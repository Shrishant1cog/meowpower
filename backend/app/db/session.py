from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

from app.core.config import Settings


def create_database_engine(settings: Settings, *, test_mode: bool = False) -> AsyncEngine:
    settings.database_path.parent.mkdir(parents=True, exist_ok=True)
    connect_args = {"timeout": 30}
    engine_kwargs: dict[str, object] = {
        "echo": False,
        "connect_args": connect_args,
        "pool_pre_ping": True,
    }
    if test_mode:
        engine_kwargs["poolclass"] = StaticPool

    engine = create_async_engine(
        f"sqlite+aiosqlite:///{settings.database_path.as_posix()}",
        **engine_kwargs,
    )

    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragmas(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()

    return engine


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False, autoflush=False)


async def session_scope(
    session_factory: async_sessionmaker[AsyncSession],
) -> AsyncIterator[AsyncSession]:
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
