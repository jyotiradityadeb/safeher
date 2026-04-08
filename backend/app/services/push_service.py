from pathlib import Path

import requests

from app.core.config import get_settings

try:
    import firebase_admin
    from firebase_admin import credentials, messaging
except Exception:
    firebase_admin = None
    credentials = None
    messaging = None


class PushService:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.enabled = False
        if firebase_admin and self.settings.firebase_credentials_path:
            try:
                if not firebase_admin._apps:
                    cred = credentials.Certificate(Path(self.settings.firebase_credentials_path))
                    firebase_admin.initialize_app(cred)
                self.enabled = True
            except Exception:
                self.enabled = False

    async def send_alert_notification(self, devices: list[dict], alert: dict) -> list[dict]:
        results: list[dict] = []
        metadata = alert.get("metadata") or {}
        source = metadata.get("source")
        if source == "smart_checkin_timeout" or alert.get("gesture_label") == "smart_checkin_missed":
            body = "Smart check-in missed. Immediate follow-up recommended."
        else:
            body = f"Distress gesture detected: {alert['gesture_label']}"
        for device in devices:
            provider = device.get("provider", "expo")
            if provider == "expo":
                results.append(self._send_expo_push(device, alert, body))
            elif self.enabled and messaging:
                try:
                    message = messaging.Message(
                        token=device["token"],
                        notification=messaging.Notification(
                            title="SafeHer Emergency Alert",
                            body=body,
                        ),
                        data={
                            "map_link": alert["map_link"],
                            "user_id": alert["user_id"],
                            "alert_id": alert["id"],
                        },
                    )
                    response = messaging.send(message)
                    results.append({"token": device["token"], "status": "sent", "provider_id": response})
                except Exception as exc:
                    results.append({"token": device["token"], "status": "failed", "error": str(exc)})
            else:
                results.append({"token": device["token"], "status": "simulated"})
        return results

    def _send_expo_push(self, device: dict, alert: dict, body: str) -> dict:
        try:
            response = requests.post(
                self.settings.expo_push_url,
                json={
                    "to": device["token"],
                    "title": "SafeHer Emergency Alert",
                    "body": body,
                    "data": {
                        "map_link": alert["map_link"],
                        "user_id": alert["user_id"],
                        "alert_id": alert["id"],
                    },
                    "sound": "default",
                },
                timeout=10,
            )
            response.raise_for_status()
            payload = response.json()
            return {"token": device["token"], "provider": "expo", "status": "sent", "response": payload}
        except Exception as exc:
            return {"token": device["token"], "provider": "expo", "status": "failed", "error": str(exc)}
