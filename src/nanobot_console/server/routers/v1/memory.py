"""Long-term memory (stub)."""

from __future__ import annotations

from fastapi import APIRouter, Query

from nanobot_console.server.models import DataResponse, MemoryResponse

router = APIRouter(tags=["Memory"])


@router.get("/memory", response_model=DataResponse[MemoryResponse])
async def get_memory(
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[MemoryResponse]:
    """Return memory blobs (stub)."""
    _ = bot_id
    return DataResponse(data=MemoryResponse(long_term="", history=""))
