from datetime import datetime, timezone

from bson import ObjectId


class FakeInsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class FakeUpdateResult:
    def __init__(self, matched_count=1):
        self.matched_count = matched_count


class FakeDeleteResult:
    def __init__(self, deleted_count=0):
        self.deleted_count = deleted_count


class FakeCursor:
    def __init__(self, documents):
        self.documents = list(documents)

    def sort(self, key, direction):
        reverse = direction == -1
        self.documents.sort(key=lambda item: item.get(key), reverse=reverse)
        return self

    async def to_list(self, length=100):
        return self.documents[:length]


class FakeCollection:
    def __init__(self, documents=None):
        self.documents = list(documents or [])

    async def find_one(self, query=None, sort=None):
        query = query or {}
        matches = [document for document in self.documents if _matches(document, query)]
        if sort:
            key, direction = sort[0]
            matches.sort(key=lambda item: item.get(key), reverse=direction == -1)
        return matches[0] if matches else None

    async def insert_one(self, document):
        stored = dict(document)
        stored.setdefault("_id", ObjectId())
        self.documents.append(stored)
        return FakeInsertResult(stored["_id"])

    async def insert_many(self, documents):
        inserted_ids = []
        for document in documents:
            stored = dict(document)
            stored.setdefault("_id", ObjectId())
            self.documents.append(stored)
            inserted_ids.append(stored["_id"])
        return inserted_ids

    async def update_one(self, query, update, upsert=False):
        document = await self.find_one(query)
        if document:
            for key, value in update.get("$set", {}).items():
                document[key] = value
            return FakeUpdateResult()
        if upsert:
            created = dict(query)
            for key, value in update.get("$setOnInsert", {}).items():
                created[key] = value
            for key, value in update.get("$set", {}).items():
                created[key] = value
            created.setdefault("_id", ObjectId())
            self.documents.append(created)
            return FakeUpdateResult()
        return FakeUpdateResult(matched_count=0)

    async def delete_one(self, query):
        for index, document in enumerate(self.documents):
            if _matches(document, query):
                self.documents.pop(index)
                return FakeDeleteResult(deleted_count=1)
        return FakeDeleteResult(deleted_count=0)

    def find(self, query=None):
        query = query or {}
        return FakeCursor([document for document in self.documents if _matches(document, query)])


class FakeDatabase(dict):
    def __getitem__(self, item):
        if item not in self:
            self[item] = FakeCollection()
        return dict.__getitem__(self, item)


def seeded_db():
    now = datetime.now(timezone.utc)
    user_id = ObjectId()
    db = FakeDatabase()
    db["users"] = FakeCollection(
        [
            {
                "_id": user_id,
                "full_name": "Demo User",
                "email": "demo@safeher.app",
                "password_hash": "$2b$12$abcdefghijklmnopqrstuv",
                "phone_number": "+919999999999",
                "is_admin": False,
                "created_at": now,
                "updated_at": now,
            }
        ]
    )
    db["contacts"] = FakeCollection(
        [
            {
                "_id": ObjectId(),
                "user_id": str(user_id),
                "name": "Mother",
                "phone_number": "+918888888888",
                "relationship": "Mother",
                "channel": "sms",
                "created_at": now,
                "updated_at": now,
            }
        ]
    )
    return db, str(user_id)


def _matches(document, query):
    for key, expected in query.items():
        if document.get(key) != expected:
            return False
    return True
