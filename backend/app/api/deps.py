from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.security.auth import decode_access_token

bearer_scheme = HTTPBearer(auto_error=True)
DBSession = Annotated[Session, Depends(get_db)]


def get_current_admin(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
) -> dict[str, str]:
    payload = decode_access_token(credentials.credentials)
    if payload.get("role") != "superadmin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return {
        "username": payload["sub"],
        "full_name": payload.get("name", payload["sub"]),
        "role": payload["role"],
    }


CurrentAdmin = Annotated[dict[str, str], Depends(get_current_admin)]

