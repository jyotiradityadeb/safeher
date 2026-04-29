from datetime import datetime, timezone

from app.schemas.location import LocationUpdateCreate


class LocationService:
    def __init__(self, db):
        self.locations = db["locations"]
        self.live_rooms = db["live_rooms"]

    async def record_location(self, user_id: str, payload: LocationUpdateCreate) -> dict:
        document = payload.model_dump()
        document.update({"user_id": user_id, "created_at": datetime.now(timezone.utc)})
        result = await self.locations.insert_one(document)
        document["id"] = str(result.inserted_id)
        await self._broadcast_location_into_live_room(user_id, payload)
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

    async def _broadcast_location_into_live_room(self, user_id: str, payload: LocationUpdateCreate) -> None:
        room = await self.live_rooms.find_one(
            {"user_id": user_id, "status": "active"},
            sort=[("updated_at", -1)],
        )
        if not room:
            return

        last_broadcast = room.get("last_location_broadcast_at")
        now = datetime.now(timezone.utc)
        if last_broadcast and (now - last_broadcast).total_seconds() < 25:
            return

        timeline = list(room.get("timeline", []))
        timeline.append(
            {
                "type": "location_update",
                "message": (
                    f"Live location updated to {payload.latitude:.5f}, {payload.longitude:.5f}"
                ),
                "created_at": now,
                "latitude": payload.latitude,
                "longitude": payload.longitude,
                "accuracy": payload.accuracy,
            }
        )
        await self.live_rooms.update_one(
            {"_id": room["_id"]},
            {
                "$set": {
                    "timeline": timeline,
                    "updated_at": now,
                    "last_location_broadcast_at": now,
                }
            },
        )
