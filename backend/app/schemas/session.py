from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class SessionResponse(BaseModel):
    id: int
    username: str | None = None
    client_name: str | None = None
    nas_identifier: str | None = None
    nas_ip_address: str | None = None
    framed_ip_address: str | None = None
    acct_session_id: str
    calling_station_id: str | None = None
    called_station_id: str | None = None
    started_at: datetime | None = None
    updated_at: datetime | None = None
    ended_at: datetime | None = None
    session_time_seconds: int | None = None
    input_octets: int | None = None
    output_octets: int | None = None
