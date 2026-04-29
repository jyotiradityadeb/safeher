from typing import Any

from app.core.config import get_settings

try:
    from twilio.rest import Client
except Exception:
    Client = None


class NotificationService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.enabled = all(
            [
                self.settings.twilio_account_sid,
                self.settings.twilio_auth_token,
                self.settings.twilio_phone_number,
                Client is not None,
            ]
        )
        self.client = (
            Client(self.settings.twilio_account_sid, self.settings.twilio_auth_token)
            if self.enabled
            else None
        )

    async def dispatch_alert(self, contacts: list[dict], alert: dict, user: dict | None = None) -> list[dict]:
        results: list[dict] = []
        for contact in contacts:
            channel = (contact.get("channel") or "sms").lower()
            destination = contact.get("phone_number")
            body = self._build_message(alert, user)
            if self.enabled and self.client:
                sender = self.settings.twilio_phone_number
                target = destination
                if channel == "whatsapp":
                    sender = self.settings.twilio_whatsapp_number or self.settings.twilio_phone_number
                    target = f"whatsapp:{destination}"
                    if not str(sender).startswith("whatsapp:"):
                        sender = f"whatsapp:{sender}"
                try:
                    message = self.client.messages.create(body=body, from_=sender, to=target)
                    results.append(
                        {
                            "contact": contact.get("name"),
                            "channel": channel,
                            "status": "sent",
                            "provider_sid": message.sid,
                        }
                    )
                except Exception as exc:
                    results.append(
                        {
                            "contact": contact.get("name"),
                            "channel": channel,
                            "status": "failed",
                            "error": str(exc),
                        }
                    )
                    if channel == "sms":
                        whatsapp_fallback = await self._send_whatsapp_fallback(destination, body, contact)
                        if whatsapp_fallback:
                            results.append(whatsapp_fallback)
            else:
                results.append(
                    {
                        "contact": contact.get("name"),
                        "channel": channel,
                        "status": "simulated",
                        "reason": "Twilio credentials are not configured on backend.",
                        "preview": body,
                    }
                )
        return results

    async def _send_whatsapp_fallback(self, destination: str, body: str, contact: dict) -> dict | None:
        if not self.enabled or not self.client or not self.settings.twilio_whatsapp_number:
            return None
        sender = self.settings.twilio_whatsapp_number
        if not sender.startswith("whatsapp:"):
            sender = f"whatsapp:{sender}"
        target = f"whatsapp:{destination}"
        try:
            message = self.client.messages.create(body=body, from_=sender, to=target)
            return {
                "contact": contact.get("name"),
                "channel": "whatsapp_fallback",
                "status": "sent",
                "provider_sid": message.sid,
            }
        except Exception as exc:
            return {
                "contact": contact.get("name"),
                "channel": "whatsapp_fallback",
                "status": "failed",
                "error": str(exc),
            }

    def _build_message(self, alert: dict, user: dict | None) -> str:
        user_label = user["full_name"] if user else alert["user_id"]
        metadata = alert.get("metadata") or {}
        source = metadata.get("source")
        room = alert.get("trusted_circle_room") or {}
        room_code = room.get("room_code")
        public_link = room.get("public_link")

        if source == "smart_checkin_timeout" or alert.get("gesture_label") == "smart_checkin_missed":
            summary = "Smart check-in missed. User did not confirm safety in time."
        else:
            summary = f"Distress gesture detected: {alert['gesture_label']}."

        room_text = f" Trusted circle room: {room_code}." if room_code else ""
        link_text = f" Live updates: {public_link}." if public_link else ""
        return (
            f"SAFEHER ALERT for {user_label}. "
            f"{summary} "
            f"Time: {alert['triggered_at']}. "
            f"Live location: {alert['map_link']}. "
            f"Please call now and stay connected until confirmed safe.{room_text}{link_text}"
        )
