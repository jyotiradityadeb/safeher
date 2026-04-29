from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_name: str = Field(default="SafeHer API", alias="APP_NAME")
    app_env: str = Field(default="development", alias="APP_ENV")
    secret_key: str = Field(default="change-me", alias="SECRET_KEY")
    access_token_expire_minutes: int = Field(default=1440, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(default=7, alias="REFRESH_TOKEN_EXPIRE_DAYS")
    mongodb_url: str = Field(default="mongodb://localhost:27017", alias="MONGODB_URL")
    mongodb_db: str = Field(default="safeher", alias="MONGODB_DB")
    prototype_memory_db: bool = Field(default=False, alias="PROTOTYPE_MEMORY_DB")
    allow_memory_fallback: bool = Field(default=False, alias="ALLOW_MEMORY_DB_FALLBACK")
    twilio_account_sid: str = Field(default="", alias="TWILIO_ACCOUNT_SID")
    twilio_auth_token: str = Field(default="", alias="TWILIO_AUTH_TOKEN")
    twilio_phone_number: str = Field(default="", alias="TWILIO_PHONE_NUMBER")
    twilio_whatsapp_number: str = Field(default="", alias="TWILIO_WHATSAPP_NUMBER")
    firebase_credentials_path: str = Field(default="", alias="FIREBASE_CREDENTIALS_PATH")
    expo_push_url: str = Field(default="https://exp.host/--/api/v2/push/send", alias="EXPO_PUSH_URL")
    google_maps_base_url: str = Field(default="https://maps.google.com/?q=", alias="GOOGLE_MAPS_BASE_URL")
    public_room_base_url: str = Field(default="http://127.0.0.1:8000", alias="PUBLIC_ROOM_BASE_URL")
    client_origins: str = Field(default="http://localhost:8081,http://localhost:5173", alias="CLIENT_ORIGINS")
    auth_login_max_attempts: int = Field(default=10, alias="AUTH_LOGIN_MAX_ATTEMPTS")
    auth_login_window_seconds: int = Field(default=60, alias="AUTH_LOGIN_WINDOW_SECONDS")
    alerts_create_max_attempts: int = Field(default=5, alias="ALERTS_CREATE_MAX_ATTEMPTS")
    alerts_create_window_seconds: int = Field(default=60, alias="ALERTS_CREATE_WINDOW_SECONDS")
    federated_update_max_attempts: int = Field(default=20, alias="FEDERATED_UPDATE_MAX_ATTEMPTS")
    federated_update_window_seconds: int = Field(default=60, alias="FEDERATED_UPDATE_WINDOW_SECONDS")
    demo_user_email: str = Field(default="demo@safeher.app", alias="DEMO_USER_EMAIL")
    demo_user_password: str = Field(default="password123", alias="DEMO_USER_PASSWORD")
    admin_user_email: str = Field(default="admin@safeher.app", alias="ADMIN_USER_EMAIL")
    admin_user_password: str = Field(default="admin123", alias="ADMIN_USER_PASSWORD")

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.client_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
