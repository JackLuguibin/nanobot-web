"""Health check response models."""

from __future__ import annotations

from datetime import datetime

from pydantic import Field

from nanobot_console.server.models import BaseResponse


class HealthResponse(BaseResponse):
    """Health check response."""

    status: str = Field(default="ok", description="'ok' when healthy")
    version: str = Field(description="API version")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
