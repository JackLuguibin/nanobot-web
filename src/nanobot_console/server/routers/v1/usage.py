"""Token usage history (stub)."""

from __future__ import annotations

from fastapi import APIRouter, Query

from nanobot_console.server.models import DataResponse, UsageHistoryItem

router = APIRouter(tags=["Usage"])


@router.get("/usage/history", response_model=DataResponse[list[UsageHistoryItem]])
async def usage_history(
    bot_id: str | None = Query(default=None, alias="bot_id"),
    days: int = Query(default=14, ge=1, le=366),
) -> DataResponse[list[UsageHistoryItem]]:
    """Daily usage history (stub: empty)."""
    _ = bot_id, days
    return DataResponse(data=[])
