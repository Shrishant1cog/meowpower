from __future__ import annotations

import httpx
import pytest

from app.integrations.model_discovery import get_model_discovery_adapter


@pytest.mark.asyncio
@pytest.mark.parametrize(
    (
        "provider_type",
        "configured_endpoint",
        "expected_url",
        "expected_header",
        "payload",
        "expected_models",
    ),
    [
        (
            "openai",
            None,
            "https://api.openai.com/v1/models",
            ("authorization", "Bearer provider-secret"),
            {"data": [{"id": "gpt-test"}, {"id": "gpt-test"}, {"id": "o3-test"}]},
            ["gpt-test", "o3-test"],
        ),
        (
            "google_gemini",
            None,
            "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000",
            ("x-goog-api-key", "provider-secret"),
            {"models": [{"name": "models/gemini-test"}]},
            ["gemini-test"],
        ),
        (
            "anthropic",
            None,
            "https://api.anthropic.com/v1/models?limit=1000",
            ("x-api-key", "provider-secret"),
            {"data": [{"id": "claude-test"}]},
            ["claude-test"],
        ),
        (
            "nvidia_nim",
            None,
            "https://integrate.api.nvidia.com/v1/models",
            ("authorization", "Bearer provider-secret"),
            {"data": [{"id": "nim-test"}]},
            ["nim-test"],
        ),
        (
            "openai_compatible",
            "https://models.example.test/v1",
            "https://models.example.test/v1/models",
            ("authorization", "Bearer provider-secret"),
            {"data": [{"id": "compatible-test"}]},
            ["compatible-test"],
        ),
        (
            "ollama",
            "http://127.0.0.1:11434",
            "http://127.0.0.1:11434/api/tags",
            ("x-test-header", "absent"),
            {"models": [{"name": "local-model:latest", "model": "local-model:latest"}]},
            ["local-model:latest"],
        ),
    ],
)
async def test_provider_adapters_use_official_endpoints_and_normalize_models(
    provider_type,
    configured_endpoint,
    expected_url,
    expected_header,
    payload,
    expected_models,
):
    captured: list[httpx.Request] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json=payload, request=request)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        adapter = get_model_discovery_adapter(provider_type)
        endpoint = adapter.resolve_endpoint(configured_endpoint)
        result = await adapter.discover(client, endpoint, "provider-secret")

    assert str(captured[0].url) == expected_url
    header_name, expected_value = expected_header
    if expected_value == "absent":
        assert header_name not in captured[0].headers
    else:
        assert captured[0].headers[header_name] == expected_value
    assert result.models == expected_models


@pytest.mark.asyncio
async def test_named_credential_profiles_discovery_cache_and_switching(
    client,
    provider_http_client,
):
    provider_mock = provider_http_client.provider_mock  # type: ignore[attr-defined]
    provider_mock.payload = {"data": [{"id": "model-one"}, {"id": "model-two"}]}

    created = await client.post(
        "/api/v1/settings/providers",
        json={
            "name": "Primary OpenAI",
            "provider_type": "openai",
            "model_identifier": "model-one",
            "api_key": "primary-secret",
            "api_key_profile_name": "My NVIDIA Key",
        },
    )
    assert created.status_code == 201
    body = created.json()
    provider_id = body["id"]
    assert body["active_credential_profile_name"] == "My NVIDIA Key"
    assert body["credential_profiles"][0]["is_active"] is True
    assert "primary-secret" not in created.text
    assert "credential_ref" not in created.text

    first_profile_id = body["credential_profiles"][0]["id"]
    listed_profiles = await client.get(
        f"/api/v1/settings/providers/{provider_id}/credential-profiles"
    )
    assert listed_profiles.status_code == 200
    assert listed_profiles.json() == body["credential_profiles"]

    discovered = await client.get(f"/api/v1/settings/providers/{provider_id}/models")
    assert discovered.status_code == 200
    assert discovered.json()["models"] == ["model-one", "model-two"]
    assert discovered.json()["selected_model_available"] is True
    assert provider_mock.requests[0].headers["authorization"] == "Bearer primary-secret"

    cached = await client.get(f"/api/v1/settings/providers/{provider_id}/models")
    assert cached.status_code == 200
    assert cached.json()["source"] == "cache"
    assert len(provider_mock.requests) == 1

    second_profile = await client.post(
        f"/api/v1/settings/providers/{provider_id}/credential-profiles",
        json={
            "label": "Secondary key",
            "api_key": "secondary-secret",
            "is_active": True,
        },
    )
    assert second_profile.status_code == 201
    second_profile_id = second_profile.json()["id"]
    assert second_profile.json()["is_active"] is True
    assert "secondary-secret" not in second_profile.text

    switched = await client.get(
        f"/api/v1/settings/providers/{provider_id}/models",
        params={"credential_profile_id": second_profile_id},
    )
    assert switched.status_code == 200
    assert switched.json()["source"] == "provider"
    assert len(provider_mock.requests) == 2
    assert provider_mock.requests[1].headers["authorization"] == "Bearer secondary-secret"

    providers = await client.get("/api/v1/settings/providers")
    assert providers.status_code == 200
    saved = providers.json()[0]
    assert saved["active_credential_profile_id"] == second_profile_id
    assert saved["active_credential_profile_name"] == "Secondary key"
    assert {profile["id"] for profile in saved["credential_profiles"]} == {
        first_profile_id,
        second_profile_id,
    }


@pytest.mark.asyncio
async def test_model_discovery_reports_auth_network_and_empty_states(
    client,
    provider_http_client,
):
    provider_mock = provider_http_client.provider_mock  # type: ignore[attr-defined]
    created = await client.post(
        "/api/v1/settings/providers",
        json={
            "name": "Discovery states",
            "provider_type": "openai",
            "model_identifier": "manual-model",
            "api_key": "provider-secret",
        },
    )
    provider_id = created.json()["id"]

    provider_mock.status_code = 401
    unauthorized = await client.get(
        f"/api/v1/settings/providers/{provider_id}/models",
        params={"refresh": "true"},
    )
    assert unauthorized.status_code == 502
    assert unauthorized.json()["error"]["code"] == "provider_authentication_error"
    assert "provider-secret" not in unauthorized.text

    provider_mock.status_code = 200
    provider_mock.error = httpx.ConnectError("offline")
    network_error = await client.get(
        f"/api/v1/settings/providers/{provider_id}/models",
        params={"refresh": "true"},
    )
    assert network_error.status_code == 502
    assert network_error.json()["error"]["code"] == "provider_network_error"

    provider_mock.error = None
    provider_mock.payload = {"data": []}
    empty = await client.get(
        f"/api/v1/settings/providers/{provider_id}/models",
        params={"refresh": "true"},
    )
    assert empty.status_code == 200
    assert empty.json()["models"] == []
    assert empty.json()["selected_model_available"] is False


@pytest.mark.asyncio
async def test_test_connection_uses_a_genuine_provider_response(client, provider_http_client):
    provider_mock = provider_http_client.provider_mock  # type: ignore[attr-defined]
    provider_mock.payload = {"data": [{"id": "connected-model"}]}
    created = await client.post(
        "/api/v1/settings/providers",
        json={
            "name": "Connection test",
            "provider_type": "openai",
            "model_identifier": "connected-model",
            "api_key": "provider-secret",
            "api_key_profile_name": "Primary key",
        },
    )
    provider_id = created.json()["id"]

    response = await client.post(
        f"/api/v1/settings/providers/{provider_id}/test-connection",
        json={},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "connected"
    assert response.json()["model_count"] == 1
    assert response.json()["credential_profile_name"] == "Primary key"
    assert provider_mock.requests[-1].url == "https://api.openai.com/v1/models"
