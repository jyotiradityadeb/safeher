from datetime import datetime, timezone

from app.schemas.location import LocationUpdateCreate


class LocationService:
    def __init__(self, db):
        self.locations = db["locations"]

    async def record_location(self, user_id: str, payload: LocationUpdateCreate) -> dict:
        document = payload.model_dump()
        document.update({"user_id": user_id, "created_at": datetime.now(timezone.utc)})
        result = await self.locations.insert_one(document)
        document["id"] = str(result.inserted_id)
        return document

    async def latest_location(self, user_id: str) -> dict | None:
        location = await self.locations.find_one({"user_id": user_id}, sort=[("recorded_at", -1)])
        if not location:
            return None
        return {
            "id": str(location["_id"]),
            "user_id": location["user_id"],
            "latitude": location["latitude"],
            "longitude": location["longitude"],
            "accuracy": location.get("accuracy"),
            "speed": location.get("speed"),
            "recorded_at": location["recorded_at"],
        }
