"""Skills from ``config.json`` and ``.cursor/skills/*/SKILL.md``."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from nanobot_console.server.bot_workspace import (
    iter_workspace_skill_dirs,
    read_text,
    skill_description_preview,
    validate_skill_name,
    workspace_skill_md_path,
    write_text,
)
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
from nanobot_console.server.nanobot_user_config import (
    load_raw_config,
    resolve_config_path,
)

router = APIRouter(tags=["Skills"])


def _skill_cfg_map(bot_id: str | None) -> dict[str, Any]:
    """Return the ``skills`` object from raw config (no full validation)."""
    path = resolve_config_path(bot_id)
    raw = load_raw_config(path)
    block = raw.get("skills")
    return block if isinstance(block, dict) else {}


def _builtin_skill_infos(bot_id: str | None, ws_names: set[str]) -> list[SkillInfo]:
    """Skills declared under the top-level ``skills`` key in ``config.json``."""
    cfg = _skill_cfg_map(bot_id)
    out: list[SkillInfo] = []
    for name, meta in cfg.items():
        if not isinstance(name, str) or name in ws_names:
            continue
        enabled = True
        if isinstance(meta, dict) and "enabled" in meta:
            enabled = bool(meta.get("enabled"))
        out.append(
            SkillInfo(
                name=name,
                source="builtin",
                description="",
                enabled=enabled,
                path=None,
                available=True,
            )
        )
    return out


def _workspace_skill_infos(bot_id: str | None) -> list[SkillInfo]:
    """Skills defined as ``.cursor/skills/<name>/SKILL.md``."""
    out: list[SkillInfo] = []
    for d in iter_workspace_skill_dirs(bot_id):
        md = d / "SKILL.md"
        desc = skill_description_preview(md)
        out.append(
            SkillInfo(
                name=d.name,
                source="workspace",
                description=desc,
                enabled=True,
                path=str(md),
                available=True,
            )
        )
    return out


@router.get("/skills", response_model=DataResponse[list[SkillInfo]])
async def list_skills(
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[list[SkillInfo]]:
    """Merge built-in skills from config with workspace ``.cursor/skills``."""
    ws_infos = _workspace_skill_infos(bot_id)
    ws_names = {s.name for s in ws_infos}
    builtin = _builtin_skill_infos(bot_id, ws_names)
    return DataResponse(data=builtin + ws_infos)


@router.get(
    "/skills/registry/search",
    response_model=DataResponse[list[RegistrySearchItem]],
)
async def search_skills_registry(
    q: str | None = Query(default=None),
    registry_url: str | None = Query(default=None, alias="registry_url"),
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[list[RegistrySearchItem]]:
    """Remote registry search is not implemented in the console server."""
    _ = q, registry_url, bot_id
    return DataResponse(data=[])


@router.get("/skills/{name}/content", response_model=DataResponse[SkillContentResponse])
async def get_skill_content(
    name: str,
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[SkillContentResponse]:
    """Read workspace skill markdown or return empty content for config-only skills."""
    validate_skill_name(name)
    wpath = workspace_skill_md_path(bot_id, name)
    if wpath.is_file():
        return DataResponse(
            data=SkillContentResponse(name=name, content=read_text(wpath))
        )
    cfg = _skill_cfg_map(bot_id)
    if name in cfg:
        return DataResponse(data=SkillContentResponse(name=name, content=""))
    raise HTTPException(status_code=404, detail="Skill not found")


@router.post(
    "/skills/{name}/copy-to-workspace",
    response_model=DataResponse[OkWithName],
)
async def copy_skill_to_workspace(
    name: str,
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[OkWithName]:
    """Create a workspace copy from a configured built-in skill name."""
    validate_skill_name(name)
    wpath = workspace_skill_md_path(bot_id, name)
    if wpath.is_file():
        raise HTTPException(status_code=400, detail="Skill already exists in workspace")
    cfg = _skill_cfg_map(bot_id)
    if name not in cfg:
        raise HTTPException(status_code=404, detail="Unknown built-in skill")
    body = (
        f"# {name}\n\n"
        "Copied from configuration. Edit this file and adjust "
        "`skills` in config.json as needed.\n"
    )
    write_text(wpath, body)
    return DataResponse(data=OkWithName(name=name))


@router.put("/skills/{name}/content", response_model=DataResponse[OkWithName])
async def update_skill_content(
    name: str,
    body: SkillContentBody,
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[OkWithName]:
    """Write workspace skill markdown."""
    validate_skill_name(name)
    wpath = workspace_skill_md_path(bot_id, name)
    if not wpath.is_file():
        raise HTTPException(status_code=404, detail="Workspace skill not found")
    write_text(wpath, body.content)
    return DataResponse(data=OkWithName(name=name))


@router.post("/skills", response_model=DataResponse[OkWithName])
async def create_skill(
    body: SkillCreateBody,
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[OkWithName]:
    """Create ``.cursor/skills/<name>/SKILL.md``."""
    name = validate_skill_name(body.name)
    wpath = workspace_skill_md_path(bot_id, name)
    if wpath.is_file():
        raise HTTPException(status_code=400, detail="Skill already exists")
    content = body.content or f"# {name}\n\n{body.description}\n"
    write_text(wpath, content)
    return DataResponse(data=OkWithName(name=name))


@router.delete("/skills/{name}", response_model=DataResponse[OkWithName])
async def delete_skill(
    name: str,
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[OkWithName]:
    """Delete a workspace skill file (and empty parent directory)."""
    validate_skill_name(name)
    wpath = workspace_skill_md_path(bot_id, name)
    if not wpath.is_file():
        raise HTTPException(status_code=404, detail="Workspace skill not found")
    try:
        wpath.unlink()
    except OSError as exc:
        raise HTTPException(status_code=500, detail="Failed to delete skill") from exc
    parent = wpath.parent
    try:
        if parent.is_dir() and not any(parent.iterdir()):
            parent.rmdir()
    except OSError:
        pass
    return DataResponse(data=OkWithName(name=name))


@router.post(
    "/skills/install-from-registry",
    response_model=DataResponse[OkWithName],
)
async def install_skill_from_registry(
    body: InstallFromRegistryBody,
    bot_id: str | None = Query(default=None, alias="bot_id"),
) -> DataResponse[OkWithName]:
    """Placeholder install — creates a stub workspace skill file."""
    name = validate_skill_name(body.name)
    wpath = workspace_skill_md_path(bot_id, name)
    if wpath.is_file():
        raise HTTPException(status_code=400, detail="Skill already exists")
    lines = [f"# {name}", "", "Installed from registry (stub placeholder)."]
    if body.registry_url:
        lines.append(f"Registry: {body.registry_url}")
    write_text(wpath, "\n".join(lines) + "\n")
    return DataResponse(data=OkWithName(name=name))
