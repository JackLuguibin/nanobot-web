# nanobot-web

WebSocket channel plugin for [nanobot-ai](https://github.com/your-repo/nanobot-ai).

## Installation

```bash
pip install -e .
```

> Requires `nanobot-ai >= 0.1.4.post6` to already be installed.

## Configuration

Add the following to your `~/.nanobot/config.json` channels section:

```json
{
  "channels": {
    "ws": {
      "enabled": true,
      "host": "0.0.0.0",
      "port": 8765,
      "allowFrom": [],
      "maxConnections": 100,
      "streaming": false
    }
  }
}
```

| Field            | Type       | Default   | Description                                          |
|------------------|------------|-----------|------------------------------------------------------|
| `enabled`        | `bool`     | `false`   | Enable the WebSocket channel                        |
| `host`           | `string`   | `0.0.0.0` | Bind address                                        |
| `port`           | `int`      | `8765`    | WebSocket server port                               |
| `allowFrom`      | `list[str]`| `[]`      | Allowed chat IDs (empty = allow all, `["*"]` = all) |
| `maxConnections` | `int`      | `100`     | Max concurrent WebSocket connections                |
| `streaming`      | `bool`     | `false`   | Enable streaming responses                           |

## Client Usage

Connect to `ws://<host>:<port>/<chat_id>`. The URL path is used as the `chat_id`.

Send JSON messages:

```json
{"type": "message", "content": "Hello nanobot!"}
```

Receive responses as:

```json
{"type": "message", "content": "Hello! How can I help?"}
```

Ping/pong is also supported:

```json
{"type": "ping"}
// Server responds:
{"type": "pong"}
```

## Development

```bash
pip install -e ".[dev]"
```

### Linting

```bash
ruff check .
ruff format .
```

## License

MIT
