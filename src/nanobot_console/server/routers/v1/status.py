"""Aggregate runtime status."""

from __future__ import annotations

from fastapi import APIRouter, Query

from nanobot_console.server.models import DataResponse, StatusResponse
from nanobot_console.server.models.status import placeholder_status
from nanobot_console.server.nanobot_user_config import (
    read_default_model,
    resolve_config_path,
)

router = APIRouter(tags=["Status"])


@router.get("/status", response_model=DataResponse[StatusResponse])
async def get_status(
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[StatusResponse]:
    """Return status; ``model`` comes from ``config.json`` when present."""
    base = placeholder_status()
    path = resolve_config_path(bot_id)
    model = read_default_model(path)
    return DataResponse(data=base.model_copy(update={"model": model}))
