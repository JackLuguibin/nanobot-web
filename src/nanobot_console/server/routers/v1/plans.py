"""Plans / Kanban board persisted under ``.nanobot_console/plans.json``."""

from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import ValidationError

from nanobot_console.server.bot_workspace import (
    load_json_file,
    plans_path,
    save_json_file,
)
from nanobot_console.server.models import DataResponse
from nanobot_console.server.models.plans import (
    PlanBoard,
    PlanSaveBody,
    empty_plan_board,
)

router = APIRouter(tags=["Plans"])


def _load_board(bot_id: str | None) -> PlanBoard:
    """Load board from disk or return an empty default."""
    path = plans_path(bot_id)
    data = load_json_file(path, None)
    if data is None:
        return empty_plan_board()
    try:
        return PlanBoard.model_validate(data)
    except ValidationError:
        return empty_plan_board()


@router.get("/plans", response_model=DataResponse[PlanBoard])
async def get_plans(
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[PlanBoard]:
    """Load plan board JSON from the workspace console directory."""
    return DataResponse(data=_load_board(bot_id))


@router.put("/plans", response_model=DataResponse[PlanBoard])
async def save_plans(
    body: PlanSaveBody,
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[PlanBoard]:
    """Persist plan board JSON and echo the saved document."""
    board = PlanBoard(
        id=body.id,
        name=body.name,
        columns=body.columns,
        tasks=body.tasks,
    )
    path = plans_path(bot_id)
    save_json_file(path, board.model_dump(mode="json", by_alias=True))
    return DataResponse(data=board)
