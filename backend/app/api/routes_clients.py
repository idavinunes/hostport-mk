from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentAdmin, DBSession
from app.models.entities import Client, ClientPlan, Plan
from app.schemas.client import ClientCreate, ClientResponse, ClientUpdate
from app.services.audit import write_audit_log
from app.services.helpers import (
    hash_text,
    mask_cpf,
    plan_to_summary,
    serialize_model,
)
from app.security.crypto import encrypt_text, hash_password

router = APIRouter()


def get_active_plan(client: Client) -> ClientPlan | None:
    now = datetime.now(timezone.utc)
    ordered_plans = sorted(client.client_plans, key=lambda item: item.starts_at, reverse=True)
    for client_plan in ordered_plans:
        if client_plan.active and (client_plan.ends_at is None or client_plan.ends_at >= now):
            return client_plan
    return None


def build_client_response(client: Client) -> ClientResponse:
    active_plan = get_active_plan(client)
    plan_summary = plan_to_summary(active_plan.plan) if active_plan and active_plan.plan else None
    return ClientResponse(
        id=client.id,
        registration_type=client.registration_type,
        full_name=client.full_name,
        cpf_masked=mask_cpf(client.cpf_hash),
        phone=client.phone,
        email=client.email,
        wifi_username=client.wifi_username,
        status=client.status,
        marketing_opt_in=client.marketing_opt_in,
        terms_version=client.terms_version,
        privacy_version=client.privacy_version,
        terms_accepted_at=client.terms_accepted_at,
        privacy_accepted_at=client.privacy_accepted_at,
        current_plan=plan_summary,
        created_at=client.created_at,
        updated_at=client.updated_at,
    )


def assign_plan(db: DBSession, client: Client, plan_id: UUID | None) -> None:
    if plan_id is None:
        return

    plan = db.get(Plan, plan_id)
    if not plan or not plan.active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    for client_plan in client.client_plans:
        if client_plan.active:
            client_plan.active = False
            client_plan.ends_at = datetime.now(timezone.utc)

    db.add(ClientPlan(client_id=client.id, plan_id=plan.id, active=True))


@router.get("", response_model=list[ClientResponse])
def list_clients(db: DBSession, _: CurrentAdmin) -> list[ClientResponse]:
    clients = db.scalars(
        select(Client)
        .options(selectinload(Client.client_plans).selectinload(ClientPlan.plan))
        .order_by(Client.created_at.desc())
    ).all()
    return [build_client_response(client) for client in clients]


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client(
    payload: ClientCreate,
    request: Request,
    db: DBSession,
    current_admin: CurrentAdmin,
) -> ClientResponse:
    existing_username = db.scalar(select(Client).where(Client.wifi_username == payload.wifi_username))
    if existing_username:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="wifi_username already exists")
    if payload.cpf and db.scalar(select(Client).where(Client.cpf_hash == hash_text(payload.cpf))):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="CPF already exists")

    client = Client(
        registration_type=payload.registration_type,
        full_name=payload.full_name,
        cpf_ciphertext=encrypt_text(payload.cpf) if payload.cpf else None,
        cpf_hash=hash_text(payload.cpf) if payload.cpf else None,
        phone=payload.phone,
        email=payload.email,
        wifi_username=payload.wifi_username,
        wifi_password_hash=hash_password(payload.wifi_password),
        status=payload.status,
        marketing_opt_in=payload.marketing_opt_in,
        terms_version=payload.terms_version,
        privacy_version=payload.privacy_version,
        terms_accepted_at=payload.terms_accepted_at,
        privacy_accepted_at=payload.privacy_accepted_at,
    )
    db.add(client)
    db.flush()
    assign_plan(db, client, payload.plan_id)
    db.commit()
    db.refresh(client)
    db.refresh(client, attribute_names=["client_plans"])

    write_audit_log(
        db=db,
        actor_user=current_admin["username"],
        action="create",
        entity_name="clients",
        entity_id=str(client.id),
        before=None,
        after=serialize_model(build_client_response(client)),
        source_ip=request.client.host if request.client else None,
    )
    db.commit()

    client = db.scalar(
        select(Client)
        .options(selectinload(Client.client_plans).selectinload(ClientPlan.plan))
        .where(Client.id == client.id)
    )
    assert client is not None
    return build_client_response(client)


@router.put("/{client_id}", response_model=ClientResponse)
def update_client(
    client_id: UUID,
    payload: ClientUpdate,
    request: Request,
    db: DBSession,
    current_admin: CurrentAdmin,
) -> ClientResponse:
    client = db.scalar(
        select(Client)
        .options(selectinload(Client.client_plans).selectinload(ClientPlan.plan))
        .where(Client.id == client_id)
    )
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    before = serialize_model(build_client_response(client))

    if payload.registration_type is not None:
        client.registration_type = payload.registration_type
    if payload.full_name is not None:
        client.full_name = payload.full_name
    if payload.cpf is not None:
        existing_cpf = db.scalar(select(Client).where(Client.cpf_hash == hash_text(payload.cpf), Client.id != client.id))
        if existing_cpf:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="CPF already exists")
        client.cpf_ciphertext = encrypt_text(payload.cpf)
        client.cpf_hash = hash_text(payload.cpf)
    if payload.phone is not None:
        client.phone = payload.phone
    if payload.email is not None:
        client.email = payload.email
    if payload.wifi_username is not None and payload.wifi_username != client.wifi_username:
        existing_username = db.scalar(
            select(Client).where(Client.wifi_username == payload.wifi_username, Client.id != client.id)
        )
        if existing_username:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="wifi_username already exists")
        client.wifi_username = payload.wifi_username
    if payload.wifi_password is not None:
        client.wifi_password_hash = hash_password(payload.wifi_password)
    if payload.status is not None:
        client.status = payload.status
    if payload.marketing_opt_in is not None:
        client.marketing_opt_in = payload.marketing_opt_in
    if payload.terms_version is not None:
        client.terms_version = payload.terms_version
    if payload.privacy_version is not None:
        client.privacy_version = payload.privacy_version
    if payload.terms_accepted_at is not None:
        client.terms_accepted_at = payload.terms_accepted_at
    if payload.privacy_accepted_at is not None:
        client.privacy_accepted_at = payload.privacy_accepted_at

    if payload.plan_id is not None:
        assign_plan(db, client, payload.plan_id)

    db.commit()
    db.refresh(client)
    db.refresh(client, attribute_names=["client_plans"])

    after = serialize_model(build_client_response(client))
    write_audit_log(
        db=db,
        actor_user=current_admin["username"],
        action="update",
        entity_name="clients",
        entity_id=str(client.id),
        before=before,
        after=after,
        source_ip=request.client.host if request.client else None,
    )
    db.commit()

    return build_client_response(client)
