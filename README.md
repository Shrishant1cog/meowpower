# MeowPower

MeowPower is a local-first AI production studio for turning authorized long-form video into publish-ready YouTube Shorts. The repository currently contains the completed **Phase 1 application foundation** and the completed **Phase 1.5 UX/model-discovery enhancement**, awaiting developer testing.

The application includes a FastAPI backend, SQLite/Alembic persistence, secure named provider credential profiles, genuine provider model discovery, a native Windows music-folder picker, persisted partial-workflow jobs, native SSE with snapshot-first replay, active-job recovery after refresh/restart, and a polished React editing-workspace shell.

> The current Start action is explicitly a **simulated partial workflow** (`foundation_demo`). It does not retrieve, transcribe, analyze, render, subtitle, thumbnail, upload, or publish video. Phase 1.5 discovers available model identifiers and manages authorized configuration; it does not execute a model.

## Project root

```text
C:\Users\user\OneDrive\Desktop\Projects\Clipper\meowpower
```

All application-owned database data, logs, caches, build output, dependencies, temporary files, and future media artifacts are written beneath this root.

**OneDrive caveat:** this root is physically below the configured OneDrive Personal Desktop hierarchy. The OneDrive client was stopped during the audit and had no project sync record, so current synchronization was not proven; future automatic pickup is still possible. The project was not moved or OneDrive reconfigured without developer approval. See `docs/SECURITY.md`.

## Quick start

```powershell
Set-Location "C:\Users\user\OneDrive\Desktop\Projects\Clipper\meowpower"
.\scripts\setup.ps1
.\scripts\start.ps1
```

Open:

- Frontend: `http://127.0.0.1:5173`
- AI Models: `http://127.0.0.1:5173/models`
- API: `http://127.0.0.1:8000`
- OpenAPI: `http://127.0.0.1:8000/docs`

The start script waits for both services to become ready and verifies that their ports are bound only to loopback.

Stop services:

```powershell
.\scripts\stop.ps1
```

The stop script validates the tracked process identities, terminates their process trees, and verifies that ports 8000 and 5173 are released.

## Configure a provider and discover models

1. Open **AI Models** and add or select an authorized provider configuration.
2. For OpenAI, Google Gemini, Anthropic, or NVIDIA NIM, the official model-list endpoint is fixed by the backend. OpenAI-compatible and Ollama configurations use their configured endpoint.
3. Add named API key profiles. Key material is write-only and stored only in Windows Credential Manager; SQLite retains an opaque reference and the active-profile compatibility mirror.
4. Save a new configuration, select it, and allow the genuine model catalog to load. The catalog is cached for 900 seconds while its provider type, effective endpoint, and selected profile remain unchanged.
5. Use **Refresh models** to force an upstream request or **Test connection** to perform a genuine provider request.
6. If discovery is empty, unavailable, or the configured model is absent upstream, enter a model identifier manually. Manual fallback remains explicit and authoritative.

## Manual development commands

Backend:

```powershell
Set-Location backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend:

```powershell
Set-Location frontend
npm run dev
```

## Verification commands

```powershell
Set-Location backend
..\.venv\Scripts\python.exe -m ruff check app tests
..\.venv\Scripts\python.exe -m pytest -q
..\.venv\Scripts\python.exe -m alembic current
..\.venv\Scripts\python.exe -m pip check

Set-Location ..\frontend
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

The final Phase 1.5 run passed Ruff, **43 backend tests**, TypeScript, **20 frontend tests across 4 files**, the production build (**2685 modules; 1.02s**), `npm audit` with zero vulnerabilities, and `pip check`. The live Alembic head is `20260113_0003`. Exact output sizes and live/manual evidence are recorded in `docs/TEST_REPORT.md`.

## Project layout

```text
backend/   FastAPI, SQLAlchemy, Alembic, services, integrations, workers, tests
frontend/  React, TypeScript, Vite, Tailwind v4, Motion, shadcn source, components, tests
docs/      Architecture, roadmap, API, SSE, security, decisions, test report
scripts/   Windows setup, environment, development, start, stop, and backup commands
storage/   Database, sources, audio, transcripts, clips, thumbnails, music metadata
models/    Locally downloaded model weights
cache/     Project-local dependency/model caches
logs/      Structured local logs
temp/      Temporary files and local process state
tests/     Reserved for cross-application end-to-end tests
```

## Documentation

- `docs/ARCHITECTURE.md`
- `docs/IMPLEMENTATION_ROADMAP.md` — all 17 phases plus the authorized Phase 1.5 enhancement
- `docs/TECHNICAL_DECISIONS.md`
- `docs/API_CONTRACTS.md`
- `docs/SSE_PROTOCOL.md`
- `docs/SECURITY.md`
- `docs/TEST_REPORT.md`
- `docs/guides/getting-started.md`

## Phase governance

Implementation stops after the authorized phase. The only message that authorizes the next phase is:

```text
TESTING COMPLETE. PROCEED TO NEXT PHASE.
```

Phase 2 is not authorized or implemented. MeowPower never guarantees viral performance. Future opportunity scores are explainable estimates that can be calibrated against real publishing results.
