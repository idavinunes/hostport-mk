import secrets
from typing import Annotated

from fastapi import APIRouter, HTTPException, Request, status

from app.core.config import settings
from app.core.rate_limit import limiter
from app.schemas.auth import LoginRequest, TokenResponse
from app.security.auth import create_access_token

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, payload: LoginRequest) -> TokenResponse:
    valid_username = secrets.compare_digest(payload.username, settings.admin_username)
    valid_password = secrets.compare_digest(payload.password, settings.admin_password)

    if not (valid_username and valid_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(
        subject=settings.admin_username,
        role="superadmin",
        name=settings.admin_full_name,
    )
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.jwt_expiration_minutes * 60,
        full_name=settings.admin_full_name,
        role="superadmin",
    )
