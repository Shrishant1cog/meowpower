from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings
from app.db.models.job import Job
from app.repositories.job_repository import JobRepository

logger = logging.getLogger(__name__)

_SETTLED_STATUSES = {"completed", "failed", "cancelled", "recoverable"}
_PUBLIC_FAILURE_MESSAGE = "The workflow failed. See the local log for details."


@dataclass(frozen=True)
class JobSnapshot:
    job: Job
    last_event_sequence: int


class _ProgressEstimator:
    """Estimates remaining time from observed backend progress samples."""

    def __init__(self) -> None:
        self._samples: list[tuple[float, float]] = []

    def observe(self, elapsed: float, progress: float) -> None:
        if self._samples and self._samples[-1][1] == progress:
            return
        self._samples.append((elapsed, progress))

    def estimate(self, elapsed: float, progress: float) -> float | None:
        positive = [sample for sample in self._samples if sample[1] > 0]
        if len(positive) < 2:
            return None
        first_elapsed, first_progress = positive[0]
        last_elapsed, last_progress = positive[-1]
        elapsed_span = last_elapsed - first_elapsed
        progress_span = last_progress - first_progress
        if elapsed_span <= 0 or progress_span <= 0:
            return None
        rate = progress_span / elapsed_span
        if rate <= 0:
            return None
        return max(0.0, (100.0 - progress) / rate)


class JobManager:
    """Owns bounded, in-process Phase 1 demo jobs and their persisted events."""

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        settings: Settings,
    ) -> None:
        self.session_factory = session_factory
        self.settings = settings
        self._tasks: dict[str, asyncio.Task[None]] = {}
        self._event_locks: dict[str, asyncio.Lock] = {}

    def _event_lock(self, job_id: str) -> asyncio.Lock:
        lock = self._event_locks.get(job_id)
        if lock is None:
            lock = asyncio.Lock()
            self._event_locks[job_id] = lock
        return lock

    async def create_demo_job(self, idempotency_key: str) -> JobSnapshot:
        async with self.session_factory() as session:
            repository = JobRepository(session)
            existing = await repository.get_by_idempotency_key(idempotency_key)
            if existing is not None:
                sequence = await repository.latest_event_sequence(existing.id)
                return JobSnapshot(existing, sequence)

            job = Job(
                id=str(uuid.uuid4()),
                idempotency_key=idempotency_key,
                job_type="foundation_demo",
                status="queued",
                stage="queued",
                stage_label="Queued",
                operation="Preparing the Phase 1 partial workflow",
                progress_percent=0,
                message="Simulated workflow activity queued",
            )
            session.add(job)
            try:
                await session.commit()
            except IntegrityError:
                await session.rollback()
                duplicate = await repository.get_by_idempotency_key(idempotency_key)
                if duplicate is None:
                    raise
                sequence = await repository.latest_event_sequence(duplicate.id)
                return JobSnapshot(duplicate, sequence)

        task = asyncio.create_task(self._run_demo(job.id), name=f"demo-job-{job.id}")
        self._tasks[job.id] = task
        task.add_done_callback(lambda completed: self._task_done(job.id, completed))
        return JobSnapshot(job, 0)

    async def get_job(self, job_id: str) -> JobSnapshot | None:
        async with self.session_factory() as session:
            repository = JobRepository(session)
            job = await repository.get(job_id)
            if job is None:
                return None
            sequence = await repository.latest_event_sequence(job_id)
            return JobSnapshot(job, sequence)

    async def get_active_job(self) -> JobSnapshot | None:
        async with self.session_factory() as session:
            repository = JobRepository(session)
            job = await repository.get_latest_active_job()
            if job is None:
                return None
            sequence = await repository.latest_event_sequence(job.id)
            return JobSnapshot(job, sequence)

    async def cancel_job(self, job_id: str) -> JobSnapshot | None:
        async with self._event_lock(job_id):
            async with self.session_factory() as session:
                repository = JobRepository(session)
                job = await repository.get(job_id)
                if job is None:
                    return None
                sequence = await repository.latest_event_sequence(job_id)
                if job.status in _SETTLED_STATUSES:
                    return JobSnapshot(job, sequence)

                now = datetime.now(UTC)
                elapsed = self._elapsed_for_job(job, now)
                job.cancel_requested = True
                job.status = "cancelled"
                job.stage = "cancelled"
                job.stage_label = "Partial workflow cancelled"
                job.operation = "Stopping the partial workflow"
                job.progress_percent = min(100.0, max(0.0, job.progress_percent))
                job.elapsed_seconds = elapsed
                job.eta_remaining_seconds = 0
                job.message = "Simulated workflow activity cancelled"
                job.error_message = None
                job.completed_at = now
                event = await repository.add_event(
                    job_id,
                    "job.progress",
                    self._event_payload(
                        job=job,
                        status="cancelled",
                        stage="cancelled",
                        stage_label="Partial workflow cancelled",
                        operation="Stopping the partial workflow",
                        progress=job.progress_percent,
                        elapsed=elapsed,
                        eta_remaining=0,
                        message="Simulated workflow activity cancelled",
                        updated_at=now,
                        error_message=None,
                    ),
                )
                sequence = event.sequence
                await session.commit()
                return JobSnapshot(job, sequence)

    async def recover_stale_jobs(self) -> int:
        return await self._mark_interrupted_jobs_recoverable()

    async def shutdown(self) -> None:
        for task in list(self._tasks.values()):
            task.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks.values(), return_exceptions=True)
        stale = await self._mark_interrupted_jobs_recoverable()
        if stale:
            logger.warning("Marked %s interrupted demo job(s) recoverable", stale)

    async def _mark_interrupted_jobs_recoverable(self) -> int:
        async with self.session_factory() as session:
            jobs = await JobRepository(session).list_incomplete_jobs()
            job_ids = [job.id for job in jobs]

        count = 0
        for job_id in job_ids:
            async with self._event_lock(job_id):
                async with self.session_factory() as session:
                    repository = JobRepository(session)
                    current = await repository.get(job_id)
                    if current is None or current.status not in {"queued", "running"}:
                        continue
                    now = datetime.now(UTC)
                    elapsed = self._elapsed_for_job(current, now)
                    current.status = "recoverable"
                    current.stage = "recoverable"
                    current.stage_label = "Partial workflow paused"
                    current.operation = "The previous run stopped before completion"
                    current.elapsed_seconds = elapsed
                    current.eta_remaining_seconds = None
                    current.message = "Application stopped before this job completed"
                    current.completed_at = now
                    await repository.add_event(
                        current.id,
                        "job.progress",
                        self._event_payload(
                            job=current,
                            status="recoverable",
                            stage="recoverable",
                            stage_label="Partial workflow paused",
                            operation="The previous run stopped before completion",
                            progress=current.progress_percent,
                            elapsed=elapsed,
                            eta_remaining=None,
                            message="Application stopped before this job completed",
                            updated_at=now,
                            error_message=None,
                        ),
                    )
                    await session.commit()
                    count += 1
        return count

    async def _run_demo(self, job_id: str) -> None:
        started = asyncio.get_running_loop().time()
        stage_delay = self.settings.demo_stage_delay_seconds
        event_interval = min(0.2, max(0.05, self.settings.job_poll_interval_seconds))
        estimator = _ProgressEstimator()
        stages: list[tuple[float, str, str, str]] = [
            (4, "foundation_demo", "Preparing local workspace", "Validating project services"),
            (18, "source_intake", "Reviewing source inputs", "Checking the selected source"),
            (36, "music_intake", "Reviewing music settings", "Checking local music readiness"),
            (56, "analysis_preview", "Previewing analysis stages", "Simulating local intelligence"),
            (76, "clip_preview", "Previewing clip discovery", "Simulating explainable ranking"),
            (92, "final_validation", "Validating workflow output", "Simulating final checks"),
            (
                100,
                "completed",
                "Partial workflow complete",
                "Implemented foundation checks finished",
            ),
        ]
        current_progress = 0.0
        try:
            for progress, stage, label, operation in stages:
                deadline = asyncio.get_running_loop().time() + stage_delay
                while True:
                    remaining = deadline - asyncio.get_running_loop().time()
                    if remaining <= 0:
                        break
                    await asyncio.sleep(min(event_interval, remaining))
                    if not await self._job_is_running(job_id):
                        return
                    elapsed = asyncio.get_running_loop().time() - started
                    estimator.observe(elapsed, current_progress)
                    eta_remaining = estimator.estimate(elapsed, current_progress)
                    await self._emit(
                        job_id,
                        status="running",
                        stage=stage,
                        stage_label=label,
                        operation=operation,
                        progress=current_progress,
                        message=f"Simulated workflow activity: {operation.lower()}",
                        started=started,
                        eta_remaining=eta_remaining,
                    )

                current_progress = float(progress)
                elapsed = asyncio.get_running_loop().time() - started
                estimator.observe(elapsed, current_progress)
                eta_remaining = estimator.estimate(elapsed, current_progress)
                terminal = progress == 100
                await self._emit(
                    job_id,
                    status="completed" if terminal else "running",
                    stage=stage,
                    stage_label=label,
                    operation=operation,
                    progress=current_progress,
                    message=(
                        "Simulated workflow completed successfully"
                        if terminal
                        else f"Simulated workflow activity: {operation.lower()}"
                    ),
                    started=started,
                    eta_remaining=0 if terminal else eta_remaining,
                    terminal=terminal,
                )
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Demo job %s failed", job_id)
            await self._emit(
                job_id,
                status="failed",
                stage="failed",
                stage_label="Partial workflow failed",
                operation="Handling simulated workflow error",
                progress=await self._current_progress(job_id),
                message=_PUBLIC_FAILURE_MESSAGE,
                started=started,
                error_message=_PUBLIC_FAILURE_MESSAGE,
                terminal=True,
            )

    def _task_done(self, job_id: str, task: asyncio.Task[None]) -> None:
        self._tasks.pop(job_id, None)
        if task.cancelled():
            return
        try:
            exception = task.exception()
        except asyncio.CancelledError:
            return
        if exception is not None:
            logger.error(
                "Demo job %s terminated unexpectedly",
                job_id,
                exc_info=(type(exception), exception, exception.__traceback__),
            )

    async def _job_is_running(self, job_id: str) -> bool:
        async with self.session_factory() as session:
            job = await JobRepository(session).get(job_id)
            if job is None or job.cancel_requested:
                return False
            return job.status in {"queued", "running"}

    async def _current_progress(self, job_id: str) -> float:
        async with self.session_factory() as session:
            job = await JobRepository(session).get(job_id)
            return job.progress_percent if job else 0.0

    async def _emit(
        self,
        job_id: str,
        *,
        status: str,
        stage: str,
        stage_label: str,
        operation: str,
        progress: float,
        message: str,
        started: float,
        eta_remaining: float | None = None,
        error_message: str | None = None,
        terminal: bool = False,
    ) -> int | None:
        async with self._event_lock(job_id):
            async with self.session_factory() as session:
                repository = JobRepository(session)
                job = await repository.get(job_id)
                if job is None:
                    return None
                latest_sequence = await repository.latest_event_sequence(job_id)
                if job.status in _SETTLED_STATUSES:
                    return latest_sequence

                elapsed = asyncio.get_running_loop().time() - started
                now = datetime.now(UTC)
                job.status = status
                job.stage = stage
                job.stage_label = stage_label
                job.operation = operation
                job.progress_percent = progress
                job.elapsed_seconds = round(elapsed, 3)
                job.eta_remaining_seconds = eta_remaining
                job.message = message
                job.error_message = error_message
                if job.started_at is None:
                    job.started_at = now
                if terminal or status in {"completed", "failed", "cancelled"}:
                    job.completed_at = now
                event = await repository.add_event(
                    job_id,
                    "job.progress",
                    self._event_payload(
                        job=job,
                        status=status,
                        stage=stage,
                        stage_label=stage_label,
                        operation=operation,
                        progress=progress,
                        elapsed=round(elapsed, 3),
                        eta_remaining=eta_remaining,
                        message=message,
                        updated_at=now,
                        error_message=error_message,
                    ),
                )
                await session.commit()
                return event.sequence

    @staticmethod
    def _event_payload(
        *,
        job: Job,
        status: str,
        stage: str,
        stage_label: str,
        operation: str,
        progress: float,
        elapsed: float,
        eta_remaining: float | None,
        message: str,
        updated_at: datetime,
        error_message: str | None,
    ) -> dict[str, Any]:
        return {
            "job_id": job.id,
            "status": status,
            "stage": stage,
            "stage_label": stage_label,
            "progress_percent": progress,
            "elapsed_seconds": elapsed,
            "eta_remaining_seconds": eta_remaining,
            "message": message,
            "updated_at": updated_at.isoformat(),
            "operation": operation,
            "error_message": error_message,
        }

    @staticmethod
    def _elapsed_for_job(job: Job, now: datetime) -> float:
        if job.started_at is None:
            return round(job.elapsed_seconds, 3)
        started_at = job.started_at
        if started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=UTC)
        return round(max(0.0, (now - started_at).total_seconds()), 3)
