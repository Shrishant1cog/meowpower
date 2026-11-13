from __future__ import annotations

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class AppSettings(TimestampMixin, Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True, default=1)
    theme: Mapped[str] = mapped_column(String(16), nullable=False, default="system")
    music_folder_token: Mapped[str | None] = mapped_column(
        String(128),
        ForeignKey("music_folders.token", ondelete="SET NULL"),
        nullable=True,
    )
