from fastapi import APIRouter, Request

from app.api.deps import CurrentAdmin, DBSession
from app.models.entities import AppSettings
from app.schemas.settings import AppSettingsResponse, AppSettingsUpdate
from app.services.audit import write_audit_log
from app.services.helpers import serialize_model

router = APIRouter()


def get_or_create_settings(db: DBSession) -> AppSettings:
    settings_obj = db.get(AppSettings, 1)
    if settings_obj is None:
        settings_obj = AppSettings(
            id=1,
            company_name="Sua Academia",
            legal_name="Sua Academia LTDA",
            support_email="infra@example.com",
            support_phone="+55 11 99999-9999",
            portal_domain="wifi.example.com",
            api_domain="api.example.com",
            radius_server_ip="10.10.10.10",
            default_dns_servers="1.1.1.1,8.8.8.8",
            default_radius_interim_update="5m",
            default_terms_version="v1",
            default_privacy_version="v1",
        )
        db.add(settings_obj)
        db.commit()
        db.refresh(settings_obj)
    return settings_obj


@router.get("", response_model=AppSettingsResponse)
def get_settings(db: DBSession, _: CurrentAdmin) -> AppSettingsResponse:
    settings_obj = get_or_create_settings(db)
    return AppSettingsResponse.model_validate(settings_obj)


@router.put("", response_model=AppSettingsResponse)
def update_settings(
    payload: AppSettingsUpdate,
    request: Request,
    db: DBSession,
    current_admin: CurrentAdmin,
) -> AppSettingsResponse:
    settings_obj = get_or_create_settings(db)
    before = serialize_model(AppSettingsResponse.model_validate(settings_obj))

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(settings_obj, field, value)

    db.commit()
    db.refresh(settings_obj)

    write_audit_log(
        db=db,
        actor_user=current_admin["username"],
        action="update",
        entity_name="app_settings",
        entity_id=str(settings_obj.id),
        before=before,
        after=serialize_model(AppSettingsResponse.model_validate(settings_obj)),
        source_ip=request.client.host if request.client else None,
    )
    db.commit()

    return AppSettingsResponse.model_validate(settings_obj)
