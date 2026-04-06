from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class DeviceCreate(BaseModel):
    client_id: UUID
    mac: str = Field(min_length=12, max_length=17)
    nickname: str | None = Field(default=None, max_length=120)
    first_seen_at: datetime | None = None
    last_seen_at: datetime | None = None
    blocked: bool = False

    @field_validator("mac")
    @classmethod
    def validate_mac(cls, value: str) -> str:
        normalized = value.replace("-", "").replace(":", "").replace(".", "")
        if len(normalized) != 12:
            raise ValueError("MAC must have 12 hexadecimal characters")
        return value


class DeviceUpdate(BaseModel):
    client_id: UUID | None = None
    mac: str | None = Field(default=None, min_length=12, max_length=17)
    nickname: str | None = Field(default=None, max_length=120)
    first_seen_at: datetime | None = None
    last_seen_at: datetime | None = None
    blocked: bool | None = None


class DeviceResponse(BaseModel):
    id: UUID
    client_id: UUID
    client_name: str | None = None
    mac_masked: str
    nickname: str | None = None
    first_seen_at: datetime | None = None
    last_seen_at: datetime | None = None
    blocked: bool
    created_at: datetime
    updated_at: datetime
