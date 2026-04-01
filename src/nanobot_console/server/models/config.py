"""Configuration section models (loose shapes for stub phase)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict


class GeneralConfig(BaseModel):
    """``general`` subsection."""

    model_config = ConfigDict(extra="allow")

    workspace: str | None = None
    model: str | None = None
    max_iterations: int | None = None
    temperature: float | None = None
    memory_window: int | None = None
    reasoning_effort: str | None = None


class ConfigSection(BaseModel):
    """Merged config document (subset typed, rest flexible)."""

    model_config = ConfigDict(extra="allow")

    general: GeneralConfig | None = None
    providers: dict[str, Any] | None = None
    tools: dict[str, Any] | None = None
    channels: dict[str, Any] | None = None
    skills: dict[str, Any] | None = None


class ConfigPutBody(BaseModel):
    """PUT /config body."""

    model_config = ConfigDict(extra="forbid")

    section: str
    data: dict[str, Any]


class ConfigValidateResponse(BaseModel):
    """POST /config/validate response."""

    model_config = ConfigDict(extra="forbid")

    valid: bool
    errors: list[str]
