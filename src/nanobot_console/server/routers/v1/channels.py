"""Channel configuration and refresh (stub)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query

from nanobot_console.server.models import DataResponse, OkBody
from nanobot_console.server.models.channels import (
    ChannelRefreshResult,
    ChannelUpdateBody,
)
from nanobot_console.server.models.status import ChannelStatus

router = APIRouter(tags=["Channels"])


@router.get("/channels", response_model=DataResponse[list[ChannelStatus]])
async def list_channels(
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[list[ChannelStatus]]:
    """List channel status rows (stub)."""
    _ = bot_id
    return DataResponse(data=[])


@router.put("/channels/{name}", response_model=DataResponse[dict[str, Any]])
async def update_channel(
    name: str,
    body: ChannelUpdateBody,
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[dict[str, Any]]:
    """Update channel config (stub)."""
    _ = name, body, bot_id
    return DataResponse(data={})


@router.delete("/channels/{name}", response_model=DataResponse[OkBody])
async def delete_channel(
    name: str,
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[OkBody]:
    """Delete channel (stub)."""
    _ = name, bot_id
    return DataResponse(data=OkBody())


@router.post(
    "/channels/refresh",
    response_model=DataResponse[list[ChannelRefreshResult]],
)
async def refresh_all_channels(
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[list[ChannelRefreshResult]]:
    """Refresh all channels (stub)."""
    _ = bot_id
    return DataResponse(data=[])


@router.post(
    "/channels/{name}/refresh",
    response_model=DataResponse[ChannelRefreshResult],
)
async def refresh_channel(
    name: str,
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[ChannelRefreshResult]:
    """Refresh one channel (stub)."""
    _ = bot_id
    return DataResponse(
        data=ChannelRefreshResult(name=name, success=True, message=None)
    )
