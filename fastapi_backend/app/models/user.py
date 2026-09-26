from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, EmailStr, Field


class UserRole(str, Enum):
    CITIZEN = "citizen"
    OFFICER = "officer"
    REVIEWER = "reviewer"
    ADMIN = "admin"


class User(BaseModel):
    id: str | None = Field(default=None, alias="_id")
    name: str
    email: EmailStr
    role: UserRole = UserRole.CITIZEN

    provider: str = "local"
    google_id: str | None = None

    is_active: bool = True

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    class Config:
        populate_by_name = True