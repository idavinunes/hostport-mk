from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class VoucherCreate(BaseModel):
    router_id: UUID
    username: str | None = Field(default=None, min_length=3, max_length=120)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    comment: str | None = Field(default=None, max_length=255)
    profile_name: str | None = Field(default=None, min_length=1, max_length=120)
    server_name: str | None = Field(default=None, min_length=1, max_length=120)
    limit_uptime: str | None = Field(default=None, min_length=1, max_length=64)
    active: bool = True


class VoucherResponse(BaseModel):
    id: UUID
    router_id: UUID
    router_name: str
    router_site_name: str | None = None
    username: str
    password_masked: str
    plain_password: str | None = None
    comment: str | None = None
    profile_name: str | None = None
    server_name: str | None = None
    limit_uptime: str | None = None
    active: bool
    sync_status: str
    sync_error: str | None = None
    mikrotik_user_id: str | None = None
    synced_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
