from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi.testclient import TestClient

from app.api.campaigns import get_campaign_dispatch_service
from app.core.auth import AuthenticatedUser, require_active_user
from app.core.config import Settings
from app.guard.deliverability_guard import DeliverabilityGuard
from app.integrations.listmonk.client import ListmonkClient, ListmonkError
from app.main import app
from app.repositories.clients import ClientCampaignRecord
from app.repositories.listmonk_mappings import InMemoryListmonkMappingRepository
from app.services.campaigns import CampaignDispatchService
from app.services.listmonk_mappings import (
    ListmonkMappingConflictError,
    ListmonkMappingService,
)


class FakeListmonkClient:
    def __init__(self) -> None:
        self.created_campaign_payloads: list[dict[str, Any]] = []
        self.sent_campaign_ids: list[str] = []

    def create_campaign(self, payload: dict[str, Any]) -> dict[str, Any]:
        self.created_campaign_payloads.append(payload)
        return {"data": {"id": f"lm_{len(self.created_campaign_payloads)}"}}

    def trigger_campaign_send(self, campaign_id: str) -> dict[str, str]:
        self.sent_campaign_ids.append(campaign_id)
        return {"status": "mocked"}


class FakeClientRepository:
    def __init__(self, campaigns: list[ClientCampaignRecord]) -> None:
        self._campaigns = campaigns

    def list_client_campaigns(self, client_id: str) -> list[ClientCampaignRecord]:
        return [
            campaign for campaign in self._campaigns if campaign.client_id == client_id
        ]

    def list_admin_campaigns(self) -> list[ClientCampaignRecord]:
        return self._campaigns


def build_campaign(
    campaign_id: str = "campaign_123",
    client_id: str = "client_123",
    subject: str = "Launch",
) -> ClientCampaignRecord:
    now = datetime.now(timezone.utc)
    return ClientCampaignRecord(
        id=campaign_id,
        client_id=client_id,
        name="Launch campaign",
        status="draft",
        subject=subject,
        created_at=now,
        updated_at=now,
    )


def build_dispatch_service(
    *,
    email_sending_enabled_raw: str = "true",
    fake_listmonk: FakeListmonkClient | None = None,
    mapping_service: ListmonkMappingService | None = None,
    campaigns: list[ClientCampaignRecord] | None = None,
) -> CampaignDispatchService:
    return CampaignDispatchService(
        settings=Settings(email_sending_enabled_raw=email_sending_enabled_raw),
        guard=DeliverabilityGuard(),
        listmonk_client=fake_listmonk or FakeListmonkClient(),  # type: ignore[arg-type]
        mapping_service=mapping_service
        or ListmonkMappingService(InMemoryListmonkMappingRepository()),
        client_repository=FakeClientRepository(  # type: ignore[arg-type]
            campaigns or [build_campaign()]
        ),
    )


def test_upsert_mapping_creates_new_mapping() -> None:
    service = ListmonkMappingService(InMemoryListmonkMappingRepository())

    mapping = service.ensure_campaign_mapping(
        client_id="client_123",
        campaign_id="campaign_123",
        listmonk_campaign_id="lm_123",
    )

    assert mapping.client_id == "client_123"
    assert mapping.entity_type == "campaign"
    assert mapping.entity_id == "campaign_123"
    assert mapping.listmonk_type == "campaign"
    assert mapping.listmonk_id == "lm_123"


def test_upsert_mapping_is_idempotent_for_same_target() -> None:
    service = ListmonkMappingService(InMemoryListmonkMappingRepository())

    first = service.ensure_campaign_mapping(
        client_id="client_123",
        campaign_id="campaign_123",
        listmonk_campaign_id="lm_123",
    )
    second = service.ensure_campaign_mapping(
        client_id="client_123",
        campaign_id="campaign_123",
        listmonk_campaign_id="lm_123",
    )

    assert second.id == first.id
    assert second.listmonk_id == "lm_123"


def test_conflicting_mapping_is_rejected() -> None:
    service = ListmonkMappingService(InMemoryListmonkMappingRepository())
    service.ensure_campaign_mapping(
        client_id="client_123",
        campaign_id="campaign_123",
        listmonk_campaign_id="lm_123",
    )

    try:
        service.ensure_campaign_mapping(
            client_id="client_123",
            campaign_id="campaign_123",
            listmonk_campaign_id="lm_456",
        )
    except ListmonkMappingConflictError as error:
        assert "different technical id" in str(error)
    else:
        raise AssertionError("Expected ListmonkMappingConflictError")


def test_mapping_is_scoped_by_client_id() -> None:
    repository = InMemoryListmonkMappingRepository()
    service = ListmonkMappingService(repository)

    first = service.ensure_campaign_mapping(
        client_id="client_alpha",
        campaign_id="campaign_123",
        listmonk_campaign_id="lm_alpha",
    )
    second = service.ensure_campaign_mapping(
        client_id="client_beta",
        campaign_id="campaign_123",
        listmonk_campaign_id="lm_beta",
    )

    assert first.listmonk_id == "lm_alpha"
    assert second.listmonk_id == "lm_beta"
    assert [mapping.listmonk_id for mapping in repository.list_by_client("client_alpha")] == [
        "lm_alpha"
    ]


def test_no_cross_client_mapping_leakage() -> None:
    service = ListmonkMappingService(InMemoryListmonkMappingRepository())
    service.ensure_campaign_mapping(
        client_id="client_alpha",
        campaign_id="campaign_123",
        listmonk_campaign_id="lm_alpha",
    )

    assert (
        service.get_mapping(
            client_id="client_beta",
            entity_type="campaign",
            entity_id="campaign_123",
            listmonk_type="campaign",
        )
        is None
    )


def test_disabled_campaign_send_does_not_call_listmonk() -> None:
    fake_listmonk = FakeListmonkClient()
    repository = InMemoryListmonkMappingRepository()
    service = build_dispatch_service(
        email_sending_enabled_raw="false",
        fake_listmonk=fake_listmonk,
        mapping_service=ListmonkMappingService(repository),
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "blocked"
    assert result["decision"] == "blocked"
    assert result["listmonk_dispatched"] is False
    assert repository.list_by_client("client_123") == []
    assert fake_listmonk.created_campaign_payloads == []
    assert fake_listmonk.sent_campaign_ids == []


def test_enabled_campaign_send_creates_mapping_after_guard_authorizes() -> None:
    fake_listmonk = FakeListmonkClient()
    service = build_dispatch_service(fake_listmonk=fake_listmonk)

    result = service.send_campaign("campaign_123")

    assert result["status"] == "queued"
    assert result["decision"] == "authorized"
    assert result["listmonk_dispatched"] is True
    assert result["listmonk_mapping"]["listmonk_id"] == "lm_1"
    assert result["listmonk_mapping"]["created"] is True
    assert fake_listmonk.created_campaign_payloads == [
        {"name": "Launch campaign", "subject": "Launch"}
    ]
    assert fake_listmonk.sent_campaign_ids == ["lm_1"]


def test_enabled_campaign_send_reuses_existing_mapping() -> None:
    fake_listmonk = FakeListmonkClient()
    mapping_service = ListmonkMappingService(InMemoryListmonkMappingRepository())
    mapping_service.ensure_campaign_mapping(
        client_id="client_123",
        campaign_id="campaign_123",
        listmonk_campaign_id="lm_existing",
    )
    service = build_dispatch_service(
        fake_listmonk=fake_listmonk,
        mapping_service=mapping_service,
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "queued"
    assert result["listmonk_mapping"]["created"] is False
    assert fake_listmonk.created_campaign_payloads == []
    assert fake_listmonk.sent_campaign_ids == ["lm_existing"]


def test_send_endpoint_uses_guarded_dispatch_service() -> None:
    fake_user = AuthenticatedUser(
        id="user_1",
        clerk_user_id="clerk_1",
        email="admin@sendwise.test",
        access_type="platform_admin",
        status="active",
    )
    fake_listmonk = FakeListmonkClient()
    service = build_dispatch_service(
        email_sending_enabled_raw="false",
        fake_listmonk=fake_listmonk,
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
