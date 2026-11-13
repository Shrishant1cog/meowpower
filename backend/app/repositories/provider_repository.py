from __future__ import annotations

import json
from datetime import UTC, datetime

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.ai_provider_config import AIProviderConfig
from app.db.models.provider_credential_profile import ProviderCredentialProfile
from app.db.models.provider_model_catalog import ProviderModelCatalog


async def list_providers(session: AsyncSession) -> list[AIProviderConfig]:
    result = await session.scalars(
        select(AIProviderConfig).order_by(
            AIProviderConfig.is_active.desc(), AIProviderConfig.created_at.asc()
        )
    )
    return list(result)


async def get_provider(session: AsyncSession, provider_id: int) -> AIProviderConfig | None:
    return await session.get(AIProviderConfig, provider_id)


async def deactivate_providers(session: AsyncSession) -> None:
    await session.execute(update(AIProviderConfig).values(is_active=False))


async def list_credential_profiles(
    session: AsyncSession,
    provider_id: int,
) -> list[ProviderCredentialProfile]:
    result = await session.scalars(
        select(ProviderCredentialProfile)
        .where(ProviderCredentialProfile.provider_config_id == provider_id)
        .order_by(ProviderCredentialProfile.created_at.asc(), ProviderCredentialProfile.id.asc())
    )
    return list(result)


async def get_credential_profile(
    session: AsyncSession,
    provider_id: int,
    profile_id: int,
) -> ProviderCredentialProfile | None:
    return await session.scalar(
        select(ProviderCredentialProfile).where(
            ProviderCredentialProfile.id == profile_id,
            ProviderCredentialProfile.provider_config_id == provider_id,
        )
    )


async def get_model_catalog(
    session: AsyncSession,
    provider_id: int,
    endpoint_key: str,
) -> ProviderModelCatalog | None:
    return await session.scalar(
        select(ProviderModelCatalog).where(
            ProviderModelCatalog.provider_config_id == provider_id,
            ProviderModelCatalog.endpoint_key == endpoint_key,
        )
    )


async def delete_model_catalogs(
    session: AsyncSession,
    provider_id: int,
    *,
    credential_profile_id: int | None = None,
) -> None:
    statement = delete(ProviderModelCatalog).where(
        ProviderModelCatalog.provider_config_id == provider_id
    )
    if credential_profile_id is not None:
        statement = statement.where(
            ProviderModelCatalog.credential_profile_id == credential_profile_id
        )
    await session.execute(statement)


async def upsert_model_catalog(
    session: AsyncSession,
    *,
    provider_id: int,
    endpoint_key: str,
    endpoint_url: str,
    credential_profile_id: int | None,
    models: list[str],
) -> ProviderModelCatalog:
    catalog = await get_model_catalog(session, provider_id, endpoint_key)
    if catalog is None:
        catalog = ProviderModelCatalog(
            provider_config_id=provider_id,
            endpoint_key=endpoint_key,
            endpoint_url=endpoint_url,
            credential_profile_id=credential_profile_id,
            models_json=json.dumps(models),
        )
        session.add(catalog)
    else:
        catalog.endpoint_url = endpoint_url
        catalog.credential_profile_id = credential_profile_id
        catalog.models_json = json.dumps(models)
        catalog.fetched_at = datetime.now(UTC)
    await session.flush()
    return catalog
