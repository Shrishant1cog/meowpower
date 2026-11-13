from __future__ import annotations

import sqlite3
import sys
import uuid

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
from app.integrations.credential_store import KeyringCredentialStore
from app.main import create_app


@pytest.mark.asyncio
async def test_windows_credential_manager_round_trip_through_backend(tmp_path, directory_picker):
    if sys.platform != "win32":
        pytest.skip("Windows Credential Manager is only available on Windows")

    store = KeyringCredentialStore()
    if not store.available:
        pytest.skip("Windows Credential Manager backend is unavailable")

    reference = f"phase1-audit:{uuid.uuid4()}"
    first_secret = "temporary-audit-secret-1"
    replacement_secret = "temporary-audit-secret-2"
    try:
        store.set(reference, first_secret)
        assert store.get(reference) == first_secret
        store.set(reference, replacement_secret)
        assert store.get(reference) == replacement_secret
    finally:
        store.delete(reference)
    assert store.get(reference) is None

    settings = Settings(project_root=tmp_path)
    app = create_app(
        settings,
        credential_store=store,
        directory_picker=directory_picker,
    )
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(
            transport=transport,
            base_url="http://127.0.0.1:8000",
        ) as api:
            created = await api.post(
                "/api/v1/settings/providers",
                json={
                    "name": "Windows vault audit provider",
                    "provider_type": "openai",
                    "model_identifier": "audit-model",
                    "api_key": replacement_secret,
                },
            )
            assert created.status_code == 201
            assert replacement_secret not in created.text
            assert created.json()["credential_status"] == "stored"

            with sqlite3.connect(settings.database_path) as connection:
                stored_reference = connection.execute(
                    "SELECT credential_ref FROM ai_provider_configs WHERE id = ?",
                    (created.json()["id"],),
                ).fetchone()[0]
            assert stored_reference.startswith("provider:")
            assert replacement_secret not in stored_reference
            assert store.get(stored_reference) == replacement_secret

            removed = await api.patch(
                f"/api/v1/settings/providers/{created.json()['id']}",
                json={"remove_credential": True},
            )
            assert removed.status_code == 200
            assert removed.json()["credential_status"] == "missing"
            assert store.get(stored_reference) is None

            deleted = await api.delete(f"/api/v1/settings/providers/{created.json()['id']}")
            assert deleted.status_code == 204
            assert store.get(stored_reference) is None
