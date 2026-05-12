from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi.testclient import TestClient

from app.api.campaigns import get_campaign_dispatch_service
from app.core.auth import AuthenticatedUser, require_active_user
from app.core.config import Settings
from app.guard.deliverability_guard import DeliverabilityGuard
from app.integrations.listmonk.client import ListmonkClient, ListmonkError
from app.repositories.blocked_sends import InMemoryBlockedSendRepository
from app.main import app
from app.repositories.clients import ClientCampaignRecord, ClientRecord
from app.repositories.contacts import ContactRecord, InMemoryContactRepository
from app.repositories.listmonk_mappings import InMemoryListmonkMappingRepository
from app.repositories.suppression_list import InMemorySuppressionListRepository
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


class FakePreparationService:
    def __init__(self, *, content_ready: bool) -> None:
        self.content_ready = content_ready

    def prepare_campaign(
        self,
        campaign_id: str,
        _current_user: AuthenticatedUser | None = None,
    ) -> dict[str, Any]:
        return {
            "status": "synced",
            "campaign_id": campaign_id,
            "listmonk_synced": True,
            "content_ready": self.content_ready,
            "content": {
                "template_name": "campaign",
                "content_ready": self.content_ready,
                "reason": "Compiled template missing." if not self.content_ready else None,
                "subject": "Launch",
                "preview_text": "Preview",
                "body": "<html><body><p>Body</p></body></html>" if self.content_ready else "",
                "unsubscribe_url": "http://localhost:3000/unsubscribe",
                "client_name": "Test Client",
            },
            "listmonk_mapping": {
                "entity_type": "campaign",
                "entity_id": campaign_id,
                "listmonk_type": "campaign",
                "listmonk_id": "lm_existing",
                "created": False,
            },
        }


class FakeClientRepository:
    def __init__(
        self,
        campaigns: list[ClientCampaignRecord],
        clients: list[ClientRecord],
    ) -> None:
        self._campaigns = campaigns
        self._clients = {client.id: client for client in clients}

    def get_by_id(self, client_id: str) -> ClientRecord | None:
        return self._clients.get(client_id)

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
    status: str = "ready",
) -> ClientCampaignRecord:
    now = datetime.now(timezone.utc)
    return ClientCampaignRecord(
        id=campaign_id,
        client_id=client_id,
        name="Launch campaign",
        status=status,
        subject=subject,
        created_at=now,
        updated_at=now,
    )


def build_client(
    client_id: str = "client_123",
    status: str = "active",
    email_limit_per_campaign: int | None = None,
    max_campaigns: int | None = None,
) -> ClientRecord:
    now = datetime.now(timezone.utc)
    return ClientRecord(
        id=client_id,
        email=f"{client_id}@example.test",
        personal_name="Test Client",
        status=status,
        email_limit_per_campaign=email_limit_per_campaign,
        max_campaigns=max_campaigns,
        created_at=now,
        updated_at=now,
    )


def build_contact(
    contact_id: str = "contact_123",
    client_id: str = "client_123",
    email: str = "person@example.test",
    status: str = "sendable",
) -> ContactRecord:
    now = datetime.now(timezone.utc)
    return ContactRecord(
        id=contact_id,
        client_id=client_id,
        email=email,
        status=status,
        created_at=now,
        updated_at=now,
    )


def build_dispatch_service(
    *,
    email_sending_enabled_raw: str = "true",
    fake_listmonk: FakeListmonkClient | None = None,
    mapping_service: ListmonkMappingService | None = None,
    blocked_send_repository: InMemoryBlockedSendRepository | None = None,
    campaigns: list[ClientCampaignRecord] | None = None,
    clients: list[ClientRecord] | None = None,
    contact_repository: InMemoryContactRepository | None = None,
    suppression_repository: InMemorySuppressionListRepository | None = None,
    preparation_service: FakePreparationService | None = None,
) -> CampaignDispatchService:
    selected_campaigns = [build_campaign()] if campaigns is None else campaigns
    selected_clients = [build_client()] if clients is None else clients
    selected_contact_repository = contact_repository or InMemoryContactRepository(
        contacts=[build_contact()],
        campaign_contacts={("client_123", "campaign_123", "contact_123")},
    )
    return CampaignDispatchService(
        settings=Settings(email_sending_enabled_raw=email_sending_enabled_raw),
        guard=DeliverabilityGuard(),
        listmonk_client=fake_listmonk or FakeListmonkClient(),  # type: ignore[arg-type]
        mapping_service=mapping_service
        or ListmonkMappingService(InMemoryListmonkMappingRepository()),
        client_repository=FakeClientRepository(  # type: ignore[arg-type]
            selected_campaigns,
            selected_clients,
        ),
        contact_repository=selected_contact_repository,
        suppression_list_repository=suppression_repository
        or InMemorySuppressionListRepository(),
        blocked_send_repository=blocked_send_repository
        or InMemoryBlockedSendRepository(),
        campaign_preparation_service=preparation_service,
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


def test_dispatch_does_not_trigger_real_send_when_content_is_not_ready() -> None:
    fake_listmonk = FakeListmonkClient()
    service = build_dispatch_service(
        fake_listmonk=fake_listmonk,
        preparation_service=FakePreparationService(content_ready=False),
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "dispatch_blocked"
    assert "Compiled template missing." in result["reason"]
    assert result["listmonk_dispatched"] is False
    assert fake_listmonk.sent_campaign_ids == []


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
    blocked_send_repository = InMemoryBlockedSendRepository()
    service = build_dispatch_service(
        email_sending_enabled_raw="false",
        fake_listmonk=fake_listmonk,
        mapping_service=ListmonkMappingService(repository),
        blocked_send_repository=blocked_send_repository,
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "blocked"
    assert result["decision"] == "blocked"
    assert result["reason"] == 'EMAIL_SENDING_ENABLED is not exactly "true".'
    assert result["code"] == "email_sending_disabled"
    assert result["listmonk_dispatched"] is False
    assert result["client_id"] == "client_123"
    assert result["blocked_send_id"]
    assert repository.list_by_client("client_123") == []
    blocked_sends = blocked_send_repository.list_by_campaign("campaign_123")
    assert len(blocked_sends) == 1
    assert blocked_sends[0].id == result["blocked_send_id"]
    assert blocked_sends[0].client_id == "client_123"
    assert blocked_sends[0].reason == f'{result["code"]}: {result["reason"]}'
    assert blocked_sends[0].decision == "blocked"
    assert fake_listmonk.created_campaign_payloads == []
    assert fake_listmonk.sent_campaign_ids == []


def test_paused_client_blocks_campaign_send_without_listmonk() -> None:
    fake_listmonk = FakeListmonkClient()
    blocked_send_repository = InMemoryBlockedSendRepository()
    service = build_dispatch_service(
        fake_listmonk=fake_listmonk,
        clients=[build_client(status="paused")],
        blocked_send_repository=blocked_send_repository,
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "blocked"
    assert result["code"] == "client_status_not_sendable"
    assert result["listmonk_dispatched"] is False
    assert blocked_send_repository.list_by_campaign("campaign_123")
    assert fake_listmonk.created_campaign_payloads == []
    assert fake_listmonk.sent_campaign_ids == []


def test_draft_campaign_blocks_campaign_send_without_listmonk() -> None:
    fake_listmonk = FakeListmonkClient()
    service = build_dispatch_service(
        fake_listmonk=fake_listmonk,
        campaigns=[build_campaign(status="draft")],
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "blocked"
    assert result["code"] == "campaign_status_not_sendable"
    assert result["listmonk_dispatched"] is False
    assert fake_listmonk.created_campaign_payloads == []
    assert fake_listmonk.sent_campaign_ids == []


def test_email_limit_per_campaign_blocks_oversized_batch() -> None:
    fake_listmonk = FakeListmonkClient()
    contact_repository = InMemoryContactRepository(
        contacts=[
            build_contact(contact_id="contact_1", email="one@example.test"),
            build_contact(contact_id="contact_2", email="two@example.test"),
        ],
        campaign_contacts={
            ("client_123", "campaign_123", "contact_1"),
            ("client_123", "campaign_123", "contact_2"),
        },
    )
    service = build_dispatch_service(
        fake_listmonk=fake_listmonk,
        clients=[build_client(email_limit_per_campaign=1)],
        contact_repository=contact_repository,
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "blocked"
    assert result["code"] == "email_limit_per_campaign_exceeded"
    assert result["eligible_contact_count"] == 2
    assert fake_listmonk.sent_campaign_ids == []


def test_empty_campaign_batch_blocks_without_listmonk() -> None:
    fake_listmonk = FakeListmonkClient()
    service = build_dispatch_service(
        fake_listmonk=fake_listmonk,
        contact_repository=InMemoryContactRepository(),
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "blocked"
    assert result["code"] == "empty_campaign_batch"
    assert fake_listmonk.sent_campaign_ids == []


def test_suppressed_contact_blocks_partial_batch_without_listmonk() -> None:
    fake_listmonk = FakeListmonkClient()
    contact_repository = InMemoryContactRepository(
        contacts=[
            build_contact(contact_id="contact_1", email="one@example.test"),
            build_contact(contact_id="contact_2", email="two@example.test"),
        ],
        campaign_contacts={
            ("client_123", "campaign_123", "contact_1"),
            ("client_123", "campaign_123", "contact_2"),
        },
    )
    suppression_repository = InMemorySuppressionListRepository()
    suppression_repository.add_suppression(
        client_id="client_123",
        email="two@example.test",
        reason="manual",
    )
    service = build_dispatch_service(
        fake_listmonk=fake_listmonk,
        contact_repository=contact_repository,
        suppression_repository=suppression_repository,
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "blocked"
    assert result["code"] == "partial_batch_not_supported"
    assert result["eligible_contact_count"] == 1
    assert result["blocked_contact_count"] == 1
    assert result["blocked_reasons"] == {"suppression_list": 1}
    assert fake_listmonk.sent_campaign_ids == []


def test_all_non_sendable_contacts_block_without_listmonk() -> None:
    fake_listmonk = FakeListmonkClient()
    contact_repository = InMemoryContactRepository(
        contacts=[
            build_contact(status="unsubscribed"),
            build_contact(
                contact_id="contact_2",
                email="two@example.test",
                status="bounced",
            ),
        ],
        campaign_contacts={
            ("client_123", "campaign_123", "contact_123"),
            ("client_123", "campaign_123", "contact_2"),
        },
    )
    service = build_dispatch_service(
        fake_listmonk=fake_listmonk,
        contact_repository=contact_repository,
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "blocked"
    assert result["code"] == "no_eligible_contacts"
    assert result["blocked_reasons"] == {
        "contact_bounced": 1,
        "contact_unsubscribed": 1,
    }
    assert fake_listmonk.sent_campaign_ids == []


def test_contact_client_mismatch_blocks_without_listmonk() -> None:
    fake_listmonk = FakeListmonkClient()
    contact_repository = InMemoryContactRepository(
        contacts=[build_contact(client_id="client_other")],
        campaign_contacts={("client_123", "campaign_123", "contact_123")},
    )
    service = build_dispatch_service(
        fake_listmonk=fake_listmonk,
        contact_repository=contact_repository,
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "blocked"
    assert result["code"] == "no_eligible_contacts"
    assert result["blocked_reasons"] == {"contact_client_mismatch": 1}
    assert fake_listmonk.sent_campaign_ids == []


def test_max_campaigns_blocks_when_active_campaign_count_exceeds_limit() -> None:
    fake_listmonk = FakeListmonkClient()
    service = build_dispatch_service(
        fake_listmonk=fake_listmonk,
        clients=[build_client(max_campaigns=1)],
        campaigns=[
            build_campaign(campaign_id="campaign_123"),
            build_campaign(campaign_id="campaign_456"),
        ],
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "blocked"
    assert result["code"] == "max_campaigns_exceeded"
    assert fake_listmonk.sent_campaign_ids == []


def test_disabled_campaign_send_without_campaign_context_does_not_persist_fake_block() -> None:
    fake_listmonk = FakeListmonkClient()
    blocked_send_repository = InMemoryBlockedSendRepository()
    service = build_dispatch_service(
        email_sending_enabled_raw="false",
        fake_listmonk=fake_listmonk,
        blocked_send_repository=blocked_send_repository,
        campaigns=[],
    )

    result = service.send_campaign("missing_campaign")

    assert result["status"] == "blocked"
    assert result["listmonk_dispatched"] is False
    assert "client_id" not in result
    assert "blocked_send_id" not in result
    assert blocked_send_repository.list_by_campaign("missing_campaign") == []
    assert fake_listmonk.created_campaign_payloads == []
    assert fake_listmonk.sent_campaign_ids == []


def test_enabled_campaign_send_creates_mapping_after_guard_authorizes() -> None:
    fake_listmonk = FakeListmonkClient()
    service = build_dispatch_service(fake_listmonk=fake_listmonk)

    result = service.send_campaign("campaign_123")

    assert result["status"] == "queued"
    assert result["decision"] == "authorized"
    assert result["guard"]["eligible_contact_count"] == 1
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
