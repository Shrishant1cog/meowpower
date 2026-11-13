from __future__ import annotations

from typing import Protocol

import keyring
from keyring.backends.fail import Keyring as FailKeyring
from keyring.errors import KeyringError


class CredentialStore(Protocol):
    @property
    def available(self) -> bool: ...

    def set(self, reference: str, secret: str) -> None: ...

    def get(self, reference: str) -> str | None: ...

    def delete(self, reference: str) -> None: ...


class KeyringCredentialStore:
    """Stores secrets in the operating-system credential vault."""

    service_name = "MeowPower"

    def __init__(self) -> None:
        try:
            backend = keyring.get_keyring()
            self._available = backend is not None and not isinstance(backend, FailKeyring)
        except Exception:
            self._available = False

    @property
    def available(self) -> bool:
        return self._available

    def set(self, reference: str, secret: str) -> None:
        try:
            keyring.set_password(self.service_name, reference, secret)
        except KeyringError as exc:
            self._available = False
            raise RuntimeError("Operating-system credential store is unavailable") from exc

    def get(self, reference: str) -> str | None:
        try:
            return keyring.get_password(self.service_name, reference)
        except KeyringError:
            self._available = False
            return None

    def delete(self, reference: str) -> None:
        try:
            keyring.delete_password(self.service_name, reference)
        except KeyringError:
            return
