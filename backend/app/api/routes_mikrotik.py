from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentAdmin, DBSession
from app.models.entities import Client, Device, Router
from app.schemas.mikrotik import OnlineUserResponse, RouterConnectionTestResponse
from app.services.helpers import hash_text
from app.services.mikrotik_api import RouterOsApiClient, RouterOsError, config_from_router

router = APIRouter()


def get_integrated_router(db: DBSession, router_id: UUID) -> Router:
    router_obj = db.get(Router, router_id)
    if not router_obj:
        raise HTTPException(status_code=404, detail="Router not found")
    if not router_obj.integration_enabled:
        raise HTTPException(status_code=400, detail="Router integration is not enabled")
    return router_obj


@router.post("/routers/{router_id}/test-connection", response_model=RouterConnectionTestResponse)
def test_router_connection(router_id: UUID, db: DBSession, _: CurrentAdmin) -> RouterConnectionTestResponse:
    router_obj = get_integrated_router(db, router_id)

    try:
        with RouterOsApiClient(config_from_router(router_obj)) as client:
            details = client.test_connection()
    except RouterOsError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return RouterConnectionTestResponse(
        router_id=router_obj.id,
        router_name=router_obj.name,
        identity=details.get("identity"),
        version=details.get("version"),
        board_name=details.get("board-name"),
        uptime=details.get("uptime"),
    )


@router.get("/routers/{router_id}/online-users", response_model=list[OnlineUserResponse])
def list_router_online_users(router_id: UUID, db: DBSession, _: CurrentAdmin) -> list[OnlineUserResponse]:
    router_obj = get_integrated_router(db, router_id)
    if not router_obj.online_monitoring_enabled:
        raise HTTPException(status_code=400, detail="Online monitoring is disabled for this router")

    try:
        with RouterOsApiClient(config_from_router(router_obj)) as client:
            active_users = client.list_hotspot_active()
    except RouterOsError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    usernames = sorted({row.get("user") for row in active_users if row.get("user")})
    macs = sorted({row.get("mac-address") for row in active_users if row.get("mac-address")})

    clients = db.scalars(select(Client).where(Client.wifi_username.in_(usernames))).all() if usernames else []
    devices = (
        db.scalars(select(Device).where(Device.mac_hash.in_([hash_text(mac) for mac in macs]))).all()
        if macs
        else []
    )
    clients_by_username = {client.wifi_username: client for client in clients}
    devices_by_mac_hash = {device.mac_hash: device for device in devices}

    response: list[OnlineUserResponse] = []
    for row in active_users:
        username = row.get("user")
        mac_address = row.get("mac-address")
        client_obj = clients_by_username.get(username or "")
        device_obj = devices_by_mac_hash.get(hash_text(mac_address)) if mac_address else None

        response.append(
            OnlineUserResponse(
                router_id=router_obj.id,
                router_name=router_obj.name,
                router_site_name=router_obj.site_name,
                username=username,
                client_name=client_obj.full_name if client_obj else None,
                device_nickname=device_obj.nickname if device_obj else None,
                address=row.get("address"),
                mac_address=mac_address,
                server=row.get("server"),
                login_by=row.get("login-by"),
                uptime=row.get("uptime"),
                session_time_left=row.get("session-time-left"),
                idle_time=row.get("idle-time"),
                bytes_in=row.get("bytes-in"),
                bytes_out=row.get("bytes-out"),
            )
        )

    return response
