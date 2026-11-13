from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class DirectoryPickResponse(BaseModel):
    selection_state: Literal["selected", "cancelled"]
    folder_token: str | None = None
    display_name: str | None = None
    message: str
