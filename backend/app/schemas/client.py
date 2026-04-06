from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schemas.plan import PlanSummary


class ClientBase(BaseModel):
    registration_type: str = Field(pattern="^(visitor|member)$")
    full_name: str = Field(min_length=3, max_length=255)
    phone: str | None = Field(default=None, max_length=32)
    email: EmailStr | None = None
    wifi_username: str = Field(min_length=3, max_length=120)
    status: str = Field(default="active", pattern="^(active|blocked|inactive)$")
    marketing_opt_in: bool = False
    terms_version: str = Field(min_length=1, max_length=64)
    privacy_version: str = Field(min_length=1, max_length=64)
    terms_accepted_at: datetime | None = None
    privacy_accepted_at: datetime | None = None
    plan_id: UUID | None = None


class ClientCreate(ClientBase):
    cpf: str | None = Field(default=None, min_length=11, max_length=18)
    wifi_password: str = Field(min_length=8, max_length=128)

    @field_validator("cpf")
    @classmethod
    def validate_cpf(cls, value: str | None) -> str | None:
        if value is None:
            return value
        digits = "".join(filter(str.isdigit, value))
        if len(digits) != 11:
            raise ValueError("CPF must have 11 digits")
        return value


class ClientUpdate(BaseModel):
    registration_type: str | None = Field(default=None, pattern="^(visitor|member)$")
    full_name: str | None = Field(default=None, min_length=3, max_length=255)
    cpf: str | None = Field(default=None, min_length=11, max_length=18)
    phone: str | None = Field(default=None, max_length=32)
    email: EmailStr | None = None
    wifi_username: str | None = Field(default=None, min_length=3, max_length=120)
    wifi_password: str | None = Field(default=None, min_length=8, max_length=128)
    status: str | None = Field(default=None, pattern="^(active|blocked|inactive)$")
    marketing_opt_in: bool | None = None
    terms_version: str | None = Field(default=None, min_length=1, max_length=64)
    privacy_version: str | None = Field(default=None, min_length=1, max_length=64)
    terms_accepted_at: datetime | None = None
    privacy_accepted_at: datetime | None = None
    plan_id: UUID | None = None


class ClientResponse(BaseModel):
    id: UUID
    registration_type: str
    full_name: str
    cpf_masked: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    wifi_username: str
    status: str
    marketing_opt_in: bool
    terms_version: str
    privacy_version: str
    terms_accepted_at: datetime | None = None
    privacy_accepted_at: datetime | None = None
    current_plan: PlanSummary | None = None
    created_at: datetime
    updated_at: datetime
