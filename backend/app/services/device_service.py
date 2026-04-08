from datetime import datetime, timezone

from app.schemas.device import DeviceTokenCreate


class DeviceService:
    def __init__(self, db):
        self.devices = db["devices"]

    async def upsert_device_token(self, user_id: str, payload: DeviceTokenCreate) -> dict:
        document = {
            "user_id": user_id,
            "token": payload.token,
            "platform": payload.platform,
            "provider": payload.provider,
            "updated_at": datetime.now(timezone.utc),
        }
        await self.devices.update_one(
            {"user_id": user_id, "token": payload.token},
            {"$set": document, "$setOnInsert": {"created_at": datetime.now(timezone.utc)}},
            upsert=True,
        )
        return document

    async def list_user_devices(self, user_id: str) -> list[dict]:
        devices = await self.devices.find({"user_id": user_id}).to_list(length=20)
        return [
            {
                "id": str(device["_id"]),
                "token": device["token"],
                "platform": device["platform"],
                "provider": device["provider"],
                "updated_at": device["updated_at"],
            }
            for device in devices
        ]
