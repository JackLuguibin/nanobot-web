"""Pydantic models for request bodies and response payloads."""

from __future__ import annotations

from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

from nanobot_console.server.models import errors as _errors
from nanobot_console.server.models import health as _health
from nanobot_console.server.models import echo as _echo

# Base response wrapper
class BaseResponse(BaseModel):
    """Shared fields for all API responses."""

    model_config = ConfigDict(extra="forbid")


T = TypeVar("T")


class DataResponse(BaseResponse, Generic[T]):
    """Wrapper for responses that carry a data payload."""

    data: T
    message: str | None = None


# Re-export from submodules so existing `from nanobot_console.server.models import ...` calls still work
ErrorDetail = _errors.ErrorDetail
ErrorResponse = _errors.ErrorResponse
HealthResponse = _health.HealthResponse
EchoRequest = _echo.EchoRequest
EchoResponse = _echo.EchoResponse
