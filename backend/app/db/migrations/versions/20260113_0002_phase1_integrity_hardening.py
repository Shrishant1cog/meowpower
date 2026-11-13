"""Phase 1 integrity hardening.

Revision ID: 20260113_0002
Revises: 20260101_0001
Create Date: 2026-01-13 00:00:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "20260113_0002"
down_revision: str | None = "20260101_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("app_settings") as batch:
        batch.create_foreign_key(
            "fk_app_settings_music_folder_token",
            "music_folders",
            ["music_folder_token"],
            ["token"],
            ondelete="SET NULL",
        )
    op.create_index(
        "uq_music_folders_single_active",
        "music_folders",
        ["is_active"],
        unique=True,
        sqlite_where=sa.text("is_active = 1"),
    )
    op.create_index(
        "uq_ai_provider_configs_single_active",
        "ai_provider_configs",
        ["is_active"],
        unique=True,
        sqlite_where=sa.text("is_active = 1"),
    )


def downgrade() -> None:
    op.drop_index("uq_ai_provider_configs_single_active", table_name="ai_provider_configs")
    op.drop_index("uq_music_folders_single_active", table_name="music_folders")
    with op.batch_alter_table("app_settings") as batch:
        batch.drop_constraint("fk_app_settings_music_folder_token", type_="foreignkey")
