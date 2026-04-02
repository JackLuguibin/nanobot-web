"""Tests for dashboard-related status and usage history APIs."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from nanobot_console.server.app import create_app


@pytest.fixture
def temp_config_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Redirect nanobot ``config.json`` to ``tmp_path / config.json``."""
    cfg = tmp_path / "config.json"

    def fake_get_config_path() -> Path:
        return cfg

    monkeypatch.setattr(
        "nanobot.config.loader.get_config_path",
        fake_get_config_path,
    )
    return tmp_path


@pytest.fixture
def client(temp_config_dir: Path) -> TestClient:
    """HTTP client with temp config directory."""
    return TestClient(create_app())


def test_status_and_usage_reflect_session_usage(
    client: TestClient, temp_config_dir: Path
) -> None:
    """Session JSONL with ``usage`` fields feeds status and usage/history."""
    ws = temp_config_dir / "ws"
    sessions = ws / "sessions"
    sessions.mkdir(parents=True)
    today = date.today().isoformat()
    meta = {
        "_type": "metadata",
        "key": "cli:direct",
        "created_at": f"{today}T10:00:00",
        "updated_at": f"{today}T10:00:00",
        "metadata": {},
        "last_consolidated": 0,
    }
    lines = [
        json.dumps(meta, ensure_ascii=False),
        json.dumps(
            {
                "role": "user",
                "content": "hi",
                "timestamp": f"{today}T12:00:00",
            },
            ensure_ascii=False,
        ),
        json.dumps(
            {
                "role": "assistant",
                "content": "ok",
                "timestamp": f"{today}T12:00:01",
                "model": "test-model",
                "usage": {"prompt_tokens": 10, "completion_tokens": 5},
            },
            ensure_ascii=False,
        ),
    ]
    session_file = sessions / "cli_direct.jsonl"
    session_file.write_text("\n".join(lines) + "\n", encoding="utf-8")

    r_cfg = client.put(
        "/api/v1/config",
        json={"section": "agents", "data": {"defaults": {"workspace": str(ws)}}},
    )
    assert r_cfg.status_code == 200

    r_status = client.get("/api/v1/status")
    assert r_status.status_code == 200
    st = r_status.json()["data"]
    assert st["active_sessions"] == 1
    assert st["messages_today"] == 2
    assert st["token_usage"]["prompt_tokens"] == 10
    assert st["token_usage"]["completion_tokens"] == 5
    assert st["token_usage"]["total_tokens"] == 15
    assert "test-model" in st["token_usage"]["by_model"]

    r_usage = client.get("/api/v1/usage/history?days=7")
    assert r_usage.status_code == 200
    hist = r_usage.json()["data"]
    assert len(hist) == 7
    today_row = next(h for h in hist if h["date"] == today)
    assert today_row["prompt_tokens"] == 10
    assert today_row["completion_tokens"] == 5
