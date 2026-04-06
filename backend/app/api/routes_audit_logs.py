from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.deps import CurrentAdmin, DBSession
from app.models.entities import AuditLog
from app.schemas.audit import AuditLogResponse

router = APIRouter()


@router.get("", response_model=list[AuditLogResponse])
def list_audit_logs(
    db: DBSession,
    _: CurrentAdmin,
    limit: int = Query(default=100, ge=1, le=500),
) -> list[AuditLogResponse]:
    logs = db.scalars(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)).all()
    return [AuditLogResponse.model_validate(log_item) for log_item in logs]

