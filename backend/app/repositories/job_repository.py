from __future__ import annotations

from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.job import Job, JobEvent


class JobRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, job_id: str) -> Job | None:
        return await self.session.scalar(select(Job).where(Job.id == job_id))

    async def get_by_idempotency_key(self, key: str) -> Job | None:
        return await self.session.scalar(select(Job).where(Job.idempotency_key == key))

    async def get_latest_job(self) -> Job | None:
        return await self.session.scalar(
            select(Job).order_by(Job.created_at.desc(), Job.id.desc()).limit(1)
        )

    async def get_latest_active_job(self) -> Job | None:
        return await self.session.scalar(
            select(Job)
            .where(Job.status.in_(["queued", "running", "recoverable"]))
            .order_by(Job.created_at.desc(), Job.id.desc())
            .limit(1)
        )

    async def list_incomplete_jobs(self) -> list[Job]:
        result = await self.session.scalars(
            select(Job)
            .where(Job.status.in_(["queued", "running"]))
            .order_by(Job.created_at.asc(), Job.id.asc())
        )
        return list(result)

    async def list_events_after(self, job_id: str, sequence: int = 0) -> list[JobEvent]:
        result = await self.session.scalars(
            select(JobEvent)
            .where(JobEvent.job_id == job_id, JobEvent.sequence > sequence)
            .order_by(JobEvent.sequence.asc())
        )
        return list(result)

    async def next_sequence(self, job_id: str) -> int:
        latest = await self.session.scalar(
            select(func.max(JobEvent.sequence)).where(JobEvent.job_id == job_id)
        )
        return int(latest or 0) + 1

    async def latest_event_sequence(self, job_id: str) -> int:
        latest = await self.session.scalar(
            select(func.max(JobEvent.sequence)).where(JobEvent.job_id == job_id)
        )
        return int(latest or 0)

    async def add_event(
        self,
        job_id: str,
        event_type: str,
        payload: dict[str, Any],
    ) -> JobEvent:
        sequence = await self.next_sequence(job_id)
        persisted_payload = {**payload, "sequence": sequence}
        event = JobEvent(
            job_id=job_id,
            sequence=sequence,
            event_type=event_type,
            payload=persisted_payload,
        )
        self.session.add(event)
        await self.session.flush()
        return event
