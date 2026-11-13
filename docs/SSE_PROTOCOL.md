# MeowPower SSE Protocol — Phase 1

Endpoint:

```text
GET /api/v1/jobs/{job_id}/events
Accept: text/event-stream
```

The endpoint uses native FastAPI/Starlette `StreamingResponse`. It does not use WebSocket transport.

## Frame format

Every meaningful job event uses:

```text
id: 4
event: job.progress
data: {"job_id":"...","status":"running","stage":"analysis_preview","stage_label":"Previewing analysis stages","progress_percent":36,"elapsed_seconds":18,"eta_remaining_seconds":37,"message":"Simulated workflow activity: simulating local intelligence","updated_at":"2026-01-01T12:00:18Z","operation":"Simulating local intelligence","error_message":null,"sequence":4}

```

The blank line terminates the frame. `id` is the per-job sequence and increases by exactly one for every persisted event. The same sequence is persisted inside the JSON payload before the event row is flushed, so the frame ID and payload cannot drift.

## Payload schema

| Field | Type | Required | Meaning |
|---|---|---:|---|
| `job_id` | string | yes | Persistent job UUID |
| `status` | enum | yes | `queued`, `running`, `completed`, `failed`, `cancelled`, `recoverable` |
| `stage` | string | yes | Stable machine stage identifier |
| `stage_label` | string | yes | Human-readable stage |
| `progress_percent` | number | yes | Backend-owned progress from 0 to 100 |
| `elapsed_seconds` | number | yes | Backend-measured elapsed duration |
| `eta_remaining_seconds` | number or null | yes | Backend estimate; null means not yet reliable |
| `message` | string | yes | Safe progress/failure message |
| `updated_at` | ISO-8601 string | yes | Event creation time |
| `operation` | string or null | no | Current concrete operation |
| `error_message` | string or null | no | Safe failure detail |
| `sequence` | integer | yes | Mirrors the SSE frame ID and persisted event sequence |

## Event semantics

- Progress, terminal, and recovery events use the `job.progress` event name.
- A terminal event has status `completed`, `failed`, or `cancelled`.
- A `recoverable` event is terminal for the interrupted Phase 1 run and closes the stream.
- The server closes the stream after emitting a terminal or recoverable event.
- The browser must not calculate progress or ETA. It renders the received values.
- Progress is an estimate of workflow completion, not a probability of audience performance.
- Public failure messages are sanitized; exception details remain only in the project-local structured log.

## Cursor and replay semantics

Two cursor inputs are supported:

```text
GET /api/v1/jobs/{job_id}/events?after=7
Last-Event-ID: 7
```

- `after` must be a non-negative integer. A negative value is rejected with `422` by request validation.
- `Last-Event-ID` must be a non-negative integer. Invalid or negative values are rejected with `400 invalid_event_cursor` before the stream starts.
- If both inputs are present, `Last-Event-ID` takes precedence.
- The server emits only persisted events whose sequence is greater than the effective cursor.
- Sequence values are contiguous from 1 for each job.

The browser `EventSource` automatically sends the most recent received frame ID in `Last-Event-ID` when reconnecting. The initial browser subscription explicitly supplies the authoritative cursor in the `after` query parameter.

## Snapshot-first recovery

A refresh or remount does not rely on an in-memory event stream. Recovery order is:

1. `GET /api/v1/jobs/active` discovers the latest active job.
2. `GET /api/v1/jobs/{job_id}` obtains the authoritative snapshot and `last_event_sequence`.
3. `GET /api/v1/jobs/{job_id}/events?after={cursor}` resumes persisted replay.

The frontend stores the maximum snapshot/event cursor it has accepted. It rejects duplicate, regressing, malformed, or unrelated-job events and never fabricates intermediate progress.

## Stream framing and keepalive

The first frame includes a reconnect delay:

```text
retry: 1500

```

A comment keepalive is emitted after 15 seconds without a persisted event:

```text
: keepalive

```

## Cancellation

`POST /api/v1/jobs/{job_id}/cancel` updates persistent cancellation state under the job's event lock. The worker observes the flag at its next safe checkpoint, and the API persists a terminal `cancelled` event. The SSE stream then closes.

## Error cases

- Unknown job: HTTP `404` before the stream starts.
- Invalid `Last-Event-ID`: HTTP `400` before the stream starts.
- Invalid negative `after`: HTTP `422` before the stream starts.
- Connection interruption: browser reconnects and replays from its last accepted ID.
- Application shutdown: the worker is cancelled and its job becomes `recoverable` on the next startup with a persisted recovery event.
