"""Configuration sections (stub)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query

from nanobot_console.server.models import (
    ConfigPutBody,
    ConfigSection,
    ConfigValidateResponse,
    DataResponse,
)

router = APIRouter(tags=["Config"])


@router.get("/config", response_model=DataResponse[ConfigSection])
async def get_config(
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[ConfigSection]:
    """Return merged config (stub)."""
    _ = bot_id
    return DataResponse(data=ConfigSection())


@router.put("/config", response_model=DataResponse[ConfigSection])
async def put_config(
    body: ConfigPutBody,
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[ConfigSection]:
    """Update config section (stub)."""
    _ = body, bot_id
    return DataResponse(data=ConfigSection())


@router.get("/config/schema", response_model=DataResponse[Any])
async def get_config_schema(
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[Any]:
    """JSON Schema for config (stub)."""
    _ = bot_id
    return DataResponse(data={})


@router.post("/config/validate", response_model=DataResponse[ConfigValidateResponse])
async def validate_config(
    _body: dict[str, Any],
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[ConfigValidateResponse]:
    """Validate arbitrary config (stub)."""
    _ = bot_id
    return DataResponse(data=ConfigValidateResponse(valid=True, errors=[]))
