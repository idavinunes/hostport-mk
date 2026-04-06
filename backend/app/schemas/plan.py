from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PlanBase(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    download_kbps: int = Field(gt=0)
    upload_kbps: int = Field(gt=0)
    quota_mb: int | None = Field(default=None, ge=0)
    session_timeout_seconds: int | None = Field(default=None, ge=1)
    idle_timeout_seconds: int | None = Field(default=None, ge=1)
    price_cents: int = Field(default=0, ge=0)
    active: bool = True


class PlanCreate(PlanBase):
    pass


class PlanUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    download_kbps: int | None = Field(default=None, gt=0)
    upload_kbps: int | None = Field(default=None, gt=0)
    quota_mb: int | None = Field(default=None, ge=0)
    session_timeout_seconds: int | None = Field(default=None, ge=1)
    idle_timeout_seconds: int | None = Field(default=None, ge=1)
    price_cents: int | None = Field(default=None, ge=0)
    active: bool | None = None


class PlanResponse(PlanBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class PlanSummary(BaseModel):
    id: UUID
    name: str
    download_kbps: int
    upload_kbps: int
    session_timeout_seconds: int | None = None
    idle_timeout_seconds: int | None = None
