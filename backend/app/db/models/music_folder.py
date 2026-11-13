from __future__ import annotations

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class MusicFolder(TimestampMixin, Base):
    __tablename__ = "music_folders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    token: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    absolute_path: Mapped[str] = mapped_column(String(2048), nullable=False, unique=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
