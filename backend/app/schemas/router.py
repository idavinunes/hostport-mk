from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, IPvAnyAddress


class RouterBase(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    nas_identifier: str = Field(min_length=2, max_length=120)
    routeros_version: str = Field(default="v7", pattern="^(v6|v7)$")
    ip_address: IPvAnyAddress
    site_name: str | None = None
    integration_enabled: bool = False
    management_transport: str = Field(default="api", pattern="^(api|api-ssl)$")
    management_port: int = Field(default=8728, ge=1, le=65535)
    management_username: str | None = Field(default=None, min_length=1, max_length=120)
    management_verify_tls: bool = False
    voucher_sync_enabled: bool = True
    online_monitoring_enabled: bool = True
    hotspot_interface: str = Field(default="bridge-lan", min_length=2, max_length=120)
    hotspot_name: str = Field(default="hotspot-academia", min_length=2, max_length=120)
    hotspot_profile_name: str = Field(default="hsprof-academia", min_length=2, max_length=120)
    hotspot_address: IPvAnyAddress
    hotspot_network: str = Field(default="10.10.10.0/24", min_length=9, max_length=32)
    pool_name: str = Field(default="pool-hotspot", min_length=2, max_length=120)
    pool_range_start: IPvAnyAddress
    pool_range_end: IPvAnyAddress
    dhcp_server_name: str = Field(default="dhcp-hotspot", min_length=2, max_length=120)
    lease_time: str = Field(default="1h", min_length=1, max_length=32)
    nas_port_type: str = Field(default="wireless-802.11", min_length=2, max_length=64)
    radius_src_address: IPvAnyAddress
    radius_timeout: str = Field(default="1100ms", min_length=1, max_length=32)
    radius_interim_update: str = Field(default="5m", min_length=1, max_length=32)
    configure_dns: bool = True
    create_dhcp: bool = True
    create_walled_garden: bool = True
    create_api_walled_garden: bool = True
    active: bool = True


class RouterCreate(RouterBase):
    management_password: str | None = Field(default=None, min_length=1, max_length=255)


class RouterUpdate(BaseModel):
    name: str | None = None
    nas_identifier: str | None = None
    routeros_version: str | None = Field(default=None, pattern="^(v6|v7)$")
    ip_address: IPvAnyAddress | None = None
    site_name: str | None = None
    integration_enabled: bool | None = None
    management_transport: str | None = Field(default=None, pattern="^(api|api-ssl)$")
    management_port: int | None = Field(default=None, ge=1, le=65535)
    management_username: str | None = Field(default=None, min_length=1, max_length=120)
    management_password: str | None = Field(default=None, min_length=1, max_length=255)
    management_verify_tls: bool | None = None
    voucher_sync_enabled: bool | None = None
    online_monitoring_enabled: bool | None = None
    hotspot_interface: str | None = None
    hotspot_name: str | None = None
    hotspot_profile_name: str | None = None
    hotspot_address: IPvAnyAddress | None = None
    hotspot_network: str | None = None
    pool_name: str | None = None
    pool_range_start: IPvAnyAddress | None = None
    pool_range_end: IPvAnyAddress | None = None
    dhcp_server_name: str | None = None
    lease_time: str | None = None
    nas_port_type: str | None = None
    radius_src_address: IPvAnyAddress | None = None
    radius_timeout: str | None = None
    radius_interim_update: str | None = None
    configure_dns: bool | None = None
    create_dhcp: bool | None = None
    create_walled_garden: bool | None = None
    create_api_walled_garden: bool | None = None
    active: bool | None = None


class RouterResponse(RouterBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    management_password_configured: bool = False
    created_at: datetime
    updated_at: datetime
