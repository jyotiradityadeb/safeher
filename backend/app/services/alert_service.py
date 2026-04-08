from datetime import datetime, timezone
from statistics import mean

from bson import ObjectId

from app.core.config import get_settings
from app.schemas.alert import AlertCreate
from app.services.device_service import DeviceService
from app.services.notification_service import NotificationService
from app.services.push_service import PushService
from app.services.safety_service import SafetyService
from app.utils.realtime import realtime_manager


class AlertService:
    def __init__(self, db):
        self.alerts = db["alerts"]
        self.locations = db["locations"]
        self.contacts = db["contacts"]
        self.users = db["users"]
        self.db = db
        self.notification_service = NotificationService()
        self.push_service = PushService()

    async def create_alert(self, user_id: str, payload: AlertCreate, public_base_url: str | None = None) -> dict:
        settings = get_settings()
        contacts = await self.contacts.find({"user_id": user_id}).to_list(length=20)
        user = await self.users.find_one({"_id": ObjectId(user_id)})
        map_link = f"{settings.google_maps_base_url}{payload.location.latitude},{payload.location.longitude}"

        alert = {
            "user_id": user_id,
            "gesture_label": payload.gesture_label,
            "confidence": payload.confidence,
            "location": payload.location.model_dump(),
            "features": payload.features.model_dump(),
            "metadata": payload.metadata or {},
            "triggered_at": payload.triggered_at,
            "map_link": map_link,
            "status": "triggered",
            "delivery_channels": ["sms" for _ in contacts],
            "created_at": datetime.now(timezone.utc),
        }
        result = await self.alerts.insert_one(alert)
        alert["_id"] = result.inserted_id

        # Mirror alert coordinates into the live location stream so public room links
        # can keep moving even when background tracking is temporarily unavailable.
        await self.locations.insert_one(
            {
                "user_id": user_id,
                "latitude": payload.location.latitude,
                "longitude": payload.location.longitude,
                "accuracy": payload.location.accuracy,
                "speed": None,
                "recorded_at": payload.triggered_at,
                "created_at": datetime.now(timezone.utc),
            }
        )

        serialized = self._serialize(alert, user)
        live_room = await SafetyService(self.db).create_live_room_for_alert(
            user_id,
            serialized,
            contacts,
            public_base_url=public_base_url,
        )
        delivery_results = await self.notification_service.dispatch_alert(
            contacts,
            {**alert, "map_link": map_link, "trusted_circle_room": live_room},
            {"full_name": user["full_name"]} if user else None,
        )
        await self.alerts.update_one(
            {"_id": result.inserted_id},
            {"$set": {"delivery_results": delivery_results}},
        )
        serialized = self._serialize({**alert, "delivery_results": delivery_results}, user)
        serialized["trusted_circle_room"] = live_room
        devices = await DeviceService(self.db).list_user_devices(user_id)
        push_results = await self.push_service.send_alert_notification(devices, serialized)
        await self.alerts.update_one(
            {"_id": result.inserted_id},
            {"$set": {"delivery_results": delivery_results, "push_results": push_results}},
        )
        serialized["push_results"] = push_results
        await realtime_manager.broadcast({"type": "alert.created", "payload": serialized})
        return serialized

    async def get_alert_history(self, user_id: str) -> list[dict]:
        alerts = await self.alerts.find({"user_id": user_id}).sort("created_at", -1).to_list(length=100)
        return [self._serialize(alert) for alert in alerts]

    async def get_admin_summary(self) -> dict:
        alerts = await self.alerts.find({}).sort("created_at", -1).to_list(length=200)
        user_ids = list({alert["user_id"] for alert in alerts})
        users = await self.users.find({"_id": {"$in": [ObjectId(user_id) for user_id in user_ids if ObjectId.is_valid(user_id)]}}).to_list(length=200)
        user_lookup = {str(user["_id"]): user for user in users}
        serialized = [self._serialize(alert, user_lookup.get(alert["user_id"])) for alert in alerts]
        confidence_values = [alert["confidence"] for alert in serialized]
        return {
            "total_alerts": len(serialized),
            "active_alerts": len([alert for alert in serialized if alert["status"] == "triggered"]),
            "avg_confidence": round(mean(confidence_values), 3) if confidence_values else 0.0,
            "recent_alerts": serialized[:20],
        }

    @staticmethod
    def _serialize(alert: dict, user: dict | None = None) -> dict:
        return {
            "id": str(alert["_id"]),
            "user_id": alert["user_id"],
            "user_name": user.get("full_name") if user else None,
            "user_email": user.get("email") if user else None,
            "gesture_label": alert["gesture_label"],
            "confidence": alert["confidence"],
            "location": alert["location"],
            "features": alert["features"],
            "triggered_at": alert["triggered_at"],
            "map_link": alert["map_link"],
            "status": alert["status"],
            "delivery_channels": alert.get("delivery_channels", []),
            "delivery_results": alert.get("delivery_results", []),
            "push_results": alert.get("push_results", []),
            "metadata": alert.get("metadata"),
        }
