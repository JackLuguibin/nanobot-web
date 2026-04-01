"""Skills list, content, registry (stub)."""

from __future__ import annotations

from fastapi import APIRouter, Query

from nanobot_console.server.models import (
    DataResponse,
    SkillContentResponse,
    SkillCreateBody,
    SkillInfo,
)
from nanobot_console.server.models.base import OkWithName
from nanobot_console.server.models.skills import (
    InstallFromRegistryBody,
    RegistrySearchItem,
    SkillContentBody,
)

router = APIRouter(tags=["Skills"])


@router.get("/skills", response_model=DataResponse[list[SkillInfo]])
async def list_skills(
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[list[SkillInfo]]:
    """List skills (stub)."""
    _ = bot_id
    return DataResponse(data=[])


@router.get(
    "/skills/registry/search",
    response_model=DataResponse[list[RegistrySearchItem]],
)
async def search_skills_registry(
    q: str | None = Query(default=None),
    registry_url: str | None = Query(default=None, alias="registry_url"),
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[list[RegistrySearchItem]]:
    """Search remote skill registry (stub)."""
    _ = q, registry_url, bot_id
    return DataResponse(data=[])


@router.get("/skills/{name}/content", response_model=DataResponse[SkillContentResponse])
async def get_skill_content(
    name: str,
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[SkillContentResponse]:
    """Read skill file (stub)."""
    _ = bot_id
    return DataResponse(data=SkillContentResponse(name=name, content=""))


@router.post(
    "/skills/{name}/copy-to-workspace",
    response_model=DataResponse[OkWithName],
)
async def copy_skill_to_workspace(
    name: str,
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[OkWithName]:
    """Copy builtin skill into workspace (stub)."""
    _ = bot_id
    return DataResponse(data=OkWithName(name=name))


@router.put("/skills/{name}/content", response_model=DataResponse[OkWithName])
async def update_skill_content(
    name: str,
    _body: SkillContentBody,
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[OkWithName]:
    """Write skill content (stub)."""
    _ = bot_id
    return DataResponse(data=OkWithName(name=name))


@router.post("/skills", response_model=DataResponse[OkWithName])
async def create_skill(
    body: SkillCreateBody,
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[OkWithName]:
    """Create workspace skill (stub)."""
    _ = bot_id
    return DataResponse(data=OkWithName(name=body.name))


@router.delete("/skills/{name}", response_model=DataResponse[OkWithName])
async def delete_skill(
    name: str,
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[OkWithName]:
    """Delete skill (stub)."""
    _ = bot_id
    return DataResponse(data=OkWithName(name=name))


@router.post(
    "/skills/install-from-registry",
    response_model=DataResponse[OkWithName],
)
async def install_skill_from_registry(
    body: InstallFromRegistryBody,
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[OkWithName]:
    """Install skill from registry (stub)."""
    _ = bot_id
    return DataResponse(data=OkWithName(name=body.name))
