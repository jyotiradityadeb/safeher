from pydantic import BaseModel, Field


class EmergencyContactCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    phone_number: str = Field(min_length=8, max_length=20)
    relationship: str = Field(min_length=2, max_length=50)
    channel: str = "sms"
