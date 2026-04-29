from datetime import datetime

from pydantic import BaseModel, Field


class LocationUpdateCreate(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy: float | None = Field(default=None, ge=0)
    speed: float | None = None
    recorded_at: datetime
