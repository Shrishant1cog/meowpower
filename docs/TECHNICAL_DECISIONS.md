# MeowPower Technical Decisions

These decisions are authoritative for Phase 1 and the authorized Phase 1.5 enhancement. They are revisited only through an explicit architecture decision record in `docs/decisions/`.

| ID | Decision | Rationale | Alternatives considered | Status |
|---|---|---|---|---|
| TD-001 | Local browser + FastAPI service | Keeps AI/media work in Python while providing a polished React workspace; avoids wrapper overhead. | Tauri, Electron, Next.js | Accepted |
| TD-002 | Bind services to `127.0.0.1` | Prevents accidental LAN exposure of private media and local services. | `0.0.0.0`, cloud deployment | Accepted |
| TD-003 | SQLAlchemy 2.x async + aiosqlite | Typed ORM, independent sessions, mature migrations, low local operational cost. | Synchronous SQLite, remote PostgreSQL | Accepted |
| TD-004 | SQLite WAL and Alembic | Appropriate for a single-user local studio; explicit revision history and safe concurrent reads. | `metadata.json`, manual schema scripts | Accepted |
| TD-005 | Native FastAPI SSE | Current FastAPI/Starlette supports streaming responses; avoids an unnecessary dependency. | Polling only, WebSocket, SSE-Starlette | Accepted |
| TD-006 | Persist job events and replay by sequence | Reconnect correctness survives browser/server timing and supports `Last-Event-ID`. | In-memory pub/sub only | Accepted |
| TD-007 | React 19 + Vite + TypeScript | Current stable client stack with fast local feedback and strong typing. | Next.js, plain React scripts | Accepted |
| TD-008 | Tailwind CSS v4 via Vite plugin | Current documented installation model; no obsolete v3 config dependency. | Tailwind v3, plain CSS | Accepted |
| TD-009 | shadcn/ui source components | Accessible primitives remain local, editable source rather than a remote component service. | Full third-party component suite | Accepted |
| TD-010 | TanStack Query + Zustand | Clear separation between remote server state and local interface/workflow state. | One global store, ad hoc fetch state | Accepted |
| TD-011 | Motion 14 `LazyMotion` with asynchronous `domAnimation` | Delivers consistent Phase 1.5 UI motion while keeping feature code in an isolated chunk; `MotionConfig reducedMotion="user"` and lightweight named components limit runtime and bundle cost. | `AnimatePresence` around route/form conditionals, `layoutId`, `domMax`, no animation | Accepted for Phase 1.5 |
| TD-012 | OS credential manager via keyring plus named profiles | Secrets do not enter SQLite, logs, API responses, or the React bundle; named profiles allow safe switching, replacement, and removal while keeping the Phase 1 reference as a compatibility mirror. | Plaintext SQLite, encrypted-file key store, one unlabelled key per provider | Accepted with clear unavailable state |
| TD-013 | Dedicated Tkinter executor thread | Native folder picker runs without blocking FastAPI and creates/destroys Tk in one thread. | Blocking event loop, browser directory upload | Accepted |
| TD-014 | Opaque folder token | Prevents absolute path disclosure while allowing stable UI references. | Exposing local path | Accepted |
| TD-015 | In-process bounded demo worker | Appropriate for Phase 1's simulated job; persistent state and independent sessions are already in place. | Celery, Redis, separate service | Accepted |
| TD-016 | No telemetry or automatic cloud upload | Protects local source/transcript/music privacy and preserves local-first behavior. | Product analytics, implicit cloud processing | Accepted |
| TD-017 | Project-local caches and data | Prevents application state from being written to AppData, Documents, Downloads, or Desktop outside the project root. | Global package/model caches | Accepted with OneDrive placement caveat |
| TD-018 | Explicit future-phase navigation states | Prevents planned features from appearing functional or producing fake metrics. | Hidden routes, simulated analytics | Accepted |
| TD-019 | Active-job discovery plus authoritative snapshot cursor | `/jobs/active` identifies work after refresh; the persisted snapshot cursor prevents replay gaps and regressions. | Browser-memory-only state, polling from sequence zero | Accepted |
| TD-020 | SSE `after` query plus `Last-Event-ID` precedence | Supports explicit snapshot-first subscription and standard browser reconnect replay with one deterministic rule. | Query-only cursor, header-only cursor | Accepted |
| TD-021 | Per-job event locks and persisted payload sequence | Makes cancellation/recovery atomic and keeps the frame ID, JSON sequence, and database row aligned. | Unsynchronized task writes, frame-only sequence | Accepted |
| TD-022 | Route-level lazy loading and stable app-owned QueryClient | Splits non-initial UI from the main bundle without recreating server-state infrastructure between routes. | One monolithic route bundle, module-global QueryClient | Accepted |
| TD-023 | Lifecycle scripts verify readiness, identity, and released ports | Silent background startup or stale PIDs are unsafe for a local security boundary. | Unverified `Start-Process`, PID-only stop | Accepted |
| TD-024 | Alembic must preserve application logging handlers | `fileConfig()` can erase the rotating JSON handler and disable application loggers during startup migration. | Unconditional `fileConfig()`, separate logging setup | Accepted |
| TD-025 | Database-enforced active-record uniqueness and folder FK | Prevents multiple active folders/providers and invalid settings references at the storage layer. | Application-only checks | Accepted |
| TD-026 | Separate credential-profile rows with an active-profile compatibility mirror | `provider_credential_profiles` owns named labels and opaque references; `ai_provider_configs.credential_ref` remains the legacy mirror so older integrations and downgrade behavior stay deterministic. | Store multiple secrets in one column, remove the legacy column immediately | Accepted |
| TD-027 | Provider-specific model-list adapters | Official OpenAI, Google Gemini, Anthropic, and NVIDIA NIM requests use fixed official endpoints and provider-specific headers; configured OpenAI-compatible and Ollama endpoints remain supported. | One generic request shape for every provider, browser-side provider calls | Accepted |
| TD-028 | HTTPS-or-loopback endpoint policy | Remote provider traffic must use HTTPS; plaintext HTTP is accepted only for `localhost`/loopback, preventing accidental credential transmission over an insecure remote connection. | Permit HTTP everywhere, browser CORS as the only guard | Accepted |
| TD-029 | Bounded, non-redirecting provider HTTP client | Connect/read timeouts, disabled redirects, disabled environment proxy trust, and a 2 MB response ceiling bound local resource use and credential exposure. | Unbounded streaming responses, following redirects with auth headers | Accepted |
| TD-030 | Persisted model catalog with a 900-second profile-aware TTL | A catalog is reusable only while fresh and while provider type, effective endpoint, and selected credential-profile ID still match; `refresh=true` forces upstream retrieval. | Browser-only cache, process-only cache, endpoint-only cache key | Accepted |
| TD-031 | Manual model fallback remains authoritative | Discovery never silently changes the configured model. A missing current model or failed/empty discovery leaves manual identifier entry available and clearly labeled. | Auto-select the first returned model, disable the field on error | Accepted |
| TD-032 | Explicit Test Connection performs a genuine upstream request | The action verifies the selected profile against the provider model-list endpoint rather than inferring connectivity from cached metadata. | Local health probe, cache-only status | Accepted |
| TD-033 | Phase 1.5 is UX/configuration scope only | The existing `foundation_demo` engine remains the implemented partial workflow. Model discovery does not execute models and does not add transcription, rendering, publishing, or other Phase 2+ capability. | Claim a production AI workflow, silently expand phase scope | Accepted |
| TD-034 | Cancel response and SSE terminal event are idempotent | The frontend closes a duplicate terminal SSE event and emits one cancellation notification regardless of whether the cancel response or persisted event arrives first. | Cursor regression, duplicate notifications, EventSource reconnect loop | Accepted |

## Dependency selection notes

Dependency versions were checked against package registries and official documentation when implementation began. Python packages are pinned in `backend/requirements.txt`; development tools are pinned separately in `backend/requirements-dev.txt`. JavaScript dependencies are pinned in `frontend/package.json`, with `frontend/package-lock.json` providing the reproducible install.

Important compatibility choices:

- SQLAlchemy is installed with its `asyncio` extra because the async engine requires `greenlet`.
- FastAPI's current stable line works with Pydantic v2 and native streaming responses.
- Vite 8 is used with the current React plugin and Node.js 24 LTS.
- Tailwind v4 uses `@tailwindcss/vite` and `@import "tailwindcss"` rather than a legacy `tailwind.config.js` pipeline.
- Vitest supplies the Vite test configuration and runs in jsdom with React Testing Library.
- Motion 14.13.0 was added for the authorized Phase 1.5 UX refinement. `LazyMotion` loads `domAnimation` asynchronously from `frontend/src/components/motion/motion-features.ts`; `MotionConfig reducedMotion="user"` delegates the preference to the operating system. Route/form `AnimatePresence`, `layout`, and `layoutId` are intentionally avoided because conditional wrappers caused content loss and `layout` requires features beyond `domAnimation`.

## Algorithm policy

No production media-analysis algorithm is implemented in Phase 1 or Phase 1.5. Phase 1.5 discovers available model identifiers and manages authorized credentials/configuration only; it does not execute a model or produce media-analysis output. Future algorithm selections must record the maintained candidate, license, hardware cost, accuracy benchmark on representative fixtures, and why it outperforms or is safer than alternatives. Opportunity scores must remain explainable estimates, never guarantees of virality.

## Model-discovery policy

Model discovery is an explicit configuration aid, not an execution path. The backend owns every provider request so credentials never enter browser code. Official providers use fixed endpoints; OpenAI-compatible and Ollama use their configured local/remote base URLs. The effective endpoint, provider type, and selected credential-profile ID form the cache identity. Discovery failures are sanitized and leave manual model entry available. The current `model_catalog_ttl_seconds` value is 900 seconds; changing it is an explicit configuration decision.

## Job ETA policy

Phase 1 elapsed and ETA values are calculated and emitted by the backend from measured simulation stage durations. Future ETA logic should use a rolling measurement table keyed by media characteristics and processing configuration. If there is insufficient history, the backend should send `null` and the UI should display “ETA calculating” rather than inventing a duration.

## Storage-location policy

The application writes only beneath the selected MeowPower root. The current root happens to reside below the OneDrive Personal Desktop hierarchy. OneDrive was not started or reconfigured during the audit, and relocation requires explicit developer approval. Future installations should default to a physical path outside synchronization roots while retaining the same project-local write policy.
