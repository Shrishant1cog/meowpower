# MeowPower Security Model — Phase 1 / Phase 1.5

## Threat model

MeowPower handles private local media, transcripts, music files, AI credentials, and eventual YouTube OAuth tokens. The primary risks are unintended network exposure, cross-origin state changes, path disclosure, secret leakage, unsafe subprocess execution, malformed local input, and ambiguous job state after interruption.

## Controls implemented in Phase 1 and Phase 1.5

### Network exposure

- Backend startup target is `127.0.0.1:8000`.
- Frontend target is `127.0.0.1:5173`.
- The server does not bind to `0.0.0.0`.
- Trusted Host middleware allows only `127.0.0.1` and `localhost`.
- CORS allows only the two local frontend origins and does not enable credentialed cross-origin requests.
- `scripts/start.ps1` waits for readiness and rejects a listener bound to a non-loopback address.

### Origin validation

State-changing `POST`, `PATCH`, `PUT`, and `DELETE` requests are rejected when their `Origin` header is present and not an allowed local frontend origin. Requests without an Origin header remain usable by local command-line clients and tests.

This is a defense-in-depth control, not a replacement for binding to loopback. Browser origin handling and loopback binding remain the primary controls.

### Credentials

- API keys are write-only request fields.
- Secrets are stored through the OS credential manager using `keyring`; the installed backend is `keyring.backends.Windows.WinVaultKeyring`.
- Named credential profiles live in `provider_credential_profiles`; SQLite stores only an opaque reference and user-visible label.
- `ai_provider_configs.credential_ref` remains the compatibility mirror of the active profile so Phase 1 integrations and downgrade behavior stay deterministic.
- Provider/profile responses expose `stored`, `missing`, or `unavailable`, never key material or the reference.
- Logs do not log request bodies, credential references, or provider secrets.
- The React bundle never receives a stored secret; it submits a write-only key and receives only masked status/label data.
- An unavailable credential store returns an explicit `503 credential_store_unavailable` error.
- Profile replacement/removal and provider deletion remove the corresponding OS credential-store entry.
- The native Windows credential vault was exercised live for named-profile create, list/mask, activation, replacement, removal, and provider deletion.
- Alembic revision `20260113_0003` copies each legacy opaque reference into a `Migrated credential` profile without reading, moving, or rewriting the secret in Windows Credential Manager.

### Provider network requests

- The browser never calls a model-list provider directly; the backend owns every request that can use a credential.
- Official OpenAI, Google Gemini, Anthropic, and NVIDIA NIM requests use fixed HTTPS endpoints. OpenAI-compatible and Ollama use their configured base endpoint.
- Remote endpoints require HTTPS. Plaintext HTTP is accepted only for `localhost`/loopback.
- Endpoint URLs cannot contain embedded credentials or fragments and are length-bounded.
- The provider client uses bounded connect/read timeouts, disables redirects, ignores environment proxy settings, and rejects response bodies larger than 2 MB.
- Upstream 401/403 responses become sanitized `provider_authentication_error`; timeouts/connection failures become `provider_network_error`; invalid or oversized bodies become `provider_response_error`.
- Upstream response bodies, request authorization headers, API secrets, and credential references are never returned to the browser or written to logs.

### Local paths

- The native picker stores an absolute path only in the backend database.
- API responses expose an opaque folder token and display name only.
- Frontend source uses browser-selected file metadata and never asks the backend to reveal a local path.
- Test coverage explicitly asserts that the selected absolute path is absent from responses.
- Selected paths are canonicalized with `resolve(strict=True)` and checked to be accessible directories.
- A new folder row is flushed before the settings foreign-key token is updated, preventing an invalid transient foreign-key reference.

### Database

- SQLite uses WAL, foreign keys, a busy timeout, and SQLAlchemy parameterized queries.
- Each request/worker operation uses an independent async session.
- Exceptions trigger rollback.
- Alembic owns schema evolution.
- Secrets are not columns in the application database.
- Alembic revision `20260113_0002` adds the settings-to-folder foreign key and unique partial indexes that permit only one active folder and one active provider.
- Alembic revision `20260113_0003` adds named credential profiles, persisted model catalogs, provider endpoint/active-profile fields, foreign keys, and the safe legacy-reference conversion.
- The Phase 1.5 migration was exercised on the live database: the existing provider row/reference stayed exact, the Windows Vault secret stayed present, and the new `Migrated credential` profile pointed to the same opaque reference.
- `PRAGMA integrity_check` returns `ok`; `PRAGMA foreign_key_check` is empty.

### Input, errors, and logging

- Pydantic v2 validates request bodies and field bounds.
- API errors use stable codes and safe messages.
- Validation errors report field locations/types without echoing rejected values, including secrets.
- Unexpected exceptions return a generic public message; details go to the project-local rotating JSON log.
- Alembic migration startup preserves the application's root logger and JSON file handler instead of replacing them.
- The folder picker is protected by a lock so duplicate native dialogs cannot open concurrently.
- Tk objects are created and destroyed in their dedicated GUI thread.
- Public job failure messages are sanitized while detailed exception traces remain in structured logs.
- Provider discovery errors are also sanitized; upstream status details contain no response body, URL credential, or submitted key.

### Job integrity

- Job state changes and event insertion are serialized by a per-job event lock.
- Every persisted event stores its sequence in both the event row and JSON payload.
- A settled job cannot be overwritten by a late worker event.
- Cancellation and recovery are atomic with their terminal event.
- The frontend rejects duplicate, regressing, malformed, and unrelated-job events.
- The cancel-response/SSE ordering is idempotent: when the cancellation response supplies the terminal snapshot before the persisted terminal event arrives, the duplicate terminal event closes the stream without advancing state again, and exactly one cancellation notification is shown.
- Refresh recovery uses the persisted snapshot and event cursor rather than trusting stale browser state.

### Process execution

No FFmpeg or external media process is launched in Phase 1 or Phase 1.5. Future subprocesses must use argument arrays, never shell interpolation, and must enforce timeout, cancellation, output limits, and cleanup.

## Data retention and location

All application writes remain under the MeowPower root. `.gitignore` excludes the virtual environment, `node_modules`, database, logs, models, caches, temporary files, and generated media. `.env` is excluded. The sample `.env.example` contains no secrets.

### OneDrive placement caveat

The current project root is physically below the configured OneDrive Personal Desktop root:

```text
C:\Users\user\OneDrive\Desktop\Projects\Clipper\meowpower
```

At audit time the OneDrive client was stopped and its Personal SyncEngine database contained no `Clipper` or `meowpower` record, so current synchronization was not proven. However, the OneDrive root, OneDrive Desktop, and `Projects` directories are reparse points, and Windows maps the Desktop known folder to `C:\Users\user\OneDrive\Desktop`. A future OneDrive start could therefore automatically pick up the project. Moving or relocating the project was not performed without developer approval. Until that decision is made, the project-local storage guarantee means “all application-owned writes stay under this root,” not “this root is outside every synchronization product.”

## Future controls required before external publication

- Google OAuth authorization-code flow with PKCE/state validation and exact redirect URI restrictions.
- OAuth tokens in the OS credential store, not SQLite or logs.
- YouTube scopes requested narrowly and documented in the UI.
- Explicit cloud-provider opt-in before any source/transcript/music content is sent externally.
- Final human review before publishing; default visibility is private/unlisted until selected.
- Content declarations, copyright/music licensing checks, and versioned compliance validation.
- Rate limits and retry boundaries for Google APIs.
- Audit records that contain no secret values.

## Security review status

The Phase 1.5 security review is complete for the implemented local application scope. Automated coverage includes origin-independent local calls, provider/profile masking, unavailable credential stores, named-profile lifecycle behavior, safe provider endpoint validation, sanitized upstream errors, path non-disclosure, validation-envelope secrecy, SQLite constraints and migration compatibility, logging preservation, and cancellation/SSE idempotency.

Live verification additionally confirmed that the installed credential backend is Windows Credential Manager, the migrated NVIDIA secret remained present without being rewritten, temporary named profiles could be created, activated, replaced, and removed without exposing secrets, remote provider traffic stayed backend-owned, and the browser console remained error-free. `npm audit --omit=dev` reported zero vulnerabilities, `pip check` reported no broken requirements, the live SQLite integrity/foreign-key checks passed, and the final Ruff/Pytest/TypeScript/Vitest/build suites passed.

No unresolved critical issue was identified within the authorized Phase 1/Phase 1.5 boundary. The OneDrive placement caveat remains an environmental decision requiring explicit developer approval before relocation. Formal external penetration testing, OAuth review, cloud hardening, and publication controls remain future-phase/Phase 17 work. No automated check can guarantee YouTube acceptance or safe media licensing.
