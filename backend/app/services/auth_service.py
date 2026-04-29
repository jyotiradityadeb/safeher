from datetime import datetime, timezone

from fastapi import HTTPException, status

from app.schemas.auth import LoginRequest, SignupRequest, TokenResponse
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    get_password_hash,
    verify_password,
)


class AuthService:
    def __init__(self, db):
        self.users = db["users"]

    async def signup(self, payload: SignupRequest) -> TokenResponse:
        existing = await self.users.find_one({"email": payload.email})
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered.")

        now = datetime.now(timezone.utc)
        user = {
            "full_name": payload.full_name,
            "email": payload.email,
            "password_hash": get_password_hash(payload.password),
            "phone_number": payload.phone_number,
            "is_admin": False,
            "created_at": now,
            "updated_at": now,
        }
        result = await self.users.insert_one(user)
        user_id = str(result.inserted_id)
        access_token = create_access_token(user_id)
        refresh_token = create_refresh_token(user_id)
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user={
                "id": user_id,
                "full_name": payload.full_name,
                "email": payload.email,
                "phone_number": payload.phone_number,
                "is_admin": False,
            },
        )

    async def login(self, payload: LoginRequest) -> TokenResponse:
        user = await self.users.find_one({"email": payload.email})
        if not user or not verify_password(payload.password, user["password_hash"]):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials.")

        user_id = str(user["_id"])
        access_token = create_access_token(user_id)
        refresh_token = create_refresh_token(user_id)
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user={
                "id": user_id,
                "full_name": user["full_name"],
                "email": user["email"],
                "phone_number": user["phone_number"],
                "is_admin": user.get("is_admin", False),
            },
        )
