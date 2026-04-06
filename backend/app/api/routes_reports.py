from __future__ import annotations

import csv
from datetime import datetime
from io import StringIO

from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import String, func, or_, select

from app.api.deps import CurrentAdmin, DBSession
from app.models.entities import Client, RadAcct
from app.schemas.report import MarcoCivilReportRow
from app.services.audit import write_audit_log
from app.services.helpers import hash_text, mask_cpf, normalize_mac_compact, serialize_model

router = APIRouter()


def build_report_statement():
    return (
        select(RadAcct, Client.full_name, Client.cpf_hash)
        .join(Client, Client.wifi_username == RadAcct.username, isouter=True)
        .order_by(RadAcct.acctstarttime.desc().nullslast(), RadAcct.radacctid.desc())
    )


def apply_report_filters(
    statement,
    *,
    started_from: datetime | None,
    started_to: datetime | None,
    mac: str | None,
    cpf: str | None,
    ip: str | None,
    nas: str | None,
):
    if started_from is not None:
        statement = statement.where(RadAcct.acctstarttime >= started_from)
    if started_to is not None:
        statement = statement.where(RadAcct.acctstarttime <= started_to)
    if mac:
        normalized_mac = normalize_mac_compact(mac)
        calling_station_normalized = func.upper(
            func.regexp_replace(func.coalesce(RadAcct.callingstationid, ""), "[-:\\.]", "", "g")
        )
        statement = statement.where(calling_station_normalized == normalized_mac)
    if cpf:
        statement = statement.where(Client.cpf_hash == hash_text(cpf))
    if ip:
        statement = statement.where(
            or_(
                func.cast(RadAcct.framedipaddress, String) == ip,
                func.cast(RadAcct.nasipaddress, String) == ip,
            )
        )
    if nas:
        nas_term = nas.strip()
        statement = statement.where(
            or_(
                func.coalesce(RadAcct.nasidentifier, "").ilike(f"%{nas_term}%"),
                func.cast(RadAcct.nasipaddress, String) == nas_term,
            )
        )
    return statement


def build_report_row(radacct: RadAcct, client_name: str | None, cpf_hash: str | None) -> MarcoCivilReportRow:
    return MarcoCivilReportRow(
        id=radacct.radacctid,
        username=radacct.username,
        client_name=client_name,
        cpf_masked=mask_cpf(cpf_hash),
        nas_identifier=radacct.nasidentifier,
        nas_ip_address=str(radacct.nasipaddress) if radacct.nasipaddress else None,
        framed_ip_address=str(radacct.framedipaddress) if radacct.framedipaddress else None,
        acct_session_id=radacct.acctsessionid,
        calling_station_id=radacct.callingstationid,
        called_station_id=radacct.calledstationid,
        started_at=radacct.acctstarttime,
        updated_at=radacct.acctupdatetime,
        ended_at=radacct.acctstoptime,
        session_time_seconds=radacct.acctsessiontime,
        input_octets=radacct.acctinputoctets,
        output_octets=radacct.acctoutputoctets,
        terminate_cause=radacct.acctterminatecause,
    )


def load_report_rows(
    db: DBSession,
    *,
    started_from: datetime | None,
    started_to: datetime | None,
    mac: str | None,
    cpf: str | None,
    ip: str | None,
    nas: str | None,
    limit: int,
) -> list[MarcoCivilReportRow]:
    statement = build_report_statement()
    statement = apply_report_filters(
        statement,
        started_from=started_from,
        started_to=started_to,
        mac=mac,
        cpf=cpf,
        ip=ip,
        nas=nas,
    ).limit(limit)
    rows = db.execute(statement).all()
    return [build_report_row(radacct, client_name, cpf_hash) for radacct, client_name, cpf_hash in rows]


def build_csv(rows: list[MarcoCivilReportRow]) -> str:
    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "session_db_id",
            "acct_session_id",
            "username",
            "client_name",
            "cpf_masked",
            "nas_identifier",
            "nas_ip_address",
            "framed_ip_address",
            "calling_station_id",
            "called_station_id",
            "started_at",
            "updated_at",
            "ended_at",
            "session_time_seconds",
            "input_octets",
            "output_octets",
            "terminate_cause",
        ]
    )
    for row in rows:
        writer.writerow(
            [
                row.id,
                row.acct_session_id,
                row.username or "",
                row.client_name or "",
                row.cpf_masked or "",
                row.nas_identifier or "",
                row.nas_ip_address or "",
                row.framed_ip_address or "",
                row.calling_station_id or "",
                row.called_station_id or "",
                row.started_at.isoformat() if row.started_at else "",
                row.updated_at.isoformat() if row.updated_at else "",
                row.ended_at.isoformat() if row.ended_at else "",
                row.session_time_seconds or "",
                row.input_octets or "",
                row.output_octets or "",
                row.terminate_cause or "",
            ]
        )
    return buffer.getvalue()


@router.get("/marco-civil", response_model=list[MarcoCivilReportRow])
def marco_civil_report(
    db: DBSession,
    _: CurrentAdmin,
    started_from: datetime | None = Query(default=None),
    started_to: datetime | None = Query(default=None),
    mac: str | None = Query(default=None),
    cpf: str | None = Query(default=None),
    ip: str | None = Query(default=None),
    nas: str | None = Query(default=None),
    limit: int = Query(default=500, ge=1, le=5000),
) -> list[MarcoCivilReportRow]:
    return load_report_rows(
        db,
        started_from=started_from,
        started_to=started_to,
        mac=mac,
        cpf=cpf,
        ip=ip,
        nas=nas,
        limit=limit,
    )


@router.get("/marco-civil/export")
def export_marco_civil_report(
    request: Request,
    db: DBSession,
    current_admin: CurrentAdmin,
    started_from: datetime | None = Query(default=None),
    started_to: datetime | None = Query(default=None),
    mac: str | None = Query(default=None),
    cpf: str | None = Query(default=None),
    ip: str | None = Query(default=None),
    nas: str | None = Query(default=None),
    limit: int = Query(default=5000, ge=1, le=20000),
) -> StreamingResponse:
    rows = load_report_rows(
        db,
        started_from=started_from,
        started_to=started_to,
        mac=mac,
        cpf=cpf,
        ip=ip,
        nas=nas,
        limit=limit,
    )
    payload = {
        "report": "marco_civil",
        "filters": {
            "started_from": started_from.isoformat() if started_from else None,
            "started_to": started_to.isoformat() if started_to else None,
            "mac": mac,
            "cpf": "***.***.***-**" if cpf else None,
            "ip": ip,
            "nas": nas,
            "limit": limit,
            "rows": len(rows),
        },
    }
    write_audit_log(
        db=db,
        actor_user=current_admin["username"],
        action="export",
        entity_name="reports.marco_civil",
        entity_id=f"rows:{len(rows)}",
        before=None,
        after=serialize_model(payload),
        source_ip=request.client.host if request.client else None,
    )
    db.commit()

    csv_payload = build_csv(rows)
    filename = f"marco_civil_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([csv_payload]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
