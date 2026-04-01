"""Plans / Kanban board (stub)."""

from __future__ import annotations

from fastapi import APIRouter, Query

from nanobot_console.server.models import DataResponse
from nanobot_console.server.models.plans import (
    PlanBoard,
    PlanSaveBody,
    empty_plan_board,
)

router = APIRouter(tags=["Plans"])


@router.get("/plans", response_model=DataResponse[PlanBoard])
async def get_plans(
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[PlanBoard]:
    """Load plan board (stub)."""
    _ = bot_id
    return DataResponse(data=empty_plan_board())


@router.put("/plans", response_model=DataResponse[PlanBoard])
async def save_plans(
    body: PlanSaveBody,
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[PlanBoard]:
    """Save plan board (stub)."""
    _ = bot_id
    return DataResponse(
        data=PlanBoard(
            id=body.id,
            name=body.name,
            columns=body.columns,
            tasks=body.tasks,
        )
    )
