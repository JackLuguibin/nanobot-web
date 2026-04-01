"""Bot management API (stub)."""

from __future__ import annotations

from fastapi import APIRouter, status

from nanobot_console.server.models import (
    CreateBotRequest,
    DataResponse,
    OkBody,
    SetDefaultBotBody,
)
from nanobot_console.server.models.bots import BotInfo, placeholder_bot

router = APIRouter(tags=["Bots"])


@router.get("/bots", response_model=DataResponse[list[BotInfo]])
async def list_bots() -> DataResponse[list[BotInfo]]:
    """List all bots (stub: empty list)."""
    return DataResponse(data=[])


@router.post(
    "/bots",
    response_model=DataResponse[BotInfo],
    status_code=status.HTTP_200_OK,
)
async def create_bot(_body: CreateBotRequest) -> DataResponse[BotInfo]:
    """Create a bot (stub)."""
    return DataResponse(data=placeholder_bot())


@router.get("/bots/{bot_id}", response_model=DataResponse[BotInfo])
async def get_bot(bot_id: str) -> DataResponse[BotInfo]:
    """Return one bot (stub)."""
    return DataResponse(data=placeholder_bot(bot_id=bot_id))


@router.delete("/bots/{bot_id}", response_model=DataResponse[OkBody])
async def delete_bot(_bot_id: str) -> DataResponse[OkBody]:
    """Delete a bot (stub)."""
    return DataResponse(data=OkBody())


@router.put("/bots/default", response_model=DataResponse[OkBody])
async def set_default_bot(_body: SetDefaultBotBody) -> DataResponse[OkBody]:
    """Set default bot (stub)."""
    return DataResponse(data=OkBody())


@router.post("/bots/{bot_id}/start", response_model=DataResponse[BotInfo])
async def start_bot(bot_id: str) -> DataResponse[BotInfo]:
    """Start bot process (stub)."""
    b = placeholder_bot(bot_id=bot_id)
    return DataResponse(data=b.model_copy(update={"running": True}))


@router.post("/bots/{bot_id}/stop", response_model=DataResponse[BotInfo])
async def stop_bot(bot_id: str) -> DataResponse[BotInfo]:
    """Stop bot process (stub)."""
    b = placeholder_bot(bot_id=bot_id)
    return DataResponse(data=b.model_copy(update={"running": False}))
