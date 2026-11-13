from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Header, Query, Request, status
from fastapi.responses import StreamingResponse

from app.core.errors import APIError, NotFoundError
from app.schemas.job import ActiveJobResponse, DemoJobRequest, JobResponse
from app.services.job_service import JobEventStream
from app.workers.job_manager import JobSnapshot

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _job_response(snapshot: JobSnapshot) -> JobResponse:
    response = JobResponse.model_validate(snapshot.job)
    return response.model_copy(update={"last_event_sequence": snapshot.last_event_sequence})


@router.post("/demo", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_demo_job(payload: DemoJobRequest, request: Request) -> JobResponse:
    snapshot = await request.app.state.job_manager.create_demo_job(payload.request_id)
    return _job_response(snapshot)


@router.get("/active", response_model=ActiveJobResponse)
async def get_active_job(request: Request) -> ActiveJobResponse:
    snapshot = await request.app.state.job_manager.get_active_job()
    return ActiveJobResponse(job=_job_response(snapshot) if snapshot is not None else None)


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: str, request: Request) -> JobResponse:
    snapshot = await request.app.state.job_manager.get_job(job_id)
    if snapshot is None:
        raise NotFoundError("Job was not found")
    return _job_response(snapshot)


@router.get("/{job_id}/events")
async def stream_job_events(
    job_id: str,
    request: Request,
    after: Annotated[int | None, Query(ge=0)] = None,
    last_event_id: Annotated[str | None, Header(alias="Last-Event-ID")] = None,
) -> StreamingResponse:
    snapshot = await request.app.state.job_manager.get_job(job_id)
    if snapshot is None:
        raise NotFoundError("Job was not found")

    cursor = after
    if last_event_id is not None:
        try:
            cursor = int(last_event_id)
        except ValueError as exc:
            raise APIError(
                400,
                "invalid_event_cursor",
                "The event cursor must be a non-negative integer.",
            ) from exc
        if cursor < 0:
            raise APIError(
                400,
                "invalid_event_cursor",
                "The event cursor must be a non-negative integer.",
            )

    stream = JobEventStream(
        request.app.state.session_factory,
        request.app.state.settings,
    )
    return StreamingResponse(
        stream.stream(job_id, cursor or 0),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{job_id}/cancel", response_model=JobResponse)
async def cancel_job(job_id: str, request: Request) -> JobResponse:
    snapshot = await request.app.state.job_manager.cancel_job(job_id)
    if snapshot is None:
        raise NotFoundError("Job was not found")
    return _job_response(snapshot)
