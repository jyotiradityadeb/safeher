from datetime import datetime
from typing import List

from pydantic import BaseModel, Field


class ModelUpdateCreate(BaseModel):
    user_id: str
    round_id: int
    sample_count: int = Field(gt=0)
    metrics: dict
    weights: List[float]
    submitted_at: datetime
