from datetime import datetime, timezone
from typing import Any

from fastapi.testclient import TestClient

from app.api.campaigns import get_send_simulation_service
from app.core.auth import AuthenticatedUser, require_active_user
from app.guard.deliverability_guard import DeliverabilityGuard
from app.main import app
from app.repositories.blocked_sends import InMemoryBlockedSendRepository
from app.repositories.clients import ClientCampaignRecord, ClientRecord
from app.repositories.contacts import ContactRecord, InMemoryContactRepository
from app.repositories.email_logs import InMemoryEmailLogRepository
from app.repositories.suppression_list import InMemorySuppressionListRepository
from app.services.send_simulation import SendSimulationService


class FakePreparationService:
    def __init__(self) -> None:
        self.prepared_campaign_ids: list[str] = []
        self.trigger_campaign_send_called = False

    def prepare_campaign(
        self,
        campaign_id: str,
        _current_user: AuthenticatedUser | None = None,
    ) -> dict[str, Any]:
        self.prepared_campaign_ids.append(campaign_id)
        return {
            "status": "synced",
            "campaign_id": campaign_id,
            "listmonk_synced": True,
            "listmonk_mapping": {
                "entity_type": "campaign",
                "entity_id": campaign_id,
                "listmonk_type": "campaign",
                "listmonk_id": "lm_123",
                "created": False,
            },
            "content_ready": True,
            "content": {
                "template_name": "campaign",
                "content_ready": True,
                "reason": None,
                "subject": "Launch",
                "preview_text": "Technical preview for campaign Launch campaign.",
                "body": "<html><body><p>Simulated HTML body.</p></body></html>",
                "unsubscribe_url": "http://localhost:3000/unsubscribe",
                "client_name": "Test Client",
            },
        }

    def trigger_campaign_send(self, _campaign_id: str) -> None:
        self.trigger_campaign_send_called = True
        raise AssertionError("Simulation must not trigger a real send.")


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
    status: str = "ready",
) -> ClientCampaignRecord:
    now = datetime.now(timezone.utc)
    return ClientCampaignRecord(
        id=campaign_id,
        client_id=client_id,
        name="Launch campaign",
        status=status,
        subject="Launch",
        created_at=now,
        updated_at=now,
    )


def build_client(client_id: str = "client_123", status: str = "active") -> ClientRecord:
    now = datetime.now(timezone.utc)
    return ClientRecord(
        id=client_id,
        email=f"{client_id}@example.test",
        personal_name="Test Client",
        status=status,
        created_at=now,
        updated_at=now,
    )


def build_contact(
    contact_id: str,
    email: str,
    status: str = "sendable",
) -> ContactRecord:
    now = datetime.now(timezone.utc)
    return ContactRecord(
        id=contact_id,
        client_id="client_123",
        email=email,
        status=status,
        created_at=now,
        updated_at=now,
    )


def build_service(
    *,
    campaign: ClientCampaignRecord | None = None,
    client: ClientRecord | None = None,
    contacts: list[ContactRecord] | None = None,
    campaign_contacts: set[tuple[str, str, str]] | None = None,
    blocked_send_repository: InMemoryBlockedSendRepository | None = None,
    email_log_repository: InMemoryEmailLogRepository | None = None,
    preparation_service: FakePreparationService | None = None,
) -> SendSimulationService:
    selected_campaign = campaign or build_campaign()
    selected_contacts = contacts or [
        build_contact("contact_1", "one@example.test"),
        build_contact("contact_2", "two@example.test"),
    ]
    return SendSimulationService(
        guard=DeliverabilityGuard(),
        client_repository=FakeClientRepository(  # type: ignore[arg-type]
            [selected_campaign],
            [client or build_client()],
        ),
        contact_repository=InMemoryContactRepository(
            contacts=selected_contacts,
            campaign_contacts=campaign_contacts
            or {
                ("client_123", selected_campaign.id, contact.id)
                for contact in selected_contacts
            },
        ),
        suppression_list_repository=InMemorySuppressionListRepository(),
        blocked_send_repository=blocked_send_repository
        or InMemoryBlockedSendRepository(),
        email_log_repository=email_log_repository or InMemoryEmailLogRepository(),
        campaign_preparation_service=preparation_service or FakePreparationService(),
    )


def test_simulation_authorizes_without_real_sending_enabled_and_logs_contacts() -> None:
    preparation_service = FakePreparationService()
    email_log_repository = InMemoryEmailLogRepository()
    service = build_service(
        preparation_service=preparation_service,
        email_log_repository=email_log_repository,
    )

    result = service.simulate_campaign_send("campaign_123")

    assert result["status"] == "simulated"
    assert result["mode"] == "simulation"
    assert result["decision"] == "authorized"
    assert result["guard"]["eligible_contact_count"] == 2
    assert result["email_logs_created"] == 2
    assert result["listmonk_prepared"] is True
    assert result["listmonk_dispatched"] is False
    assert result["real_send_attempted"] is False
    assert preparation_service.prepared_campaign_ids == ["campaign_123"]
    assert preparation_service.trigger_campaign_send_called is False
    logs = email_log_repository.list_by_campaign("campaign_123")
    assert [log.status for log in logs] == ["simulated", "simulated"]
    assert [log.provider_message_id for log in logs] == [None, None]
    assert all(log.body == "<html><body><p>Simulated HTML body.</p></body></html>" for log in logs)
    assert result["content"]["template_name"] == "campaign"
    assert result["content"]["content_ready"] is True
    assert result["content"]["body"].startswith("<html")


def test_simulation_block_does_not_create_email_logs_or_prepare_listmonk() -> None:
    blocked_send_repository = InMemoryBlockedSendRepository()
    email_log_repository = InMemoryEmailLogRepository()
    preparation_service = FakePreparationService()
    service = build_service(
        campaign=build_campaign(status="draft"),
        blocked_send_repository=blocked_send_repository,
        email_log_repository=email_log_repository,
        preparation_service=preparation_service,
    )

    result = service.simulate_campaign_send("campaign_123")

    assert result["status"] == "blocked"
    assert result["code"] == "campaign_status_not_sendable"
    assert result["email_logs_created"] == 0
    assert result["listmonk_prepared"] is False
    assert preparation_service.prepared_campaign_ids == []
    assert email_log_repository.list_by_campaign("campaign_123") == []
    blocked_sends = blocked_send_repository.list_by_campaign("campaign_123")
    assert len(blocked_sends) == 1
    assert blocked_sends[0].decision == "blocked"


def test_simulate_send_endpoint_uses_simulation_service() -> None:
    fake_user = AuthenticatedUser(
        id="user_1",
        clerk_user_id="clerk_1",
        email="admin@sendwise.test",
        access_type="platform_admin",
        status="active",
    )
    service = build_service()

    app.dependency_overrides[require_active_user] = lambda: fake_user
    app.dependency_overrides[get_send_simulation_service] = lambda: service

    try:
        response = TestClient(app).post("/campaigns/campaign_123/simulate-send")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "simulated"
    assert payload["mode"] == "simulation"
    assert payload["email_logs_created"] == 2
    assert payload["listmonk_dispatched"] is False
