"""WebSocket channel implementation for nanobot.

Clients connect via WebSocket and exchange messages with the bot.
Each WebSocket connection represents one chat session (chat_id = connection token).
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, Literal
from urllib.parse import unquote

import websockets
from loguru import logger
from nanobot.bus.events import OutboundMessage
from nanobot.bus.queue import MessageBus
from nanobot.channels.base import BaseChannel
from nanobot.config.schema import Base
from pydantic import Field
from websockets.asyncio.server import ServerConnection


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
    session_key: str | None = Field(default=None)
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
        self._connections: dict[str, ServerConnection] = {}
        self._lock = asyncio.Lock()

    @staticmethod
    def _lookup_keys_for_chat_id(chat_id: str) -> list[str]:
        """Possible dict keys for the same logical chat (path vs outbound id)."""
        keys: list[str] = []
        for candidate in (chat_id, unquote(chat_id)):
            if not candidate:
                continue
            if candidate not in keys:
                keys.append(candidate)
            if ":" in candidate:
                suffix = candidate.split(":", 1)[-1]
                if suffix and suffix not in keys:
                    keys.append(suffix)
            prefixed = f"ws:{candidate}"
            if not candidate.startswith("ws:") and prefixed not in keys:
                keys.append(prefixed)
        return keys

    def _connection_for_outbound(self, chat_id: str) -> ServerConnection | None:
        """Resolve a live connection; outbound chat_id may differ from URL path key."""
        for key in self._lookup_keys_for_chat_id(chat_id):
            ws = self._connections.get(key)
            if ws is not None:
                return ws
        return None

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
            ws = self._connection_for_outbound(msg.chat_id)

        if ws is None:
            logger.warning(
                "No WebSocket connection for chat_id: {} (tried keys: {})",
                msg.chat_id,
                self._lookup_keys_for_chat_id(msg.chat_id),
            )
            return

        try:
            meta = msg.metadata or {}
            if meta.get("_stream_end"):
                out_type: Literal["message", "delta", "end", "error", "pong"] = "end"
            elif meta.get("_stream_delta"):
                out_type = "delta"
            else:
                out_type = "message"
            payload = OutboundPayload(
                type=out_type,
                content=msg.content,
                media=msg.media or [],
                metadata=meta,
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

    async def _handle_connection(self, connection: ServerConnection) -> None:
        """Handle an individual WebSocket client connection."""
        # websockets ≥12: handler receives only the connection; path is on the request
        req = connection.request
        path = (req.path if req is not None else "/") or "/"
        # Derive chat_id from the connection path or assign a unique one
        raw_path = path.strip("/") or ""
        raw_id = unquote(raw_path.split("/")[-1]) if raw_path else str(id(connection))
        chat_id = raw_id
        alias_keys: list[str] = []

        # Token-based allowlist (same semantics as BaseChannel.is_allowed for "*")
        allowed = self.config.allow_from
        if allowed and "*" not in allowed and chat_id not in allowed:
            logger.warning("chat_id {} rejected: not in allowlist", chat_id)
            await connection.close(4003, "Forbidden")
            return

        async with self._lock:
            if len(self._connections) >= self.config.max_connections:
                await connection.close(1008, "Server at capacity")
                return
            self._connections[chat_id] = connection

        logger.info("WebSocket client connected: {}", chat_id)

        try:
            async for raw in connection:
                try:
                    inbound = InboundPayload.model_validate(json.loads(raw))
                except json.JSONDecodeError:
                    payload = OutboundPayload(type="error", content="Invalid JSON")
                    await connection.send(payload.model_dump_json())
                    continue
                except Exception:
                    payload = OutboundPayload(
                        type="error", content="Invalid message format"
                    )
                    await connection.send(payload.model_dump_json())
                    continue

                if inbound.type == "ping":
                    await connection.send(
                        OutboundPayload(type="pong").model_dump_json()
                    )
                elif inbound.type == "message":
                    content = (inbound.content or "").strip()
                    if not content:
                        continue
                    sk = (inbound.session_key or "").strip()
                    if sk and sk != chat_id:
                        async with self._lock:
                            self._connections[sk] = connection
                        if sk not in alias_keys:
                            alias_keys.append(sk)
                    await self._handle_message(
                        sender_id=inbound.sender_id or chat_id,
                        chat_id=chat_id,
                        content=content,
                        metadata={**(inbound.metadata or {}), "ws_path": path},
                        session_key=inbound.session_key,
                    )
        except websockets.exceptions.ConnectionClosed:
            pass
        except Exception as e:
            logger.error("WebSocket error for {}: {}", chat_id, e)
        finally:
            # Multiple connections may share the same chat_id (e.g. React remount).
            # Only remove dict entries that still point at *this* connection.
            async with self._lock:
                if self._connections.get(chat_id) is connection:
                    self._connections.pop(chat_id, None)
                for alias in alias_keys:
                    if self._connections.get(alias) is connection:
                        self._connections.pop(alias, None)
            logger.info("WebSocket client disconnected: {}", chat_id)
