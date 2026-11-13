"""Phase 1.5 named credentials and model discovery catalogs.

Revision ID: 20260113_0003
Revises: 20260113_0002
Create Date: 2026-01-13 00:01:00
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260113_0003"
down_revision: str | None = "20260113_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "provider_credential_profiles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("provider_config_id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column("credential_ref", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["provider_config_id"],
            ["ai_provider_configs.id"],
            name="fk_provider_credential_profiles_provider",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "provider_config_id",
            "label",
            name="uq_provider_credential_profile_label",
        ),
        sa.UniqueConstraint("credential_ref", name="uq_provider_credential_profile_ref"),
    )
    op.create_index(
        "ix_provider_credential_profiles_provider_config_id",
        "provider_credential_profiles",
        ["provider_config_id"],
    )

    op.create_table(
        "provider_model_catalogs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("provider_config_id", sa.Integer(), nullable=False),
        sa.Column("endpoint_key", sa.String(length=64), nullable=False),
        sa.Column("endpoint_url", sa.String(length=1024), nullable=False),
        sa.Column("credential_profile_id", sa.Integer(), nullable=True),
        sa.Column("models_json", sa.Text(), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["credential_profile_id"],
            ["provider_credential_profiles.id"],
            name="fk_provider_model_catalogs_credential_profile",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["provider_config_id"],
            ["ai_provider_configs.id"],
            name="fk_provider_model_catalogs_provider",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "provider_config_id",
            "endpoint_key",
            name="uq_provider_model_catalog_endpoint",
        ),
    )
    op.create_index(
        "ix_provider_model_catalogs_provider_config_id",
        "provider_model_catalogs",
        ["provider_config_id"],
    )

    with op.batch_alter_table("ai_provider_configs") as batch:
        batch.add_column(sa.Column("endpoint_url", sa.String(length=1024), nullable=True))
        batch.add_column(sa.Column("active_credential_profile_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_ai_provider_configs_active_credential_profile",
            "provider_credential_profiles",
            ["active_credential_profile_id"],
            ["id"],
            ondelete="SET NULL",
        )

    # Preserve every Phase 1 provider credential by moving its opaque keyring
    # reference into a named profile. The secret itself never enters SQLite.
    connection = op.get_bind()
    legacy_rows = list(
        connection.execute(
            sa.text(
                "SELECT id, credential_ref FROM ai_provider_configs "
                "WHERE credential_ref IS NOT NULL ORDER BY id"
            )
        ).mappings()
    )
    for row in legacy_rows:
        result = connection.execute(
            sa.text(
                "INSERT INTO provider_credential_profiles "
                "(provider_config_id, label, credential_ref, created_at, updated_at) "
                "VALUES (:provider_id, :label, :credential_ref, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
            ),
            {
                "provider_id": row["id"],
                "label": "Migrated credential",
                "credential_ref": row["credential_ref"],
            },
        )
        profile_id = result.lastrowid
        connection.execute(
            sa.text(
                "UPDATE ai_provider_configs "
                "SET active_credential_profile_id = :profile_id WHERE id = :provider_id"
            ),
            {"profile_id": profile_id, "provider_id": row["id"]},
        )


def downgrade() -> None:
    connection = op.get_bind()
    # Keep the active profile's opaque reference in the Phase 1 column so a
    # downgrade does not orphan the credential currently used by the provider.
    connection.execute(
        sa.text(
            "UPDATE ai_provider_configs SET credential_ref = ("
            "SELECT credential_ref FROM provider_credential_profiles "
            "WHERE provider_credential_profiles.id = "
            "ai_provider_configs.active_credential_profile_id"
            ")"
        )
    )

    op.drop_index(
        "ix_provider_model_catalogs_provider_config_id",
        table_name="provider_model_catalogs",
    )
    op.drop_table("provider_model_catalogs")
    with op.batch_alter_table("ai_provider_configs") as batch:
        batch.drop_constraint(
            "fk_ai_provider_configs_active_credential_profile", type_="foreignkey"
        )
        batch.drop_column("active_credential_profile_id")
        batch.drop_column("endpoint_url")
    op.drop_index(
        "ix_provider_credential_profiles_provider_config_id",
        table_name="provider_credential_profiles",
    )
    op.drop_table("provider_credential_profiles")
