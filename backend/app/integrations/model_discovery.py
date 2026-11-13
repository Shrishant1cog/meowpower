from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit, urlunsplit

import httpx

from app.db.models.ai_provider_config import AIProviderConfig


@dataclass(frozen=True)
class DiscoveredModels:
    endpoint_url: str
    models: list[str]


class ModelDiscoveryFailure(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        status_code: int = 502,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}


class ModelDiscoveryAdapter:
    provider_type: str
    default_endpoint: str | None = None
    requires_credential: bool = True

    def resolve_endpoint(self, configured_endpoint: str | None) -> str:
        endpoint = (configured_endpoint or self.default_endpoint or "").strip()
        if not endpoint:
            raise ModelDiscoveryFailure(
                "provider_endpoint_required",
                "A base endpoint is required for this provider.",
                status_code=422,
            )
        return validate_provider_endpoint(endpoint)

    async def discover(
        self,
        client: httpx.AsyncClient,
        endpoint_url: str,
        api_key: str | None,
    ) -> DiscoveredModels:
        raise NotImplementedError


class OpenAIModelDiscoveryAdapter(ModelDiscoveryAdapter):
    provider_type = "openai"
    default_endpoint = "https://api.openai.com/v1/models"

    async def discover(
        self,
        client: httpx.AsyncClient,
        endpoint_url: str,
        api_key: str | None,
    ) -> DiscoveredModels:
        payload = await request_model_catalog(
            client,
            endpoint_url,
            headers={"Authorization": f"Bearer {api_key}"},
        )
        return DiscoveredModels(endpoint_url, extract_data_ids(payload))


class GoogleGeminiModelDiscoveryAdapter(ModelDiscoveryAdapter):
    provider_type = "google_gemini"
    default_endpoint = "https://generativelanguage.googleapis.com/v1beta/models"

    async def discover(
        self,
        client: httpx.AsyncClient,
        endpoint_url: str,
        api_key: str | None,
    ) -> DiscoveredModels:
        separator = "&" if "?" in endpoint_url else "?"
        url = f"{endpoint_url}{separator}pageSize=1000"
        payload = await request_model_catalog(
            client,
            url,
            headers={"x-goog-api-key": api_key or ""},
        )
        models: list[str] = []
        for item in payload.get("models", []):
            if not isinstance(item, dict):
                continue
            name = item.get("name")
            if isinstance(name, str):
                models.append(name.removeprefix("models/"))
        return DiscoveredModels(endpoint_url, normalize_models(models))


class AnthropicModelDiscoveryAdapter(ModelDiscoveryAdapter):
    provider_type = "anthropic"
    default_endpoint = "https://api.anthropic.com/v1/models"

    async def discover(
        self,
        client: httpx.AsyncClient,
        endpoint_url: str,
        api_key: str | None,
    ) -> DiscoveredModels:
        separator = "&" if "?" in endpoint_url else "?"
        url = f"{endpoint_url}{separator}limit=1000"
        payload = await request_model_catalog(
            client,
            url,
            headers={
                "x-api-key": api_key or "",
                "anthropic-version": "2023-06-01",
            },
        )
        return DiscoveredModels(endpoint_url, extract_data_ids(payload))


class NvidiaNIMModelDiscoveryAdapter(ModelDiscoveryAdapter):
    provider_type = "nvidia_nim"
    default_endpoint = "https://integrate.api.nvidia.com/v1/models"

    async def discover(
        self,
        client: httpx.AsyncClient,
        endpoint_url: str,
        api_key: str | None,
    ) -> DiscoveredModels:
        payload = await request_model_catalog(
            client,
            endpoint_url,
            headers={"Authorization": f"Bearer {api_key}"},
        )
        return DiscoveredModels(endpoint_url, extract_data_ids(payload))


class OpenAICompatibleModelDiscoveryAdapter(ModelDiscoveryAdapter):
    provider_type = "openai_compatible"
    requires_credential = False

    def resolve_endpoint(self, configured_endpoint: str | None) -> str:
        if not configured_endpoint:
            raise ModelDiscoveryFailure(
                "provider_endpoint_required",
                "Enter the OpenAI-compatible base URL, including its /v1 path.",
                status_code=422,
            )
        endpoint = validate_provider_endpoint(configured_endpoint.strip())
        if endpoint.endswith("/models"):
            return endpoint
        return f"{endpoint.rstrip('/')}/models"

    async def discover(
        self,
        client: httpx.AsyncClient,
        endpoint_url: str,
        api_key: str | None,
    ) -> DiscoveredModels:
        headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
        payload = await request_model_catalog(client, endpoint_url, headers=headers)
        return DiscoveredModels(endpoint_url, extract_data_ids(payload))


class OllamaModelDiscoveryAdapter(ModelDiscoveryAdapter):
    provider_type = "ollama"
    default_endpoint = "http://127.0.0.1:11434"
    requires_credential = False

    def resolve_endpoint(self, configured_endpoint: str | None) -> str:
        endpoint = validate_provider_endpoint(
            (configured_endpoint or self.default_endpoint or "").strip()
        )
        if endpoint.endswith("/api/tags"):
            return endpoint
        return f"{endpoint.rstrip('/')}/api/tags"

    async def discover(
        self,
        client: httpx.AsyncClient,
        endpoint_url: str,
        api_key: str | None,
    ) -> DiscoveredModels:
        payload = await request_model_catalog(client, endpoint_url, headers={})
        models: list[str] = []
        for item in payload.get("models", []):
            if not isinstance(item, dict):
                continue
            model = item.get("model") or item.get("name")
            if isinstance(model, str):
                models.append(model)
        return DiscoveredModels(endpoint_url, normalize_models(models))


_ADAPTERS: dict[str, ModelDiscoveryAdapter] = {
    "openai": OpenAIModelDiscoveryAdapter(),
    "google_gemini": GoogleGeminiModelDiscoveryAdapter(),
    "anthropic": AnthropicModelDiscoveryAdapter(),
    "nvidia_nim": NvidiaNIMModelDiscoveryAdapter(),
    "openai_compatible": OpenAICompatibleModelDiscoveryAdapter(),
    "ollama": OllamaModelDiscoveryAdapter(),
}


def get_model_discovery_adapter(provider_type: str) -> ModelDiscoveryAdapter:
    adapter = _ADAPTERS.get(provider_type)
    if adapter is None:
        raise ModelDiscoveryFailure(
            "provider_discovery_unsupported",
            "Automatic model discovery is not available for this provider type.",
            status_code=422,
        )
    return adapter


def validate_provider_endpoint(endpoint: str) -> str:
    if len(endpoint) > 1024:
        raise ModelDiscoveryFailure(
            "provider_endpoint_invalid",
            "The provider endpoint is too long.",
            status_code=422,
        )
    parsed = urlsplit(endpoint)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ModelDiscoveryFailure(
            "provider_endpoint_invalid",
            "The provider endpoint must be an absolute HTTP or HTTPS URL.",
            status_code=422,
        )
    if parsed.username or parsed.password or parsed.fragment:
        raise ModelDiscoveryFailure(
            "provider_endpoint_invalid",
            "The provider endpoint cannot contain credentials or a fragment.",
            status_code=422,
        )
    hostname = parsed.hostname.lower()
    is_loopback = hostname in {"localhost", "127.0.0.1", "::1"} or hostname.startswith(
        "127."
    )
    if parsed.scheme != "https" and not is_loopback:
        raise ModelDiscoveryFailure(
            "provider_endpoint_invalid",
            "Use HTTPS for remote provider endpoints. HTTP is accepted only for localhost.",
            status_code=422,
        )
    normalized = urlunsplit(
        (
            parsed.scheme.lower(),
            parsed.netloc,
            parsed.path.rstrip("/") or "/",
            parsed.query,
            "",
        )
    )
    return normalized


def endpoint_cache_key(provider_type: str, endpoint_url: str) -> str:
    return hashlib.sha256(f"{provider_type}\n{endpoint_url}".encode()).hexdigest()


async def request_model_catalog(
    client: httpx.AsyncClient,
    url: str,
    *,
    headers: dict[str, str],
) -> dict[str, Any]:
    try:
        response = await client.get(url, headers=headers)
    except httpx.TimeoutException as exc:
        raise ModelDiscoveryFailure(
            "provider_network_error",
            "The provider model-list request timed out.",
        ) from exc
    except httpx.NetworkError as exc:
        raise ModelDiscoveryFailure(
            "provider_network_error",
            "The provider model-list endpoint could not be reached.",
        ) from exc
    except httpx.HTTPError as exc:
        raise ModelDiscoveryFailure(
            "provider_network_error",
            "The provider model-list request failed.",
        ) from exc

    if response.status_code in {401, 403}:
        raise ModelDiscoveryFailure(
            "provider_authentication_error",
            "The provider rejected the selected credential.",
            details={"provider_status": response.status_code},
        )
    if response.status_code >= 300:
        raise ModelDiscoveryFailure(
            "provider_response_error",
            "The provider returned an unexpected model-list response.",
            details={"provider_status": response.status_code},
        )
    if len(response.content) > 2_000_000:
        raise ModelDiscoveryFailure(
            "provider_response_error",
            "The provider model-list response exceeded the local safety limit.",
        )
    try:
        payload = response.json()
    except (json.JSONDecodeError, ValueError) as exc:
        raise ModelDiscoveryFailure(
            "provider_response_error",
            "The provider did not return a valid JSON model catalog.",
        ) from exc
    if not isinstance(payload, dict):
        raise ModelDiscoveryFailure(
            "provider_response_error",
            "The provider returned an invalid model catalog.",
        )
    return payload


def extract_data_ids(payload: dict[str, Any]) -> list[str]:
    models: list[str] = []
    data = payload.get("data")
    if not isinstance(data, list):
        return models
    for item in data:
        if isinstance(item, str):
            models.append(item)
        elif isinstance(item, dict):
            identifier = item.get("id") or item.get("name")
            if isinstance(identifier, str):
                models.append(identifier)
    return normalize_models(models)


def normalize_models(models: list[str]) -> list[str]:
    return sorted({model.strip() for model in models if model.strip()}, key=str.casefold)


def provider_endpoint(provider: AIProviderConfig) -> str:
    adapter = get_model_discovery_adapter(provider.provider_type)
    return adapter.resolve_endpoint(provider.endpoint_url)
