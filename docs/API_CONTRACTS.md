# MeowPower Phase 1 / Phase 1.5 API Contracts

Base URL: `http://127.0.0.1:8000`

All payloads use JSON unless noted. Errors use a stable, safe envelope:

```json
{
  "error": {
    "code": "machine_readable_code",
    "message": "Human-readable safe message",
    "details": {}
  }
}
```

`details` is optional. Validation details identify field locations and validation types only; submitted values, API secrets, credential references, and absolute filesystem paths are never echoed. No response exposes an API secret, credential reference, or selected absolute filesystem path.

## `GET /api/v1/health`

Returns service readiness.

```json
{
  "status": "ok",
  "app": "MeowPower API",
  "version": "0.1.5-phase1.5",
  "phase": 1,
  "database": "connected"
}
```

## `GET /api/v1/settings`

Returns persisted application settings and a privacy-safe folder summary.

```json
{
  "theme": "system",
  "music_folder": {
    "selection_state": "none",
    "folder_token": null,
    "display_name": null,
    "message": "No local music folder has been selected."
  },
  "version": "0.1.5-phase1.5"
}
```

`theme` is `light`, `dark`, or `system`.

## `PATCH /api/v1/settings`

Request:

```json
{ "theme": "dark" }
```

All fields are optional. Returns the same shape as `GET /api/v1/settings`.

## `GET /api/v1/settings/providers`

Returns all provider configurations and their masked named credential profiles:

```json
[
  {
    "id": 1,
    "name": "Primary OpenAI",
    "provider_type": "openai",
    "model_identifier": "example-model",
    "endpoint_url": null,
    "is_active": true,
    "credential_status": "stored",
    "has_credential": true,
    "active_credential_profile_id": 4,
    "active_credential_profile_name": "Personal key",
    "credential_profiles": [
      {
        "id": 4,
        "label": "Personal key",
        "credential_status": "stored",
        "has_credential": true,
        "is_active": true
      }
    ]
  }
]
```

`provider_type` is one of `openai`, `google_gemini`, `anthropic`, `nvidia_nim`, `openai_compatible`, `ollama`, or `local`.

`credential_status` is `stored`, `missing`, or `unavailable`. A response never contains the credential reference or key material. `active_credential_profile_id` and `active_credential_profile_name` identify the profile used for provider requests.

## `POST /api/v1/settings/providers`

Request:

```json
{
  "name": "Primary OpenAI",
  "provider_type": "openai",
  "model_identifier": "example-model",
  "endpoint_url": null,
  "api_key": "optional-secret",
  "api_key_profile_name": "Personal key",
  "is_active": true
}
```

`api_key` is write-only. It is sent to the OS credential store and is never returned. When supplied, it creates an active named profile; `api_key_profile_name` defaults to `Primary credential`. Local providers may omit it. Returns `201` with one provider response.

`endpoint_url` is accepted for `openai_compatible` and `ollama`. Official-provider discovery uses its fixed endpoint and ignores custom endpoint values.

If the credential store is unavailable and a key was supplied, the API returns `503 credential_store_unavailable` and does not claim that the key was saved.

## `PATCH /api/v1/settings/providers/{provider_id}`

Optional request fields:

```json
{
  "name": "Renamed provider",
  "model_identifier": "new-model",
  "endpoint_url": "https://models.example.test/v1",
  "api_key": "replacement-secret",
  "api_key_profile_name": "Renamed active profile",
  "is_active": true,
  "remove_credential": false
}
```

This supports rename, model change, endpoint change, activation, compatibility replacement of the active profile's key, renaming the active profile, and removal of the active profile while keeping the provider configuration. `api_key` and `remove_credential` are compatibility operations; new UI flows use the named-profile collection endpoints below. Returns the updated provider response. Removed credentials are deleted from the OS credential store; no secret is returned.

## `DELETE /api/v1/settings/providers/{provider_id}`

Removes provider metadata and every associated credential-profile/vault entry. Returns `204` with no body.

## `GET /api/v1/settings/providers/{provider_id}/credential-profiles`

Returns the provider's named profiles using the same masked profile shape shown in the provider response. Returns `200` with an array.

## `POST /api/v1/settings/providers/{provider_id}/credential-profiles`

Request:

```json
{
  "label": "Secondary key",
  "api_key": "write-only-secret",
  "is_active": true
}
```

Creates a profile in Windows Credential Manager and persists only its opaque reference. `is_active` defaults to `true`; making a profile active updates the provider's compatibility mirror and invalidates model catalogs tied to the previous active profile. Returns `201` with the masked profile. Duplicate labels within one provider return `409 credential_profile_label_exists`.

## `PATCH /api/v1/settings/providers/{provider_id}/credential-profiles/{profile_id}`

Optional request fields:

```json
{
  "label": "Renamed key",
  "api_key": "replacement-secret",
  "is_active": true
}
```

Renames, replaces, or activates a named profile. The replacement secret is write-only and invalidates the profile's cached catalog. Returns `200` with the masked profile.

## `DELETE /api/v1/settings/providers/{provider_id}/credential-profiles/{profile_id}`

Deletes the profile row, its cached catalog, and its Windows Credential Manager entry. If it was active, the provider selects another remaining profile as active or becomes credentialless. Returns `204` with no body.

## `GET /api/v1/settings/providers/{provider_id}/models`

Discovers or returns the provider's genuine model catalog. Optional query parameters:

- `refresh=true` forces an upstream request and replaces the persisted catalog;
- `credential_profile_id={id}` selects a specific named profile; when omitted, the provider's active profile is used.

A cached response is returned only while it is younger than 900 seconds and its provider type, effective endpoint, and selected profile still match. Response:

```json
{
  "provider_id": 1,
  "provider_name": "Primary OpenAI",
  "provider_type": "openai",
  "endpoint_url": "https://api.openai.com/v1/models",
  "models": ["gpt-example", "o3-example"],
  "fetched_at": "2026-01-01T12:00:00Z",
  "cache_ttl_seconds": 900,
  "source": "provider",
  "selected_model": "gpt-example",
  "selected_model_available": true
}
```

`source` is `provider` for a fresh upstream request and `cache` for a valid persisted catalog. A model list can be empty. `selected_model_available` is false when the configured model is not in the catalog; the configured model remains selected for manual fallback.

Official request mapping:

| Provider | Effective request URL | Authentication |
|---|---|---|
| `openai` | `https://api.openai.com/v1/models` | `Authorization: Bearer ...` |
| `google_gemini` | `https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000` | `x-goog-api-key: ...` |
| `anthropic` | `https://api.anthropic.com/v1/models?limit=1000` | `x-api-key: ...` plus `anthropic-version: 2023-06-01` |
| `nvidia_nim` | `https://integrate.api.nvidia.com/v1/models` | `Authorization: Bearer ...` |
| `openai_compatible` | configured base URL plus `/models` | optional `Authorization: Bearer ...` |
| `ollama` | configured base URL plus `/api/tags` | none |

Remote endpoints require HTTPS. Plaintext HTTP is accepted only for loopback hosts. `local` has no automatic model-list adapter and returns `422 provider_discovery_unsupported`.

## `POST /api/v1/settings/providers/{provider_id}/test-connection`

Performs a genuine upstream model-list request using the selected profile and returns:

```json
{
  "status": "connected",
  "provider_id": 1,
  "provider_name": "Primary OpenAI",
  "provider_type": "openai",
  "endpoint_url": "https://api.openai.com/v1/models",
  "credential_profile_name": "Personal key",
  "model_count": 2,
  "checked_at": "2026-01-01T12:00:00Z"
}
```

Optional request body:

```json
{ "credential_profile_id": 4 }
```

When omitted, the active profile is used. Test Connection always refreshes upstream; it does not report connectivity from cached metadata.

## Provider discovery errors

Discovery uses the standard safe error envelope. Important codes are:

- `provider_endpoint_required` / `provider_endpoint_invalid` — `422`;
- `provider_credential_missing` — `409`;
- `credential_store_unavailable` — `503`;
- `provider_authentication_error` — `502` for upstream 401/403;
- `provider_network_error` — `502` for timeout/connection failure;
- `provider_response_error` — `502` for an invalid/oversized/unexpected upstream response;
- `provider_discovery_unsupported` — `422`.

Upstream bodies, secrets, credential references, and absolute local paths are never echoed.

## `POST /api/system/pick-directory`

Opens the native Windows folder picker on one dedicated GUI thread.

Successful selection:

```json
{
  "selection_state": "selected",
  "folder_token": "opaque-random-token",
  "display_name": "Authorized Music",
  "message": "Music folder selected. Its absolute path remains private to the backend."
}
```

Cancellation:

```json
{
  "selection_state": "cancelled",
  "folder_token": null,
  "display_name": null,
  "message": "Folder selection was cancelled. The previous selection is unchanged."
}
```

Cancellation and picker failure do not modify the prior selection. The endpoint classifies failures as `409 dialog_already_open`, `503 native_dialog_unavailable`, `400 invalid_directory`, or `500 directory_picker_failed`.

## `GET /api/system/music-folder`

Returns the active folder summary without its absolute path.

## `DELETE /api/system/music-folder`

Clears the active folder selection and returns:

```json
{
  "selection_state": "none",
  "folder_token": null,
  "display_name": null,
  "message": "Local music folder selection cleared."
}
```

## `POST /api/v1/jobs/demo`

Creates the simulated Phase 1 partial workflow (`foundation_demo`). It remains a configuration/streaming demonstration; Phase 1.5 does not execute production media or model stages.

Request:

```json
{ "request_id": "b4cb3f17-aec2-4c22-94e8-e7b60d449b26" }
```

`request_id` is the client idempotency key and must contain 8–128 characters. Repeating the same key returns the existing job ID rather than creating a duplicate. A new request after a terminal job uses a new key.

Response (`201`):

```json
{
  "id": "e9061d96-92e8-4fda-b9a3-87b5b10f68ce",
  "job_type": "foundation_demo",
  "status": "queued",
  "stage": "queued",
  "stage_label": "Queued",
  "operation": "Preparing the Phase 1 partial workflow",
  "progress_percent": 0,
  "elapsed_seconds": 0,
  "eta_remaining_seconds": null,
  "message": "Simulated workflow activity queued",
  "error_message": null,
  "created_at": "2026-01-01T12:00:00Z",
  "updated_at": "2026-01-01T12:00:00Z",
  "started_at": null,
  "completed_at": null,
  "last_event_sequence": 0
}
```

## `GET /api/v1/jobs/active`

Returns the latest recoverable in-progress job after a refresh or application restart:

```json
{
  "job": {
    "id": "e9061d96-92e8-4fda-b9a3-87b5b10f68ce",
    "status": "running",
    "last_event_sequence": 7
  }
}
```

The `job` member is `null` when there is no active job. The response is a wrapper; the complete job snapshot uses the same shape as job creation.

## `GET /api/v1/jobs/{job_id}`

Returns the current persistent job snapshot using the same shape as job creation. `last_event_sequence` is the authoritative persisted event cursor for that job.

## `GET /api/v1/jobs/{job_id}/events`

Returns `text/event-stream`. The browser uses `EventSource` and should not set custom headers.

The initial subscription accepts a non-negative query cursor:

```text
GET /api/v1/jobs/{job_id}/events?after=7
```

Reconnect replay may also use the standard `Last-Event-ID` header automatically supplied by the browser. If both are present, `Last-Event-ID` takes precedence. An invalid or negative `Last-Event-ID` returns `400 invalid_event_cursor`; a negative `after` value fails request validation with `422`.

See `docs/SSE_PROTOCOL.md` for the frame, payload, cursor, and replay schema.

## `POST /api/v1/jobs/{job_id}/cancel`

Requests real cancellation of the partial-workflow worker. Returns the current job snapshot, including `last_event_sequence`, and persists one terminal cancellation event. Terminal jobs remain terminal. The browser treats the response and persisted terminal event idempotently so only one notification is shown and the SSE stream closes without reconnect loops.

## Status codes

| Code | Meaning |
|---|---|
| 200 | Successful read/update |
| 201 | Resource created |
| 204 | Resource deleted |
| 400 | Invalid local input or invalid SSE cursor |
| 403 | Request origin is not an allowed local frontend |
| 404 | Job/provider/resource not found |
| 409 | Dialog, credential, or operation conflict |
| 422 | Pydantic request validation failed or provider endpoint/discovery is unsupported |
| 500 | Unexpected local service error |
| 502 | Upstream provider authentication, network, or response failure |
| 503 | Required credential store or native desktop dialog is unavailable |
