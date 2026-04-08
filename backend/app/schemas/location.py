from datetime import datetime

from pydantic import BaseModel


class LocationUpdateCreate(BaseModel):
    latitude: float
    longitude: float
    accuracy: float | None = None
    speed: float | None = None
    recorded_at: datetime
