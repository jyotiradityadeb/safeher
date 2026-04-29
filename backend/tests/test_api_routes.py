from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.deps import get_current_user
from app.api.routes import router
from app.db.database import get_database
from .conftest import FakeCollection, FakeDatabase, seeded_db


def create_test_client(db, user=None):
    app = FastAPI()
    app.include_router(router, prefix="/api")
    app.dependency_overrides[get_database] = lambda: db
    if user is not None:
        app.dependency_overrides[get_current_user] = lambda: user
    return TestClient(app)


def test_health_route_returns_ok():
    client = create_test_client(FakeDatabase())

    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_signup_route_creates_user(monkeypatch):
    db = FakeDatabase()
    client = create_test_client(db)
    monkeypatch.setattr("app.services.auth_service.get_password_hash", lambda password: "hashed-secret")

    response = client.post(
        "/api/auth/signup",
        json={
            "full_name": "Alice",
            "email": "alice@example.com",
            "password": "secret123",
            "phone_number": "+911234567890",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["user"]["email"] == "alice@example.com"
    assert payload["access_token"]
    assert payload["refresh_token"]


def test_login_route_returns_token_for_existing_user(monkeypatch):
    db = FakeDatabase()
    monkeypatch.setattr("app.services.auth_service.verify_password", lambda plain, hashed: True)
    db["users"] = FakeCollection(
        [
            {
                "_id": "user-1",
                "full_name": "Alice",
                "email": "alice@example.com",
                "password_hash": "hashed-secret",
                "phone_number": "+911234567890",
                "is_admin": True,
            }
        ]
    )
    client = create_test_client(db)

    response = client.post(
        "/api/auth/login",
        json={
            "email": "alice@example.com",
            "password": "secret123",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["user"]["id"] == "user-1"
    assert payload["access_token"]
    assert payload["refresh_token"]
    assert payload["user"]["is_admin"] is True


def test_contacts_routes_list_and_create_contacts():
    db, user_id = seeded_db()
    user = {
        "id": user_id,
        "email": "demo@safeher.app",
        "full_name": "Demo User",
        "phone_number": "+919999999999",
    }
    client = create_test_client(db, user=user)

    create_response = client.post(
        "/api/contacts",
        json={
            "name": "Sister",
            "phone_number": "+916666666666",
            "relationship": "Sister",
            "channel": "sms",
        },
    )
    list_response = client.get("/api/contacts")

    assert create_response.status_code == 200
    assert list_response.status_code == 200
    contacts = list_response.json()
    assert len(contacts) == 2
    assert any(contact["name"] == "Sister" for contact in contacts)

    contact_id = next(contact["id"] for contact in contacts if contact["name"] == "Sister")
    delete_response = client.delete(f"/api/contacts/{contact_id}")
    assert delete_response.status_code == 200
    assert delete_response.json()["id"] == contact_id


def test_alert_route_creates_alert_history_entry(monkeypatch):
    db, user_id = seeded_db()
    user = {
        "id": user_id,
        "email": "demo@safeher.app",
        "full_name": "Demo User",
        "phone_number": "+919999999999",
    }
    client = create_test_client(db, user=user)

    async def fake_post_alert(*args, **kwargs):
        return [{"contact": "Mother", "status": "simulated"}]

    async def fake_push(*args, **kwargs):
        return [{"token": "expo-token", "status": "simulated"}]

    async def fake_broadcast(*args, **kwargs):
        return None

    monkeypatch.setattr(
        "app.services.notification_service.NotificationService.dispatch_alert",
        fake_post_alert,
    )
    monkeypatch.setattr(
        "app.services.push_service.PushService.send_alert_notification",
        fake_push,
    )
    monkeypatch.setattr("app.services.alert_service.realtime_manager.broadcast", fake_broadcast)

    response = client.post(
        "/api/alerts",
        json={
            "gesture_label": "distress_swipe",
            "confidence": 0.94,
            "location": {
                "latitude": 12.34,
                "longitude": 56.78,
                "accuracy": 5,
            },
            "features": {
                "coordinates": [[0, 0], [1, 1]],
                "duration_ms": 900,
                "average_speed": 0.4,
                "max_speed": 1.1,
                "total_distance": 280,
                "direction_changes": 4,
            },
            "triggered_at": datetime.now(timezone.utc).isoformat(),
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["gesture_label"] == "distress_swipe"
    assert payload["delivery_results"][0]["status"] == "simulated"
    assert payload["trusted_circle_room"]["status"] == "active"

    history_response = client.get("/api/alerts/history")
    assert history_response.status_code == 200
    assert len(history_response.json()) == 1

    alert_id = payload["id"]
    resolve_response = client.patch(f"/api/alerts/{alert_id}/resolve")
    assert resolve_response.status_code == 200
    assert resolve_response.json()["status"] == "resolved"


def test_federated_routes_submit_and_aggregate():
    db = FakeDatabase()
    client = create_test_client(db, user={"id": "admin-1", "is_admin": True})

    submitted = client.post(
        "/api/federated/updates",
        json={
            "user_id": "admin-1",
            "round_id": 2,
            "sample_count": 4,
            "metrics": {"accuracy": 0.9},
            "weights": [0.1, 0.2, 0.3],
            "submitted_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    aggregated = client.post("/api/federated/aggregate/2")

    assert submitted.status_code == 200
    assert aggregated.status_code == 200
    payload = aggregated.json()
    assert payload["round_id"] == 2
    assert payload["participant_count"] == 1
    assert payload["aggregated_weights"] == [0.1, 0.2, 0.3]


def test_federated_public_model_and_device_round_routes():
    db = FakeDatabase()
    client = create_test_client(
        db,
        user={
            "id": "user-1",
            "email": "demo@safeher.app",
            "full_name": "Demo User",
            "phone_number": "+919999999999",
            "is_admin": False,
        },
    )

    latest_response = client.get("/api/federated/model/latest/public")
    simulate_response = client.post("/api/federated/device-round")

    assert latest_response.status_code == 200
    assert latest_response.json()["round_id"] == 0
    assert simulate_response.status_code == 200
    payload = simulate_response.json()
    assert payload["global_model"]["round_id"] == 1
    assert payload["global_model"]["participant_count"] == 1
    assert payload["update"]["user_id"] == "user-1"


def test_admin_summary_requires_admin_role():
    db, user_id = seeded_db()
    client = create_test_client(
        db,
        user={
            "id": user_id,
            "email": "demo@safeher.app",
            "full_name": "Demo User",
            "phone_number": "+919999999999",
            "is_admin": False,
        },
    )

    response = client.get("/api/admin/summary")

    assert response.status_code == 403


def test_safety_routes_live_room_and_smart_check_in(monkeypatch):
    db, user_id = seeded_db()
    user = {
        "id": user_id,
        "email": "demo@safeher.app",
        "full_name": "Demo User",
        "phone_number": "+919999999999",
    }
    client = create_test_client(db, user=user)

    async def fake_post_alert(*args, **kwargs):
        return [{"contact": "Mother", "status": "simulated"}]

    async def fake_push(*args, **kwargs):
        return [{"token": "expo-token", "status": "simulated"}]

    async def fake_broadcast(*args, **kwargs):
        return None

    monkeypatch.setattr(
        "app.services.notification_service.NotificationService.dispatch_alert",
        fake_post_alert,
    )
    monkeypatch.setattr(
        "app.services.push_service.PushService.send_alert_notification",
        fake_push,
    )
    monkeypatch.setattr("app.services.alert_service.realtime_manager.broadcast", fake_broadcast)

    alert_response = client.post(
        "/api/alerts",
        json={
            "gesture_label": "distress_swipe",
            "confidence": 0.91,
            "location": {"latitude": 12.34, "longitude": 56.78, "accuracy": 5},
            "features": {
                "coordinates": [[0, 0], [1, 1]],
                "duration_ms": 900,
                "average_speed": 0.4,
                "max_speed": 1.1,
                "total_distance": 280,
                "direction_changes": 4,
            },
            "triggered_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    assert alert_response.status_code == 200
    room = alert_response.json()["trusted_circle_room"]

    room_response = client.get("/api/safety/live-room/latest")
    assert room_response.status_code == 200
    assert room_response.json()["id"] == room["id"]
    assert room_response.json()["public_link"]

    access_token = room_response.json()["public_link"].rstrip("/").split("/")[-1]
    public_response = client.get(f"/api/public/live-room/{access_token}")
    assert public_response.status_code == 200
    assert public_response.json()["room_code"] == room["room_code"]

    note_response = client.post(
        f"/api/safety/live-room/{room['id']}/notes",
        json={"message": "I am moving to a safer area."},
    )
    assert note_response.status_code == 200
    assert note_response.json()["timeline"][-1]["type"] == "user_note"

    checkin_request = client.post(
        "/api/safety/check-ins/request",
        json={"reason": "post_alert_confirmation", "due_in_seconds": 120},
    )
    assert checkin_request.status_code == 200
    checkin_id = checkin_request.json()["id"]

    latest_checkin = client.get("/api/safety/check-ins/latest")
    assert latest_checkin.status_code == 200
    assert latest_checkin.json()["status"] == "pending"

    checkin_ack = client.post(
        f"/api/safety/check-ins/{checkin_id}/ack",
        json={"status": "safe", "note": "User confirmed safe."},
    )
    assert checkin_ack.status_code == 200
    assert checkin_ack.json()["status"] == "safe"
