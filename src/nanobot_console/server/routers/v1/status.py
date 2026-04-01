"""Aggregate runtime status (stub)."""

from __future__ import annotations

from fastapi import APIRouter, Query

from nanobot_console.server.models import DataResponse, StatusResponse
from nanobot_console.server.models.status import placeholder_status

router = APIRouter(tags=["Status"])


@router.get("/status", response_model=DataResponse[StatusResponse])
async def get_status(
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[StatusResponse]:
    """Return bot / service status (stub)."""
    _ = bot_id
    return DataResponse(data=placeholder_status())
