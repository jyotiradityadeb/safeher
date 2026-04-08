from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import get_settings
from app.utils.security import get_password_hash


class Database:
    client: AsyncIOMotorClient | None = None
    db: AsyncIOMotorDatabase | "InMemoryDatabase" | None = None


class InMemoryInsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class InMemoryDeleteResult:
    def __init__(self, deleted_count):
        self.deleted_count = deleted_count


class InMemoryCursor:
    def __init__(self, documents):
        self.documents = list(documents)

    def sort(self, key, direction):
        self.documents.sort(key=lambda item: item.get(key), reverse=direction == -1)
        return self

    async def to_list(self, length=100):
        return self.documents[:length]


class InMemoryCollection:
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
        return InMemoryInsertResult(stored["_id"])

    async def insert_many(self, documents):
        results = []
        for document in documents:
            result = await self.insert_one(document)
            results.append(result.inserted_id)
        return results

    async def update_one(self, query, update, upsert=False):
        existing = await self.find_one(query)
        if existing:
            for key, value in update.get("$set", {}).items():
                existing[key] = value
            return
        if upsert:
            document = dict(query)
            document.update(update.get("$setOnInsert", {}))
            document.update(update.get("$set", {}))
            await self.insert_one(document)

    async def delete_one(self, query):
        for index, document in enumerate(self.documents):
            if _matches(document, query):
                self.documents.pop(index)
                return InMemoryDeleteResult(1)
        return InMemoryDeleteResult(0)

    def find(self, query=None):
        query = query or {}
        return InMemoryCursor([document for document in self.documents if _matches(document, query)])


class InMemoryDatabase(dict):
    def __getitem__(self, name):
        if name not in self:
            self[name] = InMemoryCollection()
        return dict.__getitem__(self, name)


def _matches(document, query):
    for key, expected in query.items():
        actual = document.get(key)
        if isinstance(expected, dict) and "$in" in expected:
            candidates = expected["$in"]
            normalized_actual = str(actual) if isinstance(actual, ObjectId) else actual
            normalized_candidates = [str(candidate) if isinstance(candidate, ObjectId) else candidate for candidate in candidates]
            if normalized_actual not in normalized_candidates:
                return False
        elif isinstance(expected, ObjectId) and isinstance(actual, str):
            if actual != str(expected):
                return False
        elif actual != expected:
            return False
    return True


def _seed_in_memory(db: InMemoryDatabase) -> None:
    now = datetime.now(timezone.utc)
    demo_user_id = ObjectId("64b000000000000000000001")
    admin_user_id = ObjectId("64b000000000000000000002")
    db["users"] = InMemoryCollection(
        [
            {
                "_id": demo_user_id,
                "full_name": "Demo User",
                "email": "demo@safeher.app",
                "password_hash": get_password_hash("password123"),
                "phone_number": "+919999999999",
                "is_admin": False,
                "created_at": now,
                "updated_at": now,
            },
            {
                "_id": admin_user_id,
                "full_name": "SafeHer Admin",
                "email": "admin@safeher.app",
                "password_hash": get_password_hash("admin123"),
                "phone_number": "+911111111111",
                "is_admin": True,
                "created_at": now,
                "updated_at": now,
            },
        ]
    )
    db["contacts"] = InMemoryCollection()
    db["alerts"] = InMemoryCollection()
    db["model_updates"] = InMemoryCollection()
    db["global_models"] = InMemoryCollection()
    db["devices"] = InMemoryCollection()
    db["locations"] = InMemoryCollection()


database = Database()


async def connect_to_mongo() -> None:
    settings = get_settings()
    if settings.prototype_memory_db:
        database.client = None
        database.db = InMemoryDatabase()
        _seed_in_memory(database.db)
        return
    try:
        database.client = AsyncIOMotorClient(settings.mongodb_url, serverSelectionTimeoutMS=2000)
        await database.client.admin.command("ping")
        database.db = database.client[settings.mongodb_db]
    except Exception:
        database.client = None
        database.db = InMemoryDatabase()
        _seed_in_memory(database.db)


async def close_mongo_connection() -> None:
    if database.client:
        database.client.close()


def get_database() -> AsyncIOMotorDatabase:
    if database.db is None:
        raise RuntimeError("Database connection has not been initialized.")
    return database.db
