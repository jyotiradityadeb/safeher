from datetime import datetime, timezone

import pytest

from app.schemas.alert import AlertCreate, GestureFeaturePayload, LocationPayload
from app.services.alert_service import AlertService

from .conftest import seeded_db


@pytest.mark.asyncio
async def test_create_alert_serializes_and_persists(monkeypatch):
    db, user_id = seeded_db()
    service = AlertService(db)

    async def fake_dispatch_alert(contacts, alert, user=None):
        return [{"contact": contact["name"], "status": "simulated"} for contact in contacts]

    async def fake_push_results(devices, alert):
        return [{"token": "expo-token", "status": "simulated"}]

    async def fake_broadcast(message):
        return None

    monkeypatch.setattr(service.notification_service, "dispatch_alert", fake_dispatch_alert)
    monkeypatch.setattr(service.push_service, "send_alert_notification", fake_push_results)
    monkeypatch.setattr("app.services.alert_service.realtime_manager.broadcast", fake_broadcast)

    alert = await service.create_alert(
        user_id,
        AlertCreate(
            gesture_label="distress_swipe",
            confidence=0.95,
            location=LocationPayload(latitude=12.34, longitude=56.78, accuracy=5),
            features=GestureFeaturePayload(
                coordinates=[[0, 0], [1, 1]],
                duration_ms=800,
                average_speed=0.4,
                max_speed=1.2,
                total_distance=300,
                direction_changes=4,
            ),
            triggered_at=datetime.now(timezone.utc),
        ),
    )

    assert alert["gesture_label"] == "distress_swipe"
    assert alert["delivery_results"][0]["status"] == "simulated"
    assert alert["trusted_circle_room"]["status"] == "active"
    assert alert["trusted_circle_room"]["public_link"]
    assert "map_link" in alert


@pytest.mark.asyncio
async def test_need_help_reuses_live_room_and_updates_timeline(monkeypatch):
    db, user_id = seeded_db()
    service = AlertService(db)

    async def fake_dispatch_alert(contacts, alert, user=None):
        return [{"contact": contact["name"], "status": "simulated"} for contact in contacts]

    async def fake_push_results(devices, alert):
        return [{"token": "expo-token", "status": "simulated"}]

    async def fake_broadcast(message):
        return None

    monkeypatch.setattr(service.notification_service, "dispatch_alert", fake_dispatch_alert)
    monkeypatch.setattr(service.push_service, "send_alert_notification", fake_push_results)
    monkeypatch.setattr("app.services.alert_service.realtime_manager.broadcast", fake_broadcast)

    first = await service.create_alert(
        user_id,
        AlertCreate(
            gesture_label="distress_swipe",
            confidence=0.95,
            location=LocationPayload(latitude=12.34, longitude=56.78, accuracy=5),
            features=GestureFeaturePayload(
                coordinates=[[0, 0], [1, 1]],
                duration_ms=800,
                average_speed=0.4,
                max_speed=1.2,
                total_distance=300,
                direction_changes=4,
            ),
            triggered_at=datetime.now(timezone.utc),
        ),
    )
    second = await service.create_alert(
        user_id,
        AlertCreate(
            gesture_label="manual_need_help",
            confidence=0.99,
            location=LocationPayload(latitude=12.35, longitude=56.79, accuracy=5),
            features=GestureFeaturePayload(
                coordinates=[[0, 0], [2, 2]],
                duration_ms=700,
                average_speed=0.5,
                max_speed=1.3,
                total_distance=310,
                direction_changes=5,
            ),
            triggered_at=datetime.now(timezone.utc),
        ),
    )

    assert first["trusted_circle_room"]["id"] == second["trusted_circle_room"]["id"]
    assert any(
        "Need-help escalation triggered." in item.get("message", "")
        for item in second["trusted_circle_room"]["timeline"]
    )
    assert len(db["locations"].documents) >= 2
