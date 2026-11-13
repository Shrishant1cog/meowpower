from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, utc_now


class ProviderModelCatalog(Base):
    """Cached model identifiers for one provider configuration and endpoint."""

    __tablename__ = "provider_model_catalogs"
    __table_args__ = (
        UniqueConstraint(
            "provider_config_id",
            "endpoint_key",
            name="uq_provider_model_catalog_endpoint",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    provider_config_id: Mapped[int] = mapped_column(
        ForeignKey("ai_provider_configs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    endpoint_key: Mapped[str] = mapped_column(String(64), nullable=False)
    endpoint_url: Mapped[str] = mapped_column(String(1024), nullable=False)
    credential_profile_id: Mapped[int | None] = mapped_column(
        ForeignKey("provider_credential_profiles.id", ondelete="SET NULL"), nullable=True
    )
    models_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now
    )
