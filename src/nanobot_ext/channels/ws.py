"""WebSocket channel implementation for nanobot.

Clients connect via WebSocket and exchange messages with the bot.
Each WebSocket connection represents one chat session (chat_id = connection token).
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, Literal

import websockets
from loguru import logger
from nanobot.bus.events import OutboundMessage
from nanobot.bus.queue import MessageBus
from nanobot.channels.base import BaseChannel
from nanobot.config.schema import Base
from pydantic import Field


class WebSocketConfig(Base):
    """WebSocket channel configuration."""

    enabled: bool = True
    host: str = "0.0.0.0"
    port: int = 8765
    allow_from: list[str] = ["*"]  # Per-connection token allowlist
    max_connections: int = 100
    streaming: bool = False


class InboundPayload(Base):
    """Parsed inbound message from a WebSocket client."""

    type: Literal["message", "ping"] = Field(default="message")
    content: str = Field(default="")
    sender_id: str | None = Field(default=None)
    media: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class OutboundPayload(Base):
    """Structured outbound message sent to a WebSocket client."""

    type: Literal["message", "delta", "end", "error", "pong"] = Field(default="message")
    content: str = Field(default="")
    media: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)


class WebSocketChannel(BaseChannel):
    """WebSocket channel — accepts client connections and relays messages."""

    name = "ws"
    display_name = "WebSocket"

    @classmethod
    def default_config(cls) -> dict[str, Any]:
        return WebSocketConfig().model_dump(by_alias=True)

    def __init__(self, config: Any, bus: MessageBus):
        if isinstance(config, dict):
            config = WebSocketConfig.model_validate(config)
        super().__init__(config, bus)
        self.config: WebSocketConfig = config
        self._server_task: asyncio.Task | None = None
        self._running = False
        self._connections: dict[str, websockets.WebSocketServerProtocol] = {}
        self._lock = asyncio.Lock()

    async def start(self) -> None:
        """Start the WebSocket server and listen for connections."""
        if self._running:
            return

        self._running = True
        self._server_task = asyncio.create_task(self._run_server())
        logger.info(
            "WebSocket channel listening on {}:{}", self.config.host, self.config.port
        )

    async def stop(self) -> None:
        """Stop the WebSocket server and close all connections."""
        self._running = False

        async with self._lock:
            conns = list(self._connections.values())

        # Close all client connections gracefully
        for ws in conns:
            try:
                await ws.close(1001, "server shutting down")
            except Exception:
                logger.error("Failed to close WebSocket connection: {}", ws)

        # Stop the server
        if self._server_task:
            self._server_task.cancel()
            try:
                await self._server_task
            except asyncio.CancelledError:
                logger.error("WebSocket server cancelled")

        logger.info("WebSocket channel stopped")

    async def send(self, msg: OutboundMessage) -> None:
        """Forward an outbound message to the corresponding WebSocket client."""
        if msg.content == "[empty message]" and not msg.media:
            return

        async with self._lock:
            ws = self._connections.get(msg.chat_id)

        if ws is None:
            logger.warning("No WebSocket connection for chat_id: {}", msg.chat_id)
            return

        try:
            payload = OutboundPayload(
                type="message",
                content=msg.content,
                media=msg.media or [],
                metadata=msg.metadata or {},
            ).model_dump_json(ensure_ascii=False)
            await ws.send(payload)
        except Exception as e:
            logger.error("Failed to send to {}: {}", msg.chat_id, e)

    async def send_delta(
        self, chat_id: str, delta: str, metadata: dict[str, Any] | None = None
    ) -> None:
        """Deliver a streaming text chunk."""
        await self.send(
            OutboundMessage(
                channel=self.name,
                chat_id=chat_id,
                content=delta,
                metadata=metadata or {},
            )
        )

    async def _run_server(self) -> None:
        """Run the WebSocket server, accepting connections."""
        stop = asyncio.Future()
        # Store stop future so the connection handler can trigger shutdown
        self._stop_future = stop

        try:
            async with websockets.serve(
                self._handle_connection,
                host=self.config.host,
                port=self.config.port,
                max_size=10 * 1024 * 1024,  # 10 MB
                max_queue=16,
            ):
                await stop
        except asyncio.CancelledError:
            logger.error("WebSocket server cancelled")

    async def _handle_connection(
        self, ws: websockets.WebSocketServerProtocol, path: str
    ) -> None:
        """Handle an individual WebSocket client connection."""
        # Derive chat_id from the connection path or assign a unique one
        raw_id = path.strip("/") or str(id(ws))
        chat_id = raw_id

        # Token-based allowlist
        if self.config.allow_from and chat_id not in self.config.allow_from:
            logger.warning("chat_id {} rejected: not in allowlist", chat_id)
            await ws.close(4003, "Forbidden")
            return

        async with self._lock:
            if len(self._connections) >= self.config.max_connections:
                await ws.close(1008, "Server at capacity")
                return
            self._connections[chat_id] = ws

        logger.info("WebSocket client connected: {}", chat_id)

        try:
            async for raw in ws:
                try:
                    inbound = InboundPayload.model_validate(json.loads(raw))
                except json.JSONDecodeError:
                    payload = OutboundPayload(type="error", content="Invalid JSON")
                    await ws.send(payload.model_dump_json())
                    continue
                except Exception:
                    payload = OutboundPayload(
                        type="error", content="Invalid message format"
                    )
                    await ws.send(payload.model_dump_json())
                    continue

                if inbound.type == "ping":
                    await ws.send(OutboundPayload(type="pong").model_dump_json())
                elif inbound.type == "message":
                    content = (inbound.content or "").strip()
                    if not content:
                        continue
                    await self._handle_message(
                        sender_id=inbound.sender_id or chat_id,
                        chat_id=chat_id,
                        content=content,
                        metadata={**(inbound.metadata or {}), "ws_path": path},
                    )
        except websockets.exceptions.ConnectionClosed:
            pass
        except Exception as e:
            logger.error("WebSocket error for {}: {}", chat_id, e)
        finally:
            async with self._lock:
                self._connections.pop(chat_id, None)
            logger.info("WebSocket client disconnected: {}", chat_id)
