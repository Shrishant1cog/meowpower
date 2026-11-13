from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

JobStatus = Literal[
    "queued",
    "running",
    "completed",
    "failed",
    "cancelled",
    "recoverable",
]


class DemoJobRequest(BaseModel):
    request_id: str = Field(min_length=8, max_length=128)


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    job_type: str
    status: JobStatus
    stage: str
    stage_label: str
    operation: str
    progress_percent: float
    elapsed_seconds: float
    eta_remaining_seconds: float | None
    message: str
    error_message: str | None
    created_at: datetime
    updated_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
    last_event_sequence: int = 0


class ActiveJobResponse(BaseModel):
    job: JobResponse | None


class JobEventPayload(BaseModel):
    job_id: str
    status: JobStatus
    stage: str
    stage_label: str
    progress_percent: float
    elapsed_seconds: float
    eta_remaining_seconds: float | None
    message: str
    updated_at: datetime
    operation: str | None = None
    error_message: str | None = None
    sequence: int
