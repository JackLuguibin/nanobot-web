"""MCP server listing and diagnostics (stub)."""

from __future__ import annotations

from fastapi import APIRouter, Query

from nanobot_console.server.models import DataResponse
from nanobot_console.server.models.mcp import MCPTestResult
from nanobot_console.server.models.status import MCPStatus

router = APIRouter(tags=["MCP"])


@router.get("/mcp", response_model=DataResponse[list[MCPStatus]])
async def list_mcp(
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[list[MCPStatus]]:
    """List MCP servers (stub)."""
    _ = bot_id
    return DataResponse(data=[])


@router.post("/mcp/{name}/test", response_model=DataResponse[MCPTestResult])
async def test_mcp(
    name: str,
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[MCPTestResult]:
    """Test MCP connection (stub)."""
    _ = bot_id
    return DataResponse(
        data=MCPTestResult(name=name, success=True, message=None, latency_ms=0.0)
    )


@router.post("/mcp/{name}/refresh", response_model=DataResponse[MCPTestResult])
async def refresh_mcp(
    name: str,
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[MCPTestResult]:
    """Refresh MCP server (stub)."""
    _ = bot_id
    return DataResponse(
        data=MCPTestResult(name=name, success=True, message=None, latency_ms=0.0)
    )
