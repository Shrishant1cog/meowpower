from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

ProviderType = Literal[
    "openai",
    "google_gemini",
    "anthropic",
    "nvidia_nim",
    "openai_compatible",
    "ollama",
    "local",
]
CredentialStatus = Literal["missing", "stored", "unavailable"]


def _strip(value: str) -> str:
    return value.strip()


class ProviderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    provider_type: ProviderType
    model_identifier: str = Field(min_length=1, max_length=255)
    endpoint_url: str | None = Field(default=None, max_length=1024)
    api_key: str | None = Field(default=None, min_length=1, max_length=4096)
    api_key_profile_name: str | None = Field(default=None, min_length=1, max_length=120)
    is_active: bool = False

    @field_validator("name", "model_identifier", "api_key_profile_name")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None


class ProviderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    model_identifier: str | None = Field(default=None, min_length=1, max_length=255)
    endpoint_url: str | None = Field(default=None, max_length=1024)
    api_key: str | None = Field(default=None, min_length=1, max_length=4096)
    api_key_profile_name: str | None = Field(default=None, min_length=1, max_length=120)
    is_active: bool | None = None
    remove_credential: bool = False

    @field_validator("name", "model_identifier", "api_key_profile_name")
    @classmethod
    def strip_text(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None


class CredentialProfileCreate(BaseModel):
    label: str = Field(min_length=1, max_length=120)
    api_key: str = Field(min_length=1, max_length=4096)
    is_active: bool = True

    @field_validator("label")
    @classmethod
    def strip_label(cls, value: str) -> str:
        return _strip(value)


class CredentialProfileUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=120)
    api_key: str | None = Field(default=None, min_length=1, max_length=4096)
    is_active: bool | None = None

    @field_validator("label")
    @classmethod
    def strip_label(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None


class CredentialProfileResponse(BaseModel):
    id: int
    label: str
    credential_status: CredentialStatus
    has_credential: bool
    is_active: bool


class ProviderResponse(BaseModel):
    id: int
    name: str
    provider_type: ProviderType
    model_identifier: str
    endpoint_url: str | None
    is_active: bool
    credential_status: CredentialStatus
    has_credential: bool
    active_credential_profile_id: int | None
    active_credential_profile_name: str | None
    credential_profiles: list[CredentialProfileResponse]


class ModelCatalogResponse(BaseModel):
    provider_id: int
    provider_name: str
    provider_type: ProviderType
    endpoint_url: str
    models: list[str]
    fetched_at: datetime
    cache_ttl_seconds: int
    source: Literal["cache", "provider"]
    selected_model: str
    selected_model_available: bool


class ConnectionTestRequest(BaseModel):
    credential_profile_id: int | None = None


class ConnectionTestResponse(BaseModel):
    status: Literal["connected"]
    provider_id: int
    provider_name: str
    provider_type: ProviderType
    endpoint_url: str
    credential_profile_name: str | None
    model_count: int
    checked_at: datetime
