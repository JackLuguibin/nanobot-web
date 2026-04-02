"""Tests for channel CRUD and refresh API."""

from __future__ import annotations

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


def test_channels_empty(client: TestClient) -> None:
    """GET /channels returns empty list when no plugin channels exist."""
    response = client.get("/api/v1/channels")
    assert response.status_code == 200
    assert response.json()["data"] == []


def test_channels_list_and_update_disable_refresh(
    client: TestClient,
) -> None:
    """PUT merges channel; GET lists rows; DELETE disables; refresh endpoints work."""
    r0 = client.put(
        "/api/v1/config",
        json={
            "section": "channels",
            "data": {
                "telegram": {"enabled": True, "token": "t"},
            },
        },
    )
    assert r0.status_code == 200

    r1 = client.get("/api/v1/channels")
    assert r1.status_code == 200
    rows = r1.json()["data"]
    assert len(rows) == 1
    assert rows[0]["name"] == "telegram"
    assert rows[0]["enabled"] is True
    assert rows[0]["status"] in ("online", "offline")

    r2 = client.put(
        "/api/v1/channels/telegram",
        json={"data": {"token": "new"}},
    )
    assert r2.status_code == 200
    assert r2.json()["data"]["token"] == "new"

    r3 = client.delete("/api/v1/channels/telegram")
    assert r3.status_code == 200
    assert r3.json()["data"]["status"] == "ok"

    r4 = client.get("/api/v1/channels")
    assert r4.json()["data"][0]["enabled"] is False

    r5 = client.post("/api/v1/channels/telegram/refresh")
    assert r5.status_code == 200
    assert r5.json()["data"]["success"] is True

    r6 = client.post("/api/v1/channels/refresh")
    assert r6.status_code == 200
    assert len(r6.json()["data"]) == 1


def test_channels_delete_unknown(client: TestClient) -> None:
    """DELETE unknown channel returns 404."""
    response = client.delete("/api/v1/channels/nonexistent")
    assert response.status_code == 404


def test_channels_put_reserved_name(client: TestClient) -> None:
    """PUT to a reserved key returns 400."""
    response = client.put(
        "/api/v1/channels/sendProgress",
        json={"data": {"enabled": True}},
    )
    assert response.status_code == 400


def test_channels_refresh_unknown(client: TestClient) -> None:
    """POST refresh for unknown channel returns 404."""
    response = client.post("/api/v1/channels/nope/refresh")
    assert response.status_code == 404
