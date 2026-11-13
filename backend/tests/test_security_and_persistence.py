from __future__ import annotations

import json
import logging
import sqlite3
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.config import Settings
from app.main import create_app, run_migrations

BACKEND_DIR = Path(__file__).resolve().parents[1]


@pytest.mark.asyncio
async def test_host_origin_cors_and_validation_security(client):
    invalid_host = await client.get(
        "/api/v1/health",
        headers={"Host": "attacker.invalid"},
    )
    assert invalid_host.status_code == 400

    invalid_origin = await client.patch(
        "/api/v1/settings",
        json={"theme": "dark"},
        headers={"Origin": "https://attacker.invalid"},
    )
    assert invalid_origin.status_code == 403
    assert invalid_origin.json()["error"]["code"] == "origin_not_allowed"

    allowed_origin = await client.patch(
        "/api/v1/settings",
        json={"theme": "dark"},
        headers={"Origin": "http://127.0.0.1:5173"},
    )
    assert allowed_origin.status_code == 200

    preflight = await client.options(
        "/api/v1/settings",
        headers={
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "PATCH",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"
    assert "credentials" not in preflight.headers.get("access-control-allow-credentials", "")


@pytest.mark.asyncio
async def test_validation_and_unexpected_errors_do_not_echo_secrets(client):
    secret = "credential-that-must-never-be-echoed"
    validation = await client.post(
        "/api/v1/settings/providers",
        json={
            "name": "Invalid provider",
            "provider_type": "openai",
            "model_identifier": "model",
            "api_key": "x" * 5000,
        },
    )
    assert validation.status_code == 422
    assert validation.json()["error"]["code"] == "validation_error"
    assert secret not in validation.text

    app = client._transport.app  # type: ignore[attr-defined]

    async def fail_with_private_detail(_job_id: str):
        raise RuntimeError("private implementation detail")

    app.state.job_manager.get_job = fail_with_private_detail  # type: ignore[method-assign]
    failure = await client.get("/api/v1/jobs/private-job")
    assert failure.status_code == 500
    assert failure.json()["error"]["code"] == "internal_error"
    assert "private implementation detail" not in failure.text


@pytest.mark.asyncio
async def test_migrations_preserve_application_logging_and_json_audit_log(client, tmp_path):
    worker_logger = logging.getLogger("app.workers.job_manager")
    assert worker_logger.disabled is False
    assert worker_logger.isEnabledFor(logging.INFO)

    worker_logger.info("phase1 logging persistence probe")
    for handler in logging.getLogger().handlers:
        handler.flush()

    log_path = tmp_path / "logs" / "meowpower.log"
    assert log_path.exists()
    records = [
        json.loads(line)
        for line in log_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    assert any(
        record["logger"] == "app.workers.job_manager"
        and record["message"] == "phase1 logging persistence probe"
        for record in records
    )


@pytest.mark.asyncio
async def test_database_pragmas_foreign_keys_indexes_and_opaque_credentials(
    client,
    credential_store,
    tmp_path,
):
    app = client._transport.app  # type: ignore[attr-defined]
    async with app.state.engine.connect() as connection:
        foreign_keys = await connection.scalar(text("PRAGMA foreign_keys"))
        journal_mode = await connection.scalar(text("PRAGMA journal_mode"))
    assert foreign_keys == 1
    assert str(journal_mode).lower() == "wal"

    response = await client.post(
        "/api/v1/settings/providers",
        json={
            "name": "Opaque reference provider",
            "provider_type": "openai",
            "model_identifier": "model",
            "api_key": "temporary-secret-value",
            "is_active": True,
        },
    )
    assert response.status_code == 201
    assert "credential_ref" not in response.text
    assert "temporary-secret-value" not in response.text

    database_path = tmp_path / "storage" / "database" / "meowpower.db"
    with sqlite3.connect(database_path) as connection:
        reference = connection.execute(
            "SELECT credential_ref FROM ai_provider_configs WHERE id = ?",
            (response.json()["id"],),
        ).fetchone()[0]
        indexes = {
            row[1]
            for row in connection.execute(
                "SELECT type, name FROM sqlite_master WHERE type = 'index'"
            )
        }
        app_settings_foreign_keys = connection.execute(
            "PRAGMA foreign_key_list(app_settings)"
        ).fetchall()
    assert reference.startswith("provider:")
    assert "temporary-secret-value" not in reference
    assert "uq_music_folders_single_active" in indexes
    assert "uq_ai_provider_configs_single_active" in indexes
    assert any(row[2] == "music_folders" for row in app_settings_foreign_keys)


@pytest.mark.asyncio
async def test_credential_replacement_removal_and_deletion_are_masked(
    client,
    credential_store,
):
    created = await client.post(
        "/api/v1/settings/providers",
        json={
            "name": "Credential lifecycle",
            "provider_type": "openai",
            "model_identifier": "model",
            "api_key": "first-temporary-secret",
        },
    )
    assert created.status_code == 201
    provider_id = created.json()["id"]

    replaced = await client.patch(
        f"/api/v1/settings/providers/{provider_id}",
        json={"api_key": "replacement-temporary-secret"},
    )
    assert replaced.status_code == 200
    assert "replacement-temporary-secret" not in replaced.text
    assert set(credential_store.values.values()) == {"replacement-temporary-secret"}

    removed = await client.patch(
        f"/api/v1/settings/providers/{provider_id}",
        json={"remove_credential": True},
    )
    assert removed.status_code == 200
    assert removed.json()["credential_status"] == "missing"
    assert removed.json()["has_credential"] is False
    assert credential_store.values == {}

    deleted = await client.delete(f"/api/v1/settings/providers/{provider_id}")
    assert deleted.status_code == 204
    assert credential_store.values == {}


@pytest.mark.asyncio
async def test_migration_upgrade_downgrade_and_reupgrade_is_reproducible(tmp_path: Path):
    settings = Settings(project_root=tmp_path)
    settings.ensure_directories()
    run_migrations(settings)
    database_path = settings.database_path
    assert database_path.exists()

    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option(
        "script_location", str(BACKEND_DIR / "app" / "db" / "migrations")
    )
    config.set_main_option(
        "sqlalchemy.url", f"sqlite:///{settings.database_path.as_posix()}"
    )
    command.downgrade(config, "base")
    with sqlite3.connect(database_path) as connection:
        remaining = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
    assert remaining == {"alembic_version"}

    command.upgrade(config, "head")
    with sqlite3.connect(database_path) as connection:
        revision = connection.execute("SELECT version_num FROM alembic_version").fetchone()[0]
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            )
        }
    assert revision == "20260113_0003"
    assert {"app_settings", "music_folders", "ai_provider_configs", "jobs", "job_events"} <= tables


@pytest.mark.asyncio
async def test_application_restart_preserves_settings_without_database_corruption(
    tmp_path,
    credential_store,
    directory_picker,
):
    settings = Settings(
        project_root=tmp_path,
        demo_stage_delay_seconds=0.03,
        job_poll_interval_seconds=0.01,
    )
    app = create_app(
        settings,
        credential_store=credential_store,
        directory_picker=directory_picker,
    )
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://127.0.0.1:8000") as first:
            response = await first.patch("/api/v1/settings", json={"theme": "dark"})
            assert response.status_code == 200

    restarted = create_app(
        settings,
        credential_store=credential_store,
        directory_picker=directory_picker,
    )
    async with restarted.router.lifespan_context(restarted):
        transport = ASGITransport(app=restarted)
        async with AsyncClient(
            transport=transport,
            base_url="http://127.0.0.1:8000",
        ) as second:
            response = await second.get("/api/v1/settings")
            assert response.status_code == 200
            assert response.json()["theme"] == "dark"

    with sqlite3.connect(settings.database_path) as connection:
        assert connection.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
        revision = connection.execute("SELECT version_num FROM alembic_version").fetchone()[0]
    assert revision == "20260113_0003"
