import secrets
import string
from datetime import datetime, timedelta, timezone

from bson import ObjectId

from app.core.config import get_settings


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class SafetyService:
    def __init__(self, db):
        self.db = db
        self.contacts = db["contacts"]
        self.live_rooms = db["live_rooms"]
        self.check_ins = db["check_ins"]
        self.alerts = db["alerts"]
        self.locations = db["locations"]
        self.settings = get_settings()

    async def create_live_room_for_alert(
        self,
        user_id: str,
        alert: dict,
        contacts: list[dict],
        public_base_url: str | None = None,
    ) -> dict:
        existing_room = await self.live_rooms.find_one(
            {"user_id": user_id, "status": "active"},
            sort=[("updated_at", -1)],
        )
        alert_event = {
            "type": "alert_event",
            "message": self._build_alert_timeline_message(alert),
            "created_at": _utc_now(),
            "alert_id": alert.get("id"),
            "gesture_label": alert.get("gesture_label"),
        }

        if existing_room:
            base_url = (public_base_url or self.settings.public_room_base_url).rstrip("/")
            access_token = existing_room.get("room_access_token") or secrets.token_urlsafe(18)
            public_link = f"{base_url}/public/live-room/{access_token}"
            timeline = list(existing_room.get("timeline", []))
            timeline.append(alert_event)
            participants = [
                {
                    "name": contact.get("name", "Trusted contact"),
                    "phone_number": contact.get("phone_number"),
                    "relationship": contact.get("relationship"),
                    "channel": "sms",
                }
                for contact in contacts
            ]
            await self.live_rooms.update_one(
                {"_id": existing_room["_id"]},
                {
                    "$set": {
                        "alert_id": alert.get("id"),
                        "room_access_token": access_token,
                        "public_link": public_link,
                        "participants": participants,
                        "timeline": timeline,
                        "updated_at": _utc_now(),
                    }
                },
            )
            existing_room["alert_id"] = alert.get("id")
            existing_room["room_access_token"] = access_token
            existing_room["public_link"] = public_link
            existing_room["participants"] = participants
            existing_room["timeline"] = timeline
            existing_room["updated_at"] = _utc_now()
            return self._serialize_live_room(existing_room)

        access_token = secrets.token_urlsafe(18)
        base_url = (public_base_url or self.settings.public_room_base_url).rstrip("/")
        public_link = f"{base_url}/public/live-room/{access_token}"
        room = {
            "user_id": user_id,
            "alert_id": alert["id"],
            "status": "active",
            "room_code": self._generate_room_code(),
            "room_access_token": access_token,
            "public_link": public_link,
            "participants": [
                {
                    "name": contact.get("name", "Trusted contact"),
                    "phone_number": contact.get("phone_number"),
                    "relationship": contact.get("relationship"),
                    "channel": "sms",
                }
                for contact in contacts
            ],
            "receipts": [],
            "timeline": [alert_event],
            "created_at": _utc_now(),
            "updated_at": _utc_now(),
        }
        result = await self.live_rooms.insert_one(room)
        room["_id"] = result.inserted_id
        return self._serialize_live_room(room)

    async def get_public_live_room(self, access_token: str) -> dict | None:
        room = await self.live_rooms.find_one({"room_access_token": access_token, "status": "active"})
        if room is None:
            return None

        map_link = None
        live_location = None
        latest_location = await self.locations.find_one({"user_id": room["user_id"]}, sort=[("recorded_at", -1)])
        if latest_location:
            latitude = latest_location.get("latitude")
            longitude = latest_location.get("longitude")
            if latitude is not None and longitude is not None:
                map_link = f"{self.settings.google_maps_base_url}{latitude},{longitude}"
            live_location = {
                "latitude": latitude,
                "longitude": longitude,
                "accuracy": latest_location.get("accuracy"),
                "recorded_at": latest_location.get("recorded_at"),
            }

        alert_id = room.get("alert_id")
        if map_link is None and alert_id and ObjectId.is_valid(alert_id):
            alert = await self.alerts.find_one({"_id": ObjectId(alert_id)})
            if alert:
                map_link = alert.get("map_link")

        return self._serialize_public_live_room(room, map_link, live_location)

    async def acknowledge_public_live_room(self, access_token: str, contact_name: str) -> dict:
        room = await self.live_rooms.find_one({"room_access_token": access_token, "status": "active"})
        if room is None:
            raise ValueError("Live room not found.")

        cleaned_name = contact_name.strip()
        receipts = list(room.get("receipts", []))
        now = _utc_now()
        existing_index = next(
            (index for index, receipt in enumerate(receipts) if str(receipt.get("contact_name", "")).strip().lower() == cleaned_name.lower()),
            None,
        )
        receipt = {"contact_name": cleaned_name, "acknowledged_at": now}
        if existing_index is None:
            receipts.append(receipt)
        else:
            receipts[existing_index] = receipt

        timeline = list(room.get("timeline", []))
        timeline.append(
            {
                "type": "contact_ack",
                "message": f"{cleaned_name} viewed alert.",
                "created_at": now,
                "contact_name": cleaned_name,
            }
        )

        await self.live_rooms.update_one(
            {"_id": room["_id"]},
            {"$set": {"receipts": receipts, "timeline": timeline, "updated_at": now}},
        )
        refreshed = await self.get_public_live_room(access_token)
        if refreshed is None:
            raise ValueError("Live room not found.")
        return refreshed

    async def add_public_live_room_note(self, access_token: str, contact_name: str, message: str) -> dict:
        room = await self.live_rooms.find_one({"room_access_token": access_token, "status": "active"})
        if room is None:
            raise ValueError("Live room not found.")
        cleaned_name = contact_name.strip()
        cleaned_message = message.strip()
        if not cleaned_name or not cleaned_message:
            raise ValueError("Contact name and message are required.")
        now = _utc_now()
        timeline = list(room.get("timeline", []))
        timeline.append(
            {
                "type": "contact_note",
                "message": f"{cleaned_name}: {cleaned_message}",
                "created_at": now,
                "contact_name": cleaned_name,
            }
        )
        await self.live_rooms.update_one(
            {"_id": room["_id"]},
            {"$set": {"timeline": timeline, "updated_at": now}},
        )
        refreshed = await self.get_public_live_room(access_token)
        if refreshed is None:
            raise ValueError("Live room not found.")
        return refreshed

    async def get_latest_live_room(self, user_id: str) -> dict | None:
        room = await self.live_rooms.find_one({"user_id": user_id}, sort=[("updated_at", -1)])
        return self._serialize_live_room(room) if room else None

    async def add_live_room_note(self, user_id: str, room_id: str, message: str) -> dict:
        room = await self._find_room(room_id, user_id)
        if room is None:
            raise ValueError("Live room not found.")
        timeline = list(room.get("timeline", []))
        timeline.append(
            {
                "type": "user_note",
                "message": message,
                "created_at": _utc_now(),
            }
        )
        await self.live_rooms.update_one(
            {"_id": room["_id"]},
            {"$set": {"timeline": timeline, "updated_at": _utc_now()}},
        )
        room["timeline"] = timeline
        room["updated_at"] = _utc_now()
        return self._serialize_live_room(room)

    async def request_check_in(self, user_id: str, reason: str, due_in_seconds: int) -> dict:
        now = _utc_now()
        check_in = {
            "user_id": user_id,
            "reason": reason,
            "status": "pending",
            "requested_at": now,
            "due_at": now + timedelta(seconds=due_in_seconds),
            "acknowledged_at": None,
            "note": None,
        }
        result = await self.check_ins.insert_one(check_in)
        check_in["_id"] = result.inserted_id
        return self._serialize_check_in(check_in)

    async def get_latest_check_in(self, user_id: str) -> dict | None:
        check_in = await self.check_ins.find_one({"user_id": user_id}, sort=[("requested_at", -1)])
        if not check_in:
            return None
        check_in = await self._mark_missed_if_overdue(check_in)
        return self._serialize_check_in(check_in)

    async def acknowledge_check_in(self, user_id: str, check_in_id: str, status: str, note: str | None) -> dict:
        check_in = await self._find_check_in(check_in_id, user_id)
        if check_in is None:
            raise ValueError("Check-in not found.")
        check_in = await self._mark_missed_if_overdue(check_in)
        if check_in["status"] == "missed":
            return self._serialize_check_in(check_in)
        updated = {
            **check_in,
            "status": status,
            "acknowledged_at": _utc_now(),
            "note": note,
        }
        await self.check_ins.update_one(
            {"_id": check_in["_id"]},
            {
                "$set": {
                    "status": status,
                    "acknowledged_at": updated["acknowledged_at"],
                    "note": note,
                }
            },
        )
        return self._serialize_check_in(updated)

    async def _mark_missed_if_overdue(self, check_in: dict) -> dict:
        if check_in.get("status") == "pending" and check_in.get("due_at") and check_in["due_at"] < _utc_now():
            await self.check_ins.update_one({"_id": check_in["_id"]}, {"$set": {"status": "missed"}})
            check_in["status"] = "missed"
        return check_in

    @staticmethod
    def _build_alert_timeline_message(alert: dict) -> str:
        gesture_label = str(alert.get("gesture_label", "")).strip().lower()
        if gesture_label == "manual_need_help":
            return "Need-help escalation triggered."
        if gesture_label == "smart_checkin_missed":
            return "Smart check-in missed. Auto-escalation triggered."
        if gesture_label == "battery_low_fallback":
            return "Battery fallback alert triggered at critical battery level."
        return "Emergency alert triggered and trusted circle activated."

    @staticmethod
    def _generate_room_code() -> str:
        alphabet = string.ascii_uppercase + string.digits
        return "".join(secrets.choice(alphabet) for _ in range(6))

    async def _find_room(self, room_id: str, user_id: str) -> dict | None:
        if ObjectId.is_valid(room_id):
            return await self.live_rooms.find_one({"_id": ObjectId(room_id), "user_id": user_id})
        return await self.live_rooms.find_one({"_id": room_id, "user_id": user_id})

    async def _find_check_in(self, check_in_id: str, user_id: str) -> dict | None:
        if ObjectId.is_valid(check_in_id):
            return await self.check_ins.find_one({"_id": ObjectId(check_in_id), "user_id": user_id})
        return await self.check_ins.find_one({"_id": check_in_id, "user_id": user_id})

    @staticmethod
    def _serialize_live_room(room: dict) -> dict:
        return {
            "id": str(room["_id"]),
            "user_id": room["user_id"],
            "alert_id": room.get("alert_id"),
            "status": room["status"],
            "room_code": room["room_code"],
            "public_link": room.get("public_link"),
            "participants": room.get("participants", []),
            "receipts": room.get("receipts", []),
            "timeline": room.get("timeline", []),
            "created_at": room["created_at"],
            "updated_at": room["updated_at"],
        }

    @staticmethod
    def _serialize_public_live_room(room: dict, map_link: str | None, live_location: dict | None) -> dict:
        return {
            "room_code": room.get("room_code"),
            "status": room.get("status"),
            "participants": [
                {
                    "name": participant.get("name"),
                    "relationship": participant.get("relationship"),
                }
                for participant in room.get("participants", [])
            ],
            "receipts": room.get("receipts", []),
            "timeline": room.get("timeline", []),
            "map_link": map_link,
            "live_location": live_location,
            "updated_at": room.get("updated_at"),
        }

    @staticmethod
    def _serialize_check_in(check_in: dict) -> dict:
        return {
            "id": str(check_in["_id"]),
            "user_id": check_in["user_id"],
            "reason": check_in["reason"],
            "status": check_in["status"],
            "requested_at": check_in["requested_at"],
            "due_at": check_in["due_at"],
            "acknowledged_at": check_in.get("acknowledged_at"),
            "note": check_in.get("note"),
        }
