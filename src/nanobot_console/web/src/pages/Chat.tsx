import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Markdown } from "../components/Markdown";
import { useAppStore } from "../store";
import {
  resolveNanobotWsBase,
  useNanobotChannelWebSocket,
} from "../hooks/useNanobotChannelWebSocket";
import { registerChatHandler, getWSRef } from "../hooks/useWebSocket";
import * as api from "../api/client";
import { Button, Tag, Popconfirm } from "antd";
import {
  PlusOutlined,
  LoadingOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import {
  Bot,
  Check,
  ChevronRight,
  Copy,
  MessageSquare,
  Sparkles,
  Square,
  User,
  Wand2,
  Wrench,
  X,
} from "lucide-react";
import type { StreamChunk, ToolCall } from "../api/types";
import { normalizeToolCallsArray } from "../utils/toolCalls";
import type { TextAreaRef } from "antd/es/input/TextArea";
import Input from "antd/es/input";
import { SubagentPanel, type SubagentTask } from "../components/SubagentPanel";

interface ChatInputProps {
  inputRef: React.RefObject<TextAreaRef | null>;
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
}

function ChatInput({
  inputRef,
  value,
  onChange,
  onKeyDown,
  onSend,
  onStop,
  isStreaming,
}: ChatInputProps) {
  const [focused, setFocused] = useState(false);
  const canSend = value.trim().length > 0;

  return (
    <div className="space-y-2">
      <div
        className={`relative rounded-2xl border transition-all duration-200 bg-white dark:bg-gray-900 ${
          focused
            ? "border-blue-400 dark:border-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.15)]"
            : "border-gray-200 dark:border-gray-700 shadow-sm hover:border-gray-300 dark:hover:border-gray-600"
        }`}
      >
        <Input.TextArea
          ref={inputRef as React.RefObject<TextAreaRef>}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Send a message..."
          autoSize={{ minRows: 1, maxRows: 8 }}
          variant="borderless"
          className="!text-[15px] !leading-relaxed !py-3.5 !px-4 !pr-14 resize-none bg-transparent"
          style={{ boxShadow: "none" }}
        />

        {/* Action bar */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-0">
          <span className="text-xs text-gray-400 dark:text-gray-500 select-none">
            {isStreaming ? (
              <span className="flex items-center gap-1.5 text-blue-500">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Generating…
              </span>
            ) : (
              <span>Enter to send · Shift+Enter for new line</span>
            )}
          </span>

          <button
            onClick={isStreaming ? onStop : onSend}
            disabled={!isStreaming && !canSend}
            className={`flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-150 ${
              isStreaming
                ? "bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/30 hover:shadow-red-500/40 hover:scale-105"
                : canSend
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/30 hover:shadow-blue-500/40 hover:scale-105"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
            }`}
            title={isStreaming ? "Stop generating" : "Send message"}
          >
            {isStreaming ? (
              <Square className="w-3.5 h-3.5 fill-current" />
            ) : (
              <svg
                viewBox="0 0 16 16"
                className="w-3.5 h-3.5 fill-current"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M.5 1.163A1 1 0 0 1 1.97.28l12.868 6.837a1 1 0 0 1 0 1.766L1.969 15.72A1 1 0 0 1 .5 14.836V10.33a1 1 0 0 1 .816-.983L8.5 8 1.316 6.653A1 1 0 0 1 .5 5.67V1.163Z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  tool_name?: string;
  isStreaming?: boolean;
  /** 发送时间，ISO 字符串，用于展示 */
  created_at?: string;
  timestamp?: string;
  /** 消息来源：user / main_agent / sub_agent / tool_call；聊天区仅展示 user 与 main_agent */
  source?: "user" | "main_agent" | "sub_agent" | "tool_call";
  /** WebSocket / 流式帧内嵌的多段工具调用，展示为可折叠块 */
  tool_calls?: ToolCall[];
  /** 发起工具调用前的推理说明 */
  reasoning_content?: string;
}

/** Console WebSocket 的 tool_call / tool_result 追踪用（与帧内嵌 tool_calls 分列） */
interface TrackedToolCall {
  id: string;
  name: string;
  args: string;
  status: "pending" | "running" | "success" | "error";
  result?: string;
}

/** 将 Agent 的 tool_hint 拆成多行，避免 read_file("a")read_file("b") 挤在一行 */
function formatToolHintMultiline(hint: string): string {
  return hint.replace(/\),\s*(?=[A-Za-z_]\w*\()/g, ")\n");
}

/** JSON.stringify length heuristic for merging streaming tool call argument snapshots. */
function toolCallArgumentsPayloadScore(args: Record<string, unknown>): number {
  try {
    return JSON.stringify(args).length;
  } catch {
    return 0;
  }
}

/**
 * Merge successive chat_token tool_calls by id so a later frame with richer
 * arguments does not get overwritten by an empty snapshot.
 */
function mergeStreamingToolCalls(prev: ToolCall[], incoming: ToolCall[]): ToolCall[] {
  if (incoming.length === 0) {
    return prev;
  }
  const prevById = new Map(prev.map((tc) => [tc.id, tc] as const));
  return incoming.map((tc) => {
    const old = prevById.get(tc.id);
    if (!old) {
      return tc;
    }
    const scoreOld = toolCallArgumentsPayloadScore(old.arguments);
    const scoreNew = toolCallArgumentsPayloadScore(tc.arguments);
    if (scoreNew >= scoreOld) {
      return {
        ...tc,
        name: tc.name || old.name,
        tool_call_type: tc.tool_call_type ?? old.tool_call_type,
      };
    }
    return {
      ...tc,
      name: tc.name || old.name,
      arguments: old.arguments,
      tool_call_type: tc.tool_call_type ?? old.tool_call_type,
    };
  });
}

/**
 * Safe display for tool arguments. JSON.stringify(undefined) is undefined and
 * renders nothing in React — avoid empty expanded panels.
 */
function formatToolCallArgumentsForDisplay(
  args: Record<string, unknown> | undefined,
): string {
  if (args === undefined) {
    return "Arguments missing (legacy or incomplete message).";
  }
  try {
    return JSON.stringify(args, null, 2);
  } catch {
    return String(args);
  }
}

function toolCallSummaryPreview(
  args: Record<string, unknown> | undefined,
): string | null {
  if (!args || Object.keys(args).length === 0) {
    return null;
  }
  for (const v of Object.values(args)) {
    if (typeof v === "string" && v.trim()) {
      const t = v.trim();
      return t.length > 52 ? `${t.slice(0, 49)}…` : t;
    }
  }
  return null;
}

function ArgumentValueNode({ value }: { value: unknown }): ReactNode {
  if (value === null) {
    return <span className="text-slate-400 dark:text-slate-500">null</span>;
  }
  if (typeof value === "boolean") {
    return (
      <code className="text-slate-700 dark:text-slate-200">{String(value)}</code>
    );
  }
  if (typeof value === "number") {
    return <code className="text-slate-700 dark:text-slate-200">{value}</code>;
  }
  if (typeof value === "string") {
    const multiline = value.includes("\n") || value.length > 160;
    if (multiline) {
      return (
        <pre className="text-[11px] sm:text-xs font-mono leading-relaxed m-0 whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200 bg-slate-100/80 dark:bg-slate-900/50 rounded-md px-2.5 py-2 ring-1 ring-inset ring-slate-200/70 dark:ring-slate-600/45">
          {value}
        </pre>
      );
    }
    return (
      <span className="break-words text-slate-800 dark:text-slate-200">
        &quot;{value}&quot;
      </span>
    );
  }
  return (
    <pre className="text-[11px] font-mono leading-relaxed m-0 whitespace-pre-wrap break-words text-slate-600 dark:text-slate-400">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function ToolCallParametersTable({
  args,
}: {
  args: Record<string, unknown>;
}) {
  const internalKeys = new Set(["_raw", "_value"]);
  const primary = Object.entries(args).filter(([k]) => !internalKeys.has(k));
  const internal = Object.entries(args).filter(([k]) => internalKeys.has(k));

  if (primary.length === 0 && internal.length === 0) {
    return (
      <p className="text-[12px] text-slate-500 dark:text-slate-400 m-0">
        (No arguments)
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {primary.length > 0 ? (
        <dl className="space-y-2.5 m-0">
          {primary.map(([key, value]) => (
            <div
              key={key}
              className="grid grid-cols-1 sm:grid-cols-[minmax(0,9rem)_1fr] gap-x-3 gap-y-1 text-[12px] sm:text-[13px] leading-snug"
            >
              <dt className="text-slate-500 dark:text-slate-400 font-medium shrink-0 pt-0.5">
                {key}
              </dt>
              <dd className="min-w-0 m-0">
                <ArgumentValueNode value={value} />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {internal.length > 0 ? (
        <div className="rounded-lg bg-amber-50/90 dark:bg-amber-950/25 ring-1 ring-amber-200/80 dark:ring-amber-800/45 px-3 py-2 space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-800/90 dark:text-amber-200/85">
            Partial / unparsed argument payload
          </div>
          {internal.map(([key, value]) => (
            <div key={key}>
              <div className="text-[11px] text-amber-900/80 dark:text-amber-100/75 mb-1 font-mono">
                {key}
              </div>
              <ArgumentValueNode value={value} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ToolCallIdCopy({ callId }: { callId: string }) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(() => {
    void navigator.clipboard.writeText(callId).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  }, [callId]);

  return (
    <div className="flex items-center gap-1.5 min-w-0 justify-end">
      <code
        className="text-[11px] font-mono text-slate-600 dark:text-slate-300 truncate max-w-[min(100%,14rem)] sm:max-w-xs"
        title={callId}
      >
        {callId}
      </code>
      <button
        type="button"
        onClick={onCopy}
        className="shrink-0 rounded-md p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 dark:hover:bg-white/10 dark:hover:text-slate-200 transition-colors"
        title="Copy call ID"
        aria-label="Copy call ID"
      >
        {copied ? (
          <Check
            className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
            strokeWidth={2.5}
          />
        ) : (
          <Copy className="h-3.5 w-3.5" strokeWidth={2} />
        )}
      </button>
    </div>
  );
}

/** `reasoning_content`：折叠展示在正文上方，标题为 Thinking */
/**
 * Walk messages in order: for each `role === "tool"` with `tool_call_id`, set
 * `result` on the matching entry in the nearest preceding assistant
 * `tool_calls`. Those tool messages are omitted from the output; unmatched
 * tool rows are kept.
 */
function mergeToolResultsIntoAssistantMessages(messages: Message[]): Message[] {
  const out: Message[] = [];

  const cloneForMerge = (msg: Message): Message => ({
    ...msg,
    tool_calls: msg.tool_calls?.map((tc) => ({ ...tc })),
  });

  for (const msg of messages) {
    if (msg.role === "tool" && msg.tool_call_id) {
      const callId = msg.tool_call_id;
      let merged = false;
      for (let i = out.length - 1; i >= 0; i--) {
        const prior = out[i];
        if (prior.role !== "assistant" || !prior.tool_calls?.length) {
          continue;
        }
        const tidx = prior.tool_calls.findIndex((tc) => tc.id === callId);
        if (tidx === -1) {
          continue;
        }
        const updatedCalls = prior.tool_calls.map((tc, j) =>
          j === tidx ? { ...tc, result: msg.content } : tc,
        );
        out[i] = { ...prior, tool_calls: updatedCalls };
        merged = true;
        break;
      }
      if (!merged) {
        out.push(cloneForMerge(msg));
      }
      continue;
    }
    out.push(cloneForMerge(msg));
  }
  return out;
}

function MessageThinkingBlock({ text }: { text: string }) {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  return (
    <details className="group text-left rounded-xl overflow-hidden bg-gradient-to-br from-slate-50/95 to-slate-100/40 dark:from-slate-800/35 dark:to-slate-900/25 ring-1 ring-slate-200/70 dark:ring-slate-600/40 border-l-[3px] border-l-primary-500/85 dark:border-l-primary-400/70 shadow-sm shadow-slate-900/5">
      <summary className="cursor-pointer list-none flex items-center gap-2.5 px-3.5 py-2.5 [&::-webkit-details-marker]:hidden select-none hover:bg-slate-100/60 dark:hover:bg-white/[0.04] transition-colors">
        <ChevronRight
          className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500 transition-transform duration-200 group-open:rotate-90"
          aria-hidden
          strokeWidth={2.25}
        />
        <Sparkles
          className="h-3.5 w-3.5 shrink-0 text-primary-600 dark:text-primary-400 opacity-90"
          aria-hidden
          strokeWidth={2}
        />
        <span className="text-[13px] font-medium text-slate-600 dark:text-slate-300 tracking-tight">
          Thinking
        </span>
      </summary>
      <div className="px-3.5 pb-3.5 pt-0">
        <div className="border-t border-slate-200/55 dark:border-slate-600/35 pt-2.5">
          <div className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-400 whitespace-pre-wrap break-words max-h-56 overflow-y-auto pr-0.5">
            {trimmed}
          </div>
        </div>
      </div>
    </details>
  );
}

function MessageToolCallsBlock({
  tool_calls,
  noTopMargin,
}: {
  tool_calls?: ToolCall[];
  /** 外层已有分隔/间距时置为 true，避免重复上边距 */
  noTopMargin?: boolean;
}) {
  const list = tool_calls ?? [];
  const normalizedList = useMemo(
    () => normalizeToolCallsArray(list as unknown),
    [list],
  );

  if (normalizedList.length === 0) {
    return null;
  }

  return (
    <div className={`${noTopMargin ? "" : "mt-3"} space-y-2.5`}>
      <div className="flex items-center gap-2 pl-0.5">
        <Wrench
          className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0"
          strokeWidth={2}
          aria-hidden
        />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Tool calls
        </span>
      </div>
      <div className="space-y-2">
        {normalizedList.map((tc) => {
          const preview = toolCallSummaryPreview(tc.arguments);
          return (
            <details
              key={tc.id}
              className="group rounded-xl text-left bg-white/90 dark:bg-gray-900/45 ring-1 ring-slate-200/80 dark:ring-slate-700/55 shadow-sm shadow-slate-900/[0.04] dark:shadow-black/20"
            >
              <summary className="cursor-pointer list-none flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-2.5 [&::-webkit-details-marker]:hidden hover:bg-slate-50/90 dark:hover:bg-white/[0.04] transition-colors rounded-xl">
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500 transition-transform duration-200 group-open:rotate-90"
                  aria-hidden
                  strokeWidth={2.25}
                />
                <span
                  className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-slate-200/90 text-slate-600 dark:bg-slate-700/90 dark:text-slate-300"
                  title="tool_call.type"
                >
                  {tc.tool_call_type ?? "function"}
                </span>
                <code className="text-[12px] sm:text-[13px] font-mono font-semibold text-slate-800 dark:text-slate-100 break-all leading-snug">
                  {tc.name}
                </code>
                {preview ? (
                  <span
                    className="w-full sm:w-auto sm:flex-1 sm:min-w-0 text-[11px] text-slate-400 dark:text-slate-500 sm:text-right truncate pl-6 sm:pl-0"
                    title={preview}
                  >
                    · {preview}
                  </span>
                ) : null}
              </summary>
              <div className="px-3 pb-3 pt-0 border-t border-slate-200/55 dark:border-slate-600/35">
                <div className="pt-3 space-y-3">
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0">
                      Call ID
                    </span>
                    <ToolCallIdCopy callId={tc.id} />
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                      Parameters
                    </div>
                    <ToolCallParametersTable args={tc.arguments} />
                  </div>
                  {tc.result !== undefined ? (
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                        Result
                      </div>
                      <pre className="text-[11px] sm:text-xs font-mono leading-relaxed m-0 whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200 bg-emerald-50/80 dark:bg-emerald-950/35 rounded-md px-2.5 py-2 ring-1 ring-inset ring-emerald-200/70 dark:ring-emerald-800/45 max-h-56 overflow-y-auto">
                        {tc.result || "(empty)"}
                      </pre>
                    </div>
                  ) : null}
                  <details className="group/json rounded-lg ring-1 ring-slate-200/65 dark:ring-slate-600/45 bg-slate-50/60 dark:bg-slate-950/40">
                    <summary className="cursor-pointer list-none px-3 py-2 text-[11px] font-medium text-slate-500 dark:text-slate-400 [&::-webkit-details-marker]:hidden hover:bg-slate-100/70 dark:hover:bg-white/[0.05] rounded-lg transition-colors">
                      Raw JSON (parsed arguments object)
                    </summary>
                    <pre className="text-[11px] sm:text-xs font-mono leading-relaxed text-slate-600 dark:text-slate-400 px-3 pb-3 pt-0 m-0 overflow-x-auto whitespace-pre-wrap break-words">
                      {formatToolCallArgumentsForDisplay(tc.arguments)}
                    </pre>
                  </details>
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}

/** True when GET /sessions/:key failed because the session does not exist. */
function isSessionMissingError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const msg = error.message;
  return /\b404\b/.test(msg) || /not\s*found/i.test(msg);
}

export default function Chat() {
  const { sessionKey: paramSessionKey } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentSessionKey, setCurrentSessionKey, currentBotId, addToast } =
    useAppStore();

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const isStreamingRef = useRef(false);
  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);
  /** One assistant reply per user turn; drop duplicate chat_done (e.g. stream_end + chat_end). */
  const assistantReplyFinalizedRef = useRef(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [sessionsSidebarOpen, setSessionsSidebarOpen] = useState(false);
  const [sessionsSidebarCollapsed, setSessionsSidebarCollapsed] =
    useState(false);
  const [toolCalls, setToolCalls] = useState<TrackedToolCall[]>([]);
  /** nanobot WebSocket 帧中的 tool_calls / reasoning_content（与正文并行展示） */
  const [streamingPayloadToolCalls, setStreamingPayloadToolCalls] = useState<
    ToolCall[]
  >([]);
  const [streamingReasoningContent, setStreamingReasoningContent] =
    useState<string>("");
  const streamingPayloadToolCallsRef = useRef<ToolCall[]>([]);
  const streamingReasoningContentRef = useRef<string>("");
  /** 流式过程中后端单独下发的工具调用摘要（与正文 Markdown 分离） */
  const [streamingToolProgress, setStreamingToolProgress] = useState<string[]>(
    [],
  );
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [subagentTasks, setSubagentTasks] = useState<SubagentTask[]>([]);
  const [subagentPanelOpen, setSubagentPanelOpen] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<TextAreaRef>(null);
  const streamingContentRef = useRef("");
  /** Coalesce high-frequency chat_token updates to one setState per animation frame */
  const streamTokenFlushRafRef = useRef<number | null>(null);
  const pendingStreamTokenDeltaRef = useRef("");
  /** 新会话首条消息：等待 nanobot 内置 websocket 通道连接后再发送 */
  const pendingNanobotOutboundRef = useRef<string | null>(null);

  /** Cancel scheduled rAF and apply any buffered tokens so state matches streamingContentRef */
  const cancelStreamTokenFlush = useCallback(() => {
    if (streamTokenFlushRafRef.current !== null) {
      cancelAnimationFrame(streamTokenFlushRafRef.current);
      streamTokenFlushRafRef.current = null;
    }
    const delta = pendingStreamTokenDeltaRef.current;
    pendingStreamTokenDeltaRef.current = "";
    if (delta) {
      setStreamingContent((prev) => prev + delta);
    }
  }, []);

  const activeSessionKey = paramSessionKey || currentSessionKey;

  const nanobotWsBase = resolveNanobotWsBase();
  const useNanobotChannel = nanobotWsBase.length > 0;

  /** 无 URL 会话时仍连 `/nanobot-ws/?client_id=...`，占位 id 与首条发送时一致 */
  const nanobotWsPlaceholderRef = useRef<string | null>(null);
  /** 避免路由/store 短暂不同步时 sessionKey 变 null，误关仍等待回复的 WebSocket */
  const nanobotWsSessionStableRef = useRef<string | null>(null);

  const wsSessionKeyForNanobot =
    activeSessionKey ??
    (useNanobotChannel
      ? (nanobotWsPlaceholderRef.current ??= crypto.randomUUID())
      : null);

  if (wsSessionKeyForNanobot) {
    nanobotWsSessionStableRef.current = wsSessionKeyForNanobot;
  }
  const stableNanobotWsSessionKey =
    wsSessionKeyForNanobot ?? nanobotWsSessionStableRef.current;

  const { sendMessage: sendNanobotMessage, ready: nanobotWsReady } =
    useNanobotChannelWebSocket({
      enabled: useNanobotChannel,
      sessionKey: stableNanobotWsSessionKey,
    });

  const { data: sessions, isPending: sessionsListPending } = useQuery({
    queryKey: ["sessions", currentBotId],
    queryFn: () => api.listSessions(currentBotId),
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (key: string) => api.deleteSession(key, currentBotId),
    onSuccess: (_, key) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["session", key] });
      if (activeSessionKey === key) {
        nanobotWsPlaceholderRef.current = null;
        nanobotWsSessionStableRef.current = null;
        setCurrentSessionKey(null);
        setMessages([]);
        setShowSuggestions(true);
        setSubagentTasks([]);
        navigate("/chat");
        setSessionsSidebarOpen(false);
      }
      addToast({ type: "success", message: "会话已删除" });
    },
    onError: () => {
      addToast({ type: "error", message: "删除会话失败" });
    },
  });

  /**
   * nanobot 首条消息前勿对草稿 UUID 拉 JSONL（无文件或键与 agent 不一致）。
   * 仅在路由已有 :sessionKey 或不用 nanobot WS 时请求。
   */
  const shouldFetchSessionJsonl =
    Boolean(activeSessionKey) &&
    (!useNanobotChannel || paramSessionKey !== undefined);

  const { data: sessionData, isError: sessionQueryError, error: sessionQueryErrorObj } =
    useQuery({
      queryKey: ["session", activeSessionKey, currentBotId],
      queryFn: () => api.getSession(activeSessionKey!, currentBotId),
      enabled: shouldFetchSessionJsonl,
      retry: false,
    });

  /**
   * 路由里带了 :sessionKey 但磁盘上已无该会话（例如旧 bookmark）时，改为打开侧栏列表中的最后一个会话。
   */
  useEffect(() => {
    if (!sessionQueryError || !paramSessionKey) {
      return;
    }
    if (paramSessionKey !== activeSessionKey) {
      return;
    }
    if (!isSessionMissingError(sessionQueryErrorObj)) {
      return;
    }
    if (sessionsListPending) {
      return;
    }

    const list = sessions ?? [];
    if (list.length === 0) {
      nanobotWsPlaceholderRef.current = null;
      nanobotWsSessionStableRef.current = null;
      setCurrentSessionKey(null);
      navigate("/chat", { replace: true });
      return;
    }

    const lastKey = list[list.length - 1].key;
    if (lastKey === paramSessionKey) {
      nanobotWsPlaceholderRef.current = null;
      nanobotWsSessionStableRef.current = null;
      setCurrentSessionKey(null);
      navigate("/chat", { replace: true });
      return;
    }

    setCurrentSessionKey(lastKey);
    navigate(`/chat/${encodeURIComponent(lastKey)}`, { replace: true });
  }, [
    sessionQueryError,
    sessionQueryErrorObj,
    paramSessionKey,
    activeSessionKey,
    sessionsListPending,
    sessions,
    navigate,
    setCurrentSessionKey,
  ]);

  // 仅路由 param 变化时清空（侧栏切换、回 /chat）；勿用 activeSessionKey，否则 stream 里
  // session_key 更新 URL 会误清空当前消息。
  const prevParamSessionKeyForMessagesRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const prev = prevParamSessionKeyForMessagesRef.current;
    if (prev !== undefined && prev !== paramSessionKey) {
      setMessages([]);
    }
    setShowSuggestions(!activeSessionKey);
    prevParamSessionKeyForMessagesRef.current = paramSessionKey;
  }, [paramSessionKey, activeSessionKey]);

  useEffect(() => {
    if (sessionData?.messages && !isStreaming) {
      const serverMessages = sessionData.messages as Message[];
      setMessages((prev) => {
        // If local has more messages (e.g. assistant msg just added in chat_done), don't overwrite with old sessionData
        if (prev.length > serverMessages.length) return prev;
        return serverMessages.map((msg, idx) => ({
          ...msg,
          id: `msg-${idx}-${Date.now()}`,
        }));
      });
      setShowSuggestions(false);
    } else if (sessionData?.messages && isStreaming) {
      // Stream just started and getSession returned a session (user message is already in it).
      // Load those messages so the user message appears immediately.
      const serverMessages = sessionData.messages as Message[];
      setMessages((prev) => {
        if (prev.length > 0) return prev;
        return serverMessages.map((msg, idx) => ({
          ...msg,
          id: `msg-${idx}-${Date.now()}`,
        }));
      });
    } else if (!activeSessionKey) {
      setShowSuggestions(true);
    }
  }, [sessionData, activeSessionKey, isStreaming]);

  // Refresh session list when current session data loads/updates so sidebar message count stays in sync
  const sessionMessageCount = sessionData?.message_count;
  useEffect(() => {
    if (activeSessionKey && sessionMessageCount !== undefined) {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    }
  }, [activeSessionKey, sessionMessageCount, queryClient]);

  /**
   * 先把 `role: tool` 的 content 合并进对应 `tool_call_id` 的 assistant
   * tool_calls，再按 source 过滤子 Agent / tool_call 行。
   */
  const displayMessages = useMemo(() => {
    const merged = mergeToolResultsIntoAssistantMessages(messages);
    return merged.filter(
      (m) => m.source !== "sub_agent" && m.source !== "tool_call",
    );
  }, [messages]);

  // 仅有一条消息时保持滚动在顶部，避免第一条用户消息被滚出视口；多条消息时滚到底部
  useEffect(() => {
    const container = messagesContainerRef.current;
    const endEl = messagesEndRef.current;
    if (!container) return;
    if (displayMessages.length <= 1) {
      container.scrollTop = 0;
      return;
    }
    // Smooth scroll on every token update queues many animations and feels sluggish
    endEl?.scrollIntoView({
      behavior: isStreaming ? "auto" : "smooth",
      block: "end",
    });
  }, [
    displayMessages.length,
    streamingContent,
    streamingToolProgress.length,
    streamingPayloadToolCalls.length,
    streamingReasoningContent,
    isStreaming,
  ]);

  const handleStreamChunk = useCallback(
    (chunk: StreamChunk) => {
      if (chunk.type === "session_key" && chunk.session_key) {
        setCurrentSessionKey(chunk.session_key);
        navigate(`/chat/${encodeURIComponent(chunk.session_key)}`, {
          replace: true,
        });
        queryClient.invalidateQueries({ queryKey: ["sessions"] });
      } else if (chunk.type === "chat_start") {
        setIsStreaming(true);
      } else if (chunk.type === "chat_token") {
        const hasText =
          typeof chunk.content === "string" && chunk.content.length > 0;
        const hasEmbeddedTools = chunk.tool_calls !== undefined;
        const hasReasoning = chunk.reasoning_content !== undefined;
        if (!hasText && !hasEmbeddedTools && !hasReasoning) {
          return;
        }
        if (hasText && chunk.content) {
          streamingContentRef.current += chunk.content;
          pendingStreamTokenDeltaRef.current += chunk.content;
          if (streamTokenFlushRafRef.current === null) {
            streamTokenFlushRafRef.current = requestAnimationFrame(() => {
              streamTokenFlushRafRef.current = null;
              const delta = pendingStreamTokenDeltaRef.current;
              pendingStreamTokenDeltaRef.current = "";
              if (delta) {
                setStreamingContent((prev) => prev + delta);
              }
            });
          }
        }
        if (hasEmbeddedTools) {
          const incoming = chunk.tool_calls ?? [];
          if (isStreamingRef.current) {
            const merged = mergeStreamingToolCalls(
              streamingPayloadToolCallsRef.current,
              incoming,
            );
            streamingPayloadToolCallsRef.current = merged;
            setStreamingPayloadToolCalls(merged);
          } else {
            /* nanobot may send tool_event after chat_end; merge into last assistant bubble. */
            streamingPayloadToolCallsRef.current = [];
            setStreamingPayloadToolCalls([]);
            setMessages((prev) => {
              if (prev.length === 0) {
                return prev;
              }
              const lastIdx = prev.length - 1;
              const last = prev[lastIdx];
              if (last.role !== "assistant") {
                return prev;
              }
              const mergedCalls = mergeStreamingToolCalls(
                last.tool_calls ?? [],
                incoming,
              );
              const next = [...prev];
              next[lastIdx] = { ...last, tool_calls: mergedCalls };
              return next;
            });
            queryClient.setQueryData(
              ["session", activeSessionKey, currentBotId],
              (old: typeof sessionData | undefined) => {
                if (!old?.messages?.length) {
                  return old;
                }
                const msgs = [...(old.messages ?? [])];
                const li = msgs.length - 1;
                const last = msgs[li] as Message | undefined;
                if (!last || last.role !== "assistant") {
                  return old;
                }
                const mergedCalls = mergeStreamingToolCalls(
                  last.tool_calls ?? [],
                  incoming,
                );
                msgs[li] = { ...last, tool_calls: mergedCalls };
                return { ...old, messages: msgs };
              },
            );
          }
        }
        if (hasReasoning) {
          const r = chunk.reasoning_content ?? "";
          if (chunk.reasoning_append) {
            const merged = streamingReasoningContentRef.current + r;
            streamingReasoningContentRef.current = merged;
            setStreamingReasoningContent(merged);
          } else {
            streamingReasoningContentRef.current = r;
            setStreamingReasoningContent(r);
          }
        }
      } else if (chunk.type === "stream_frame_end") {
        cancelStreamTokenFlush();
        if (chunk.tool_calls?.length) {
          const incoming = chunk.tool_calls;
          const merged = mergeStreamingToolCalls(
            streamingPayloadToolCallsRef.current,
            incoming,
          );
          streamingPayloadToolCallsRef.current = merged;
          setStreamingPayloadToolCalls(merged);
        }
        if (chunk.reasoning_content !== undefined) {
          streamingReasoningContentRef.current = chunk.reasoning_content;
          setStreamingReasoningContent(chunk.reasoning_content);
        }
      } else if (chunk.type === "tool_progress" && chunk.content) {
        setStreamingToolProgress((prev) => [...prev, chunk.content as string]);
      } else if (chunk.type === "tool_call" && chunk.tool_call) {
        const tc = chunk.tool_call;
        setToolCalls((prev) => [
          ...prev,
          {
            id: tc.id,
            name: tc.name,
            args: JSON.stringify(tc.arguments, null, 2),
            status: "running",
          },
        ]);
      } else if (chunk.type === "tool_result" && chunk.tool_name) {
        setToolCalls((prev) =>
          prev.map((tc) =>
            tc.name === chunk.tool_name
              ? { ...tc, status: "success", result: chunk.tool_result }
              : tc,
          ),
        );
      } else if (chunk.type === "error" && chunk.error) {
        setStreamingToolProgress([]);
        setToolCalls((prev) =>
          prev.map((tc) => ({ ...tc, status: "error", result: chunk.error })),
        );
        addToast({ type: "error", message: chunk.error });
      } else if (
        chunk.type === "subagent_start" &&
        chunk.subagent_id &&
        chunk.label
      ) {
        // Subagent started - add to panel
        const subagentId = chunk.subagent_id;
        const subagentLabel = chunk.label;
        setSubagentTasks((prev) => [
          ...prev,
          {
            id: subagentId,
            label: subagentLabel,
            task: chunk.task,
            status: "running",
          },
        ]);
        setSubagentPanelOpen(true);
      } else if (chunk.type === "assistant_message" && chunk.content) {
        const assistantContent = chunk.content;
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random()}`,
            role: "assistant",
            content: assistantContent,
            created_at: new Date().toISOString(),
            source: chunk.source ?? "main_agent",
            ...(chunk.tool_calls?.length ? { tool_calls: chunk.tool_calls } : {}),
            ...(chunk.reasoning_content
              ? { reasoning_content: chunk.reasoning_content }
              : {}),
          },
        ]);
      } else if (chunk.type === "subagent_done" && chunk.subagent_id) {
        // Subagent completed - update status
        setSubagentTasks((prev) =>
          prev.map((task) =>
            task.id === chunk.subagent_id
              ? {
                  ...task,
                  status: chunk.status === "ok" ? "success" : "error",
                  result: chunk.result,
                }
              : task,
          ),
        );
      } else if (chunk.type === "chat_done") {
        if (assistantReplyFinalizedRef.current) {
          return;
        }
        assistantReplyFinalizedRef.current = true;
        cancelStreamTokenFlush();
        const refTools = streamingPayloadToolCallsRef.current;
        const refReason = streamingReasoningContentRef.current;
        const chunkTools = chunk.tool_calls ?? [];
        const mergedToolCalls =
          chunkTools.length > 0 || refTools.length > 0
            ? mergeStreamingToolCalls(refTools, chunkTools)
            : undefined;
        const mergedReasoning =
          chunk.reasoning_content !== undefined
            ? chunk.reasoning_content
            : refReason || undefined;
        const streamedText = streamingContentRef.current;
        const fromChunk =
          chunk.content !== undefined && chunk.content !== ""
            ? chunk.content
            : streamedText;
        const hasAssistantBody =
          Boolean(fromChunk) ||
          (mergedToolCalls?.length ?? 0) > 0 ||
          (mergedReasoning !== undefined && mergedReasoning.length > 0);
        const finalContent =
          fromChunk || (hasAssistantBody ? "" : "Task completed.");
        streamingContentRef.current = "";
        streamingPayloadToolCallsRef.current = [];
        streamingReasoningContentRef.current = "";
        setStreamingPayloadToolCalls([]);
        setStreamingReasoningContent("");
        setIsStreaming(false);
        setStreamingContent("");
        setStreamingToolProgress([]);
        const assistantMsg: Message = {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: finalContent,
          created_at: new Date().toISOString(),
          source: chunk.source ?? "main_agent",
          ...(mergedToolCalls && mergedToolCalls.length > 0
            ? { tool_calls: mergedToolCalls }
            : {}),
          ...(mergedReasoning !== undefined && mergedReasoning.length > 0
            ? { reasoning_content: mergedReasoning }
            : {}),
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setToolCalls([]);
        queryClient.invalidateQueries({ queryKey: ["sessions"] });
        // Update the session cache so sessionData stays in sync with the latest session.
        // Functional form reads current cache at call time, avoiding stale closure values.
        queryClient.setQueryData(
          ["session", activeSessionKey, currentBotId],
          (old: typeof sessionData | undefined) => {
            if (!old) return old;
            return {
              ...old,
              messages: [...(old.messages ?? []), assistantMsg],
              message_count: (old.message_count ?? 0) + 1,
            };
          },
        );
      }
    },
    [
      addToast,
      queryClient,
      navigate,
      setCurrentSessionKey,
      activeSessionKey,
      currentBotId,
      cancelStreamTokenFlush,
    ],
  );

  // Register WebSocket chat message handler (WS streaming replaces SSE)
  useEffect(() => {
    const unregister = registerChatHandler(handleStreamChunk);
    return unregister;
  }, [handleStreamChunk]);

  // nanobot `ws` 频道：连接就绪后发送队列中的首条消息（新会话）
  useEffect(() => {
    if (!useNanobotChannel || !nanobotWsReady || !activeSessionKey) {
      return;
    }
    const pending = pendingNanobotOutboundRef.current;
    if (!pending) {
      return;
    }
    try {
      sendNanobotMessage({
        content: pending,
        botId: currentBotId,
        sessionKeyOverride: activeSessionKey,
      });
      pendingNanobotOutboundRef.current = null;
    } catch {
      pendingNanobotOutboundRef.current = null;
      cancelStreamTokenFlush();
      setIsStreaming(false);
      setStreamingContent("");
      streamingContentRef.current = "";
      addToast({
        type: "error",
        message:
          "nanobot WebSocket 发送失败，请确认 nanobot 已启动且 ws 频道已启用",
      });
    }
  }, [
    useNanobotChannel,
    nanobotWsReady,
    activeSessionKey,
    currentBotId,
    sendNanobotMessage,
    addToast,
    cancelStreamTokenFlush,
  ]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput("");
    setShowSuggestions(false);

    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: userMessage,
        created_at: new Date().toISOString(),
        source: "user",
      },
    ]);

    cancelStreamTokenFlush();
    assistantReplyFinalizedRef.current = false;
    setIsStreaming(true);
    setStreamingContent("");
    streamingContentRef.current = "";
    setToolCalls([]);
    setStreamingToolProgress([]);
    setStreamingPayloadToolCalls([]);
    setStreamingReasoningContent("");
    streamingPayloadToolCallsRef.current = [];
    streamingReasoningContentRef.current = "";

    if (useNanobotChannel) {
      let sk = activeSessionKey;
      if (!sk) {
        sk =
          nanobotWsPlaceholderRef.current ?? crypto.randomUUID();
        nanobotWsPlaceholderRef.current = sk;
        setCurrentSessionKey(sk);
        // 勿在此 POST /sessions(sk)：会与 nanobot 落盘键不一致并产生空 UUID 侧栏项。
        // URL 等 handleStreamChunk 的 session_key。pending 仅 ref，不会触发重渲染，就绪则立刻发。
        pendingNanobotOutboundRef.current = userMessage;
        if (nanobotWsReady) {
          try {
            sendNanobotMessage({
              content: userMessage,
              botId: currentBotId,
              sessionKeyOverride: sk,
            });
            pendingNanobotOutboundRef.current = null;
          } catch {
            cancelStreamTokenFlush();
            setIsStreaming(false);
            setStreamingContent("");
            streamingContentRef.current = "";
            pendingNanobotOutboundRef.current = null;
            addToast({
              type: "error",
              message:
                "nanobot WebSocket 发送失败，请确认 nanobot 已启动且 ws 频道已启用",
            });
          }
        }
        return;
      }
      if (!nanobotWsReady) {
        pendingNanobotOutboundRef.current = userMessage;
        return;
      }
      try {
        sendNanobotMessage({
          content: userMessage,
          botId: currentBotId,
          sessionKeyOverride: sk,
        });
      } catch {
        cancelStreamTokenFlush();
        setIsStreaming(false);
        setStreamingContent("");
        streamingContentRef.current = "";
        addToast({
          type: "error",
          message:
            "nanobot WebSocket 未连接，请确认 nanobot 已启动且 ws 频道已启用",
        });
      }
      return;
    }

    const ws = getWSRef()?.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      cancelStreamTokenFlush();
      setIsStreaming(false);
      setStreamingContent("");
      streamingContentRef.current = "";
      addToast({ type: "error", message: "WebSocket not connected" });
      return;
    }

    ws.send(JSON.stringify({
      type: "chat",
      message: userMessage,
      session_key: activeSessionKey || undefined,
      bot_id: currentBotId || undefined,
    }));
  };

  const handleStop = () => {
    // Agent interruption is not yet supported via WebSocket.
    // Stop button clears local streaming state only.
    cancelStreamTokenFlush();
    setIsStreaming(false);
    setStreamingContent("");
    streamingContentRef.current = "";
    setToolCalls([]);
    setStreamingToolProgress([]);
    setStreamingPayloadToolCalls([]);
    setStreamingReasoningContent("");
    streamingPayloadToolCallsRef.current = [];
    streamingReasoningContentRef.current = "";
    addToast({ type: "info", message: "Generation stopped" });
  };

  const handleNewChat = () => {
    nanobotWsPlaceholderRef.current = null;
    nanobotWsSessionStableRef.current = null;
    setCurrentSessionKey(null);
    setMessages([]);
    setShowSuggestions(true);
    setSubagentTasks([]);
    navigate("/chat");
    inputRef.current?.focus();
    setSessionsSidebarOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSelectSession = (sessionKey: string) => {
    setCurrentSessionKey(sessionKey);
    navigate(`/chat/${encodeURIComponent(sessionKey)}`);
    setSessionsSidebarOpen(false);
  };

  const suggestions = [
    {
      text: "Review the code structure of the current repository.",
      label: "Review code structure",
    },
    {
      text: "What automation options can be integrated?",
      label: "View automation options",
    },
    { text: "Write a simple Python script for me", label: "Write a script" },
  ];

  const toolCallTagColor = (status: TrackedToolCall["status"]) => {
    if (status === "running") return "processing";
    if (status === "success") return "success";
    return "error";
  };

  /** 格式化消息时间：年月日 + 时:分:秒.毫秒（三位） */
  const formatMessageTime = (isoStr: string | undefined): string => {
    if (!isoStr) return "";
    try {
      const d = new Date(isoStr);
      const dateStr = d.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const timeStr = d.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
      const ms = String(d.getMilliseconds()).padStart(3, "0");
      return `${dateStr} ${timeStr}.${ms}`;
    } catch {
      return "";
    }
  };

  /** nanobot may emit `stream_end` before the last `tool_event`; keep bubble while tools still stream in. */
  const showStreamingAssistantBubble =
    isStreaming &&
    (Boolean(streamingContent) ||
      streamingToolProgress.length > 0 ||
      streamingPayloadToolCalls.length > 0 ||
      streamingReasoningContent.length > 0);

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden overflow-x-hidden bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 relative">
      {/* Mobile Sessions Toggle Button */}
      <button
        onClick={() => setSessionsSidebarOpen(!sessionsSidebarOpen)}
        className="md:hidden fixed bottom-20 right-4 z-30 p-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-full shadow-lg shadow-primary-500/30 hover:shadow-xl hover:scale-105 transition-all"
      >
        {sessionsSidebarOpen ? (
          <X className="w-5 h-5" />
        ) : (
          <MessageSquare className="w-5 h-5" />
        )}
      </button>

      {/* Sessions Sidebar */}
      <div
        className={`
          ${sessionsSidebarOpen ? "translate-x-0" : "-translate-x-full"}
          ${sessionsSidebarCollapsed ? "md:-translate-x-full md:w-0 md:pointer-events-none md:overflow-hidden" : "md:translate-x-0 md:w-64"}
          fixed md:relative z-20 h-screen md:h-full
          w-64 bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl border-r border-gray-200/50 dark:border-gray-700/50
          flex flex-col transition-transform duration-300 ease-out
        `}
      >
        <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-2">
          {sessions?.map((session) => (
            <div
              key={session.key}
              className={`flex items-stretch rounded-xl transition-all ${
                activeSessionKey === session.key
                  ? "bg-gradient-to-r from-primary-50 to-blue-50 dark:from-primary-900/30 dark:to-blue-900/20 text-primary-700 dark:text-primary-300"
                  : "hover:bg-gray-100 dark:hover:bg-gray-700/50"
              }`}
            >
              <button
                type="button"
                onClick={() => handleSelectSession(session.key)}
                className="flex-1 min-w-0 text-left px-4 py-3 rounded-l-xl"
              >
                <span className="text-sm font-medium truncate block">
                  {session.title || session.key}
                </span>
                <span className="text-xs text-gray-500 mt-1 block">
                  {session.message_count} messages
                </span>
                {session.created_at && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 block">
                    {formatMessageTime(session.created_at)}
                  </span>
                )}
              </button>
              <Popconfirm
                title="删除会话"
                description={`确定删除「${session.title || session.key}」？`}
                onConfirm={() => deleteSessionMutation.mutate(session.key)}
                okText="删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  title="删除会话"
                  className="self-center shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:text-gray-500 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors duration-150 mr-1"
                >
                  <DeleteOutlined className="text-sm" />
                </button>
              </Popconfirm>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Overlay */}
      {sessionsSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-10 backdrop-blur-sm"
          onClick={() => setSessionsSidebarOpen(false)}
        />
      )}

      {sessionsSidebarCollapsed && (
        <Button
          type="text"
          icon={<MenuUnfoldOutlined />}
          onClick={() => setSessionsSidebarCollapsed(false)}
          className="hidden md:flex absolute left-2 top-20 z-30 text-gray-500 hover:text-primary-500 bg-white/80 dark:bg-gray-900/80 rounded-full shadow"
          title="展开会话"
        />
      )}

      {/* Chat Area */}
      <div className="flex-1 flex min-w-0 min-h-0">
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Header */}
          <div className="h-12 px-6 flex items-center justify-between border-b border-gray-200/50 dark:border-gray-700/50 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/20">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Chat</h2>
                <p className="text-xs text-gray-500">Work with Nanobot</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="text"
                icon={
                  sessionsSidebarCollapsed ? (
                    <MenuUnfoldOutlined />
                  ) : (
                    <MenuFoldOutlined />
                  )
                }
                onClick={() => setSessionsSidebarCollapsed((prev) => !prev)}
                className="!px-2 !py-1"
                title={
                  sessionsSidebarCollapsed ? "展开会话列表" : "收起会话列表"
                }
              />
              {sessions && sessions.length > 0 && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleNewChat}
                  className="hidden md:flex"
                >
                  New Chat
                </Button>
              )}
            </div>
          </div>

          {/* Messages / Hero */}
          <div
            ref={messagesContainerRef}
            className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-4 md:px-6 py-2 md:py-3"
          >
            {displayMessages.length === 0 && showSuggestions ? (
              <div className="min-h-full flex flex-col items-center justify-start pt-2 md:pt-4 text-center text-gray-600 dark:text-gray-300">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-100 to-blue-100 dark:from-primary-900/30 dark:to-blue-900/20 flex items-center justify-center mb-6 shadow-xl shadow-primary-500/10">
                  <Bot className="w-10 h-10 text-primary-600" />
                </div>
                <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                  Hello, how can I help you today?
                </h3>
                <p className="text-sm text-gray-500 mb-8 max-w-md">
                  Ask anything about your projects, code, or environment.
                  I&apos;ll use your Nanobot setup to help.
                </p>
                <div className="grid gap-3 w-full max-w-xl">
                  {suggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setInput(suggestion.text);
                        inputRef.current?.focus();
                      }}
                      className="flex items-center justify-between px-5 py-4 rounded-xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-lg border border-gray-100 dark:border-gray-700 text-left text-sm hover:scale-[1.02] transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <Wand2 className="w-4 h-4 text-primary-500" />
                        <span className="font-medium">{suggestion.label}</span>
                      </div>
                      <span className="text-gray-400 group-hover:translate-x-1 transition-transform">
                        →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4 w-full min-w-0 max-w-3xl mx-auto">
                {displayMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 w-full min-w-0 overflow-visible ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div
                      className={`w-10 h-10 min-w-[2.5rem] min-h-[2.5rem] rounded-xl flex items-center justify-center flex-shrink-0 overflow-visible p-1.5 box-border ${
                        msg.role === "user"
                          ? "bg-sky-500 dark:bg-sky-600 text-white shadow-md shadow-sky-500/20"
                          : "bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <User
                          className="w-5 h-5 min-w-5 min-h-5 text-white flex-shrink-0"
                          strokeWidth={2}
                        />
                      ) : (
                        <Bot className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                      )}
                    </div>
                    <div
                      className={`relative rounded-2xl px-5 py-4 ${
                        msg.role === "user"
                          ? "shrink-0 w-fit max-w-[min(100%,85%)] min-w-[8rem] bg-sky-50 dark:bg-sky-950/45 text-slate-800 dark:text-slate-100 border border-sky-200/90 dark:border-sky-800/55 shadow-sm rounded-br-md"
                          : "flex-1 min-w-0 mr-[calc(2.5rem+0.75rem)] bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm rounded-bl-md"
                      }`}
                    >
                      {msg.role === "assistant" && msg.reasoning_content ? (
                        <MessageThinkingBlock text={msg.reasoning_content} />
                      ) : null}
                      {msg.role === "assistant" ? (
                        <MessageToolCallsBlock
                          noTopMargin={!msg.reasoning_content}
                          tool_calls={msg.tool_calls}
                        />
                      ) : null}
                      <div
                        className={`prose prose-sm max-w-none ${
                          msg.role === "user"
                            ? "prose-slate dark:prose-invert"
                            : "dark:prose-invert"
                        } ${
                          msg.role === "assistant" &&
                          (msg.reasoning_content ||
                            (msg.tool_calls?.length ?? 0) > 0)
                            ? "mt-3 pt-3 border-t border-gray-100 dark:border-gray-700"
                            : ""
                        }`}
                      >
                        <Markdown>{msg.content}</Markdown>
                      </div>
                      {(msg.created_at ?? msg.timestamp) && (
                        <div
                          className={`mt-2 text-xs ${
                            msg.role === "user"
                              ? "text-slate-500 dark:text-slate-400"
                              : "text-gray-400 dark:text-gray-500"
                          }`}
                        >
                          {formatMessageTime(msg.created_at ?? msg.timestamp)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Streaming content */}
                {showStreamingAssistantBubble && (
                    <>
                      <div className="flex gap-3 w-full min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center shrink-0">
                          <Bot className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                        </div>
                        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl px-5 py-4 shadow-sm min-w-0 flex-1 max-w-full mr-[calc(2.5rem+0.75rem)]">
                          {streamingReasoningContent.length > 0 ? (
                            <MessageThinkingBlock
                              text={streamingReasoningContent}
                            />
                          ) : null}
                          {streamingPayloadToolCalls.length > 0 ? (
                            <div
                              className={
                                streamingReasoningContent.length > 0
                                  ? "mt-3 pt-3 border-t border-gray-100 dark:border-gray-700"
                                  : ""
                              }
                            >
                              <MessageToolCallsBlock
                                noTopMargin
                                tool_calls={streamingPayloadToolCalls}
                              />
                            </div>
                          ) : null}
                          {streamingContent ? (
                            <div
                              className={`text-[15px] leading-relaxed text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words ${
                                streamingReasoningContent.length > 0 ||
                                streamingPayloadToolCalls.length > 0
                                  ? "mt-3 pt-3 border-t border-gray-100 dark:border-gray-700"
                                  : ""
                              }`}
                            >
                              {streamingContent}
                            </div>
                          ) : null}
                          {streamingToolProgress.length > 0 ? (
                            <div
                              className={
                                streamingContent ||
                                streamingPayloadToolCalls.length > 0 ||
                                streamingReasoningContent.length > 0
                                  ? "mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2"
                                  : "space-y-2"
                              }
                            >
                              <div className="flex items-center gap-2 pl-0.5">
                                <Wrench
                                  className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0"
                                  strokeWidth={2}
                                  aria-hidden
                                />
                                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                  Tool calls
                                </span>
                              </div>
                              {streamingToolProgress.map((hint, idx) => (
                                <pre
                                  key={`${idx}-${hint.slice(0, 24)}`}
                                  className="text-[11px] sm:text-xs leading-relaxed font-mono text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/80 rounded-lg px-3 py-2.5 whitespace-pre-wrap break-all m-0 overflow-x-auto ring-1 ring-inset ring-slate-200/60 dark:ring-slate-700/50 border-0"
                                >
                                  {formatToolHintMultiline(hint)}
                                </pre>
                              ))}
                            </div>
                          ) : null}
                          <LoadingOutlined className="mt-2 text-primary-500" />
                        </div>
                      </div>

                      {/* Tool calls */}
                      {toolCalls.length > 0 && (
                        <div className="flex gap-3 w-full min-w-0">
                          <div
                            className="w-10 min-w-[2.5rem] shrink-0"
                            aria-hidden
                          />
                          <div className="flex-1 min-w-0 space-y-2 mr-[calc(2.5rem+0.75rem)]">
                          {toolCalls.map((tc) => (
                            <div
                              key={tc.id}
                              className={`rounded-xl p-4 border ${
                                tc.status === "running"
                                  ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                                  : tc.status === "success"
                                    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                                    : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                {tc.status === "running" ? (
                                  <LoadingOutlined className="text-blue-500" />
                                ) : tc.status === "success" ? (
                                  <CheckOutlined className="text-green-500" />
                                ) : (
                                  <CloseOutlined className="text-red-500" />
                                )}
                                <span className="font-medium text-sm">
                                  {tc.name}
                                </span>
                                <Tag color={toolCallTagColor(tc.status)}>
                                  {tc.status}
                                </Tag>
                              </div>
                              {tc.args && (
                                <pre className="text-xs bg-gray-900 text-gray-100 p-2 rounded-lg overflow-x-auto">
                                  {tc.args}
                                </pre>
                              )}
                              {tc.result && (
                                <pre className="text-xs mt-2 bg-gray-900 text-gray-100 p-2 rounded-lg overflow-x-auto max-h-32">
                                  {tc.result.slice(0, 500)}
                                  {tc.result.length > 500 && "..."}
                                </pre>
                              )}
                            </div>
                          ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl pb-safe">
            <div className="w-full min-w-0 max-w-3xl mx-auto px-4 md:px-6 py-4">
              <ChatInput
                inputRef={inputRef}
                value={input}
                onChange={setInput}
                onKeyDown={handleKeyDown}
                onSend={handleSend}
                onStop={handleStop}
                isStreaming={isStreaming}
              />
            </div>
          </div>
        </div>

        {/* Subagent Panel */}
        {subagentTasks.length > 0 && (
          <SubagentPanel
            tasks={subagentTasks}
            collapsed={!subagentPanelOpen}
            onCollapse={() => setSubagentPanelOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
