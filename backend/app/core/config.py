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
    mongodb_url: str = Field(default="mongodb://localhost:27017", alias="MONGODB_URL")
    mongodb_db: str = Field(default="safeher", alias="MONGODB_DB")
    prototype_memory_db: bool = Field(default=False, alias="PROTOTYPE_MEMORY_DB")
    twilio_account_sid: str = Field(default="", alias="TWILIO_ACCOUNT_SID")
    twilio_auth_token: str = Field(default="", alias="TWILIO_AUTH_TOKEN")
    twilio_phone_number: str = Field(default="", alias="TWILIO_PHONE_NUMBER")
    firebase_credentials_path: str = Field(default="", alias="FIREBASE_CREDENTIALS_PATH")
    expo_push_url: str = Field(default="https://exp.host/--/api/v2/push/send", alias="EXPO_PUSH_URL")
    google_maps_base_url: str = Field(default="https://maps.google.com/?q=", alias="GOOGLE_MAPS_BASE_URL")
    public_room_base_url: str = Field(default="http://127.0.0.1:8000", alias="PUBLIC_ROOM_BASE_URL")
    client_origins: str = Field(default="http://localhost:8081,http://localhost:5173", alias="CLIENT_ORIGINS")

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.client_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
