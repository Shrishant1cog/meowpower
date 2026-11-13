from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import (
    ConflictError,
    CredentialStoreUnavailableError,
    NotFoundError,
)
from app.db.models.ai_provider_config import AIProviderConfig
from app.db.models.provider_credential_profile import ProviderCredentialProfile
from app.integrations.credential_store import CredentialStore
from app.repositories.provider_repository import (
    deactivate_providers,
    delete_model_catalogs,
    get_credential_profile,
    get_provider,
    list_credential_profiles,
    list_providers,
)
from app.schemas.provider import (
    CredentialProfileCreate,
    CredentialProfileResponse,
    CredentialProfileUpdate,
    ProviderCreate,
    ProviderResponse,
    ProviderUpdate,
)


class ProviderService:
    def __init__(self, session: AsyncSession, credential_store: CredentialStore) -> None:
        self.session = session
        self.credential_store = credential_store

    def _credential_status(
        self, credential_ref: str | None
    ) -> tuple[str, bool]:
        if not credential_ref:
            return "missing", False
        if not self.credential_store.available:
            return "unavailable", False
        has_credential = self.credential_store.get(credential_ref) is not None
        return ("stored" if has_credential else "missing"), has_credential

    async def _profile_response(
        self,
        profile: ProviderCredentialProfile,
        active_profile_id: int | None,
    ) -> CredentialProfileResponse:
        status, has_credential = self._credential_status(profile.credential_ref)
        return CredentialProfileResponse(
            id=profile.id,
            label=profile.label,
            credential_status=status,
            has_credential=has_credential,
            is_active=profile.id == active_profile_id,
        )

    async def _to_response(self, provider: AIProviderConfig) -> ProviderResponse:
        profiles = await list_credential_profiles(self.session, provider.id)
        active_profile = next(
            (
                profile
                for profile in profiles
                if profile.id == provider.active_credential_profile_id
            ),
            None,
        )
        status, has_credential = self._credential_status(
            active_profile.credential_ref if active_profile is not None else None
        )
        return ProviderResponse(
            id=provider.id,
            name=provider.name,
            provider_type=provider.provider_type,
            model_identifier=provider.model_identifier,
            endpoint_url=provider.endpoint_url,
            is_active=provider.is_active,
            credential_status=status,
            has_credential=has_credential,
            active_credential_profile_id=active_profile.id if active_profile is not None else None,
            active_credential_profile_name=(
                active_profile.label if active_profile is not None else None
            ),
            credential_profiles=[
                await self._profile_response(profile, provider.active_credential_profile_id)
                for profile in profiles
            ],
        )

    def _new_credential_reference(self) -> str:
        return f"provider:{uuid.uuid4()}"

    def _store_secret(self, reference: str, secret: str) -> None:
        if not self.credential_store.available:
            raise CredentialStoreUnavailableError()
        try:
            self.credential_store.set(reference, secret)
        except RuntimeError as exc:
            raise CredentialStoreUnavailableError() from exc

    async def _create_profile(
        self,
        provider: AIProviderConfig,
        *,
        label: str,
        api_key: str,
        is_active: bool,
    ) -> ProviderCredentialProfile:
        normalized_label = label.strip()
        existing_profiles = await list_credential_profiles(self.session, provider.id)
        if any(
            profile.label.casefold() == normalized_label.casefold()
            for profile in existing_profiles
        ):
            raise ConflictError(
                "credential_profile_label_exists",
                "A credential profile with that name already exists for this provider.",
            )

        reference = self._new_credential_reference()
        self._store_secret(reference, api_key)
        profile = ProviderCredentialProfile(
            provider_config_id=provider.id,
            label=normalized_label,
            credential_ref=reference,
        )
        self.session.add(profile)
        await self.session.flush()
        if is_active:
            provider.active_credential_profile_id = profile.id
            provider.credential_ref = reference
            await self.session.flush()
        return profile

    async def _active_profile(
        self, provider: AIProviderConfig
    ) -> ProviderCredentialProfile | None:
        if provider.active_credential_profile_id is None:
            return None
        return await self.session.get(
            ProviderCredentialProfile, provider.active_credential_profile_id
        )

    async def _delete_profile(
        self,
        provider: AIProviderConfig,
        profile: ProviderCredentialProfile,
    ) -> None:
        was_active = provider.active_credential_profile_id == profile.id
        reference = profile.credential_ref
        await delete_model_catalogs(
            self.session,
            provider.id,
            credential_profile_id=profile.id,
        )
        await self.session.delete(profile)
        await self.session.flush()
        self.credential_store.delete(reference)
        if was_active:
            remaining = await list_credential_profiles(self.session, provider.id)
            if remaining:
                replacement = remaining[0]
                provider.active_credential_profile_id = replacement.id
                provider.credential_ref = replacement.credential_ref
            else:
                provider.active_credential_profile_id = None
                provider.credential_ref = None
            await self.session.flush()

    async def list(self) -> list[ProviderResponse]:
        providers = await list_providers(self.session)
        return [await self._to_response(provider) for provider in providers]

    async def create(self, data: ProviderCreate) -> ProviderResponse:
        if data.is_active:
            await deactivate_providers(self.session)
        provider = AIProviderConfig(
            name=data.name,
            provider_type=data.provider_type,
            model_identifier=data.model_identifier,
            endpoint_url=data.endpoint_url.strip() if data.endpoint_url else None,
            is_active=data.is_active,
        )
        self.session.add(provider)
        await self.session.flush()

        if data.api_key is not None:
            await self._create_profile(
                provider,
                label=data.api_key_profile_name or "Primary credential",
                api_key=data.api_key,
                is_active=True,
            )
        return await self._to_response(provider)

    async def update(self, provider_id: int, data: ProviderUpdate) -> ProviderResponse:
        provider = await get_provider(self.session, provider_id)
        if provider is None:
            raise NotFoundError("AI provider configuration was not found")

        if data.name is not None:
            provider.name = data.name.strip()
        if data.model_identifier is not None:
            provider.model_identifier = data.model_identifier.strip()
        if data.endpoint_url is not None:
            next_endpoint = data.endpoint_url.strip() or None
            if next_endpoint != provider.endpoint_url:
                await delete_model_catalogs(self.session, provider.id)
            provider.endpoint_url = next_endpoint
        if data.is_active is True:
            await deactivate_providers(self.session)
            provider.is_active = True
        elif data.is_active is False:
            provider.is_active = False

        if data.remove_credential:
            active_profile = await self._active_profile(provider)
            if active_profile is not None:
                await self._delete_profile(provider, active_profile)

        active_profile = await self._active_profile(provider)
        if data.api_key is not None:
            if active_profile is None:
                await self._create_profile(
                    provider,
                    label=data.api_key_profile_name or "Primary credential",
                    api_key=data.api_key,
                    is_active=True,
                )
            else:
                self._store_secret(active_profile.credential_ref, data.api_key)
                await delete_model_catalogs(
                    self.session,
                    provider.id,
                    credential_profile_id=active_profile.id,
                )
                if data.api_key_profile_name is not None:
                    await self._rename_profile(provider, active_profile, data.api_key_profile_name)
        elif data.api_key_profile_name is not None and active_profile is not None:
            await self._rename_profile(provider, active_profile, data.api_key_profile_name)

        await self.session.flush()
        return await self._to_response(provider)

    async def _rename_profile(
        self,
        provider: AIProviderConfig,
        profile: ProviderCredentialProfile,
        label: str,
    ) -> None:
        normalized_label = label.strip()
        profiles = await list_credential_profiles(self.session, provider.id)
        if any(
            item.id != profile.id and item.label.casefold() == normalized_label.casefold()
            for item in profiles
        ):
            raise ConflictError(
                "credential_profile_label_exists",
                "A credential profile with that name already exists for this provider.",
            )
        profile.label = normalized_label
        await self.session.flush()

    async def delete(self, provider_id: int) -> None:
        provider = await get_provider(self.session, provider_id)
        if provider is None:
            raise NotFoundError("AI provider configuration was not found")
        profiles = await list_credential_profiles(self.session, provider.id)
        references = [profile.credential_ref for profile in profiles]
        provider.active_credential_profile_id = None
        provider.credential_ref = None
        await self.session.flush()
        for profile in profiles:
            await self.session.delete(profile)
        await self.session.flush()
        for reference in references:
            self.credential_store.delete(reference)
        await self.session.delete(provider)
        await self.session.flush()

    async def list_credential_profiles(
        self,
        provider_id: int,
    ) -> list[CredentialProfileResponse]:
        provider = await get_provider(self.session, provider_id)
        if provider is None:
            raise NotFoundError("AI provider configuration was not found")
        profiles = await list_credential_profiles(self.session, provider_id)
        return [
            await self._profile_response(profile, provider.active_credential_profile_id)
            for profile in profiles
        ]

    async def create_credential_profile(
        self,
        provider_id: int,
        data: CredentialProfileCreate,
    ) -> CredentialProfileResponse:
        provider = await get_provider(self.session, provider_id)
        if provider is None:
            raise NotFoundError("AI provider configuration was not found")
        profile = await self._create_profile(
            provider,
            label=data.label,
            api_key=data.api_key,
            is_active=data.is_active,
        )
        return await self._profile_response(profile, provider.active_credential_profile_id)

    async def update_credential_profile(
        self,
        provider_id: int,
        profile_id: int,
        data: CredentialProfileUpdate,
    ) -> CredentialProfileResponse:
        provider = await get_provider(self.session, provider_id)
        if provider is None:
            raise NotFoundError("AI provider configuration was not found")
        profile = await get_credential_profile(self.session, provider_id, profile_id)
        if profile is None:
            raise NotFoundError("Credential profile was not found")

        if data.label is not None:
            await self._rename_profile(provider, profile, data.label)
        if data.api_key is not None:
            self._store_secret(profile.credential_ref, data.api_key)
            await delete_model_catalogs(
                self.session,
                provider.id,
                credential_profile_id=profile.id,
            )
        if data.is_active is True:
            provider.active_credential_profile_id = profile.id
            provider.credential_ref = profile.credential_ref
        elif data.is_active is False and provider.active_credential_profile_id == profile.id:
            remaining = [
                item
                for item in await list_credential_profiles(self.session, provider_id)
                if item.id != profile.id
            ]
            if remaining:
                provider.active_credential_profile_id = remaining[0].id
                provider.credential_ref = remaining[0].credential_ref
            else:
                provider.active_credential_profile_id = None
                provider.credential_ref = None
        await self.session.flush()
        return await self._profile_response(profile, provider.active_credential_profile_id)

    async def delete_credential_profile(self, provider_id: int, profile_id: int) -> None:
        provider = await get_provider(self.session, provider_id)
        if provider is None:
            raise NotFoundError("AI provider configuration was not found")
        profile = await get_credential_profile(self.session, provider_id, profile_id)
        if profile is None:
            raise NotFoundError("Credential profile was not found")
        await self._delete_profile(provider, profile)
