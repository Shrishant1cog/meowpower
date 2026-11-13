from __future__ import annotations

from fastapi import APIRouter, Request

from app.schemas.settings import SettingsPatch, SettingsResponse
from app.services.settings_service import SettingsService

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("", response_model=SettingsResponse)
async def get_settings(request: Request) -> SettingsResponse:
    async with request.app.state.session_factory() as session:
        service = SettingsService(session)
        response = await service.get(request.app.state.settings.app_version)
        await session.commit()
        return response


@router.patch("", response_model=SettingsResponse)
async def update_settings(
    payload: SettingsPatch,
    request: Request,
) -> SettingsResponse:
    async with request.app.state.session_factory() as session:
        service = SettingsService(session)
        await service.update(payload)
        response = await service.get(request.app.state.settings.app_version)
        await session.commit()
        return response
