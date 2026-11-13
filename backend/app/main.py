from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import httpx
from alembic import command
from alembic.config import Config
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.api.system import router as system_router
from app.api.v1.health import router as health_router
from app.api.v1.jobs import router as jobs_router
from app.api.v1.providers import router as providers_router
from app.api.v1.settings import router as settings_router
from app.core.config import Settings, get_settings
from app.core.errors import APIError
from app.core.logging import configure_logging
from app.db.session import create_database_engine, create_session_factory
from app.integrations.credential_store import CredentialStore, KeyringCredentialStore
from app.integrations.directory_picker import DirectoryPicker, NativeDirectoryPicker
from app.workers.job_manager import JobManager

logger = logging.getLogger(__name__)


def run_migrations(settings: Settings) -> None:
    # Migration source always belongs to this installed backend package. Only
    # the target database follows the runtime project root.
    backend_dir = Path(__file__).resolve().parents[1]
    config = Config(str(backend_dir / "alembic.ini"))
    config.set_main_option(
        "script_location", str(backend_dir / "app" / "db" / "migrations")
    )
    config.set_main_option(
        "sqlalchemy.url", f"sqlite:///{settings.database_path.as_posix()}"
    )
    command.upgrade(config, "head")


def configure_project_caches(settings: Settings) -> None:
    cache = settings.cache_path
    models = settings.models_path
    os.environ.setdefault("HF_HOME", str(models / "huggingface"))
    os.environ.setdefault("TORCH_HOME", str(models / "torch"))
    os.environ.setdefault("XDG_CACHE_HOME", str(cache))
    os.environ.setdefault("PIP_CACHE_DIR", str(cache / "pip"))
    os.environ.setdefault("NUMBA_CACHE_DIR", str(cache / "numba"))


def create_app(
    settings: Settings | None = None,
    *,
    credential_store: CredentialStore | None = None,
    directory_picker: DirectoryPicker | None = None,
    model_discovery_http_client: httpx.AsyncClient | None = None,
) -> FastAPI:
    runtime_settings = settings or get_settings()
    runtime_settings.ensure_directories()
    configure_project_caches(runtime_settings)
    configure_logging(runtime_settings.logs_path, runtime_settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        run_migrations(runtime_settings)
        engine = create_database_engine(runtime_settings)
        session_factory = create_session_factory(engine)
        app.state.settings = runtime_settings
        app.state.engine = engine
        app.state.session_factory = session_factory
        app.state.credential_store = credential_store or KeyringCredentialStore()
        app.state.directory_picker = directory_picker or NativeDirectoryPicker()
        owns_http_client = model_discovery_http_client is None
        app.state.model_discovery_http_client = model_discovery_http_client or httpx.AsyncClient(
            timeout=httpx.Timeout(
                runtime_settings.provider_request_timeout_seconds,
                connect=runtime_settings.provider_connect_timeout_seconds,
            ),
            follow_redirects=False,
            trust_env=False,
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
        )
        app.state.job_manager = JobManager(session_factory, runtime_settings)
        recovered = await app.state.job_manager.recover_stale_jobs()
        if recovered:
            logger.warning("Recovered %s interrupted job(s)", recovered)
        logger.info("MeowPower Phase 1 backend started")
        try:
            yield
        finally:
            await app.state.job_manager.shutdown()
            await engine.dispose()
            if owns_http_client:
                await app.state.model_discovery_http_client.aclose()
            picker = app.state.directory_picker
            if isinstance(picker, NativeDirectoryPicker):
                picker.close()
            logger.info("MeowPower Phase 1 backend stopped")

    app = FastAPI(
        title=runtime_settings.app_name,
        version=runtime_settings.app_version,
        description="Local-first AI YouTube Shorts production studio API.",
        lifespan=lifespan,
    )

    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=list(runtime_settings.allowed_hosts),
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(runtime_settings.allowed_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Idempotency-Key", "Last-Event-ID"],
        expose_headers=["Last-Event-ID"],
    )

    @app.middleware("http")
    async def enforce_local_origin(request: Request, call_next):
        if request.method in {"POST", "PATCH", "PUT", "DELETE"}:
            origin = request.headers.get("origin")
            if origin and origin not in runtime_settings.allowed_origins:
                return JSONResponse(
                    status_code=403,
                    content={
                        "error": {
                            "code": "origin_not_allowed",
                            "message": (
                                "This local API accepts state changes only from the "
                                "MeowPower frontend."
                            ),
                        }
                    },
                )
        return await call_next(request)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        _request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        fields = [
            {
                "location": [str(part) for part in error.get("loc", ())],
                "message": str(error.get("msg", "Invalid value")),
                "type": str(error.get("type", "value_error")),
            }
            for error in exc.errors()
        ]
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "validation_error",
                    "message": "The request did not pass local validation.",
                    "details": {"fields": fields},
                }
            },
        )

    @app.exception_handler(APIError)
    async def handle_api_error(_request: Request, exc: APIError) -> JSONResponse:
        content: dict[str, Any] = {
            "error": {"code": exc.code, "message": exc.message}
        }
        if exc.details:
            content["error"]["details"] = exc.details
        return JSONResponse(status_code=exc.status_code, content=content)

    @app.exception_handler(Exception)
    async def handle_unexpected_error(_request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled API error", exc_info=exc)
        return JSONResponse(
            status_code=500,
            content={
                "error": {
                    "code": "internal_error",
                    "message": "An unexpected local service error occurred.",
                }
            },
        )

    app.include_router(health_router, prefix="/api/v1")
    app.include_router(settings_router, prefix="/api/v1")
    app.include_router(providers_router, prefix="/api/v1")
    app.include_router(jobs_router, prefix="/api/v1")
    app.include_router(system_router, prefix="/api")
    return app


app = create_app()
