from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.app_settings import AppSettings
from app.db.models.music_folder import MusicFolder


async def get_or_create_settings(session: AsyncSession) -> AppSettings:
    settings = await session.scalar(select(AppSettings).where(AppSettings.id == 1))
    if settings is None:
        settings = AppSettings(id=1, theme="system", music_folder_token=None)
        session.add(settings)
        await session.flush()
    return settings


async def get_active_music_folder(session: AsyncSession) -> MusicFolder | None:
    return await session.scalar(
        select(MusicFolder).where(MusicFolder.is_active.is_(True)).limit(1)
    )


async def deactivate_music_folders(session: AsyncSession) -> None:
    folders = await session.scalars(select(MusicFolder).where(MusicFolder.is_active.is_(True)))
    for folder in folders:
        folder.is_active = False
