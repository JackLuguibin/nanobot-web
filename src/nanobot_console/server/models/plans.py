"""Plans / Kanban board models (camelCase in JSON per web client)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class PlanColumn(BaseModel):
    """Board column."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str
    title: str
    order: int


class PlanTask(BaseModel):
    """Board or Gantt task."""

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        ser_json_by_alias=True,
    )

    id: str
    title: str
    description: str | None = None
    column_id: str = Field(alias="columnId")
    order: int
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")
    priority: Literal["high", "medium", "low"] | None = None
    start_date: str | None = Field(default=None, alias="startDate")
    due_date: str | None = Field(default=None, alias="dueDate")
    progress: int | None = None
    dependencies: list[str] | None = None
    project: str | None = None
    type: Literal["task", "milestone", "project"] | None = None
    is_disabled: bool | None = Field(default=None, alias="isDisabled")


class PlanBoard(BaseModel):
    """Full board document."""

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        ser_json_by_alias=True,
    )

    id: str
    name: str | None = None
    columns: list[PlanColumn]
    tasks: list[PlanTask]


class PlanSaveBody(BaseModel):
    """PUT /plans body (subset of board fields)."""

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        ser_json_by_alias=True,
    )

    id: str
    name: str | None = None
    columns: list[PlanColumn]
    tasks: list[PlanTask]


def empty_plan_board() -> PlanBoard:
    """Return an empty board document."""
    return PlanBoard(id="stub-board", name="Stub", columns=[], tasks=[])
