from __future__ import annotations

import hashlib

from cryptography.fernet import Fernet
from passlib.hash import sha512_crypt

from app.core.config import settings
from app.services.helpers import normalize_digits, normalize_mac

fernet = Fernet(settings.app_encryption_key.encode("utf-8"))


def encrypt_text(value: str) -> bytes:
    if len(normalize_digits(value)) == 11:
        normalized = normalize_digits(value)
    elif len(value.replace("-", "").replace(":", "").replace(".", "")) == 12:
        normalized = normalize_mac(value)
    else:
        normalized = value.strip()
    return fernet.encrypt(normalized.encode("utf-8"))


def encrypt_secret(value: str) -> bytes:
    return fernet.encrypt(value.encode("utf-8"))


def decrypt_secret(value: bytes | None) -> str | None:
    if value is None:
        return None
    return fernet.decrypt(value).decode("utf-8")


def hash_password(password: str) -> str:
    return sha512_crypt.hash(password)


def stable_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()
