"""Environment variables (stub)."""

from __future__ import annotations

from fastapi import APIRouter, Query

from nanobot_console.server.models import DataResponse
from nanobot_console.server.models.env import EnvPutBody, EnvPutResponse, EnvResponse

router = APIRouter(tags=["Env"])


@router.get("/env", response_model=DataResponse[EnvResponse])
async def get_env(
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[EnvResponse]:
    """Return env vars (stub)."""
    _ = bot_id
    return DataResponse(data=EnvResponse(vars={}))


@router.put("/env", response_model=DataResponse[EnvPutResponse])
async def put_env(
    body: EnvPutBody,
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[EnvPutResponse]:
    """Update env vars (stub)."""
    _ = bot_id
    return DataResponse(data=EnvPutResponse(status="ok", vars=body.vars))
