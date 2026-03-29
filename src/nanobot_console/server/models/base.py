"""Base response models shared by API payloads."""

from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


class BaseResponse(BaseModel):
    """Shared fields for all API responses."""

    model_config = ConfigDict(extra="forbid")


class DataResponse(BaseResponse, Generic[T]):
    """Wrapper for responses that carry a data payload."""

    data: T
    message: str | None = None
