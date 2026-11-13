from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import Settings
from app.repositories.job_repository import JobRepository

_SETTLED_STATUSES = {"completed", "failed", "cancelled", "recoverable"}


class JobEventStream:
    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        settings: Settings,
    ) -> None:
        self.session_factory = session_factory
        self.settings = settings

    async def stream(self, job_id: str, after: int = 0) -> AsyncIterator[str]:
        sequence = max(0, after)
        yield "retry: 1500\n\n"
        last_keepalive = asyncio.get_running_loop().time()

        while True:
            async with self.session_factory() as session:
                repository = JobRepository(session)
                job = await repository.get(job_id)
                if job is None:
                    return
                events = await repository.list_events_after(job_id, sequence)
                for event in events:
                    sequence = event.sequence
                    payload = {**event.payload, "sequence": event.sequence}
                    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
                    yield f"id: {event.sequence}\nevent: job.progress\ndata: {data}\n\n"
                    if payload.get("status") in _SETTLED_STATUSES:
                        return

                if job.status in _SETTLED_STATUSES:
                    return

            await asyncio.sleep(self.settings.job_poll_interval_seconds)
            now = asyncio.get_running_loop().time()
            if now - last_keepalive >= 15:
                yield ": keepalive\n\n"
                last_keepalive = now
