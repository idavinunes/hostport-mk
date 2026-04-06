from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select

from app.api.deps import CurrentAdmin, DBSession
from app.models.entities import Router
from app.schemas.router import RouterCreate, RouterResponse, RouterUpdate
from app.security.crypto import encrypt_secret
from app.services.audit import write_audit_log
from app.services.helpers import serialize_model

router = APIRouter()


def build_router_response(router_obj: Router) -> RouterResponse:
    return RouterResponse(
        id=router_obj.id,
        name=router_obj.name,
        nas_identifier=router_obj.nas_identifier,
        routeros_version=router_obj.routeros_version,
        ip_address=router_obj.ip_address,
        site_name=router_obj.site_name,
        integration_enabled=router_obj.integration_enabled,
        management_transport=router_obj.management_transport,
        management_port=router_obj.management_port,
        management_username=router_obj.management_username,
        management_verify_tls=router_obj.management_verify_tls,
        management_password_configured=router_obj.management_password_ciphertext is not None,
        voucher_sync_enabled=router_obj.voucher_sync_enabled,
        online_monitoring_enabled=router_obj.online_monitoring_enabled,
        hotspot_interface=router_obj.hotspot_interface,
        hotspot_name=router_obj.hotspot_name,
        hotspot_profile_name=router_obj.hotspot_profile_name,
        hotspot_address=router_obj.hotspot_address,
        hotspot_network=router_obj.hotspot_network,
        pool_name=router_obj.pool_name,
        pool_range_start=router_obj.pool_range_start,
        pool_range_end=router_obj.pool_range_end,
        dhcp_server_name=router_obj.dhcp_server_name,
        lease_time=router_obj.lease_time,
        nas_port_type=router_obj.nas_port_type,
        radius_src_address=router_obj.radius_src_address,
        radius_timeout=router_obj.radius_timeout,
        radius_interim_update=router_obj.radius_interim_update,
        configure_dns=router_obj.configure_dns,
        create_dhcp=router_obj.create_dhcp,
        create_walled_garden=router_obj.create_walled_garden,
        create_api_walled_garden=router_obj.create_api_walled_garden,
        active=router_obj.active,
        created_at=router_obj.created_at,
        updated_at=router_obj.updated_at,
    )


def validate_router_integration(
    *,
    integration_enabled: bool,
    management_username: str | None,
    management_password_configured: bool,
) -> None:
    if not integration_enabled:
        return

    if not management_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="management_username is required when integration is enabled",
        )
    if not management_password_configured:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="management_password is required when integration is enabled",
        )
    return


@router.get("", response_model=list[RouterResponse])
def list_routers(db: DBSession, _: CurrentAdmin) -> list[RouterResponse]:
    routers = db.scalars(select(Router).order_by(Router.created_at.desc())).all()
    return [build_router_response(router) for router in routers]


@router.post("", response_model=RouterResponse, status_code=status.HTTP_201_CREATED)
def create_router(
    payload: RouterCreate,
    request: Request,
    db: DBSession,
    current_admin: CurrentAdmin,
) -> RouterResponse:
    if db.scalar(select(Router).where(Router.nas_identifier == payload.nas_identifier)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Router already exists")

    payload_data = payload.model_dump(exclude={"management_password"})
    if payload.management_password is not None:
        payload_data["management_password_ciphertext"] = encrypt_secret(payload.management_password)

    validate_router_integration(
        integration_enabled=payload_data["integration_enabled"],
        management_username=payload_data.get("management_username"),
        management_password_configured=payload_data.get("management_password_ciphertext") is not None,
    )

    router_obj = Router(**payload_data)
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
        after=serialize_model(build_router_response(router_obj)),
        source_ip=request.client.host if request.client else None,
    )
    db.commit()

    return build_router_response(router_obj)


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

    before = serialize_model(build_router_response(router_obj))
    payload_data = payload.model_dump(exclude_unset=True, exclude={"management_password"})
    for field, value in payload_data.items():
        setattr(router_obj, field, value)
    if payload.management_password is not None:
        router_obj.management_password_ciphertext = encrypt_secret(payload.management_password)

    validate_router_integration(
        integration_enabled=router_obj.integration_enabled,
        management_username=router_obj.management_username,
        management_password_configured=router_obj.management_password_ciphertext is not None,
    )

    db.commit()
    db.refresh(router_obj)

    write_audit_log(
        db=db,
        actor_user=current_admin["username"],
        action="update",
        entity_name="routers",
        entity_id=str(router_obj.id),
        before=before,
        after=serialize_model(build_router_response(router_obj)),
        source_ip=request.client.host if request.client else None,
    )
    db.commit()

    return build_router_response(router_obj)
