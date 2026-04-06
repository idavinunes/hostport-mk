from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select

from app.api.deps import CurrentAdmin, DBSession
from app.models.entities import Plan
from app.schemas.plan import PlanCreate, PlanResponse, PlanUpdate
from app.services.audit import write_audit_log
from app.services.helpers import plan_to_summary, serialize_model

router = APIRouter()


@router.get("", response_model=list[PlanResponse])
def list_plans(db: DBSession, _: CurrentAdmin) -> list[PlanResponse]:
    plans = db.scalars(select(Plan).order_by(Plan.created_at.desc())).all()
    return [PlanResponse.model_validate(plan) for plan in plans]


@router.post("", response_model=PlanResponse, status_code=status.HTTP_201_CREATED)
def create_plan(
    payload: PlanCreate,
    request: Request,
    db: DBSession,
    current_admin: CurrentAdmin,
) -> PlanResponse:
    if db.scalar(select(Plan).where(Plan.name == payload.name)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Plan already exists")

    plan = Plan(**payload.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)

    write_audit_log(
        db=db,
        actor_user=current_admin["username"],
        action="create",
        entity_name="plans",
        entity_id=str(plan.id),
        before=None,
        after=serialize_model(plan_to_summary(plan, full=True)),
        source_ip=request.client.host if request.client else None,
    )
    db.commit()

    return PlanResponse.model_validate(plan)


@router.put("/{plan_id}", response_model=PlanResponse)
def update_plan(
    plan_id: UUID,
    payload: PlanUpdate,
    request: Request,
    db: DBSession,
    current_admin: CurrentAdmin,
) -> PlanResponse:
    plan = db.get(Plan, plan_id)
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    before = serialize_model(plan_to_summary(plan, full=True))
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(plan, field, value)

    db.commit()
    db.refresh(plan)

    write_audit_log(
        db=db,
        actor_user=current_admin["username"],
        action="update",
        entity_name="plans",
        entity_id=str(plan.id),
        before=before,
        after=serialize_model(plan_to_summary(plan, full=True)),
        source_ip=request.client.host if request.client else None,
    )
    db.commit()

    return PlanResponse.model_validate(plan)

