from __future__ import annotations

import asyncio
import json
import sqlite3

import pytest

from app.integrations.directory_picker import DirectoryPickerBusyError


@pytest.mark.asyncio
async def test_application_startup_health_and_migration(client, tmp_path):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["phase"] == 1

    database_path = tmp_path / "storage" / "database" / "meowpower.db"
    assert database_path.exists()
    with sqlite3.connect(database_path) as connection:
        tables = {
            row[0]
            for row in connection.execute("SELECT name FROM sqlite_master WHERE type='table'")
        }
        revision = connection.execute("SELECT version_num FROM alembic_version").fetchone()[0]
    assert {"app_settings", "music_folders", "ai_provider_configs", "jobs", "job_events"} <= tables
    assert revision == "20260113_0003"


@pytest.mark.asyncio
async def test_settings_theme_persists(client):
    response = await client.patch("/api/v1/settings", json={"theme": "dark"})
    assert response.status_code == 200
    assert response.json()["theme"] == "dark"

    response = await client.get("/api/v1/settings")
    assert response.status_code == 200
    assert response.json()["theme"] == "dark"


@pytest.mark.asyncio
async def test_provider_configuration_and_credential_masking(client, credential_store):
    payload = {
        "name": "Primary OpenAI",
        "provider_type": "openai",
        "model_identifier": "test-model",
        "api_key": "super-secret-value",
        "is_active": True,
    }
    response = await client.post("/api/v1/settings/providers", json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["credential_status"] == "stored"
    assert body["has_credential"] is True
    assert "super-secret-value" not in response.text
    assert "credential_ref" not in body
    assert credential_store.values

    response = await client.patch(
        f"/api/v1/settings/providers/{body['id']}",
        json={"name": "Renamed OpenAI", "model_identifier": "new-model"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Renamed OpenAI"
    assert response.json()["model_identifier"] == "new-model"

    response = await client.patch(
        f"/api/v1/settings/providers/{body['id']}",
        json={"remove_credential": True},
    )
    assert response.status_code == 200
    assert response.json()["credential_status"] == "missing"
    assert response.json()["has_credential"] is False
    assert credential_store.values == {}

    response = await client.delete(f"/api/v1/settings/providers/{body['id']}")
    assert response.status_code == 204
    assert credential_store.values == {}


@pytest.mark.asyncio
async def test_unavailable_credential_store_has_clear_error(client):
    class UnavailableStore:
        available = False

        def set(self, reference: str, secret: str) -> None:
            raise RuntimeError("unavailable")

        def get(self, reference: str) -> str | None:
            return None

        def delete(self, reference: str) -> None:
            return None

    client._transport.app.state.credential_store = UnavailableStore()  # type: ignore[attr-defined]
    response = await client.post(
        "/api/v1/settings/providers",
        json={
            "name": "Remote provider",
            "provider_type": "openai",
            "model_identifier": "model",
            "api_key": "secret",
        },
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "credential_store_unavailable"
    assert "credential store is unavailable" in response.json()["error"]["message"]


@pytest.mark.asyncio
async def test_folder_token_persistence_and_path_non_disclosure(client, directory_picker, tmp_path):
    selected = tmp_path / "Authorized Music"
    selected.mkdir()
    directory_picker.result = selected

    response = await client.post("/api/system/pick-directory")
    assert response.status_code == 200
    body = response.json()
    assert body["selection_state"] == "selected"
    assert body["folder_token"]
    assert body["display_name"] == "Authorized Music"
    assert str(selected) not in response.text

    response = await client.get("/api/system/music-folder")
    assert response.status_code == 200
    assert response.json()["folder_token"] == body["folder_token"]
    assert str(selected) not in response.text

    directory_picker.result = None
    response = await client.post("/api/system/pick-directory")
    assert response.status_code == 200
    assert response.json()["selection_state"] == "cancelled"

    response = await client.get("/api/system/music-folder")
    assert response.json()["folder_token"] == body["folder_token"]
    assert response.json()["display_name"] == "Authorized Music"

    response = await client.delete("/api/system/music-folder")
    assert response.status_code == 200
    assert response.json()["selection_state"] == "none"
    response = await client.get("/api/system/music-folder")
    assert response.json()["selection_state"] == "none"


@pytest.mark.asyncio
async def test_folder_picker_busy_error_is_handled(client, directory_picker):
    directory_picker.error = DirectoryPickerBusyError("private picker detail")
    response = await client.post("/api/system/pick-directory")
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "dialog_already_open"
    assert "private picker detail" not in response.text


@pytest.mark.asyncio
async def test_job_creation_idempotency_and_completion(client):
    request_id = "same-request-identifier"
    first = await client.post("/api/v1/jobs/demo", json={"request_id": request_id})
    second = await client.post("/api/v1/jobs/demo", json={"request_id": request_id})
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] == second.json()["id"]

    for _ in range(50):
        response = await client.get(f"/api/v1/jobs/{first.json()['id']}")
        if response.json()["status"] == "completed":
            break
        await asyncio.sleep(0.03)
    assert response.json()["status"] == "completed"
    assert response.json()["progress_percent"] == 100
    assert response.json()["eta_remaining_seconds"] == 0


@pytest.mark.asyncio
async def test_sse_payload_sequential_ids_and_replay(client):
    created = await client.post(
        "/api/v1/jobs/demo", json={"request_id": "sse-request-identifier"}
    )
    job_id = created.json()["id"]

    async with client.stream("GET", f"/api/v1/jobs/{job_id}/events") as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        body = "".join([chunk async for chunk in response.aiter_text()])

    ids = [
        int(line.removeprefix("id: "))
        for line in body.splitlines()
        if line.startswith("id: ")
    ]
    assert ids == list(range(1, len(ids) + 1))
    data_lines = [
        line.removeprefix("data: ")
        for line in body.splitlines()
        if line.startswith("data: ")
    ]
    payload = json.loads(data_lines[0])
    for field in (
        "job_id",
        "status",
        "stage",
        "stage_label",
        "progress_percent",
        "elapsed_seconds",
        "eta_remaining_seconds",
        "message",
        "updated_at",
        "sequence",
    ):
        assert field in payload

    async with client.stream(
        "GET",
        f"/api/v1/jobs/{job_id}/events",
        headers={"Last-Event-ID": "1"},
    ) as replay:
        replay_body = "".join([chunk async for chunk in replay.aiter_text()])
    assert "id: 1\n" not in replay_body
    assert "id: 2\n" in replay_body


@pytest.mark.asyncio
async def test_job_cancellation(client):
    created = await client.post(
        "/api/v1/jobs/demo", json={"request_id": "cancel-request-identifier"}
    )
    job_id = created.json()["id"]
    response = await client.post(f"/api/v1/jobs/{job_id}/cancel")
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"

    async with client.stream("GET", f"/api/v1/jobs/{job_id}/events") as events:
        body = "".join([chunk async for chunk in events.aiter_text()])
    assert "cancelled" in body
