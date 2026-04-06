from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, IPvAnyAddress


class AppSettingsBase(BaseModel):
    company_name: str = Field(min_length=2, max_length=255)
    legal_name: str | None = Field(default=None, max_length=255)
    support_email: EmailStr | None = None
    support_phone: str | None = Field(default=None, max_length=64)
    portal_domain: str = Field(min_length=3, max_length=255)
    api_domain: str = Field(min_length=3, max_length=255)
    radius_server_ip: IPvAnyAddress
    default_dns_servers: str = Field(min_length=3, max_length=255)
    default_radius_interim_update: str = Field(min_length=1, max_length=32)
    default_terms_version: str = Field(min_length=1, max_length=64)
    default_privacy_version: str = Field(min_length=1, max_length=64)


class AppSettingsUpdate(AppSettingsBase):
    pass


class AppSettingsResponse(AppSettingsBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime
