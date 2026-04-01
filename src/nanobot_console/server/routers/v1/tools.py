"""Tool call logs (stub)."""

from __future__ import annotations

from fastapi import APIRouter, Query

from nanobot_console.server.models import DataResponse, ToolCallLog

router = APIRouter(tags=["Tools"])


@router.get("/tools/log", response_model=DataResponse[list[ToolCallLog]])
async def tool_logs(
    limit: int = Query(default=50, ge=1, le=500),
    tool_name: str | None = Query(default=None, alias="tool_name"),
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[list[ToolCallLog]]:
    """Recent tool invocations (stub)."""
    _ = limit, tool_name, bot_id
    return DataResponse(data=[])
