"""Pydantic models for request bodies and response payloads."""

from __future__ import annotations

from nanobot_console.server.models.activity import ActivityItem
from nanobot_console.server.models.agents import (
    AddCategoryBody,
    Agent,
    AgentCreateRequest,
    AgentsSystemStatus,
    AgentStatus,
    AgentUpdateRequest,
    BroadcastEventRequest,
    CategoryInfo,
    CategoryOverrideBody,
    DelegateTaskRequest,
    DelegateTaskResponse,
)
from nanobot_console.server.models.alerts import Alert
from nanobot_console.server.models.base import (
    BaseResponse,
    DataResponse,
    OkBody,
    OkWithAgentId,
    OkWithJobId,
    OkWithKey,
    OkWithName,
    OkWithPath,
    OkWithTopic,
)
from nanobot_console.server.models.bot_files import BotFilesResponse, BotFileUpdateBody
from nanobot_console.server.models.bots import (
    BotInfo,
    CreateBotRequest,
    SetDefaultBotBody,
)
from nanobot_console.server.models.chat import ChatRequest, ChatResponse, ToolCall
from nanobot_console.server.models.config import (
    ConfigPutBody,
    ConfigSection,
    ConfigValidateResponse,
)
from nanobot_console.server.models.cron import CronAddRequest, CronJob, CronStatus
from nanobot_console.server.models.echo import EchoRequest, EchoResponse
from nanobot_console.server.models.env import EnvPutBody, EnvPutResponse, EnvResponse
from nanobot_console.server.models.errors import ErrorDetail, ErrorResponse
from nanobot_console.server.models.health import HealthResponse
from nanobot_console.server.models.health_audit import HealthAuditResponse, HealthIssue
from nanobot_console.server.models.memory import MemoryResponse
from nanobot_console.server.models.plans import (
    PlanBoard,
    PlanColumn,
    PlanSaveBody,
    PlanTask,
)
from nanobot_console.server.models.sessions import (
    BatchDeleteBody,
    BatchDeleteResponse,
    CreateSessionBody,
    SessionDetail,
    SessionInfo,
    SessionMessagesPayload,
)
from nanobot_console.server.models.skills import (
    InstallFromRegistryBody,
    RegistrySearchItem,
    SkillContentBody,
    SkillContentResponse,
    SkillCreateBody,
    SkillInfo,
)
from nanobot_console.server.models.status import StatusResponse
from nanobot_console.server.models.tools import ToolCallLog
from nanobot_console.server.models.usage import UsageHistoryItem
from nanobot_console.server.models.workspace import (
    WorkspaceFilePutBody,
    WorkspaceFileResponse,
    WorkspaceListResponse,
)

__all__ = [
    "ActivityItem",
    "AddCategoryBody",
    "Agent",
    "AgentCreateRequest",
    "AgentsSystemStatus",
    "AgentStatus",
    "AgentUpdateRequest",
    "Alert",
    "BaseResponse",
    "BatchDeleteBody",
    "BatchDeleteResponse",
    "BotFilesResponse",
    "BotFileUpdateBody",
    "BotInfo",
    "BroadcastEventRequest",
    "CategoryInfo",
    "CategoryOverrideBody",
    "ChatRequest",
    "ChatResponse",
    "ConfigPutBody",
    "ConfigSection",
    "ConfigValidateResponse",
    "CreateBotRequest",
    "CreateSessionBody",
    "CronAddRequest",
    "CronJob",
    "CronStatus",
    "DataResponse",
    "DelegateTaskRequest",
    "DelegateTaskResponse",
    "EchoRequest",
    "EchoResponse",
    "EnvPutBody",
    "EnvPutResponse",
    "EnvResponse",
    "ErrorDetail",
    "ErrorResponse",
    "HealthAuditResponse",
    "HealthIssue",
    "HealthResponse",
    "InstallFromRegistryBody",
    "MemoryResponse",
    "OkBody",
    "OkWithAgentId",
    "OkWithJobId",
    "OkWithKey",
    "OkWithName",
    "OkWithPath",
    "OkWithTopic",
    "PlanBoard",
    "PlanColumn",
    "PlanSaveBody",
    "PlanTask",
    "RegistrySearchItem",
    "SessionDetail",
    "SessionInfo",
    "SessionMessagesPayload",
    "SetDefaultBotBody",
    "SkillContentBody",
    "SkillContentResponse",
    "SkillCreateBody",
    "SkillInfo",
    "StatusResponse",
    "ToolCall",
    "ToolCallLog",
    "UsageHistoryItem",
    "WorkspaceFilePutBody",
    "WorkspaceFileResponse",
    "WorkspaceListResponse",
]
