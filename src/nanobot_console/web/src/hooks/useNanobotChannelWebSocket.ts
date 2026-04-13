import { useCallback, useEffect, useRef, useState } from "react";

import type { StreamChunk } from "../api/types";
import { useAppStore } from "../store";
import {
  mergeToolCallsWithResults,
  normalizeToolCallsArray,
  normalizeToolResultItems,
} from "../utils/toolCalls";

import { dispatchChatChunk } from "./useWebSocket";

/** Frames from `nanobot.channels.websocket` (WebSocketChannel). */
export interface NanobotNativeWsFrame {
  event:
    | "ready"
    | "message"
    | "delta"
    | "stream_end"
    | "chat_start"
    | "chat_end"
    | "tool_event"
    | "reasoning"
    | string;
  text?: string;
  chat_id?: string;
  client_id?: string;
  media?: string[];
  reply_to?: string;
  stream_id?: unknown;
  tool_calls?: unknown;
  reasoning_content?: string;
}

function optionalToolFrameFields(
  data: Record<string, unknown>,
): Pick<StreamChunk, "tool_calls" | "reasoning_content"> {
  const normalized = normalizeToolCallsArray(data.tool_calls);
  const tool_calls = normalized.length > 0 ? normalized : undefined;
  const rc = data.reasoning_content;
  const reasoning_content = typeof rc === "string" ? rc : undefined;
  const chunk: Pick<StreamChunk, "tool_calls" | "reasoning_content"> = {};
  if (tool_calls) {
    chunk.tool_calls = tool_calls;
  }
  if (reasoning_content !== undefined) {
    chunk.reasoning_content = reasoning_content;
  }
  return chunk;
}

/**
 * Maps nanobot WS frames to StreamChunk.
 * `stream_end` = one streaming segment/frame finished (`stream_frame_end`).
 * `chat_end` = full assistant turn finished (`chat_done`).
 */
function mapNativeFrameToStreamChunk(
  data: Record<string, unknown>,
): StreamChunk | null {
  const ev = data.event;
  if (ev === "ready") {
    return null;
  }
  if (ev === "delta") {
    const text = typeof data.text === "string" ? data.text : "";
    const extra = optionalToolFrameFields(data);
    if (!text && !extra.tool_calls && extra.reasoning_content === undefined) {
      return null;
    }
    return { type: "chat_token", content: text, ...extra };
  }
  if (ev === "reasoning") {
    const text = typeof data.text === "string" ? data.text : "";
    if (!text) {
      return null;
    }
    return {
      type: "chat_token",
      content: "",
      reasoning_content: text,
      reasoning_append: true,
    };
  }
  if (ev === "message") {
    const text = typeof data.text === "string" ? data.text : "";
    const extra = optionalToolFrameFields(data);
    return { type: "chat_done", content: text, ...extra };
  }
  if (ev === "stream_end") {
    const extra = optionalToolFrameFields(data);
    return { type: "stream_frame_end", ...extra };
  }
  if (ev === "chat_start") {
    return { type: "chat_start" };
  }
  if (ev === "chat_end") {
    const extra = optionalToolFrameFields(data);
    return { type: "chat_done", content: "", ...extra };
  }
  if (ev === "tool_event") {
    const mergedTools = mergeToolCallsWithResults(
      normalizeToolCallsArray(data.tool_calls),
      normalizeToolResultItems(data.tool_results),
    );
    const synthetic: Record<string, unknown> = {
      ...data,
      tool_calls: mergedTools,
    };
    const text = typeof data.text === "string" ? data.text : "";
    const extra = optionalToolFrameFields(synthetic);
    if (
      text === "" &&
      !extra.tool_calls &&
      extra.reasoning_content === undefined
    ) {
      return null;
    }
    return { type: "chat_token", content: text, ...extra };
  }
  return null;
}

/** Default `/nanobot-ws` proxies to nanobot built-in `websocket` channel. Empty string disables. */
export function resolveNanobotWsBase(): string {
  const raw = import.meta.env.VITE_NANOBOT_WS_BASE;
  if (raw === undefined) {
    return "/nanobot-ws";
  }
  return String(raw).trim();
}

/** Build `ws:` / `wss:` URL with `client_id` query (nanobot native handshake). */
export function buildNanobotChannelWsUrl(sessionKey: string): string {
  const trimmed = resolveNanobotWsBase();
  if (!trimmed) {
    return "";
  }
  const query = `client_id=${encodeURIComponent(sessionKey)}`;
  if (trimmed.startsWith("ws://") || trimmed.startsWith("wss://")) {
    const base = trimmed.replace(/\/$/, "");
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}${query}`;
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  const pathNorm = path.replace(/\/$/, "");
  return `${proto}//${window.location.host}${pathNorm}/?${query}`;
}

export function useNanobotChannelWebSocket(options: {
  enabled: boolean;
  sessionKey: string | null;
}) {
  const { enabled, sessionKey } = options;
  const [ready, setReady] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const isConnectingRef = useRef(false);
  const setAgentWsReady = useAppStore((s) => s.setAgentWsReady);
  const setNanobotChatId = useAppStore((s) => s.setNanobotChatId);

  useEffect(() => {
    setAgentWsReady(ready);
  }, [ready, setAgentWsReady]);

  const clearReconnect = () => {
    if (reconnectTimeoutRef.current !== null) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    const base = resolveNanobotWsBase();
    const setAgentWsLinked = useAppStore.getState().setAgentWsLinked;
    if (!enabled || !sessionKey || !base) {
      setAgentWsLinked(false);
      setNanobotChatId(null);
      clearReconnect();
      setReady(false);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    const url = buildNanobotChannelWsUrl(sessionKey);
    if (!url) {
      setAgentWsLinked(false);
      setNanobotChatId(null);
      return;
    }

    setAgentWsLinked(true);
    setNanobotChatId(null);

    let cancelled = false;
    /** 每次 effect 清理或发起新连接时递增；旧 socket 的 onclose 若代数不一致则不重连 */
    let connectGeneration = 0;

    const connect = () => {
      if (cancelled) {
        return;
      }
      if (isConnectingRef.current) {
        return;
      }
      isConnectingRef.current = true;
      clearReconnect();

      const myGen = ++connectGeneration;

      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
          if (cancelled || myGen !== connectGeneration) {
            return;
          }
          isConnectingRef.current = false;
          // Ready for UI/send only after server `{ event: "ready", chat_id }` (registers route).
          console.log("[nanobot-ws] socket open, awaiting ready", url);
        };

        ws.onmessage = (event: MessageEvent<string>) => {
          const raw =
            typeof event.data === "string" ? event.data : String(event.data);
          useAppStore.getState().addNanobotWsDebugLine(raw);
          try {
            if (myGen !== connectGeneration) {
              return;
            }
            const data = JSON.parse(event.data) as Record<string, unknown>;
            const ev = data.event;
            if (ev === "ready") {
              const rawId = data.chat_id;
              const cid =
                typeof rawId === "string" && rawId.trim().length > 0
                  ? rawId.trim()
                  : null;
              if (cancelled || myGen !== connectGeneration) {
                return;
              }
              setNanobotChatId(cid);
              setReady(true);
              console.log("[nanobot-ws] ready", url, cid ?? "");
              return;
            }
            const chunk = mapNativeFrameToStreamChunk(data);
            if (chunk) {
              dispatchChatChunk(chunk);
            }
          } catch (e) {
            console.error("[nanobot-ws] parse error", e);
          }
        };

        ws.onclose = () => {
          isConnectingRef.current = false;
          if (myGen !== connectGeneration) {
            return;
          }
          setNanobotChatId(null);
          setReady(false);
          wsRef.current = null;
          if (cancelled) {
            return;
          }
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, 3000);
        };

        ws.onerror = () => {
          isConnectingRef.current = false;
        };
      } catch (e) {
        console.error("[nanobot-ws] create error", e);
        isConnectingRef.current = false;
      }
    };

    connect();

    return () => {
      cancelled = true;
      connectGeneration += 1;
      clearReconnect();
      isConnectingRef.current = false;
      useAppStore.getState().setAgentWsLinked(false);
      useAppStore.getState().setNanobotChatId(null);
      setReady(false);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, sessionKey, setNanobotChatId]);

  const sendMessage = useCallback(
    (payload: { content: string; botId: string | null; sessionKeyOverride: string }) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error("nanobot WebSocket not connected");
      }
      const chatId = useAppStore.getState().nanobotChatId;
      const body: Record<string, unknown> = {
        content: payload.content,
        session_key: payload.sessionKeyOverride,
        metadata: {
          bot_id: payload.botId,
          source: "nanobot_console",
        },
      };
      if (chatId) {
        body.chat_id = chatId;
      }
      const outbound = JSON.stringify(body);
      useAppStore.getState().addNanobotWsDebugLine(`[out] ${outbound}`);
      ws.send(outbound);
    },
    [],
  );

  return { sendMessage, ready, wsRef };
}
