from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, status

from app.core.config import settings


def create_access_token(subject: str, role: str, name: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "role": role,
        "name": name,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.jwt_expiration_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

