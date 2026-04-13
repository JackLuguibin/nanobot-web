import type { ToolCall } from "../api/types";

/**
 * Parse `function.arguments` from API / WebSocket: object or JSON string.
 */
export function parseArgumentsRecord(raw: unknown): Record<string, unknown> {
  if (raw === null || raw === undefined) {
    return {};
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return {};
    }
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : { _raw: trimmed };
    } catch {
      return { _raw: raw };
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return { _value: raw };
}

/**
 * Normalize one OpenAI-style tool call item:
 * `{ id, type, function: { name, arguments } }` or flat `{ id, name, arguments }`.
 */
export function normalizeToolCallEntry(
  raw: unknown,
  index: number,
): ToolCall | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const id =
    typeof o.id === "string" && o.id.length > 0 ? o.id : `tool-call-${index}`;
  let name = "";
  let args: Record<string, unknown> = {};
  const fn = o.function;
  if (fn && typeof fn === "object" && !Array.isArray(fn)) {
    const f = fn as Record<string, unknown>;
    name = typeof f.name === "string" ? f.name : "";
    args = parseArgumentsRecord(f.arguments);
  } else {
    name = typeof o.name === "string" ? o.name : "";
    args = parseArgumentsRecord(o.arguments);
  }
  if (!name) {
    return null;
  }
  const tool_call_type =
    typeof o.type === "string" && o.type.length > 0 ? o.type : undefined;
  const result = typeof o.result === "string" ? o.result : undefined;
  return {
    id,
    name,
    arguments: args,
    ...(tool_call_type !== undefined ? { tool_call_type } : {}),
    ...(result !== undefined ? { result } : {}),
  };
}

/**
 * Normalize a `tool_calls` array from stream or session JSON (may be raw API shape).
 */
export function normalizeToolCallsArray(raw: unknown): ToolCall[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: ToolCall[] = [];
  raw.forEach((entry, idx) => {
    const tc = normalizeToolCallEntry(entry, idx);
    if (tc) {
      out.push(tc);
    }
  });
  return out;
}
