from __future__ import annotations

import binascii
import hashlib
import socket
import ssl
from dataclasses import dataclass
from typing import Iterable

from app.models.entities import Router
from app.security.crypto import decrypt_secret


class RouterOsError(RuntimeError):
    pass


@dataclass
class RouterConnectionConfig:
    host: str
    port: int
    username: str
    password: str
    secure: bool
    verify_tls: bool
    timeout: float = 5.0


def config_from_router(router: Router) -> RouterConnectionConfig:
    password = decrypt_secret(router.management_password_ciphertext)
    if not router.management_username or not password:
        raise RouterOsError("Router integration credentials are incomplete")

    return RouterConnectionConfig(
        host=router.ip_address,
        port=router.management_port,
        username=router.management_username,
        password=password,
        secure=router.management_transport == "api-ssl",
        verify_tls=router.management_verify_tls,
    )


class RouterOsApiClient:
    def __init__(self, config: RouterConnectionConfig):
        self.config = config
        self._socket: socket.socket | ssl.SSLSocket | None = None

    def __enter__(self) -> "RouterOsApiClient":
        self.connect()
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def connect(self) -> None:
        try:
            raw_socket = socket.create_connection((self.config.host, self.config.port), timeout=self.config.timeout)
            raw_socket.settimeout(self.config.timeout)

            if self.config.secure:
                context = ssl.create_default_context()
                if not self.config.verify_tls:
                    context.check_hostname = False
                    context.verify_mode = ssl.CERT_NONE
                wrapped_socket = context.wrap_socket(raw_socket, server_hostname=self.config.host)
                wrapped_socket.settimeout(self.config.timeout)
                self._socket = wrapped_socket
            else:
                self._socket = raw_socket

            self._login(self.config.username, self.config.password)
        except (OSError, ssl.SSLError) as exc:
            self.close()
            raise RouterOsError(str(exc)) from exc

    def close(self) -> None:
        if self._socket is None:
            return
        try:
            self._socket.close()
        finally:
            self._socket = None

    def command(self, command: str, **parameters: str | None) -> tuple[list[dict[str, str]], dict[str, str]]:
        words = [command]
        for key, value in parameters.items():
            if value is None:
                continue
            words.append(f"={key}={value}")
        return self._talk(words)

    def print_menu(self, menu: str) -> list[dict[str, str]]:
        records, _ = self.command(f"{menu}/print")
        return records

    def test_connection(self) -> dict[str, str]:
        identity_records = self.print_menu("/system/identity")
        resource_records = self.print_menu("/system/resource")
        identity = identity_records[0] if identity_records else {}
        resource = resource_records[0] if resource_records else {}
        return {
            "identity": identity.get("name"),
            "version": resource.get("version"),
            "board-name": resource.get("board-name"),
            "uptime": resource.get("uptime"),
        }

    def upsert_hotspot_user(
        self,
        *,
        username: str,
        password: str,
        comment: str | None,
        profile_name: str | None,
        server_name: str | None,
        limit_uptime: str | None,
        active: bool,
    ) -> dict[str, str]:
        existing = next((row for row in self.print_menu("/ip/hotspot/user") if row.get("name") == username), None)
        payload = {
            "name": username,
            "password": password,
            "comment": comment,
            "profile": profile_name,
            "server": server_name,
            "limit-uptime": limit_uptime,
            "disabled": "no" if active else "yes",
        }

        if existing and existing.get(".id"):
            self.command("/ip/hotspot/user/set", **{".id": existing[".id"], **payload})
        else:
            self.command("/ip/hotspot/user/add", **payload)

        synced = next((row for row in self.print_menu("/ip/hotspot/user") if row.get("name") == username), None)
        if synced is None:
            raise RouterOsError("Router did not return the created hotspot user")
        return synced

    def list_hotspot_active(self) -> list[dict[str, str]]:
        return self.print_menu("/ip/hotspot/active")

    def _talk(self, words: Iterable[str]) -> tuple[list[dict[str, str]], dict[str, str]]:
        self._write_sentence(words)
        records: list[dict[str, str]] = []
        done_attrs: dict[str, str] = {}

        while True:
            sentence = self._read_sentence()
            if not sentence:
                continue

            reply = sentence[0]
            attrs = self._parse_attributes(sentence[1:])

            if reply == "!re":
                records.append(attrs)
            elif reply == "!done":
                done_attrs = attrs
                return records, done_attrs
            elif reply in {"!trap", "!fatal"}:
                detail = attrs.get("message") or attrs.get("category") or "RouterOS API error"
                raise RouterOsError(detail)

    def _login(self, username: str, password: str) -> None:
        _, done = self.command("/login", name=username, password=password)
        challenge = done.get("ret")
        if not challenge:
            return

        digest = hashlib.md5(b"\x00" + password.encode("utf-8") + binascii.unhexlify(challenge)).hexdigest()
        self.command("/login", name=username, response=f"00{digest}")

    def _write_sentence(self, words: Iterable[str]) -> None:
        for word in words:
            self._write_word(word)
        self._write_word("")

    def _read_sentence(self) -> list[str]:
        sentence: list[str] = []
        while True:
            word = self._read_word()
            if word == "":
                return sentence
            sentence.append(word)

    def _write_word(self, word: str) -> None:
        data = word.encode("utf-8")
        self._write_length(len(data))
        self._write_bytes(data)

    def _read_word(self) -> str:
        length = self._read_length()
        if length == 0:
            return ""
        return self._read_bytes(length).decode("utf-8", errors="replace")

    def _write_length(self, length: int) -> None:
        if length < 0x80:
            encoded = bytes([length])
        elif length < 0x4000:
            encoded = (length | 0x8000).to_bytes(2, "big")
        elif length < 0x200000:
            encoded = (length | 0xC00000).to_bytes(3, "big")
        elif length < 0x10000000:
            encoded = (length | 0xE0000000).to_bytes(4, "big")
        else:
            encoded = b"\xF0" + length.to_bytes(4, "big")
        self._write_bytes(encoded)

    def _read_length(self) -> int:
        first = self._read_bytes(1)[0]
        if (first & 0x80) == 0:
            return first
        if (first & 0xC0) == 0x80:
            return ((first & 0x3F) << 8) + self._read_bytes(1)[0]
        if (first & 0xE0) == 0xC0:
            tail = self._read_bytes(2)
            return ((first & 0x1F) << 16) + (tail[0] << 8) + tail[1]
        if (first & 0xF0) == 0xE0:
            tail = self._read_bytes(3)
            return ((first & 0x0F) << 24) + (tail[0] << 16) + (tail[1] << 8) + tail[2]
        tail = self._read_bytes(4)
        return (tail[0] << 24) + (tail[1] << 16) + (tail[2] << 8) + tail[3]

    def _write_bytes(self, data: bytes) -> None:
        if self._socket is None:
            raise RouterOsError("RouterOS socket is not connected")
        try:
            self._socket.sendall(data)
        except OSError as exc:
            raise RouterOsError(str(exc)) from exc

    def _read_bytes(self, size: int) -> bytes:
        if self._socket is None:
            raise RouterOsError("RouterOS socket is not connected")

        buffer = bytearray()
        while len(buffer) < size:
            try:
                chunk = self._socket.recv(size - len(buffer))
            except OSError as exc:
                raise RouterOsError(str(exc)) from exc
            if not chunk:
                raise RouterOsError("Connection closed by remote router")
            buffer.extend(chunk)
        return bytes(buffer)

    @staticmethod
    def _parse_attributes(words: Iterable[str]) -> dict[str, str]:
        attributes: dict[str, str] = {}
        for word in words:
            if word.startswith("="):
                separator = word.find("=", 1)
                if separator == -1:
                    attributes[word[1:]] = ""
                else:
                    attributes[word[1:separator]] = word[separator + 1 :]
            else:
                attributes[word] = ""
        return attributes
