from __future__ import annotations

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class ProviderCredentialProfile(TimestampMixin, Base):
    """A named API-key profile belonging to one provider configuration.

    Only the opaque credential reference is persisted. The secret itself remains in
    Windows Credential Manager (or the configured operating-system keyring).
    """

    __tablename__ = "provider_credential_profiles"
    __table_args__ = (
        UniqueConstraint(
            "provider_config_id",
            "label",
            name="uq_provider_credential_profile_label",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    provider_config_id: Mapped[int] = mapped_column(
        ForeignKey("ai_provider_configs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    credential_ref: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
