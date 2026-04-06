from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select

from app.api.deps import CurrentAdmin, DBSession
from app.models.entities import Router
from app.schemas.router import RouterCreate, RouterResponse, RouterUpdate
from app.services.audit import write_audit_log
from app.services.helpers import serialize_model

router = APIRouter()


@router.get("", response_model=list[RouterResponse])
def list_routers(db: DBSession, _: CurrentAdmin) -> list[RouterResponse]:
    routers = db.scalars(select(Router).order_by(Router.created_at.desc())).all()
    return [RouterResponse.model_validate(router) for router in routers]


@router.post("", response_model=RouterResponse, status_code=status.HTTP_201_CREATED)
def create_router(
    payload: RouterCreate,
    request: Request,
    db: DBSession,
    current_admin: CurrentAdmin,
) -> RouterResponse:
    if db.scalar(select(Router).where(Router.nas_identifier == payload.nas_identifier)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Router already exists")

    router_obj = Router(**payload.model_dump())
    db.add(router_obj)
    db.commit()
    db.refresh(router_obj)

    write_audit_log(
        db=db,
        actor_user=current_admin["username"],
        action="create",
        entity_name="routers",
        entity_id=str(router_obj.id),
        before=None,
        after=serialize_model(RouterResponse.model_validate(router_obj)),
        source_ip=request.client.host if request.client else None,
    )
    db.commit()

    return RouterResponse.model_validate(router_obj)


@router.put("/{router_id}", response_model=RouterResponse)
def update_router(
    router_id: UUID,
    payload: RouterUpdate,
    request: Request,
    db: DBSession,
    current_admin: CurrentAdmin,
) -> RouterResponse:
    router_obj = db.get(Router, router_id)
    if not router_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Router not found")

    if payload.nas_identifier is not None and payload.nas_identifier != router_obj.nas_identifier:
        existing_router = db.scalar(
            select(Router).where(Router.nas_identifier == payload.nas_identifier, Router.id != router_obj.id)
        )
        if existing_router:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Router already exists")

    before = serialize_model(RouterResponse.model_validate(router_obj))
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(router_obj, field, value)

    db.commit()
    db.refresh(router_obj)

    write_audit_log(
        db=db,
        actor_user=current_admin["username"],
        action="update",
        entity_name="routers",
        entity_id=str(router_obj.id),
        before=before,
        after=serialize_model(RouterResponse.model_validate(router_obj)),
        source_ip=request.client.host if request.client else None,
    )
    db.commit()

    return RouterResponse.model_validate(router_obj)
