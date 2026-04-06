from __future__ import annotations

from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app.models.entities import AuditLog


def write_audit_log(
    db: Session,
    actor_user: str,
    action: str,
    entity_name: str,
    entity_id: str,
    before: dict | None,
    after: dict | None,
    source_ip: str | None,
) -> AuditLog:
    audit_log = AuditLog(
        actor_user=actor_user,
        action=action,
        entity_name=entity_name,
        entity_id=entity_id,
        before_json=jsonable_encoder(before) if before is not None else None,
        after_json=jsonable_encoder(after) if after is not None else None,
        source_ip=source_ip,
    )
    db.add(audit_log)
    return audit_log
