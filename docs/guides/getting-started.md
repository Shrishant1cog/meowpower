# Getting Started with MeowPower Phase 1 / Phase 1.5

## Prerequisites

- Python 3.12 (`py -3.12` on Windows)
- Node.js 20.19+ / 22.12+ / 24 LTS
- npm
- Windows interactive desktop session for the native Tkinter picker and Windows Credential Manager
- FFmpeg is not required in Phase 1 or Phase 1.5 and becomes required in Phase 4

## One-time setup

From the MeowPower root:

```powershell
Set-Location "C:\Users\user\OneDrive\Desktop\Projects\Clipper\meowpower"
.\scripts\setup.ps1
```

Setup creates `.venv`, installs pinned Python packages, installs frontend packages using `frontend/package-lock.json`, and applies Alembic migrations. The current schema head is revision `20260113_0003`.

Confirm the migration head:

```powershell
Set-Location backend
..\.venv\Scripts\python.exe -m alembic current
Set-Location ..
```

Expected revision: `20260113_0003 (head)`.

## Start

```powershell
.\scripts\start.ps1
```

The script refuses to start if either port is occupied. It waits for the backend health endpoint and frontend HTTP endpoint, then verifies that ports 8000 and 5173 listen only on `127.0.0.1`/loopback.

Or launch both terminals manually:

```powershell
# Terminal 1
Set-Location backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```powershell
# Terminal 2
Set-Location frontend
npm run dev
```

Open `http://127.0.0.1:5173`. The provider workspace is at `http://127.0.0.1:5173/models`.

## Stop

```powershell
.\scripts\stop.ps1
```

The script checks that each saved PID still corresponds to the recorded start time, stops the tracked process tree, waits up to 10 seconds for ports 8000/5173 to be released, and fails if either remains occupied.

## Configure an authorized provider

1. Open **AI Models**.
2. Add a provider configuration and choose its provider family. OpenAI, Google Gemini, Anthropic, and NVIDIA NIM use their official model-list endpoints. OpenAI-compatible and Ollama use their configured endpoint; remote endpoints require HTTPS, while plaintext HTTP is allowed only for loopback.
3. Add named API key profiles. The submitted key is write-only and stored only in Windows Credential Manager. API responses contain labels and masked status only.
4. Save a new configuration, select it, and allow the genuine model catalog to load. The catalog is cached for 900 seconds while the provider type, effective endpoint, and selected credential profile remain unchanged.
5. Use **Refresh models** to force an upstream request. Use **Test connection** to perform a genuine provider request rather than reporting cached state.
6. Select a discovered model or enter an identifier manually. If the catalog is empty, unavailable, or does not contain the configured model, manual fallback remains available and clearly labeled.

The provider can also be managed from **Settings**. Active-profile switching, replacement, and removal are supported while the legacy provider credential reference remains a safe compatibility mirror.

## Use the partial workflow

1. Open the dashboard and optionally enter an authorized YouTube URL or select a local video in the browser.
2. Open **Automatic music**, choose **Local music folder**, and use **Choose folder** to open the native Windows dialog. The UI receives only a display name and opaque token; the absolute path remains in the backend database.
3. In **AI Models** or **Settings**, configure an authorized provider and credential profile.
4. Select **START PARTIAL WORKFLOW** from either shared control. Both controls create or resume one idempotent backend job.
5. Watch both circular HUDs. Progress, elapsed time, and ETA are backend-owned values delivered over SSE.
6. Select **CANCEL PARTIAL WORKFLOW** if needed. Cancellation produces one notification and the terminal SSE stream closes without a reconnect loop.
7. A refresh during a running job is recovered through `/api/v1/jobs/active`, the authoritative job snapshot, and SSE replay from the persisted cursor.

The native folder picker requires an interactive desktop. A headless/service session returns the safe `native_dialog_unavailable` status.

## Verify

```powershell
.\scripts\check-environment.ps1
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

The final Phase 1.5 results are **43 backend tests passed**, **20 frontend tests passed across 4 files**, TypeScript passed, the production build completed successfully, `npm audit` reported zero vulnerabilities, and `pip check` reported no broken requirements. Exact outputs are in `docs/TEST_REPORT.md`.

## Inspect local data

- SQLite database: `storage/database/meowpower.db`
- Structured JSON log: `logs/meowpower.log`
- Process state: `temp/processes.json`
- Project-local cache: `cache/`
- Model/cache roots: `models/`

The project does not write application state to global AppData, Documents, Downloads, or a second project root.

## OneDrive placement warning

The current project root is below `C:\Users\user\OneDrive\Desktop`, and Windows maps the Desktop known folder there. OneDrive was stopped during the audit and its SyncEngine database had no project record, so current synchronization was not proven. Future automatic pickup is possible because the root is physically beneath that hierarchy.

Do not move, rename, or reconfigure the synchronized root without explicit developer approval. If synchronization avoidance is required, relocate the entire project to an approved physical path outside OneDrive and rerun setup/migrations there.

## Back up the database

```powershell
.\scripts\backup-database.ps1
```

Backups are written inside `storage/database/backups/`.

## Phase boundary

The Start action runs a **simulated partial workflow** (`foundation_demo`). It proves persistence, SSE, idempotency, active-job discovery, refresh recovery, progress, ETA, cancellation, and restart recovery. Phase 1.5 adds provider discovery and credential-profile configuration but does not execute models. It does not download, transcribe, analyze, render, subtitle, thumbnail, upload, or publish a video. Those capabilities appear only in their authorized future phases, and Phase 2 is not currently authorized.
