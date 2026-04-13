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
    "websocket": {
      "enabled": true,
      "host": "0.0.0.0",
      "port": 8765,
      "path": "/",
      "allowFrom": ["*"],
      "streaming": true,
      "websocketRequiresToken": false
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

Empty `allowFrom` denies everyone; use `["*"]` or list specific client IDs.

## Client usage

Connect to:

`ws://<host>:<port><path>?client_id=<id>&token=<optional>`

The server sends a first frame:

```json
{"event": "ready", "chat_id": "<uuid>", "client_id": "..."}
```

Send a user message as JSON with a text field the server accepts, for example:

```json
{"content": "Hello nanobot!"}
```

Receive streaming and final text as:

```json
{"event": "delta", "text": "..."}
{"event": "message", "text": "..."}
{"event": "stream_end"}
```

## Development

```bash
pip install -e .
```

### Linting

```bash
ruff check .
ruff format .
```

## License

MIT
