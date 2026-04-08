from datetime import datetime
from typing import Any, List

from pydantic import BaseModel, Field


class LocationPayload(BaseModel):
    latitude: float
    longitude: float
    accuracy: float | None = None


class GestureFeaturePayload(BaseModel):
    coordinates: List[List[float]]
    duration_ms: float
    average_speed: float
    max_speed: float
    total_distance: float
    direction_changes: int


class AlertCreate(BaseModel):
    gesture_label: str
    confidence: float = Field(ge=0.0, le=1.0)
    location: LocationPayload
    features: GestureFeaturePayload
    metadata: dict[str, Any] | None = None
    triggered_at: datetime
