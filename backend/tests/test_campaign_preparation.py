from datetime import datetime, timezone
from typing import Any

from fastapi.testclient import TestClient

from app.api.campaigns import get_campaign_preparation_service
from app.core.auth import AuthenticatedUser, require_active_user
from app.core.config import Settings
from app.main import app
from app.repositories.clients import ClientCampaignRecord
from app.repositories.contacts import ContactRecord, InMemoryContactRepository
from app.repositories.listmonk_mappings import InMemoryListmonkMappingRepository
from app.services.campaign_preparation import CampaignPreparationService
from app.services.contact_subscriber_sync import ContactSubscriberSyncService
from app.services.listmonk_mappings import ListmonkMappingService


class FakeListmonkPreparationClient:
    def __init__(self) -> None:
        self.created_lists: list[dict[str, Any]] = []
        self.created_subscribers: list[dict[str, Any]] = []
        self.patched_subscribers: list[tuple[str, dict[str, Any]]] = []
        self.assigned_lists: list[dict[str, Any]] = []
        self.created_campaign_payloads: list[dict[str, Any]] = []
        self.updated_campaign_payloads: list[tuple[str, dict[str, Any]]] = []
        self.existing_by_email: dict[str, dict[str, Any]] = {}

    def create_list(self, payload: dict[str, Any]) -> dict[str, Any]:
        self.created_lists.append(payload)
        return {"data": {"id": len(self.created_lists)}}

    def get_subscriber_by_email(self, email: str) -> dict[str, Any] | None:
        return self.existing_by_email.get(email)

    def create_subscriber(self, payload: dict[str, Any]) -> dict[str, Any]:
        self.created_subscribers.append(payload)
        return {"data": {"id": 100 + len(self.created_subscribers)}}

    def patch_subscriber(
        self,
        subscriber_id: int | str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        self.patched_subscribers.append((str(subscriber_id), payload))
        return {"data": {"id": subscriber_id}}

    def assign_subscriber_lists(
        self,
        *,
        subscriber_ids: list[int],
        list_ids: list[int],
        status: str = "confirmed",
    ) -> dict[str, Any]:
        self.assigned_lists.append(
            {
                "ids": subscriber_ids,
                "target_list_ids": list_ids,
                "status": status,
            }
        )
        return {"data": True}

    def create_campaign(self, payload: dict[str, Any]) -> dict[str, Any]:
        self.created_campaign_payloads.append(payload)
        return {"data": {"id": 200 + len(self.created_campaign_payloads)}}

    def update_campaign(
        self,
        campaign_id: int | str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        self.updated_campaign_payloads.append((str(campaign_id), payload))
        return {"data": {"id": campaign_id}}


class FakeCampaignRepository:
    def __init__(self, campaigns: list[ClientCampaignRecord]) -> None:
        self._campaigns = campaigns

    def list_client_campaigns(self, client_id: str) -> list[ClientCampaignRecord]:
        return [
            campaign for campaign in self._campaigns if campaign.client_id == client_id
        ]

    def list_admin_campaigns(self) -> list[ClientCampaignRecord]:
        return self._campaigns


def build_campaign(
    *,
    campaign_id: str = "campaign_123",
    client_id: str = "client_123",
    subject: str | None = "Launch",
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


def build_contact(
    *,
    contact_id: str,
    client_id: str = "client_123",
    email: str,
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


def build_preparation_service(
    *,
    campaign: ClientCampaignRecord | None = None,
    contacts: list[ContactRecord] | None = None,
    campaign_contacts: set[tuple[str, str, str]] | None = None,
    mapping_repository: InMemoryListmonkMappingRepository | None = None,
    listmonk_client: FakeListmonkPreparationClient | None = None,
) -> tuple[CampaignPreparationService, FakeListmonkPreparationClient, InMemoryListmonkMappingRepository]:
    fake_listmonk = listmonk_client or FakeListmonkPreparationClient()
    repository = mapping_repository or InMemoryListmonkMappingRepository()
    mapping_service = ListmonkMappingService(repository)
    campaign_record = campaign or build_campaign()
    contact_repository = InMemoryContactRepository(
        contacts=contacts
        if contacts is not None
        else [
            build_contact(
                contact_id="contact_1",
                email="first@example.test",
            ),
            build_contact(
                contact_id="contact_2",
                email="second@example.test",
            ),
        ],
        campaign_contacts=campaign_contacts
        if campaign_contacts is not None
        else {
            ("client_123", "campaign_123", "contact_1"),
            ("client_123", "campaign_123", "contact_2"),
        },
    )
    contact_sync_service = ContactSubscriberSyncService(
        listmonk_client=fake_listmonk,  # type: ignore[arg-type]
        mapping_service=mapping_service,
        contact_repository=contact_repository,
    )
    service = CampaignPreparationService(
        settings=Settings(environment="test", smtp_from_email="sender@example.test"),
        listmonk_client=fake_listmonk,  # type: ignore[arg-type]
        mapping_service=mapping_service,
        client_repository=FakeCampaignRepository([campaign_record]),  # type: ignore[arg-type]
        contact_sync_service=contact_sync_service,
    )
    return service, fake_listmonk, repository


def test_prepare_campaign_creates_list_subscribers_campaign_and_mappings() -> None:
    service, fake_listmonk, repository = build_preparation_service()

    result = service.prepare_campaign("campaign_123")

    assert result["status"] == "synced"
    assert result["content_ready"] is False
    assert result["contact_summary"]["total_contacts"] == 2
    assert result["contact_summary"]["synced_count"] == 2
    assert result["list_mapping"]["created"] is True
    assert result["listmonk_mapping"]["created"] is True
    assert fake_listmonk.created_lists[0]["name"] == "sendwise-campaign-campaign_123"
    assert len(fake_listmonk.created_subscribers) == 2
    assert fake_listmonk.created_campaign_payloads == [
        {
            "name": "Launch campaign",
            "subject": "Launch",
            "lists": [1],
            "type": "regular",
            "content_type": "html",
            "body": (
                "<p>Sendwise technical campaign draft. "
                "Final campaign content is not ready.</p>"
            ),
            "tags": ["sendwise", "content_ready:false"],
            "from_email": "sender@example.test",
        }
    ]
    mapping_types = {
        (mapping.entity_type, mapping.entity_id, mapping.listmonk_type)
        for mapping in repository.list_by_client("client_123")
    }
    assert ("campaign", "campaign_123", "list") in mapping_types
    assert ("campaign", "campaign_123", "campaign") in mapping_types
    assert ("contact", "contact_1", "subscriber") in mapping_types
    assert ("contact", "contact_2", "subscriber") in mapping_types


def test_prepare_campaign_is_idempotent_and_updates_existing_campaign() -> None:
    repository = InMemoryListmonkMappingRepository()
    mapping_service = ListmonkMappingService(repository)
    mapping_service.ensure_campaign_list_mapping(
        client_id="client_123",
        campaign_id="campaign_123",
        listmonk_list_id="7",
    )
    mapping_service.ensure_campaign_mapping(
        client_id="client_123",
        campaign_id="campaign_123",
        listmonk_campaign_id="9",
    )
    mapping_service.ensure_contact_subscriber_mapping(
        client_id="client_123",
        contact_id="contact_1",
        listmonk_subscriber_id="41",
    )
    mapping_service.ensure_contact_subscriber_mapping(
        client_id="client_123",
        contact_id="contact_2",
        listmonk_subscriber_id="42",
    )
    service, fake_listmonk, _repository = build_preparation_service(
        mapping_repository=repository,
    )

    result = service.prepare_campaign("campaign_123")

    assert result["status"] == "synced"
    assert result["list_mapping"]["created"] is False
    assert result["listmonk_mapping"]["created"] is False
    assert fake_listmonk.created_lists == []
    assert fake_listmonk.created_subscribers == []
    assert fake_listmonk.updated_campaign_payloads[0][0] == "9"
    assert fake_listmonk.assigned_lists == [
        {"ids": [41], "target_list_ids": [7], "status": "confirmed"},
        {"ids": [42], "target_list_ids": [7], "status": "confirmed"},
    ]


def test_prepare_campaign_skips_error_contacts_in_batch_summary() -> None:
    service, fake_listmonk, _repository = build_preparation_service(
        contacts=[
            build_contact(
                contact_id="contact_1",
                email="first@example.test",
            ),
            build_contact(
                contact_id="contact_error",
                email="error@example.test",
                status="error",
            ),
        ],
        campaign_contacts={
            ("client_123", "campaign_123", "contact_1"),
            ("client_123", "campaign_123", "contact_error"),
        },
    )

    result = service.prepare_campaign("campaign_123")

    assert result["contact_summary"]["total_contacts"] == 2
    assert result["contact_summary"]["synced_count"] == 1
    assert result["contact_summary"]["skipped_count"] == 1
    assert result["contact_summary"]["failed_count"] == 0
    assert len(fake_listmonk.created_subscribers) == 1


def test_sync_listmonk_endpoint_uses_backend_preparation_without_sending() -> None:
    fake_user = AuthenticatedUser(
        id="user_1",
        clerk_user_id="clerk_1",
        email="admin@sendwise.test",
        access_type="platform_admin",
        status="active",
    )
    service, fake_listmonk, _repository = build_preparation_service()

    app.dependency_overrides[require_active_user] = lambda: fake_user
    app.dependency_overrides[get_campaign_preparation_service] = lambda: service

    try:
        response = TestClient(app).post("/campaigns/campaign_123/sync-listmonk")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status"] == "synced"
    assert not hasattr(fake_listmonk, "sent_campaign_ids")
