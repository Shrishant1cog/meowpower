from __future__ import annotations

from typing import Any


class APIError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or {}


class NotFoundError(APIError):
    def __init__(self, message: str) -> None:
        super().__init__(404, "not_found", message)


class ConflictError(APIError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(409, code, message)


class CredentialStoreUnavailableError(APIError):
    def __init__(self) -> None:
        super().__init__(
            503,
            "credential_store_unavailable",
            "The operating-system credential store is unavailable. "
            "The provider configuration was not saved with a credential.",
        )
