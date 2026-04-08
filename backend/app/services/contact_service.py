from datetime import datetime, timezone

from bson import ObjectId

from app.schemas.contact import EmergencyContactCreate


class ContactService:
    def __init__(self, db):
        self.contacts = db["contacts"]

    async def add_contact(self, user_id: str, payload: EmergencyContactCreate) -> dict:
        now = datetime.now(timezone.utc)
        document = payload.model_dump()
        document["channel"] = "sms"
        document.update({"user_id": user_id, "created_at": now, "updated_at": now})
        result = await self.contacts.insert_one(document)
        document["id"] = str(result.inserted_id)
        return document

    async def list_contacts(self, user_id: str) -> list[dict]:
        contacts = await self.contacts.find({"user_id": user_id}).sort("created_at", -1).to_list(length=100)
        return [
            {
                "id": str(contact["_id"]),
                "name": contact["name"],
                "phone_number": contact["phone_number"],
                "relationship": contact["relationship"],
                "channel": "sms",
                "created_at": contact["created_at"],
                "updated_at": contact["updated_at"],
            }
            for contact in contacts
        ]

    async def remove_contact(self, user_id: str, contact_id: str) -> dict:
        query = {"user_id": user_id}
        if ObjectId.is_valid(contact_id):
            query["_id"] = ObjectId(contact_id)
        else:
            query["_id"] = contact_id
        result = await self.contacts.delete_one(query)
        if getattr(result, "deleted_count", 0) == 0:
            raise ValueError("Contact not found.")
        return {"message": "Contact removed.", "id": contact_id}
