from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    """Runtime settings. All project-local paths derive from project_root."""

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_prefix="MEOWPOWER_",
        extra="ignore",
    )

    app_name: str = "MeowPower API"
    app_version: str = "0.1.5-phase1.5"
    project_root: Path = Field(default=PROJECT_ROOT)
    host: str = "127.0.0.1"
    port: int = 8000
    log_level: str = "INFO"
    allowed_origins: tuple[str, ...] = (
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    )
    allowed_hosts: tuple[str, ...] = ("127.0.0.1", "localhost")
    job_poll_interval_seconds: float = 0.2
    demo_stage_delay_seconds: float = 0.65
    model_catalog_ttl_seconds: int = 900
    provider_request_timeout_seconds: float = 10.0
    provider_connect_timeout_seconds: float = 5.0

    @property
    def database_path(self) -> Path:
        return self.project_root / "storage" / "database" / "meowpower.db"

    @property
    def logs_path(self) -> Path:
        return self.project_root / "logs"

    @property
    def models_path(self) -> Path:
        return self.project_root / "models"

    @property
    def cache_path(self) -> Path:
        return self.project_root / "cache"

    @property
    def temp_path(self) -> Path:
        return self.project_root / "temp"

    def ensure_directories(self) -> None:
        paths = (
            self.project_root,
            self.database_path.parent,
            self.logs_path,
            self.models_path,
            self.cache_path,
            self.temp_path,
            self.project_root / "storage" / "sources",
            self.project_root / "storage" / "audio",
            self.project_root / "storage" / "transcripts",
            self.project_root / "storage" / "clips",
            self.project_root / "storage" / "thumbnails",
            self.project_root / "storage" / "music",
        )
        for path in paths:
            path.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()
