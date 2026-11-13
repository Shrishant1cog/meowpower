from __future__ import annotations

import json
from datetime import UTC, datetime

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import APIError, NotFoundError
from app.db.models.ai_provider_config import AIProviderConfig
from app.db.models.provider_credential_profile import ProviderCredentialProfile
from app.integrations.credential_store import CredentialStore
from app.integrations.model_discovery import (
    ModelDiscoveryFailure,
    endpoint_cache_key,
    get_model_discovery_adapter,
)
from app.repositories.provider_repository import (
    get_credential_profile,
    get_model_catalog,
    get_provider,
    upsert_model_catalog,
)
from app.schemas.provider import ConnectionTestResponse, ModelCatalogResponse


class ModelDiscoveryService:
    def __init__(
        self,
        session: AsyncSession,
        credential_store: CredentialStore,
        http_client: httpx.AsyncClient,
        settings: Settings,
    ) -> None:
        self.session = session
        self.credential_store = credential_store
        self.http_client = http_client
        self.settings = settings

    async def _provider(self, provider_id: int) -> AIProviderConfig:
        provider = await get_provider(self.session, provider_id)
        if provider is None:
            raise NotFoundError("AI provider configuration was not found")
        return provider

    async def _profile(
        self,
        provider: AIProviderConfig,
        credential_profile_id: int | None,
    ) -> ProviderCredentialProfile | None:
        if credential_profile_id is None:
            if provider.active_credential_profile_id is None:
                return None
            return await self.session.get(
                ProviderCredentialProfile, provider.active_credential_profile_id
            )
        profile = await get_credential_profile(
            self.session, provider.id, credential_profile_id
        )
        if profile is None:
            raise NotFoundError("Credential profile was not found")
        return profile

    @staticmethod
    def _cache_age_seconds(fetched_at: datetime) -> float:
        if fetched_at.tzinfo is None:
            fetched_at = fetched_at.replace(tzinfo=UTC)
        return max(0.0, (datetime.now(UTC) - fetched_at).total_seconds())

    async def discover(
        self,
        provider_id: int,
        *,
        credential_profile_id: int | None = None,
        refresh: bool = False,
    ) -> ModelCatalogResponse:
        provider = await self._provider(provider_id)
        adapter = get_model_discovery_adapter(provider.provider_type)
        try:
            endpoint_url = adapter.resolve_endpoint(provider.endpoint_url)
        except ModelDiscoveryFailure as exc:
            raise APIError(exc.status_code, exc.code, exc.message, exc.details) from exc

        profile = await self._profile(provider, credential_profile_id)
        api_key: str | None = None
        if profile is not None:
            if not self.credential_store.available:
                raise APIError(
                    503,
                    "credential_store_unavailable",
                    "The operating-system credential store is unavailable.",
                )
            api_key = self.credential_store.get(profile.credential_ref)
            if api_key is None:
                raise APIError(
                    409,
                    "provider_credential_missing",
                    "The selected credential profile does not contain a stored API key.",
                )
        elif adapter.requires_credential:
            raise APIError(
                409,
                "provider_credential_missing",
                "Add or select an API key profile before discovering models.",
            )

        cache_key = endpoint_cache_key(provider.provider_type, endpoint_url)
        catalog = await get_model_catalog(self.session, provider.id, cache_key)
        cache_matches_profile = (
            catalog is not None
            and catalog.credential_profile_id == (profile.id if profile is not None else None)
        )
        cache_is_fresh = (
            catalog is not None
            and self._cache_age_seconds(catalog.fetched_at)
            < self.settings.model_catalog_ttl_seconds
        )
        if not refresh and cache_matches_profile and cache_is_fresh and catalog is not None:
            models = self._decode_models(catalog.models_json)
            return self._response(
                provider,
                endpoint_url,
                models,
                catalog.fetched_at,
                source="cache",
                cache_ttl_seconds=self.settings.model_catalog_ttl_seconds,
            )

        try:
            discovered = await adapter.discover(self.http_client, endpoint_url, api_key)
        except ModelDiscoveryFailure as exc:
            raise APIError(exc.status_code, exc.code, exc.message, exc.details) from exc

        stored = await upsert_model_catalog(
            self.session,
            provider_id=provider.id,
            endpoint_key=cache_key,
            endpoint_url=endpoint_url,
            credential_profile_id=profile.id if profile is not None else None,
            models=discovered.models,
        )
        return self._response(
            provider,
            endpoint_url,
            discovered.models,
            stored.fetched_at,
            source="provider",
            cache_ttl_seconds=self.settings.model_catalog_ttl_seconds,
        )

    async def test_connection(
        self,
        provider_id: int,
        credential_profile_id: int | None = None,
    ) -> ConnectionTestResponse:
        provider = await self._provider(provider_id)
        profile = await self._profile(provider, credential_profile_id)
        catalog = await self.discover(
            provider_id,
            credential_profile_id=credential_profile_id,
            refresh=True,
        )
        return ConnectionTestResponse(
            status="connected",
            provider_id=provider.id,
            provider_name=provider.name,
            provider_type=provider.provider_type,
            endpoint_url=catalog.endpoint_url,
            credential_profile_name=profile.label if profile is not None else None,
            model_count=len(catalog.models),
            checked_at=datetime.now(UTC),
        )

    @staticmethod
    def _decode_models(value: str) -> list[str]:
        try:
            payload = json.loads(value)
        except (json.JSONDecodeError, TypeError):
            return []
        if not isinstance(payload, list):
            return []
        return [model for model in payload if isinstance(model, str)]

    @staticmethod
    def _response(
        provider: AIProviderConfig,
        endpoint_url: str,
        models: list[str],
        fetched_at: datetime,
        *,
        source: str,
        cache_ttl_seconds: int,
    ) -> ModelCatalogResponse:
        return ModelCatalogResponse(
            provider_id=provider.id,
            provider_name=provider.name,
            provider_type=provider.provider_type,
            endpoint_url=endpoint_url,
            models=models,
            fetched_at=fetched_at,
            cache_ttl_seconds=cache_ttl_seconds,
            source=source,
            selected_model=provider.model_identifier,
            selected_model_available=provider.model_identifier in models,
        )
