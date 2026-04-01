"""Multi-agent API under ``/bots/{bot_id}/agents`` (stub)."""

from __future__ import annotations

from fastapi import APIRouter, status

from nanobot_console.server.models import (
    AddCategoryBody,
    Agent,
    AgentCreateRequest,
    AgentsSystemStatus,
    AgentStatus,
    AgentUpdateRequest,
    BroadcastEventRequest,
    CategoryInfo,
    CategoryOverrideBody,
    DataResponse,
    DelegateTaskRequest,
    DelegateTaskResponse,
    OkBody,
    OkWithTopic,
)
from nanobot_console.server.models.agents import (
    placeholder_agent,
    placeholder_category,
)

router = APIRouter(prefix="/bots/{bot_id}/agents", tags=["Agents"])


@router.get("/system-status/status", response_model=DataResponse[AgentsSystemStatus])
async def agents_system_status(bot_id: str) -> DataResponse[AgentsSystemStatus]:
    """Aggregate multi-agent runtime status (stub)."""
    return DataResponse(
        data=AgentsSystemStatus(
            total_agents=0,
            enabled_agents=0,
            subscribed_agents=[],
            zmq_initialized=False,
            current_agent_id=None,
        )
    )


@router.get("/categories/overrides", response_model=DataResponse[dict[str, str]])
async def get_category_overrides(bot_id: str) -> DataResponse[dict[str, str]]:
    """Return category overrides map (stub: empty)."""
    return DataResponse(data={})


@router.put("/categories/overrides", response_model=DataResponse[dict[str, str]])
async def set_category_override(
    bot_id: str,
    _body: CategoryOverrideBody,
) -> DataResponse[dict[str, str]]:
    """Update category override (stub)."""
    return DataResponse(data={})


@router.get("/categories", response_model=DataResponse[list[CategoryInfo]])
async def list_categories(bot_id: str) -> DataResponse[list[CategoryInfo]]:
    """List agent categories (stub)."""
    return DataResponse(data=[])


@router.post(
    "/categories",
    response_model=DataResponse[CategoryInfo],
    status_code=status.HTTP_200_OK,
)
async def add_category(
    bot_id: str,
    body: AddCategoryBody,
) -> DataResponse[CategoryInfo]:
    """Add category (stub)."""
    return DataResponse(data=placeholder_category(key=body.label.lower()))


@router.delete("/categories/{category_key}", response_model=DataResponse[OkBody])
async def remove_category(
    bot_id: str,
    category_key: str,
) -> DataResponse[OkBody]:
    """Remove category (stub)."""
    _ = bot_id, category_key
    return DataResponse(data=OkBody())


@router.get("", response_model=DataResponse[list[Agent]])
async def list_agents(bot_id: str) -> DataResponse[list[Agent]]:
    """List agents (stub)."""
    return DataResponse(data=[])


@router.post("", response_model=DataResponse[Agent], status_code=status.HTTP_200_OK)
async def create_agent(bot_id: str, _body: AgentCreateRequest) -> DataResponse[Agent]:
    """Create agent (stub)."""
    return DataResponse(data=placeholder_agent())


@router.get("/{agent_id}", response_model=DataResponse[Agent])
async def get_agent(bot_id: str, agent_id: str) -> DataResponse[Agent]:
    """Get agent (stub)."""
    return DataResponse(data=placeholder_agent(agent_id=agent_id))


@router.put("/{agent_id}", response_model=DataResponse[Agent])
async def update_agent(
    bot_id: str,
    agent_id: str,
    _body: AgentUpdateRequest,
) -> DataResponse[Agent]:
    """Update agent (stub)."""
    return DataResponse(data=placeholder_agent(agent_id=agent_id))


@router.delete("/{agent_id}", response_model=DataResponse[OkBody])
async def delete_agent(bot_id: str, agent_id: str) -> DataResponse[OkBody]:
    """Delete agent (stub)."""
    _ = bot_id, agent_id
    return DataResponse(data=OkBody())


@router.post("/{agent_id}/enable", response_model=DataResponse[Agent])
async def enable_agent(bot_id: str, agent_id: str) -> DataResponse[Agent]:
    """Enable agent (stub)."""
    agent = placeholder_agent(agent_id=agent_id).model_copy(update={"enabled": True})
    return DataResponse(data=agent)


@router.post("/{agent_id}/disable", response_model=DataResponse[Agent])
async def disable_agent(bot_id: str, agent_id: str) -> DataResponse[Agent]:
    """Disable agent (stub)."""
    agent = placeholder_agent(agent_id=agent_id).model_copy(update={"enabled": False})
    return DataResponse(data=agent)


@router.get("/{agent_id}/status", response_model=DataResponse[AgentStatus])
async def get_agent_status(bot_id: str, agent_id: str) -> DataResponse[AgentStatus]:
    """Per-agent status (stub)."""
    a = placeholder_agent(agent_id=agent_id)
    return DataResponse(
        data=AgentStatus(
            agent_id=a.id,
            agent_name=a.name,
            enabled=a.enabled,
            total_agents=0,
            enabled_agents=0,
            subscribed_agents=[],
            zmq_initialized=False,
            current_agent_id=None,
        )
    )


@router.post(
    "/{agent_id}/delegate",
    response_model=DataResponse[DelegateTaskResponse],
    status_code=status.HTTP_200_OK,
)
async def delegate_task(
    bot_id: str,
    agent_id: str,
    _body: DelegateTaskRequest,
) -> DataResponse[DelegateTaskResponse]:
    """Delegate task to another agent (stub)."""
    _ = bot_id, agent_id
    return DataResponse(
        data=DelegateTaskResponse(correlation_id="stub", response=None)
    )


@router.post("/{agent_id}/broadcast", response_model=DataResponse[OkWithTopic])
async def broadcast_event(
    bot_id: str,
    agent_id: str,
    body: BroadcastEventRequest,
) -> DataResponse[OkWithTopic]:
    """Broadcast event to subscribers (stub)."""
    return DataResponse(data=OkWithTopic(topic=body.topic))
