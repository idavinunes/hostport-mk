from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel


class RouterConnectionTestResponse(BaseModel):
    router_id: UUID
    router_name: str
    identity: str | None = None
    version: str | None = None
    board_name: str | None = None
    uptime: str | None = None


class OnlineUserResponse(BaseModel):
    router_id: UUID
    router_name: str
    router_site_name: str | None = None
    username: str | None = None
    client_name: str | None = None
    device_nickname: str | None = None
    address: str | None = None
    mac_address: str | None = None
    server: str | None = None
    login_by: str | None = None
    uptime: str | None = None
    session_time_left: str | None = None
    idle_time: str | None = None
    bytes_in: str | None = None
    bytes_out: str | None = None
