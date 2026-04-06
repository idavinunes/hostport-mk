from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.dialects.postgresql import INET, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    registration_type: Mapped[str] = mapped_column(String(32), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    cpf_ciphertext: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    cpf_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, unique=True)
    phone: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    wifi_username: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    wifi_password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    marketing_opt_in: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    terms_version: Mapped[str] = mapped_column(String(64), nullable=False)
    privacy_version: Mapped[str] = mapped_column(String(64), nullable=False)
    terms_accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    privacy_accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    devices: Mapped[list["Device"]] = relationship(back_populates="client")
    client_plans: Mapped[list["ClientPlan"]] = relationship(back_populates="client")


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    download_kbps: Mapped[int] = mapped_column(Integer, nullable=False)
    upload_kbps: Mapped[int] = mapped_column(Integer, nullable=False)
    quota_mb: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    session_timeout_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    idle_timeout_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class ClientPlan(Base):
    __tablename__ = "client_plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("plans.id"), nullable=False)
    starts_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    client: Mapped[Client] = relationship(back_populates="client_plans")
    plan: Mapped[Plan] = relationship()


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=False)
    mac_ciphertext: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    mac_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    nickname: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    first_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    blocked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    client: Mapped[Client] = relationship(back_populates="devices")


class Router(Base):
    __tablename__ = "routers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    nas_identifier: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    routeros_version: Mapped[str] = mapped_column(String(8), nullable=False, default="v7")
    ip_address: Mapped[str] = mapped_column(INET, nullable=False)
    site_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    integration_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    management_transport: Mapped[str] = mapped_column(String(16), nullable=False, default="api")
    management_port: Mapped[int] = mapped_column(Integer, nullable=False, default=8728)
    management_username: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    management_password_ciphertext: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    management_verify_tls: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    voucher_sync_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    online_monitoring_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    hotspot_interface: Mapped[str] = mapped_column(String(120), nullable=False, default="bridge-lan")
    hotspot_name: Mapped[str] = mapped_column(String(120), nullable=False, default="hotspot-academia")
    hotspot_profile_name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
        default="hsprof-academia",
    )
    hotspot_address: Mapped[str] = mapped_column(INET, nullable=False, default="10.10.10.1")
    hotspot_network: Mapped[str] = mapped_column(String(32), nullable=False, default="10.10.10.0/24")
    pool_name: Mapped[str] = mapped_column(String(120), nullable=False, default="pool-hotspot")
    pool_range_start: Mapped[str] = mapped_column(INET, nullable=False, default="10.10.10.100")
    pool_range_end: Mapped[str] = mapped_column(INET, nullable=False, default="10.10.10.250")
    dhcp_server_name: Mapped[str] = mapped_column(String(120), nullable=False, default="dhcp-hotspot")
    lease_time: Mapped[str] = mapped_column(String(32), nullable=False, default="1h")
    nas_port_type: Mapped[str] = mapped_column(String(64), nullable=False, default="wireless-802.11")
    radius_src_address: Mapped[str] = mapped_column(INET, nullable=False, default="10.10.10.1")
    radius_timeout: Mapped[str] = mapped_column(String(32), nullable=False, default="1100ms")
    radius_interim_update: Mapped[str] = mapped_column(String(32), nullable=False, default="5m")
    configure_dns: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    create_dhcp: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    create_walled_garden: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    create_api_walled_garden: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    vouchers: Mapped[list["Voucher"]] = relationship(back_populates="router")


class Voucher(Base):
    __tablename__ = "vouchers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    router_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("routers.id"), nullable=False)
    username: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    password_ciphertext: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    comment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    profile_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    server_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    limit_uptime: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    sync_status: Mapped[str] = mapped_column(String(16), nullable=False, default="pending")
    sync_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    mikrotik_user_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    synced_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    router: Mapped[Router] = relationship(back_populates="vouchers")


class AppSettings(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    legal_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    support_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    support_phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    portal_domain: Mapped[str] = mapped_column(String(255), nullable=False)
    api_domain: Mapped[str] = mapped_column(String(255), nullable=False)
    radius_server_ip: Mapped[str] = mapped_column(INET, nullable=False)
    default_dns_servers: Mapped[str] = mapped_column(String(255), nullable=False, default="1.1.1.1,8.8.8.8")
    default_radius_interim_update: Mapped[str] = mapped_column(String(32), nullable=False, default="5m")
    default_terms_version: Mapped[str] = mapped_column(String(64), nullable=False, default="v1")
    default_privacy_version: Mapped[str] = mapped_column(String(64), nullable=False, default="v1")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_user: Mapped[str] = mapped_column(String(120), nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_name: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(120), nullable=False)
    before_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    after_json: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    source_ip: Mapped[Optional[str]] = mapped_column(INET, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )


class RadAcct(Base):
    __tablename__ = "radacct"

    radacctid: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    acctsessionid: Mapped[str] = mapped_column(Text, nullable=False)
    acctuniqueid: Mapped[str] = mapped_column(Text, nullable=False)
    username: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    realm: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    nasipaddress: Mapped[Optional[str]] = mapped_column(INET, nullable=True)
    nasportid: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    nasporttype: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    acctstarttime: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    acctupdatetime: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    acctstoptime: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    acctinterval: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    acctsessiontime: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    acctauthentic: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    connectinfo_start: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    connectinfo_stop: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    acctinputoctets: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    acctoutputoctets: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    calledstationid: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    callingstationid: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    acctterminatecause: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    servicetype: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    framedprotocol: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    framedipaddress: Mapped[Optional[str]] = mapped_column(INET, nullable=True)
    nasidentifier: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    class_value: Mapped[Optional[str]] = mapped_column("class", Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
