"""Application configuration — validated at startup.

Configuration is loaded in the following priority order (highest first):

1. Environment variables (``NANBOT_SERVER_*``)
2. ``nanobot_web.json`` file in the project root (``server`` key)
3. Code defaults declared in ``Field(...)`` descriptors
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from nanobot_console.server.config_loader import (
    find_config_file,
    load_config_file,
    write_default_config,
)


class ServerSettings(BaseSettings):
    """FastAPI server settings loaded from env / nanobot_web.json / defaults."""

    model_config = SettingsConfigDict(
        env_prefix="NANBOT_SERVER_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    host: str = Field(default="0.0.0.0", description="Bind address")
    port: int = Field(default=8000, ge=1, le=65535, description="Bind port")
    reload: bool = Field(default=False, description="Enable auto-reload (dev only)")
    log_level: str = Field(default="INFO", description="Loguru log level")
    workers: int = Field(default=1, ge=1, description="Number of worker processes")
    cors_origins: list[str] = Field(
        default=["*"], description="Allowed CORS origins"
    )
    title: str = Field(default="nanobot-console", description="API title")
    description: str = Field(
        default="HTTP API for nanobot console management",
        description="API description",
    )
    version: str = Field(default="1.0.0", description="API version")
    api_prefix: str = Field(default="/api/v1", description="Root path for all routes")
    docs_url: str = Field(default="/docs", description="OpenAPI docs path")
    redoc_url: str = Field(default="/redoc", description="ReDoc UI path")
    openapi_url: str = Field(default="/openapi.json", description="OpenAPI schema path")

    @model_validator(mode="before")
    @classmethod
    def _apply_json_defaults(cls, values: dict) -> dict:
        """Seed ``values`` from nanobot_web.json before pydantic resolves env vars.

        Env vars (step 1) take priority over JSON (step 2), which take priority
        over ``Field`` defaults (step 3).
        """
        config = load_config_file()
        return {**config, **values} if config else values


@lru_cache(maxsize=1)
def get_settings() -> ServerSettings:
    """Return cached settings singleton.

    Creates a default ``nanobot_web.json`` if no config file exists.
    """
    if find_config_file() is None:
        path = write_default_config()
        print(f"[config] No config file found — wrote defaults to {path}")
    return ServerSettings()
