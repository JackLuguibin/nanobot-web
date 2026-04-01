"""Tests for config and env API backed by files."""

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


def test_config_get_defaults(client: TestClient) -> None:
    """GET /config returns nanobot defaults when file is missing."""
    response = client.get("/api/v1/config")
    assert response.status_code == 200
    body = response.json()
    assert body["code"] == 0
    data = body["data"]
    assert "agents" in data
    assert data["agents"]["defaults"]["model"]


def test_config_put_merge_and_env_roundtrip(
    client: TestClient, temp_config_dir: Path
) -> None:
    """PUT /config merges sections; GET/PUT /env use ``.env`` beside config."""
    r1 = client.put(
        "/api/v1/config",
        json={
            "section": "agents",
            "data": {
                "defaults": {
                    "model": "openai/gpt-4o-mini",
                    "provider": "openai",
                }
            },
        },
    )
    assert r1.status_code == 200

    r2 = client.get("/api/v1/config")
    assert r2.status_code == 200
    data = r2.json()["data"]
    assert data["agents"]["defaults"]["model"] == "openai/gpt-4o-mini"

    env_path = temp_config_dir / ".env"
    assert not env_path.exists()

    r3 = client.put("/api/v1/env", json={"vars": {"FOO": "bar", "EMPTY": ""}})
    assert r3.status_code == 200
    assert env_path.exists()
    text = env_path.read_text(encoding="utf-8")
    assert "EMPTY=" in text
    assert "FOO=" in text

    r4 = client.get("/api/v1/env")
    assert r4.status_code == 200
    vars_out = r4.json()["data"]["vars"]
    assert vars_out["FOO"] == "bar"
    assert vars_out["EMPTY"] == ""

    r5 = client.get("/api/v1/status")
    assert r5.status_code == 200
    assert r5.json()["data"]["model"] == "openai/gpt-4o-mini"


def test_config_validate_endpoint(client: TestClient) -> None:
    """POST /config/validate reports invalid core keys."""
    response = client.post(
        "/api/v1/config/validate",
        json={"agents": "not-an-object"},
    )
    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["valid"] is False
    assert payload["errors"]


def test_config_schema_endpoint(client: TestClient) -> None:
    """GET /config/schema returns a JSON Schema object."""
    response = client.get("/api/v1/config/schema")
    assert response.status_code == 200
    schema = response.json()["data"]
    assert schema.get("title") == "Config" or "properties" in schema
