from __future__ import annotations

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class AIProviderConfig(TimestampMixin, Base):
    __tablename__ = "ai_provider_configs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    provider_type: Mapped[str] = mapped_column(String(64), nullable=False)
    model_identifier: Mapped[str] = mapped_column(String(255), nullable=False)
    endpoint_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    # Retained as a compatibility pointer to the active profile's opaque keyring
    # reference. New code uses active_credential_profile_id and the profile table.
    credential_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    active_credential_profile_id: Mapped[int | None] = mapped_column(
        ForeignKey("provider_credential_profiles.id", ondelete="SET NULL"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(default=False, nullable=False, index=True)
