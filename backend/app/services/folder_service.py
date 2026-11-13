from __future__ import annotations

import asyncio
import secrets
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import APIError
from app.db.models.music_folder import MusicFolder
from app.integrations.directory_picker import (
    DirectoryPicker,
    DirectoryPickerBusyError,
    InvalidDirectoryError,
    NativeDialogUnavailableError,
)
from app.repositories.settings_repository import (
    deactivate_music_folders,
    get_active_music_folder,
    get_or_create_settings,
)
from app.schemas.settings import FolderSummary
from app.schemas.system import DirectoryPickResponse


def _canonical_directory(selected: Path) -> Path:
    return Path(selected).expanduser().resolve(strict=True)


class FolderService:
    def __init__(self, session: AsyncSession, picker: DirectoryPicker) -> None:
        self.session = session
        self.picker = picker

    async def get_summary(self) -> FolderSummary:
        folder = await get_active_music_folder(self.session)
        if folder is None:
            return FolderSummary(
                selection_state="none",
                message="No local music folder has been selected.",
            )
        return FolderSummary(
            selection_state="selected",
            folder_token=folder.token,
            display_name=folder.display_name,
            message="Local music folder selected.",
        )

    async def pick_directory(self) -> DirectoryPickResponse:
        try:
            selected = await self.picker.pick_directory()
        except DirectoryPickerBusyError as exc:
            raise APIError(
                409,
                "dialog_already_open",
                "A native folder selection dialog is already open.",
            ) from exc
        except NativeDialogUnavailableError as exc:
            raise APIError(
                503,
                "native_dialog_unavailable",
                "The native folder picker is unavailable in this desktop session.",
            ) from exc
        except InvalidDirectoryError as exc:
            raise APIError(
                400,
                "invalid_directory",
                "The selected folder is not accessible.",
            ) from exc
        except Exception as exc:
            raise APIError(
                500,
                "directory_picker_failed",
                "The native folder picker could not be opened.",
            ) from exc

        if selected is None:
            return DirectoryPickResponse(
                selection_state="cancelled",
                message="Folder selection was cancelled. The previous selection is unchanged.",
            )

        try:
            path = await asyncio.to_thread(_canonical_directory, Path(selected))
        except (OSError, RuntimeError) as exc:
            raise APIError(
                400,
                "invalid_directory",
                "The selected folder is not accessible.",
            ) from exc
        is_directory = await asyncio.to_thread(path.is_dir)
        if not is_directory:
            raise APIError(400, "invalid_directory", "The selected folder is not accessible.")

        await deactivate_music_folders(self.session)
        folder = await self.session.scalar(
            select(MusicFolder).where(MusicFolder.absolute_path == str(path))
        )
        if folder is None:
            folder = MusicFolder(
                token=secrets.token_urlsafe(24),
                display_name=path.name or "Selected folder",
                absolute_path=str(path),
                is_active=True,
            )
            self.session.add(folder)
            # The settings token has a foreign key to music_folders.token. Flush
            # a new folder before updating an already-persisted settings row so
            # SQLite never receives the token update before its parent row.
            await self.session.flush()
        else:
            folder.is_active = True

        app_settings = await get_or_create_settings(self.session)
        app_settings.music_folder_token = folder.token
        await self.session.flush()
        return DirectoryPickResponse(
            selection_state="selected",
            folder_token=folder.token,
            display_name=folder.display_name,
            message="Music folder selected. Its absolute path remains private to the backend.",
        )

    async def clear(self) -> FolderSummary:
        folder = await get_active_music_folder(self.session)
        if folder is None:
            return FolderSummary(
                selection_state="none",
                message="No local music folder is selected.",
            )
        folder.is_active = False
        app_settings = await get_or_create_settings(self.session)
        app_settings.music_folder_token = None
        await self.session.flush()
        return FolderSummary(
            selection_state="none",
            message="Local music folder selection cleared.",
        )
