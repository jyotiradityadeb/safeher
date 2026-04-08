from pydantic import BaseModel, Field


class DeviceTokenCreate(BaseModel):
    token: str = Field(min_length=10)
    platform: str = Field(default="android")
    provider: str = Field(default="expo")
