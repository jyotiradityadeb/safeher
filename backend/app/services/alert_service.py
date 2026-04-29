from datetime import datetime, timezone
from pathlib import Path
from statistics import mean

from bson import ObjectId
from fastapi import UploadFile

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
        self.evidence_dir = Path(__file__).resolve().parents[2] / "data" / "evidence"

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

    async def mark_alert_status(self, user_id: str, alert_id: str, status: str) -> dict:
        if status not in {"resolved", "cancelled"}:
            raise ValueError("Unsupported alert status.")
        if not ObjectId.is_valid(alert_id):
            raise ValueError("Alert not found.")
        existing = await self.alerts.find_one({"_id": ObjectId(alert_id), "user_id": user_id})
        if not existing:
            raise ValueError("Alert not found.")

        now = datetime.now(timezone.utc)
        await self.alerts.update_one(
            {"_id": ObjectId(alert_id)},
            {"$set": {"status": status, "resolved_at": now}},
        )
        existing["status"] = status
        existing["resolved_at"] = now
        serialized = self._serialize(existing)
        await realtime_manager.broadcast({"type": "alert.status_changed", "payload": serialized})
        return serialized

    async def attach_audio_evidence(self, user_id: str, alert_id: str, audio_file: UploadFile) -> dict:
        if not ObjectId.is_valid(alert_id):
            raise ValueError("Alert not found.")
        alert = await self.alerts.find_one({"_id": ObjectId(alert_id), "user_id": user_id})
        if not alert:
            raise ValueError("Alert not found.")

        suffix = Path(audio_file.filename or "alert-audio.m4a").suffix or ".m4a"
        safe_suffix = suffix if len(suffix) <= 10 else ".m4a"
        filename = f"{alert_id}-{int(datetime.now(timezone.utc).timestamp())}{safe_suffix}"
        self.evidence_dir.mkdir(parents=True, exist_ok=True)
        target = self.evidence_dir / filename
        content = await audio_file.read()
        target.write_bytes(content)
        evidence_url = f"/evidence/{filename}"

        await self.alerts.update_one(
            {"_id": ObjectId(alert_id)},
            {
                "$set": {
                    "audio_evidence": {
                        "filename": filename,
                        "content_type": audio_file.content_type,
                        "size_bytes": len(content),
                        "uploaded_at": datetime.now(timezone.utc),
                        "url": evidence_url,
                    }
                }
            },
        )
        return {"alert_id": alert_id, "audio_evidence_url": evidence_url}

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
            "audio_evidence": alert.get("audio_evidence"),
        }
