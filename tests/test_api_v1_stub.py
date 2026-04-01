"""Smoke tests for API v1 stub routes."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from nanobot_console.server.app import create_app


@pytest.fixture
def client() -> TestClient:
    """ASGI test client."""
    return TestClient(create_app())


def test_health_envelope(client: TestClient) -> None:
    """GET /api/v1/health returns success envelope with data."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["code"] == 0
    assert body["message"] == "success"
    assert "data" in body
    assert body["data"]["status"] == "ok"
    assert "version" in body["data"]


def test_bots_list_stub(client: TestClient) -> None:
    """Bots list returns empty array in envelope."""
    response = client.get("/api/v1/bots")
    assert response.status_code == 200
    body = response.json()
    assert body["code"] == 0
    assert body["data"] == []
