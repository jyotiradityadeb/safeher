from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class LiveRoomNoteCreate(BaseModel):
    message: str = Field(min_length=2, max_length=280)


class LiveRoomAckCreate(BaseModel):
    contact_name: str = Field(min_length=2, max_length=80)


class PublicLiveRoomNoteCreate(BaseModel):
    contact_name: str = Field(min_length=2, max_length=80)
    message: str = Field(min_length=2, max_length=280)


class CheckInRequestCreate(BaseModel):
    reason: str = Field(default="routine_safety_prompt", min_length=3, max_length=80)
    due_in_seconds: int = Field(default=120, ge=30, le=900)


class CheckInAckCreate(BaseModel):
    status: Literal["safe", "need_help"] = "safe"
    note: str | None = Field(default=None, max_length=280)


class CheckInRecord(BaseModel):
    id: str
    user_id: str
    reason: str
    status: Literal["pending", "safe", "need_help", "missed"]
    requested_at: datetime
    due_at: datetime
    acknowledged_at: datetime | None = None
    note: str | None = None
