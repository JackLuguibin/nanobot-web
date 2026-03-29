"""JSON config file loader for nanobot-web.

Searches for ``nanobot_web.json`` up the directory tree from the caller's
location, falling back to the current working directory.  The file format is
JSON with a top-level ``server`` key that mirrors the ``NANBOT_SERVER_*``
environment variables.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

CONFIG_FILENAME = "nanobot_web.json"
_SERVER_KEY = "server"


@lru_cache(maxsize=1)
def find_config_file() -> Path | None:
    """Walk upward from cwd and return the first ``nanobot_web.json`` found."""
    cwd = Path.cwd()
    for directory in (cwd, *cwd.parents):
        candidate = directory / CONFIG_FILENAME
        if candidate.is_file():
            return candidate
    return None


@lru_cache(maxsize=1)
def load_config_file() -> dict[str, Any]:
    """Load and cache the parsed ``nanobot_web.json`` file.

    Returns an empty dict when the file does not exist or cannot be parsed.
    """
    path = find_config_file()
    if path is None:
        return {}

    try:
        with path.open("r", encoding="utf-8") as f:
            data: dict[str, Any] = json.load(f)
    except Exception:
        return {}

    return data.get(_SERVER_KEY, {})


def get_config_value(key: str, default: Any = None) -> Any:
    """Return the value for ``key`` from the cached config, or ``default``."""
    return load_config_file().get(key, default)


def get_default_server_config() -> dict[str, Any]:
    """Return the default server configuration as a flat dict."""
    return {
        "host": "0.0.0.0",
        "port": 8000,
        "reload": False,
        "log_level": "INFO",
        "workers": 1,
        "cors_origins": ["*"],
        "title": "nanobot-console",
        "description": "HTTP API for nanobot console management",
        "version": "1.0.0",
        "api_prefix": "/api/v1",
        "docs_url": "/docs",
        "redoc_url": "/redoc",
        "openapi_url": "/openapi.json",
    }


def write_default_config() -> Path:
    """Write default ``nanobot_web.json`` to the project root and return its path."""
    config_path = find_config_file() or (Path.cwd() / CONFIG_FILENAME)
    default_config = {_SERVER_KEY: get_default_server_config()}

    with config_path.open("w", encoding="utf-8") as f:
        json.dump(default_config, f, indent=4, ensure_ascii=False)

    return config_path
