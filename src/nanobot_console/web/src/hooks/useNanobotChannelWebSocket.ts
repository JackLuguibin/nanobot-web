import { useCallback, useEffect, useRef, useState } from "react";

import type { StreamChunk } from "../api/types";

import { dispatchChatChunk } from "./useWebSocket";

/** Outbound JSON from `nanobot_ext.channels.ws` (OutboundPayload). */
export interface NanobotOutboundPayload {
  type: "message" | "delta" | "end" | "error" | "pong";
  content?: string;
  media?: string[];
  metadata?: Record<string, unknown>;
}

function mapPayloadToStreamChunk(
  payload: NanobotOutboundPayload,
): StreamChunk | null {
  if (payload.type === "pong") {
    return null;
  }
  if (payload.type === "error") {
    return { type: "error", error: payload.content || "Unknown error" };
  }
  if (payload.type === "delta") {
    return { type: "chat_token", content: payload.content || "" };
  }
  if (payload.type === "end") {
    return { type: "chat_done", content: payload.content };
  }
  if (payload.type === "message") {
    return { type: "chat_done", content: payload.content || "" };
  }
  return null;
}

/** 未设置 env 时默认 `/nanobot-ws`（由 Vite 代理到 nanobot `ws` 插件）。设为空字符串可关闭。 */
export function resolveNanobotWsBase(): string {
  const raw = import.meta.env.VITE_NANOBOT_WS_BASE;
  if (raw === undefined) {
    return "/nanobot-ws";
  }
  return String(raw).trim();
}

/** Build `ws:` / `wss:` URL for the nanobot channel plugin (path = chat_id). */
export function buildNanobotChannelWsUrl(sessionKey: string): string {
  const trimmed = resolveNanobotWsBase();
  if (!trimmed) {
    return "";
  }
  const pathSeg = `/${encodeURIComponent(sessionKey)}`;
  if (trimmed.startsWith("ws://") || trimmed.startsWith("wss://")) {
    return `${trimmed.replace(/\/$/, "")}${pathSeg}`;
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${proto}//${window.location.host}${path.replace(/\/$/, "")}${pathSeg}`;
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

  const clearReconnect = () => {
    if (reconnectTimeoutRef.current !== null) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    const base = resolveNanobotWsBase();
    if (!enabled || !sessionKey || !base) {
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
      return;
    }

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
          setReady(true);
          console.log("[nanobot-ws] connected", url);
        };

        ws.onmessage = (event: MessageEvent<string>) => {
          try {
            const payload = JSON.parse(event.data) as NanobotOutboundPayload;
            const chunk = mapPayloadToStreamChunk(payload);
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
      setReady(false);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, sessionKey]);

  const sendMessage = useCallback(
    (payload: { content: string; botId: string | null; sessionKeyOverride: string }) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        throw new Error("nanobot WebSocket not connected");
      }
      ws.send(
        JSON.stringify({
          type: "message",
          content: payload.content,
          sender_id: "web-console",
          session_key: payload.sessionKeyOverride,
          metadata: {
            bot_id: payload.botId,
            source: "nanobot_console",
          },
        }),
      );
    },
    [],
  );

  return { sendMessage, ready, wsRef };
}
