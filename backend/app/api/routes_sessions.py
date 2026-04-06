from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.deps import CurrentAdmin, DBSession
from app.models.entities import Client, RadAcct
from app.schemas.session import SessionResponse

router = APIRouter()


@router.get("", response_model=list[SessionResponse])
def list_sessions(
    db: DBSession,
    _: CurrentAdmin,
    active_only: bool = Query(default=True),
) -> list[SessionResponse]:
    statement = (
        select(RadAcct, Client.full_name)
        .join(Client, Client.wifi_username == RadAcct.username, isouter=True)
        .order_by(RadAcct.acctstarttime.desc().nullslast())
    )
    if active_only:
        statement = statement.where(RadAcct.acctstoptime.is_(None))

    rows = db.execute(statement).all()
    response: list[SessionResponse] = []
    for radacct, full_name in rows:
        response.append(
            SessionResponse(
                id=radacct.radacctid,
                username=radacct.username,
                client_name=full_name,
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
            )
        )
    return response
