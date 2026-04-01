"""Chat sessions (stub)."""

from __future__ import annotations

from fastapi import APIRouter, Query

from nanobot_console.server.models import (
    BatchDeleteBody,
    BatchDeleteResponse,
    CreateSessionBody,
    DataResponse,
    OkBody,
    SessionDetail,
    SessionInfo,
)
from nanobot_console.server.models.sessions import SessionMessagesPayload

router = APIRouter(tags=["Sessions"])


@router.delete("/sessions/batch", response_model=DataResponse[BatchDeleteResponse])
async def delete_sessions_batch(
    body: BatchDeleteBody,
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[BatchDeleteResponse]:
    """Batch delete sessions (stub)."""
    _ = bot_id
    return DataResponse(
        data=BatchDeleteResponse(deleted=[], failed=[])
    )


@router.get("/sessions", response_model=DataResponse[list[SessionInfo]])
async def list_sessions(
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[list[SessionInfo]]:
    """List sessions (stub)."""
    _ = bot_id
    return DataResponse(data=[])


@router.post("/sessions", response_model=DataResponse[SessionInfo])
async def create_session(
    body: CreateSessionBody,
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[SessionInfo]:
    """Create session (stub)."""
    _ = bot_id
    key = body.key or "stub-session"
    return DataResponse(
        data=SessionInfo(key=key, title=None, message_count=0)
    )


@router.get(
    "/sessions/{session_key}",
    response_model=DataResponse[SessionDetail | SessionMessagesPayload],
)
async def get_session(
    session_key: str,
    bot_id: str | None = Query(default=None, alias="bot_id"),
    detail: bool = Query(default=False),
) -> DataResponse[SessionDetail | SessionMessagesPayload]:
    """Get session messages or detail (stub)."""
    _ = bot_id
    if detail:
        return DataResponse(
            data=SessionDetail(
                key=session_key,
                message_count=0,
                preview_messages=[],
            )
        )
    return DataResponse(
        data=SessionMessagesPayload(
            key=session_key,
            messages=[],
            message_count=0,
        )
    )


@router.delete("/sessions/{session_key}", response_model=DataResponse[OkBody])
async def delete_session(
    session_key: str,
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[OkBody]:
    """Delete session (stub)."""
    _ = session_key, bot_id
    return DataResponse(data=OkBody())
