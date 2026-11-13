from __future__ import annotations

from pathlib import Path

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
from app.main import create_app


class FakeCredentialStore:
    def __init__(self, available: bool = True) -> None:
        self._available = available
        self.values: dict[str, str] = {}

    @property
    def available(self) -> bool:
        return self._available

    def set(self, reference: str, secret: str) -> None:
        if not self._available:
            raise RuntimeError("unavailable")
        self.values[reference] = secret

    def get(self, reference: str) -> str | None:
        return self.values.get(reference)

    def delete(self, reference: str) -> None:
        self.values.pop(reference, None)


class FakeDirectoryPicker:
    def __init__(self) -> None:
        self.result: Path | None = None
        self.error: Exception | None = None

    async def pick_directory(self) -> Path | None:
        if self.error:
            raise self.error
        return self.result


class MockProviderApi:
    def __init__(self) -> None:
        self.status_code = 200
        self.payload: dict[str, object] = {"data": []}
        self.error: Exception | None = None
        self.requests: list[httpx.Request] = []

    async def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.error is not None:
            raise self.error
        return httpx.Response(
            self.status_code,
            json=self.payload,
            request=request,
        )


@pytest.fixture
async def provider_http_client() -> AsyncClient:
    state = MockProviderApi()
    client = AsyncClient(transport=httpx.MockTransport(state.handler))
    client.provider_mock = state  # type: ignore[attr-defined]
    try:
        yield client
    finally:
        await client.aclose()


@pytest.fixture
def credential_store() -> FakeCredentialStore:
    return FakeCredentialStore()


@pytest.fixture
def directory_picker() -> FakeDirectoryPicker:
    return FakeDirectoryPicker()


@pytest.fixture
async def client(
    tmp_path: Path,
    credential_store,
    directory_picker,
    provider_http_client,
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
        model_discovery_http_client=provider_http_client,
    )
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(transport=transport, base_url="http://127.0.0.1:8000") as api:
            yield api
