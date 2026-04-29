import pytest

from app.schemas.auth import LoginRequest, SignupRequest
from app.services.auth_service import AuthService

from .conftest import FakeDatabase


@pytest.mark.asyncio
async def test_signup_creates_user_and_token(monkeypatch):
    db = FakeDatabase()
    service = AuthService(db)
    monkeypatch.setattr("app.services.auth_service.get_password_hash", lambda password: "hashed-secret")

    response = await service.signup(
        SignupRequest(
            full_name="Alice",
            email="alice@example.com",
            password="secret123",
            phone_number="+911234567890",
        )
    )

    assert response.access_token
    assert response.refresh_token
    assert response.user["email"] == "alice@example.com"
    assert len(db["users"].documents) == 1


@pytest.mark.asyncio
async def test_login_returns_existing_user(monkeypatch):
    db = FakeDatabase()
    db["users"].documents.append(
        {
            "_id": "user-1",
            "full_name": "Alice",
            "email": "alice@example.com",
            "password_hash": "hashed",
            "phone_number": "+911234567890",
        }
    )
    monkeypatch.setattr("app.services.auth_service.verify_password", lambda plain, hashed: True)
    service = AuthService(db)

    response = await service.login(LoginRequest(email="alice@example.com", password="secret123"))

    assert response.user["id"] == "user-1"
    assert response.access_token
    assert response.refresh_token
