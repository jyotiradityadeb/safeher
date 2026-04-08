from pydantic import BaseModel


class DemoAlertRequest(BaseModel):
    gesture_label: str = "distress_swipe"
    confidence: float = 0.96
    latitude: float = 28.6139
    longitude: float = 77.2090
