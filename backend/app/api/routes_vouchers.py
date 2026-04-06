from __future__ import annotations

import string
from datetime import datetime, timezone
from secrets import choice
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentAdmin, DBSession
from app.models.entities import Router, Voucher
from app.schemas.voucher import VoucherCreate, VoucherResponse
from app.security.crypto import decrypt_secret, encrypt_secret
from app.services.audit import write_audit_log
from app.services.helpers import serialize_model
from app.services.mikrotik_api import RouterOsApiClient, RouterOsError, config_from_router

router = APIRouter()

ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
PASSWORD_ALPHABET = string.ascii_letters + string.digits


def generate_voucher_username(length: int = 8) -> str:
    return "".join(choice(ALPHABET) for _ in range(length))


def generate_voucher_password(length: int = 10) -> str:
    return "".join(choice(PASSWORD_ALPHABET) for _ in range(length))


def generate_unique_voucher_username(db: DBSession) -> str:
    while True:
        candidate = generate_voucher_username()
        if not db.scalar(select(Voucher).where(Voucher.username == candidate)):
            return candidate


def mask_secret(secret: str) -> str:
    if len(secret) <= 4:
        return "*" * len(secret)
    return f"{secret[:2]}{'*' * max(2, len(secret) - 4)}{secret[-2:]}"


def build_voucher_response(voucher: Voucher, *, plain_password: str | None = None) -> VoucherResponse:
    password = plain_password or decrypt_secret(voucher.password_ciphertext) or ""
    router_obj = voucher.router
    return VoucherResponse(
        id=voucher.id,
        router_id=voucher.router_id,
        router_name=router_obj.name,
        router_site_name=router_obj.site_name,
        username=voucher.username,
        password_masked=mask_secret(password),
        plain_password=plain_password,
        comment=voucher.comment,
        profile_name=voucher.profile_name,
        server_name=voucher.server_name,
        limit_uptime=voucher.limit_uptime,
        active=voucher.active,
        sync_status=voucher.sync_status,
        sync_error=voucher.sync_error,
        mikrotik_user_id=voucher.mikrotik_user_id,
        synced_at=voucher.synced_at,
        created_at=voucher.created_at,
        updated_at=voucher.updated_at,
    )


def require_router_for_voucher(db: DBSession, router_id: UUID) -> Router:
    router_obj = db.get(Router, router_id)
    if not router_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Router not found")
    if not router_obj.integration_enabled or not router_obj.voucher_sync_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Router integration for vouchers is not enabled",
        )
    return router_obj


def sync_voucher(voucher: Voucher, router_obj: Router, plain_password: str) -> None:
    with RouterOsApiClient(config_from_router(router_obj)) as client:
        synced = client.upsert_hotspot_user(
            username=voucher.username,
            password=plain_password,
            comment=voucher.comment,
            profile_name=voucher.profile_name,
            server_name=voucher.server_name,
            limit_uptime=voucher.limit_uptime,
            active=voucher.active,
        )

    voucher.mikrotik_user_id = synced.get(".id")
    voucher.sync_status = "synced"
    voucher.sync_error = None
    voucher.synced_at = datetime.now(timezone.utc)


@router.get("", response_model=list[VoucherResponse])
def list_vouchers(db: DBSession, _: CurrentAdmin) -> list[VoucherResponse]:
    vouchers = db.scalars(
        select(Voucher).options(selectinload(Voucher.router)).order_by(Voucher.created_at.desc())
    ).all()
    return [build_voucher_response(voucher) for voucher in vouchers]


@router.post("", response_model=VoucherResponse, status_code=status.HTTP_201_CREATED)
def create_voucher(
    payload: VoucherCreate,
    request: Request,
    db: DBSession,
    current_admin: CurrentAdmin,
) -> VoucherResponse:
    router_obj = require_router_for_voucher(db, payload.router_id)

    username = payload.username or generate_unique_voucher_username(db)
    if payload.username and db.scalar(select(Voucher).where(Voucher.username == username)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Voucher username already exists")

    plain_password = payload.password or generate_voucher_password()
    voucher = Voucher(
        router_id=payload.router_id,
        username=username,
        password_ciphertext=encrypt_secret(plain_password),
        comment=payload.comment,
        profile_name=payload.profile_name,
        server_name=payload.server_name,
        limit_uptime=payload.limit_uptime,
        active=payload.active,
        sync_status="pending",
    )
    db.add(voucher)
    db.flush()

    sync_error: str | None = None
    try:
        sync_voucher(voucher, router_obj, plain_password)
    except RouterOsError as exc:
        voucher.sync_status = "failed"
        voucher.sync_error = str(exc)
        sync_error = str(exc)

    db.commit()
    db.refresh(voucher)
    db.refresh(voucher, attribute_names=["router"])

    write_audit_log(
        db=db,
        actor_user=current_admin["username"],
        action="create",
        entity_name="vouchers",
        entity_id=str(voucher.id),
        before=None,
        after=serialize_model(build_voucher_response(voucher)),
        source_ip=request.client.host if request.client else None,
    )
    db.commit()

    response = build_voucher_response(voucher, plain_password=plain_password)
    if sync_error:
        response.sync_error = sync_error
    return response


@router.post("/{voucher_id}/sync", response_model=VoucherResponse)
def resync_voucher(
    voucher_id: UUID,
    request: Request,
    db: DBSession,
    current_admin: CurrentAdmin,
) -> VoucherResponse:
    voucher = db.scalar(select(Voucher).options(selectinload(Voucher.router)).where(Voucher.id == voucher_id))
    if not voucher:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voucher not found")

    router_obj = require_router_for_voucher(db, voucher.router_id)
    plain_password = decrypt_secret(voucher.password_ciphertext)
    if plain_password is None:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Voucher password not available")

    before = serialize_model(build_voucher_response(voucher))
    try:
        sync_voucher(voucher, router_obj, plain_password)
    except RouterOsError as exc:
        voucher.sync_status = "failed"
        voucher.sync_error = str(exc)
        db.commit()
        db.refresh(voucher)
        db.refresh(voucher, attribute_names=["router"])
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    db.commit()
    db.refresh(voucher)
    db.refresh(voucher, attribute_names=["router"])

    write_audit_log(
        db=db,
        actor_user=current_admin["username"],
        action="sync",
        entity_name="vouchers",
        entity_id=str(voucher.id),
        before=before,
        after=serialize_model(build_voucher_response(voucher)),
        source_ip=request.client.host if request.client else None,
    )
    db.commit()

    return build_voucher_response(voucher)
