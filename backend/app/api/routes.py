from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request

from app.api.deps import get_current_admin, get_current_user
from app.core.config import get_settings
from app.db.database import get_database
from app.schemas.alert import AlertCreate
from app.schemas.auth import LoginRequest, SignupRequest
from app.schemas.contact import EmergencyContactCreate
from app.schemas.demo import DemoAlertRequest
from app.schemas.device import DeviceTokenCreate
from app.schemas.federated import ModelUpdateCreate
from app.schemas.location import LocationUpdateCreate
from app.schemas.safety import (
    CheckInAckCreate,
    CheckInRequestCreate,
    LiveRoomAckCreate,
    LiveRoomNoteCreate,
)
from app.services.alert_service import AlertService
from app.services.auth_service import AuthService
from app.services.contact_service import ContactService
from app.services.device_service import DeviceService
from app.services.federated_service import FederatedService
from app.services.location_service import LocationService
from app.services.safety_service import SafetyService

router = APIRouter()
settings = get_settings()


@router.get("/health")
async def health_check():
    return {"status": "ok"}


@router.get("/system/status")
async def system_status(user=Depends(get_current_user)):
    sms_backend_configured = bool(
        settings.twilio_account_sid
        and settings.twilio_auth_token
        and settings.twilio_phone_number
    )
    return {
        "status": "ok",
        "sms_backend": "configured" if sms_backend_configured else "simulated",
        "sms_backend_configured": sms_backend_configured,
    }


@router.post("/auth/signup")
async def signup(payload: SignupRequest, db=Depends(get_database)):
    return await AuthService(db).signup(payload)


@router.post("/auth/login")
async def login(payload: LoginRequest, db=Depends(get_database)):
    return await AuthService(db).login(payload)


@router.get("/me")
async def get_profile(user=Depends(get_current_user)):
    return user


@router.post("/contacts")
async def add_contact(
    payload: EmergencyContactCreate,
    user=Depends(get_current_user),
    db=Depends(get_database),
):
    return await ContactService(db).add_contact(user["id"], payload)


@router.get("/contacts")
async def list_contacts(user=Depends(get_current_user), db=Depends(get_database)):
    return await ContactService(db).list_contacts(user["id"])


@router.delete("/contacts/{contact_id}")
async def remove_contact(contact_id: str, user=Depends(get_current_user), db=Depends(get_database)):
    try:
        return await ContactService(db).remove_contact(user["id"], contact_id)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post("/devices")
async def register_device(
    payload: DeviceTokenCreate,
    user=Depends(get_current_user),
    db=Depends(get_database),
):
    return await DeviceService(db).upsert_device_token(user["id"], payload)


@router.get("/devices")
async def list_devices(user=Depends(get_current_user), db=Depends(get_database)):
    return await DeviceService(db).list_user_devices(user["id"])


@router.post("/alerts")
async def create_alert(
    payload: AlertCreate,
    request: Request,
    user=Depends(get_current_user),
    db=Depends(get_database),
):
    request_base_url = str(request.base_url).rstrip("/")
    hostname = (urlparse(request_base_url).hostname or "").lower()
    if hostname in {"127.0.0.1", "localhost", "::1"}:
        public_base_url = settings.public_room_base_url.rstrip("/")
    else:
        public_base_url = request_base_url
    return await AlertService(db).create_alert(user["id"], payload, public_base_url=public_base_url)


@router.get("/alerts/history")
async def get_alert_history(user=Depends(get_current_user), db=Depends(get_database)):
    return await AlertService(db).get_alert_history(user["id"])


@router.post("/locations")
async def post_location(
    payload: LocationUpdateCreate,
    user=Depends(get_current_user),
    db=Depends(get_database),
):
    return await LocationService(db).record_location(user["id"], payload)


@router.get("/locations/latest")
async def get_latest_location(user=Depends(get_current_user), db=Depends(get_database)):
    return await LocationService(db).latest_location(user["id"])


@router.get("/safety/live-room/latest")
async def get_latest_live_room(user=Depends(get_current_user), db=Depends(get_database)):
    return await SafetyService(db).get_latest_live_room(user["id"])


@router.get("/public/live-room/{access_token}")
async def get_public_live_room(access_token: str, db=Depends(get_database)):
    room = await SafetyService(db).get_public_live_room(access_token)
    if room is None:
        raise HTTPException(status_code=404, detail="Live room not found.")
    return room


@router.post("/public/live-room/{access_token}/ack")
async def acknowledge_public_live_room(
    access_token: str,
    payload: LiveRoomAckCreate,
    db=Depends(get_database),
):
    try:
        return await SafetyService(db).acknowledge_public_live_room(access_token, payload.contact_name)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post("/safety/live-room/{room_id}/notes")
async def add_live_room_note(
    room_id: str,
    payload: LiveRoomNoteCreate,
    user=Depends(get_current_user),
    db=Depends(get_database),
):
    try:
        return await SafetyService(db).add_live_room_note(user["id"], room_id, payload.message)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.post("/safety/check-ins/request")
async def request_check_in(
    payload: CheckInRequestCreate,
    user=Depends(get_current_user),
    db=Depends(get_database),
):
    return await SafetyService(db).request_check_in(
        user["id"], payload.reason, payload.due_in_seconds
    )


@router.get("/safety/check-ins/latest")
async def get_latest_check_in(user=Depends(get_current_user), db=Depends(get_database)):
    return await SafetyService(db).get_latest_check_in(user["id"])


@router.post("/safety/check-ins/{check_in_id}/ack")
async def acknowledge_check_in(
    check_in_id: str,
    payload: CheckInAckCreate,
    user=Depends(get_current_user),
    db=Depends(get_database),
):
    try:
        return await SafetyService(db).acknowledge_check_in(
            user["id"], check_in_id, payload.status, payload.note
        )
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@router.get("/admin/summary")
async def get_admin_summary(user=Depends(get_current_admin), db=Depends(get_database)):
    return await AlertService(db).get_admin_summary()


@router.post("/federated/updates")
async def submit_model_update(payload: ModelUpdateCreate, db=Depends(get_database)):
    return await FederatedService(db).submit_update(payload)


@router.post("/federated/aggregate/{round_id}")
async def aggregate_round(round_id: int, user=Depends(get_current_admin), db=Depends(get_database)):
    return await FederatedService(db).aggregate_round(round_id)


@router.get("/federated/model/latest")
async def get_latest_model(user=Depends(get_current_admin), db=Depends(get_database)):
    return await FederatedService(db).get_latest_model()


@router.get("/federated/model/latest/public")
async def get_latest_public_model(user=Depends(get_current_user), db=Depends(get_database)):
    return await FederatedService(db).get_latest_model()


@router.post("/federated/device-round")
async def simulate_device_round(user=Depends(get_current_user), db=Depends(get_database)):
    return await FederatedService(db).simulate_device_round(user["id"])


@router.post("/demo/trigger-alert")
async def trigger_demo_alert(
    payload: DemoAlertRequest,
    user=Depends(get_current_admin),
    db=Depends(get_database),
):
    demo_user = await db["users"].find_one({"email": "demo@safeher.app"})
    if not demo_user:
        return {"message": "Demo user not found. Run the seed script first."}

    alert = await AlertService(db).create_alert(
        str(demo_user["_id"]),
        AlertCreate(
            gesture_label=payload.gesture_label,
            confidence=payload.confidence,
            location={
                "latitude": payload.latitude,
                "longitude": payload.longitude,
                "accuracy": 10,
            },
            features={
                "coordinates": [[0, 0], [30, 25], [10, 50], [40, 80]],
                "duration_ms": 920,
                "average_speed": 0.58,
                "max_speed": 1.41,
                "total_distance": 332,
                "direction_changes": 4,
            },
            triggered_at=datetime.now(timezone.utc),
        ),
    )
    return {"message": "Demo alert created.", "alert": alert}


@router.post("/demo/seed-model")
async def seed_demo_model(user=Depends(get_current_admin), db=Depends(get_database)):
    service = FederatedService(db)

    await service.submit_update(
        ModelUpdateCreate(
            user_id="demo-device-1",
            round_id=1,
            sample_count=24,
            metrics={"accuracy": 0.91, "loss": 0.22},
            weights=[0.11, 0.23, 0.38, 0.52],
            submitted_at=datetime.now(timezone.utc),
        )
    )
    await service.submit_update(
        ModelUpdateCreate(
            user_id="demo-device-2",
            round_id=1,
            sample_count=18,
            metrics={"accuracy": 0.88, "loss": 0.27},
            weights=[0.15, 0.20, 0.35, 0.57],
            submitted_at=datetime.now(timezone.utc),
        )
    )
    summary = await service.aggregate_round(1)
    return {"message": "Demo federated round seeded.", "model": summary}
