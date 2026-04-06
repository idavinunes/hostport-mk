from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentAdmin, DBSession
from app.models.entities import Client, Device
from app.schemas.device import DeviceCreate, DeviceResponse, DeviceUpdate
from app.services.audit import write_audit_log
from app.services.helpers import hash_text, mask_mac, serialize_model
from app.security.crypto import encrypt_text

router = APIRouter()


def build_device_response(device: Device) -> DeviceResponse:
    return DeviceResponse(
        id=device.id,
        client_id=device.client_id,
        client_name=device.client.full_name if device.client else None,
        mac_masked=mask_mac(device.mac_hash),
        nickname=device.nickname,
        first_seen_at=device.first_seen_at,
        last_seen_at=device.last_seen_at,
        blocked=device.blocked,
        created_at=device.created_at,
        updated_at=device.updated_at,
    )


@router.get("", response_model=list[DeviceResponse])
def list_devices(db: DBSession, _: CurrentAdmin) -> list[DeviceResponse]:
    devices = db.scalars(
        select(Device).options(selectinload(Device.client)).order_by(Device.created_at.desc())
    ).all()
    return [build_device_response(device) for device in devices]


@router.post("", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
def create_device(
    payload: DeviceCreate,
    request: Request,
    db: DBSession,
    current_admin: CurrentAdmin,
) -> DeviceResponse:
    client = db.get(Client, payload.client_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")

    mac_hash = hash_text(payload.mac)
    existing = db.scalar(select(Device).where(Device.mac_hash == mac_hash))
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="MAC already exists")

    device = Device(
        client_id=payload.client_id,
        mac_ciphertext=encrypt_text(payload.mac),
        mac_hash=mac_hash,
        nickname=payload.nickname,
        first_seen_at=payload.first_seen_at,
        last_seen_at=payload.last_seen_at,
        blocked=payload.blocked,
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    db.refresh(device, attribute_names=["client"])

    write_audit_log(
        db=db,
        actor_user=current_admin["username"],
        action="create",
        entity_name="devices",
        entity_id=str(device.id),
        before=None,
        after=serialize_model(build_device_response(device)),
        source_ip=request.client.host if request.client else None,
    )
    db.commit()

    return build_device_response(device)


@router.put("/{device_id}", response_model=DeviceResponse)
def update_device(
    device_id: UUID,
    payload: DeviceUpdate,
    request: Request,
    db: DBSession,
    current_admin: CurrentAdmin,
) -> DeviceResponse:
    device = db.scalar(select(Device).options(selectinload(Device.client)).where(Device.id == device_id))
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")

    before = serialize_model(build_device_response(device))

    if payload.client_id is not None:
        client = db.get(Client, payload.client_id)
        if not client:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
        device.client_id = payload.client_id
    if payload.mac is not None:
        mac_hash = hash_text(payload.mac)
        existing = db.scalar(select(Device).where(Device.mac_hash == mac_hash, Device.id != device.id))
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="MAC already exists")
        device.mac_hash = mac_hash
        device.mac_ciphertext = encrypt_text(payload.mac)
    if payload.nickname is not None:
        device.nickname = payload.nickname
    if payload.first_seen_at is not None:
        device.first_seen_at = payload.first_seen_at
    if payload.last_seen_at is not None:
        device.last_seen_at = payload.last_seen_at
    if payload.blocked is not None:
        device.blocked = payload.blocked

    db.commit()
    db.refresh(device)
    db.refresh(device, attribute_names=["client"])

    write_audit_log(
        db=db,
        actor_user=current_admin["username"],
        action="update",
        entity_name="devices",
        entity_id=str(device.id),
        before=before,
        after=serialize_model(build_device_response(device)),
        source_ip=request.client.host if request.client else None,
    )
    db.commit()

    return build_device_response(device)

