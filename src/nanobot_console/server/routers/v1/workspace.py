"""Workspace file browser (stub)."""

from __future__ import annotations

from fastapi import APIRouter, Query

from nanobot_console.server.models import DataResponse
from nanobot_console.server.models.base import OkWithPath
from nanobot_console.server.models.workspace import (
    WorkspaceFilePutBody,
    WorkspaceFileResponse,
    WorkspaceListResponse,
)

router = APIRouter(tags=["Workspace"])


@router.get("/workspace/files", response_model=DataResponse[WorkspaceListResponse])
async def list_workspace_files(
    path: str | None = Query(default=None),
    depth: int | None = Query(default=None, ge=0, le=32),
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[WorkspaceListResponse]:
    """List files under path (stub)."""
    _ = depth, bot_id
    p = path or ""
    return DataResponse(data=WorkspaceListResponse(path=p, items=[]))


@router.get("/workspace/file", response_model=DataResponse[WorkspaceFileResponse])
async def get_workspace_file(
    path: str = Query(...),
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[WorkspaceFileResponse]:
    """Read file (stub)."""
    _ = bot_id
    return DataResponse(data=WorkspaceFileResponse(path=path, content=""))


@router.put("/workspace/file", response_model=DataResponse[OkWithPath])
async def update_workspace_file(
    body: WorkspaceFilePutBody,
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[OkWithPath]:
    """Write file (stub)."""
    _ = bot_id
    return DataResponse(data=OkWithPath(path=body.path))
