from __future__ import annotations

import hashlib
from fastapi.encoders import jsonable_encoder

from app.models.entities import Plan
from app.schemas.plan import PlanSummary


def normalize_digits(value: str) -> str:
    return "".join(filter(str.isdigit, value))


def normalize_mac(value: str) -> str:
    cleaned = value.replace("-", "").replace(":", "").replace(".", "").upper()
    return ":".join(cleaned[i : i + 2] for i in range(0, len(cleaned), 2))


def hash_text(value: str) -> str:
    if len(normalize_digits(value)) in {11, 14}:
        normalized = normalize_digits(value)
    else:
        normalized = normalize_mac(value) if any(sep in value for sep in "-:.") or len(value) == 12 else value.strip().lower()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def mask_cpf(cpf_hash: str | None) -> str | None:
    if cpf_hash is None:
        return None
    return "***.***.***-**"


def mask_mac(mac_hash: str) -> str:
    _ = mac_hash
    return "**:**:**:**:**:**"


def plan_to_summary(plan: Plan, full: bool = False) -> PlanSummary | dict:
    summary = PlanSummary(
        id=plan.id,
        name=plan.name,
        download_kbps=plan.download_kbps,
        upload_kbps=plan.upload_kbps,
        session_timeout_seconds=plan.session_timeout_seconds,
        idle_timeout_seconds=plan.idle_timeout_seconds,
    )
    if full:
        data = summary.model_dump()
        data["quota_mb"] = plan.quota_mb
        data["price_cents"] = plan.price_cents
        data["active"] = plan.active
        data["created_at"] = plan.created_at
        data["updated_at"] = plan.updated_at
        return data
    return summary


def serialize_model(value: object) -> dict:
    return jsonable_encoder(value)
