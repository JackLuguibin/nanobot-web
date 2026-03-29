"""FastAPI dependency providers.

All dependencies are declared as reusable callable factories so FastAPI's
dependency injection system can resolve and cache them per request.
"""

from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import Request

from nanobot_console.server.config import ServerSettings, get_settings


async def get_settings_dep() -> ServerSettings:
    """Inject application settings."""
    return get_settings()


class MessageBusRef:
    """Lazy, request-scoped reference to the shared MessageBus instance.

    Resolved on first access to avoid importing the bus at module load time.
    """

    def __init__(self) -> None:
        self._bus = None

    def resolve(self, request: Request):
        if self._bus is None:
            # In a real integration the app stores the bus on app.state
            self._bus = getattr(request.app.state, "message_bus", None)
        return self._bus


_message_bus_ref = MessageBusRef()


async def get_message_bus(request: Request):
    """Inject the shared MessageBus instance for the current request scope."""
    bus = _message_bus_ref.resolve(request)
    if bus is None:
        raise RuntimeError("MessageBus not initialised — is the server started?")
    return bus


@asynccontextmanager
async def lifespan_context(request: Request) -> AsyncGenerator[None, None]:
    """Placeholder lifespan hook — expand when MessageBus integration is ready."""
    yield
