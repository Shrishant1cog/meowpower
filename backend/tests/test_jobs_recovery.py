from __future__ import annotations

import asyncio
import json
import logging
import sqlite3
from contextlib import asynccontextmanager

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
from app.main import create_app


@asynccontextmanager
async def _client(settings: Settings):
    app = create_app(settings)
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(
            transport=transport,
            base_url="http://127.0.0.1:8000",
        ) as api:
            yield api, app


async def _collect_events(
    client: AsyncClient,
    url: str,
    *,
    headers: dict[str, str] | None = None,
) -> tuple[list[int], list[dict[str, object]]]:
    async with client.stream("GET", url, headers=headers) as response:
        assert response.status_code == 200
        body = "".join([chunk async for chunk in response.aiter_text()])

    ids = [
        int(line.removeprefix("id: "))
        for line in body.splitlines()
        if line.startswith("id: ")
    ]
    payloads = [
        json.loads(line.removeprefix("data: "))
        for line in body.splitlines()
        if line.startswith("data: ")
    ]
    return ids, payloads


@pytest.mark.asyncio
async def test_concurrent_idempotent_creation_creates_one_persistent_job(client, tmp_path):
    responses = await asyncio.gather(
        *[
            client.post(
                "/api/v1/jobs/demo",
                json={"request_id": "concurrent-idempotency-key"},
            )
            for _ in range(8)
        ]
    )
    assert {response.status_code for response in responses} == {201}
    job_ids = {response.json()["id"] for response in responses}
    assert len(job_ids) == 1

    with sqlite3.connect(tmp_path / "storage" / "database" / "meowpower.db") as connection:
        count = connection.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]
    assert count == 1


@pytest.mark.asyncio
async def test_active_job_discovery_and_authoritative_cursor(client):
    created = await client.post(
        "/api/v1/jobs/demo",
        json={"request_id": "active-discovery-key"},
    )
    job_id = created.json()["id"]

    active = await client.get("/api/v1/jobs/active")
    assert active.status_code == 200
    assert active.json()["job"]["id"] == job_id
    assert active.json()["job"]["last_event_sequence"] >= 0

    for _ in range(100):
        snapshot = await client.get(f"/api/v1/jobs/{job_id}")
        if snapshot.json()["status"] == "completed":
            break
        await asyncio.sleep(0.02)
    assert snapshot.json()["status"] == "completed"
    assert snapshot.json()["last_event_sequence"] > 0

    active = await client.get("/api/v1/jobs/active")
    assert active.status_code == 200
    assert active.json()["job"] is None


@pytest.mark.asyncio
async def test_event_payload_sequence_is_persisted_and_replay_cursors_work(tmp_path):
    settings = Settings(
        project_root=tmp_path,
        demo_stage_delay_seconds=0.08,
        job_poll_interval_seconds=0.02,
    )
    async with _client(settings) as (api, _app):
        created = await api.post(
            "/api/v1/jobs/demo",
            json={"request_id": "cursor-replay-key"},
        )
        job_id = created.json()["id"]

        await asyncio.sleep(0.12)
        snapshot = await api.get(f"/api/v1/jobs/{job_id}")
        cursor = snapshot.json()["last_event_sequence"]
        assert cursor >= 1

        with sqlite3.connect(settings.database_path) as connection:
            rows = connection.execute(
                "SELECT sequence, payload FROM job_events WHERE job_id = ? ORDER BY sequence",
                (job_id,),
            ).fetchall()
        assert [row[0] for row in rows] == list(range(1, len(rows) + 1))
        assert all(json.loads(row[1])["sequence"] == row[0] for row in rows)

        query_ids, query_payloads = await _collect_events(
            api,
            f"/api/v1/jobs/{job_id}/events?after={cursor}",
        )
        assert not query_ids or min(query_ids) > cursor
        assert all(
            payload["sequence"] == sequence
            for sequence, payload in zip(query_ids, query_payloads, strict=True)
        )

        header_ids, _header_payloads = await _collect_events(
            api,
            f"/api/v1/jobs/{job_id}/events?after=0",
            headers={"Last-Event-ID": str(cursor)},
        )
        assert not header_ids or min(header_ids) > cursor


@pytest.mark.asyncio
async def test_invalid_sse_cursor_is_rejected_safely(client):
    created = await client.post(
        "/api/v1/jobs/demo",
        json={"request_id": "invalid-cursor-key"},
    )
    job_id = created.json()["id"]

    invalid_header = await client.get(
        f"/api/v1/jobs/{job_id}/events",
        headers={"Last-Event-ID": "not-an-integer"},
    )
    assert invalid_header.status_code == 400
    assert invalid_header.json()["error"]["code"] == "invalid_event_cursor"

    negative_query = await client.get(f"/api/v1/jobs/{job_id}/events?after=-1")
    assert negative_query.status_code == 422


@pytest.mark.asyncio
async def test_cancellation_emits_one_terminal_event_and_cannot_be_overwritten(client):
    created = await client.post(
        "/api/v1/jobs/demo",
        json={"request_id": "atomic-cancellation-key"},
    )
    job_id = created.json()["id"]
    cancelled = await client.post(f"/api/v1/jobs/{job_id}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    assert cancelled.json()["last_event_sequence"] >= 1

    await asyncio.sleep(0.1)
    ids, payloads = await _collect_events(client, f"/api/v1/jobs/{job_id}/events")
    assert ids == list(range(1, len(ids) + 1))
    terminal = [
        payload
        for payload in payloads
        if payload["status"] in {"cancelled", "completed", "failed"}
    ]
    assert len(terminal) == 1
    assert terminal[0]["status"] == "cancelled"
    assert payloads[-1]["status"] == "cancelled"


@pytest.mark.asyncio
async def test_failure_details_are_logged_but_public_job_message_is_sanitized(
    tmp_path,
    monkeypatch,
):
    settings = Settings(
        project_root=tmp_path,
        demo_stage_delay_seconds=0.05,
        job_poll_interval_seconds=0.01,
    )
    async with _client(settings) as (api, app):
        private_detail = "private failure fixture detail"
        captured_logs: list[str] = []

        class CaptureHandler(logging.Handler):
            def emit(self, record: logging.LogRecord) -> None:
                captured_logs.append(self.format(record))

        capture_handler = CaptureHandler()
        worker_logger = logging.getLogger("app.workers.job_manager")
        worker_logger.disabled = False
        worker_logger.addHandler(capture_handler)
        assert worker_logger.isEnabledFor(logging.ERROR)

        async def fail_job_probe(_job_id: str) -> bool:
            raise RuntimeError(private_detail)

        monkeypatch.setattr(app.state.job_manager, "_job_is_running", fail_job_probe)
        created = await api.post(
            "/api/v1/jobs/demo",
            json={"request_id": "sanitized-failure-key"},
        )
        job_id = created.json()["id"]

        for _ in range(100):
            snapshot = await api.get(f"/api/v1/jobs/{job_id}")
            if snapshot.json()["status"] == "failed":
                break
            await asyncio.sleep(0.02)
        assert snapshot.json()["status"] == "failed"
        assert private_detail not in snapshot.text
        assert snapshot.json()["error_message"] == (
            "The workflow failed. See the local log for details."
        )

        _ids, payloads = await _collect_events(api, f"/api/v1/jobs/{job_id}/events")
        assert payloads[-1]["status"] == "failed"
        assert private_detail not in json.dumps(payloads)
        worker_logger.removeHandler(capture_handler)

    assert private_detail in "".join(captured_logs)


@pytest.mark.asyncio
async def test_graceful_shutdown_and_restart_make_interrupted_job_recoverable(tmp_path):
    settings = Settings(
        project_root=tmp_path,
        demo_stage_delay_seconds=5,
        job_poll_interval_seconds=0.02,
    )
    async with _client(settings) as (api, _app):
        created = await api.post(
            "/api/v1/jobs/demo",
            json={"request_id": "restart-recovery-key"},
        )
        job_id = created.json()["id"]
        assert created.status_code == 201

    async with _client(settings) as (restarted, _restarted_app):
        active = await restarted.get("/api/v1/jobs/active")
        assert active.status_code == 200
        assert active.json()["job"]["id"] == job_id
        assert active.json()["job"]["status"] == "recoverable"

        snapshot = await restarted.get(f"/api/v1/jobs/{job_id}")
        assert snapshot.json()["status"] == "recoverable"
        assert snapshot.json()["last_event_sequence"] >= 1

        _ids, payloads = await _collect_events(
            restarted,
            f"/api/v1/jobs/{job_id}/events?after=0",
        )
        assert payloads[-1]["status"] == "recoverable"
