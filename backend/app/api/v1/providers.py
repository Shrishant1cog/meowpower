from __future__ import annotations

from fastapi import APIRouter, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.provider import (
    ConnectionTestRequest,
    ConnectionTestResponse,
    CredentialProfileCreate,
    CredentialProfileResponse,
    CredentialProfileUpdate,
    ModelCatalogResponse,
    ProviderCreate,
    ProviderResponse,
    ProviderUpdate,
)
from app.services.model_discovery_service import ModelDiscoveryService
from app.services.provider_service import ProviderService

router = APIRouter(prefix="/settings/providers", tags=["settings", "providers"])


def _service(request: Request, session: AsyncSession) -> ProviderService:
    return ProviderService(session, request.app.state.credential_store)


def _model_service(request: Request, session: AsyncSession) -> ModelDiscoveryService:
    return ModelDiscoveryService(
        session,
        request.app.state.credential_store,
        request.app.state.model_discovery_http_client,
        request.app.state.settings,
    )


@router.get("", response_model=list[ProviderResponse])
async def list_providers(request: Request) -> list[ProviderResponse]:
    async with request.app.state.session_factory() as session:
        response = await _service(request, session).list()
        await session.commit()
        return response


@router.post("", response_model=ProviderResponse, status_code=status.HTTP_201_CREATED)
async def create_provider(payload: ProviderCreate, request: Request) -> ProviderResponse:
    async with request.app.state.session_factory() as session:
        response = await _service(request, session).create(payload)
        await session.commit()
        return response


@router.patch("/{provider_id}", response_model=ProviderResponse)
async def update_provider(
    provider_id: int,
    payload: ProviderUpdate,
    request: Request,
) -> ProviderResponse:
    async with request.app.state.session_factory() as session:
        response = await _service(request, session).update(provider_id, payload)
        await session.commit()
        return response


@router.delete("/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_provider(provider_id: int, request: Request) -> Response:
    async with request.app.state.session_factory() as session:
        await _service(request, session).delete(provider_id)
        await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{provider_id}/credential-profiles",
    response_model=list[CredentialProfileResponse],
)
async def list_credential_profiles(
    provider_id: int,
    request: Request,
) -> list[CredentialProfileResponse]:
    async with request.app.state.session_factory() as session:
        providers = _service(request, session)
        profiles = await providers.list_credential_profiles(provider_id)
        await session.commit()
        return profiles


@router.post(
    "/{provider_id}/credential-profiles",
    response_model=CredentialProfileResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_credential_profile(
    provider_id: int,
    payload: CredentialProfileCreate,
    request: Request,
) -> CredentialProfileResponse:
    async with request.app.state.session_factory() as session:
        response = await _service(request, session).create_credential_profile(
            provider_id, payload
        )
        await session.commit()
        return response


@router.patch(
    "/{provider_id}/credential-profiles/{profile_id}",
    response_model=CredentialProfileResponse,
)
async def update_credential_profile(
    provider_id: int,
    profile_id: int,
    payload: CredentialProfileUpdate,
    request: Request,
) -> CredentialProfileResponse:
    async with request.app.state.session_factory() as session:
        response = await _service(request, session).update_credential_profile(
            provider_id, profile_id, payload
        )
        await session.commit()
        return response


@router.delete(
    "/{provider_id}/credential-profiles/{profile_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_credential_profile(
    provider_id: int,
    profile_id: int,
    request: Request,
) -> Response:
    async with request.app.state.session_factory() as session:
        await _service(request, session).delete_credential_profile(provider_id, profile_id)
        await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{provider_id}/models", response_model=ModelCatalogResponse)
async def discover_models(
    provider_id: int,
    request: Request,
    refresh: bool = Query(default=False),
    credential_profile_id: int | None = Query(default=None),
) -> ModelCatalogResponse:
    async with request.app.state.session_factory() as session:
        response = await _model_service(request, session).discover(
            provider_id,
            credential_profile_id=credential_profile_id,
            refresh=refresh,
        )
        await session.commit()
        return response


@router.post(
    "/{provider_id}/test-connection",
    response_model=ConnectionTestResponse,
)
async def test_provider_connection(
    provider_id: int,
    payload: ConnectionTestRequest,
    request: Request,
) -> ConnectionTestResponse:
    async with request.app.state.session_factory() as session:
        response = await _model_service(request, session).test_connection(
            provider_id,
            credential_profile_id=payload.credential_profile_id,
        )
        await session.commit()
        return response
