from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.app_settings import AppSettings
from app.repositories.settings_repository import (
    get_active_music_folder,
    get_or_create_settings,
)
from app.schemas.settings import FolderSummary, SettingsPatch, SettingsResponse


class SettingsService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, version: str) -> SettingsResponse:
        settings = await get_or_create_settings(self.session)
        folder = await get_active_music_folder(self.session)
        if folder is None:
            music_folder = FolderSummary(
                selection_state="none",
                message="No local music folder has been selected.",
            )
        else:
            music_folder = FolderSummary(
                selection_state="selected",
                folder_token=folder.token,
                display_name=folder.display_name,
                message="Local music folder selected.",
            )
        return SettingsResponse(
            theme=settings.theme,
            music_folder=music_folder,
            version=version,
        )

    async def update(self, data: SettingsPatch) -> AppSettings:
        settings = await get_or_create_settings(self.session)
        if data.theme is not None:
            settings.theme = data.theme
        await self.session.flush()
        return settings
