"""Bot profile files (SOUL, USER, …) (stub)."""

from __future__ import annotations

from fastapi import APIRouter, Query

from nanobot_console.server.models import (
    BotFilesResponse,
    BotFileUpdateBody,
    DataResponse,
)
from nanobot_console.server.models.base import OkWithKey

router = APIRouter(tags=["BotFiles"])


@router.get("/bot-files", response_model=DataResponse[BotFilesResponse])
async def get_bot_files(
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[BotFilesResponse]:
    """Return profile file contents (stub)."""
    _ = bot_id
    return DataResponse(
        data=BotFilesResponse(soul="", user="", heartbeat="", tools="", agents="")
    )


@router.put("/bot-files/{key}", response_model=DataResponse[OkWithKey])
async def update_bot_file(
    key: str,
    _body: BotFileUpdateBody,
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[OkWithKey]:
    """Update one profile file (stub)."""
    _ = bot_id
    return DataResponse(data=OkWithKey(key=key))
