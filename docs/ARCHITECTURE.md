# MeowPower Architecture

## 1. Purpose and architectural stance

MeowPower is a local-first web application for turning authorized long-form video into publish-ready vertical shorts. The browser is the interface shell. A Python service owns persistence, local AI processing, media automation, credentials, and job orchestration. No source media or private transcript is transmitted to a cloud provider unless the user explicitly selects an authorized external provider.

The architecture is deliberately modular so future processing phases do not need to replace the Phase 1 foundation or the authorized Phase 1.5 enhancement. It does not include a desktop wrapper, hosted backend, remote database, telemetry, or automatic deployment.

## 2. Runtime topology

```text
Browser (React 19 / TypeScript / Vite)
  http://127.0.0.1:5173
          |
          | /api proxy (same-origin)
          v
FastAPI + Uvicorn
  http://127.0.0.1:8000
    |- API routers and Pydantic contracts
    |- services / repositories
    |- SQLAlchemy 2.x async sessions
    |      |
    |      v
    |  SQLite (WAL, foreign keys, busy timeout)
    |- OS credential manager via keyring
    |- native Tkinter picker on dedicated GUI thread
    `- bounded asyncio job workers
              |
              `- persisted job events -> native SSE
```

The backend binds only to `127.0.0.1`. The frontend Vite proxy targets `http://127.0.0.1:8000`; application code does not scatter backend URLs. The start script verifies HTTP readiness and confirms that ports 8000 and 5173 listen only on loopback.

## 3. Backend boundaries

| Layer | Responsibility | Current location |
|---|---|---|
| API | HTTP routing, typed request/response validation, status codes | `backend/app/api/` |
| Schemas | Pydantic v2 public contracts | `backend/app/schemas/` |
| Services | Business rules and transaction orchestration | `backend/app/services/` |
| Repositories | Persistence queries and model access | `backend/app/repositories/` |
| Domain models | SQLAlchemy mappings | `backend/app/db/models/` |
| Integrations | OS keyring, native folder picker, and provider model-discovery adapters | `backend/app/integrations/` |
| Workers | Long-running bounded job execution | `backend/app/workers/` |
| Core | Configuration, logging, typed errors | `backend/app/core/` |

FastAPI lifespan owns the async engine, independent session factory, job manager, credential store, picker, bounded provider HTTP client, and clean shutdown. Every request and worker operation obtains a separate `AsyncSession`; sessions are never shared concurrently.

### Database

SQLite is stored at `storage/database/meowpower.db`. Connections enable:

- WAL journal mode;
- foreign-key enforcement;
- a 5-second busy timeout;
- normal synchronous mode;
- pre-ping connection health checks.

Alembic owns schema changes. Revision `20260101_0001` creates the Phase 1 tables. Revision `20260113_0002` hardens integrity by adding the `app_settings.music_folder_token` foreign key and unique partial indexes for one active music folder and one active provider. Revision `20260113_0003` adds named provider credential profiles, persisted model catalogs, provider endpoint/active-profile fields, foreign keys/indexes, and converts each legacy credential reference into a `Migrated credential` profile without touching Windows Credential Manager. The current application head is `20260113_0003`; the application upgrades to head during lifespan startup.

Migration startup deliberately does not call Alembic's `fileConfig()`, because that function replaces root handlers and can disable the application's JSON logger. The application rotating JSON file handler remains active during migrations.

### Jobs and recovery

Phase 1's `JobManager` owns a bounded set of in-process demonstration tasks. Each job and event is persisted in SQLite. A worker uses independent sessions for each state transition. Cancellation is cooperative and checked between short simulation steps. Interrupted jobs become `recoverable` at startup rather than being silently discarded.

Each job has a per-job event lock. The lock serializes worker emission, atomic cancellation, and startup recovery so a late worker cannot overwrite a settled state. Every event stores its per-job sequence inside its JSON payload before database flush. Job snapshots expose the authoritative `last_event_sequence`. The frontend treats the cancel response and persisted terminal event idempotently: it emits one cancellation notification and closes the terminal SSE stream even when the response reaches the browser first.

`GET /api/v1/jobs/active` returns the latest active job. The browser uses that endpoint after refresh/remount, fetches the authoritative job snapshot, and then subscribes to SSE from the snapshot cursor.

Future media jobs should use bounded process workers and subprocess supervision. FastAPI `BackgroundTasks` is not suitable for long media operations.

## 4. Frontend boundaries

- **TanStack Query** owns server state: health, settings, providers, folder summary, active-job discovery, and job snapshots.
- **Zustand** owns interface state: sidebar, temporary source selection, shared workflow presentation, and notifications.
- **Central API client** owns JSON/error handling.
- **SSE hook** owns one `EventSource` subscription per active job, obtains a snapshot first, parses typed events, updates Zustand and Query cache, rejects duplicate/regressing/unrelated events, and closes terminal streams.
- **shadcn/ui source components** live under `frontend/src/components/ui/` and are editable project source.
- **Tailwind CSS v4** is loaded through `@tailwindcss/vite` and the modern CSS import.
- **Route-level lazy loading** splits Dashboard, Settings, AI Models, and planned-feature pages into production chunks. The QueryClient is owned by `App` so the provider remains stable across route transitions.
- **Motion 14** uses `LazyMotion` with asynchronous `domAnimation`, lightweight named components, consistent easing, and `MotionConfig reducedMotion="user"`. Its feature bundle remains isolated from the initial route chunks.

The top and bottom action controls render the same `WorkflowControls` behavior and read the same Zustand job state. The browser does not create progress percentages or ETA values; it displays values emitted by the backend.

## 5. SSE architecture

The backend persists every meaningful job event with a per-job monotonically increasing sequence. `GET /api/v1/jobs/{job_id}/events` polls those persisted rows and emits native SSE frames:

```text
id: 4
event: job.progress
data: {"job_id":"...","status":"running","progress_percent":36,"sequence":4}
```

The initial subscription accepts `?after=<cursor>`. Browser reconnect replay uses `Last-Event-ID`; when both are supplied, the header takes precedence. Invalid cursors fail before the stream starts. A terminal or recoverable event closes the stream. See `docs/SSE_PROTOCOL.md`.

## 6. Native directory selection

`POST /api/system/pick-directory` delegates to a dedicated single-thread executor. The Tk root and `askdirectory` dialog are created and destroyed in that same GUI thread, so the FastAPI event loop is not blocked. A lock prevents concurrent dialogs. On selection, the backend canonicalizes the path, stores an opaque token, display name, and private absolute path in SQLite, and flushes a new parent folder before updating the settings foreign-key token. Public responses contain only the token and display name. Cancellation preserves the previous selection.

## 7. Credential boundary

Provider metadata and model identifiers are stored in SQLite. API keys are stored in the operating-system credential manager through `keyring`; SQLite contains only named-profile labels, opaque references, and the active-profile compatibility mirror. Public provider/profile responses expose masked state (`stored`, `missing`, or `unavailable`) and never a secret or credential reference.

## 8. Provider model discovery

The backend owns every model-list request that can use a credential. OpenAI, Google Gemini, Anthropic, and NVIDIA NIM use fixed official HTTPS endpoints; OpenAI-compatible and Ollama use configured endpoints. Remote endpoints require HTTPS, while plaintext HTTP is accepted only for loopback. The shared HTTP client uses bounded timeouts, no redirects, no environment proxy trust, and a 2 MB response ceiling.

Persisted catalogs are reusable for 900 seconds only while provider type, effective endpoint, and selected credential-profile ID match. `refresh=true` bypasses a valid cache, and Test Connection always performs a genuine upstream request. Discovery never silently replaces the configured model; manual identifier entry remains the fallback for empty, failed, or mismatched catalogs.

## 9. Project-local data policy

Application-owned state remains under the MeowPower root:

- `storage/` for database, sources, audio, transcripts, clips, thumbnails, and music metadata;
- `models/` for downloaded model weights;
- `cache/` for dependency/model caches;
- `temp/` for temporary work and process state;
- `logs/` for structured application logs.

Runtime environment variables (`HF_HOME`, `TORCH_HOME`, `XDG_CACHE_HOME`, `PIP_CACHE_DIR`, and `NUMBA_CACHE_DIR`) are redirected into those directories where supported.

The root currently sits beneath the OneDrive Personal Desktop reparse-point hierarchy. The audit did not start OneDrive or move the project. See `docs/SECURITY.md` for the synchronization caveat.

## 10. Windows lifecycle scripts

`scripts/start.ps1` rejects occupied ports, starts both services, waits for backend and frontend HTTP readiness, and verifies loopback-only listeners. `scripts/stop.ps1` validates process identity/start time, terminates the tracked process trees, waits for ports 8000 and 5173 to be released, and fails if either remains occupied.

## 11. Planned extension seams

Future phases add modules behind existing boundaries:

- source metadata and caption retrieval under integrations/services;
- FFmpeg and media probes under a media processing service;
- transcription/alignment adapters under workers with model caches;
- scene/audio/visual analysis under bounded process workers;
- candidate generation and explainable scoring under services;
- render/subtitle/music stages under job workers;
- YouTube OAuth/upload under integrations;
- analytics calibration under a separate service.

The route, schema, persistence, and worker boundaries already in Phase 1 should remain stable unless a documented decision requires a migration.
