# nanobot-web

Console and tooling for [nanobot-ai](https://github.com/HKUDS/nanobot). Chat streaming uses the **built-in** WebSocket channel (`nanobot.channels.websocket`), not a separate plugin.

## Installation

```bash
pip install -e .
```

> Requires `nanobot-ai` (see `pyproject.toml`).

## WebSocket channel (nanobot)

Enable the channel in `~/.nanobot/config.json` under `channels` using the key **`websocket`** (the module name in `nanobot-ai`):

```json
{
  "channels": {
    "sendToolEvents": false,
    "sendReasoningContent": true,
    "websocket": {
      "enabled": true,
      "host": "0.0.0.0",
      "port": 8765,
      "path": "/",
      "allowFrom": ["*"],
      "streaming": true,
      "websocketRequiresToken": false,
      "resumeChatId": true,
      "deltaChunkChars": 5,
      "maxDeltaBufferChars": 2097152
    }
  }
}
```

For local development, set **`websocketRequiresToken`** to `false` unless you configure a static `token` or `tokenIssuePath` / issued tokens. If `true` (the upstream default), the handshake must include a valid `token` query parameter.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | `bool` | `false` | Enable the WebSocket server channel |
| `host` | `string` | `127.0.0.1` | Bind address |
| `port` | `int` | `8765` | Listen port |
| `path` | `string` | `"/"` | HTTP path for the WebSocket upgrade |
| `allowFrom` | `list[str]` | `["*"]` | Allowed `client_id` values (`["*"]` allows all) |
| `streaming` | `bool` | `true` | Streaming deltas via `send_delta` |
| `websocketRequiresToken` | `bool` | `true` | Require `token` query param on connect when no static `token` is set |
| `token` | `string` | `""` | Optional static shared secret for `?token=` |
| `tokenIssuePath` | `string` | `""` | Optional HTTP path that issues short-lived tokens (see upstream docs) |
| `resumeChatId` | `bool` | `true` | When `true`, clients may pass `?chat_id=<uuid>` to resume a persisted session; invalid UUID → HTTP 400 on handshake |
| `deltaChunkChars` | `int` | `5` | When `> 0`, split outgoing stream text into `delta` frames of at most this many Unicode scalars; `0` passes through provider chunk sizes |
| `maxDeltaBufferChars` | `int` | `2097152` | When `deltaChunkChars` > 0, cap buffered stream text per stream; overflow flushes early as extra `delta` frames (`0` = no cap) |

Global **`channels`** options (not under `websocket` only):

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `sendToolEvents` | `bool` | `false` | Emit structured `tool_event` frames (`tool_calls` / `tool_results`) on WebSocket |
| `sendReasoningContent` | `bool` | `true` | Push assistant `reasoning_content` (e.g. separate `reasoning` frame after streaming) |

Empty `allowFrom` denies everyone; use `["*"]` or list specific client IDs.

Wire protocol aligns with upstream [nanobot WebSocket changes](https://github.com/HKUDS/nanobot/pull/3216) (session lifecycle, optional chunked deltas, `chat_id` resume).

## Client usage

Connect to:

`ws://<host>:<port><path>?client_id=<id>&token=<optional>&chat_id=<optional-uuid>`

Use `chat_id` from a previous `ready` frame to resume the same persisted conversation (console passes this automatically when you open `/chat/websocket:<uuid>`). If two connections use the **same** `chat_id`, the newer connection replaces the older: the server closes the previous socket with code `1000` and reason `replaced by new connection`.

The server sends a first frame:

```json
{"event": "ready", "chat_id": "<uuid>", "client_id": "..."}
```

When resuming via `?chat_id=`:

```json
{"event": "ready", "chat_id": "<uuid>", "client_id": "...", "resumed": true}
```

Send a user message as a **JSON object** with a text field the server accepts (do not send a bare JSON array; it is ignored server-side), for example:

```json
{"content": "Hello nanobot!"}
```

Typical streaming session (simplified):

```json
{"event": "chat_start"}
{"event": "delta", "text": "...", "stream_id": "<optional>"}
{"event": "stream_end", "stream_id": "<optional>"}
{"event": "reasoning", "text": "..."}
{"event": "chat_end"}
```

Non-streaming or final channel text may use `message` with optional `reasoning_content`. Enable **`sendToolEvents`** to receive `tool_event` frames with `tool_calls` / `tool_results`.

## Development

```bash
pip install -e .
```

### Run all services (one command)

Local development runs three processes together: **nanobot gateway**, the **console API server**, and the **web dev** stack (Vite). The repo root [`Procfile`](Procfile) defines them for [Honcho](https://github.com/nickstenning/honcho).

Honcho is **not** a runtime dependency of this package: production installs should use `pip install .` (or your wheel) **without** pulling in process managers. Install Honcho only on machines where you run `honcho start`.

1. Activate the project virtual environment (this repo expects `.venv` at the root; use `.venv/bin/honcho start` if you prefer not to activate).
2. Install Honcho if it is not already available (`pip install -e ".[dev]"` includes it):

   ```bash
   pip install honcho
   ```

3. From the **repository root**, start everything:

   ```bash
   honcho start
   ```

Honcho reads `Procfile` and runs these processes in parallel:

| Process   | Command |
|-----------|---------|
| `gateway` | `nanobot gateway` |
| `server`  | `nanobot_console server` |
| `web`     | `nanobot_console web dev` |

The `web` process waits until the API and nanobot WebSocket are reachable (real handshake) before bringing up the frontend dev server. To skip that wait:

- set `SKIP_GATEWAY_WAIT=1`, or
- run `nanobot_console web dev --no-wait` (if you start `web` outside Honcho).

Press **Ctrl+C** in the terminal where `honcho start` is running to stop **all** child processes.

### Linting

```bash
ruff check .
ruff format .
```

## License

MIT
