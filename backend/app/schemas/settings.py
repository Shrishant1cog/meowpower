from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict

Theme = Literal["light", "dark", "system"]


class SettingsPatch(BaseModel):
    theme: Theme | None = None


class FolderSummary(BaseModel):
    selection_state: Literal["selected", "cancelled", "none"] = "none"
    folder_token: str | None = None
    display_name: str | None = None
    message: str | None = None


class SettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    theme: Theme
    music_folder: FolderSummary
    version: str
