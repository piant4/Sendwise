from typing import Any

import httpx
from fastapi.testclient import TestClient

from app.api.campaigns import get_campaign_dispatch_service
from app.core.auth import AuthenticatedUser, require_active_user
from app.core.config import Settings
from app.guard.deliverability_guard import DeliverabilityGuard
from app.integrations.listmonk.client import ListmonkClient, ListmonkError
from app.main import app
from app.services.campaigns import CampaignDispatchService


class FakeListmonkClient:
    def __init__(self) -> None:
        self.sent_campaign_ids: list[str] = []

    def trigger_campaign_send(self, campaign_id: str) -> dict[str, str]:
        self.sent_campaign_ids.append(campaign_id)
        return {"status": "mocked"}


def test_disabled_campaign_send_does_not_call_listmonk() -> None:
    fake_listmonk = FakeListmonkClient()
    service = CampaignDispatchService(
        settings=Settings(email_sending_enabled_raw="false"),
        guard=DeliverabilityGuard(),
        listmonk_client=fake_listmonk,  # type: ignore[arg-type]
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "blocked"
    assert result["decision"] == "blocked"
    assert result["listmonk_dispatched"] is False
    assert fake_listmonk.sent_campaign_ids == []


def test_enabled_campaign_send_calls_listmonk_after_guard_authorizes() -> None:
    fake_listmonk = FakeListmonkClient()
    service = CampaignDispatchService(
        settings=Settings(email_sending_enabled_raw="true"),
        guard=DeliverabilityGuard(),
        listmonk_client=fake_listmonk,  # type: ignore[arg-type]
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "queued"
    assert result["decision"] == "authorized"
    assert result["listmonk_dispatched"] is True
    assert fake_listmonk.sent_campaign_ids == ["campaign_123"]


def test_send_endpoint_uses_guarded_dispatch_service() -> None:
    fake_user = AuthenticatedUser(
        id="user_1",
        clerk_user_id="clerk_1",
        email="admin@sendwise.test",
        access_type="platform_admin",
        status="active",
    )
    fake_listmonk = FakeListmonkClient()
    service = CampaignDispatchService(
        settings=Settings(email_sending_enabled_raw="false"),
        guard=DeliverabilityGuard(),
        listmonk_client=fake_listmonk,  # type: ignore[arg-type]
    )

    app.dependency_overrides[require_active_user] = lambda: fake_user
    app.dependency_overrides[get_campaign_dispatch_service] = lambda: service

    try:
        response = TestClient(app).post("/campaigns/campaign_123/send")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status"] == "blocked"
    assert fake_listmonk.sent_campaign_ids == []


def test_listmonk_client_maps_upstream_errors(monkeypatch: Any) -> None:
    def fake_request(*_args: object, **_kwargs: object) -> httpx.Response:
        request = httpx.Request("GET", "http://listmonk.test/api/health")
        return httpx.Response(500, request=request, json={"error": "failed"})

    monkeypatch.setattr(httpx, "request", fake_request)
    client = ListmonkClient(base_url="http://listmonk.test", timeout_seconds=1)

    try:
        client.health()
    except ListmonkError as error:
        assert str(error) == "listmonk returned HTTP 500"
    else:
        raise AssertionError("Expected ListmonkError")


def test_listmonk_client_health_returns_json(monkeypatch: Any) -> None:
    def fake_request(*_args: object, **_kwargs: object) -> httpx.Response:
        request = httpx.Request("GET", "http://listmonk.test/api/health")
        return httpx.Response(200, request=request, json={"status": "ok"})

    monkeypatch.setattr(httpx, "request", fake_request)
    client = ListmonkClient(base_url="http://listmonk.test", timeout_seconds=1)

    assert client.health() == {"status": "ok"}
