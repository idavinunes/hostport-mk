from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    actor_user: str
    action: str
    entity_name: str
    entity_id: str
    before_json: dict | None = None
    after_json: dict | None = None
    source_ip: str | None = None
    created_at: datetime
