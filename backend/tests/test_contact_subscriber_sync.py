from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi.testclient import TestClient

from app.api.contacts import get_contact_subscriber_sync_service
from app.core.security import require_api_key
from app.integrations.listmonk.client import ListmonkClient, ListmonkError
from app.main import app
from app.repositories.contacts import ContactRecord, InMemoryContactRepository
from app.repositories.listmonk_mappings import InMemoryListmonkMappingRepository
from app.services.contact_subscriber_sync import ContactSubscriberSyncService
from app.services.listmonk_mappings import ListmonkMappingService


class FakeListmonkSubscriberClient:
    def __init__(self) -> None:
        self.created_lists: list[dict[str, Any]] = []
        self.created_subscribers: list[dict[str, Any]] = []
        self.patched_subscribers: list[tuple[str, dict[str, Any]]] = []
        self.assigned_lists: list[dict[str, Any]] = []
        self.searches: list[str] = []
        self.existing_by_email: dict[str, dict[str, Any]] = {}
        self.create_subscriber_error: ListmonkError | None = None

    def create_list(self, payload: dict[str, Any]) -> dict[str, Any]:
        self.created_lists.append(payload)
        return {"data": {"id": len(self.created_lists)}}

    def get_subscriber_by_email(self, email: str) -> dict[str, Any] | None:
        self.searches.append(email)
        return self.existing_by_email.get(email)

    def create_subscriber(self, payload: dict[str, Any]) -> dict[str, Any]:
        if self.create_subscriber_error is not None:
            raise self.create_subscriber_error
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


def build_contact(
    *,
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


def build_sync_service(
    *,
    contact: ContactRecord | None = None,
    listmonk_client: FakeListmonkSubscriberClient | None = None,
    mapping_repository: InMemoryListmonkMappingRepository | None = None,
    campaign_contacts: set[tuple[str, str, str]] | None = None,
) -> tuple[ContactSubscriberSyncService, FakeListmonkSubscriberClient, InMemoryListmonkMappingRepository]:
    fake_listmonk = listmonk_client or FakeListmonkSubscriberClient()
    repository = mapping_repository or InMemoryListmonkMappingRepository()
    contacts = [contact or build_contact()]
    service = ContactSubscriberSyncService(
        listmonk_client=fake_listmonk,  # type: ignore[arg-type]
        mapping_service=ListmonkMappingService(repository),
        contact_repository=InMemoryContactRepository(
            contacts=contacts,
            campaign_contacts=campaign_contacts,
        ),
    )
    return service, fake_listmonk, repository


def test_sync_contact_creates_client_list_subscriber_membership_and_mapping() -> None:
    service, fake_listmonk, repository = build_sync_service()

    result = service.sync_contact(contact_id="contact_123")

    assert result["status"] == "synced"
    assert result["listmonk_synced"] is True
    assert result["subscriber_created"] is True
    assert result["list_created"] is True
    assert fake_listmonk.created_lists == [
        {
            "name": "sendwise-client-client_123",
            "type": "private",
            "optin": "single",
            "status": "active",
            "tags": ["sendwise"],
            "description": "Sendwise technical client list",
        }
    ]
    assert fake_listmonk.created_subscribers == [
        {
            "email": "person@example.test",
            "name": "person@example.test",
            "status": "enabled",
            "attribs": {
                "sendwise_client_id": "client_123",
                "sendwise_contact_id": "contact_123",
            },
            "lists": [1],
            "preconfirm_subscriptions": True,
        }
    ]
    assert fake_listmonk.assigned_lists == [
        {"ids": [101], "target_list_ids": [1], "status": "confirmed"}
    ]
    assert repository.list_by_client("client_123")[0].listmonk_type == "list"
    assert result["listmonk_mapping"]["listmonk_id"] == "101"


def test_sync_contact_reuses_mapping_without_duplicate_subscriber() -> None:
    repository = InMemoryListmonkMappingRepository()
    mapping_service = ListmonkMappingService(repository)
    mapping_service.ensure_client_list_mapping(
        client_id="client_123",
        listmonk_list_id="7",
    )
    mapping_service.ensure_contact_subscriber_mapping(
        client_id="client_123",
        contact_id="contact_123",
        listmonk_subscriber_id="42",
    )
    service, fake_listmonk, _repository = build_sync_service(
        mapping_repository=repository,
    )

    result = service.sync_contact(contact_id="contact_123")

    assert result["status"] == "synced"
    assert result["subscriber_created"] is False
    assert result["list_created"] is False
    assert fake_listmonk.searches == []
    assert fake_listmonk.created_subscribers == []
    assert fake_listmonk.patched_subscribers == [
        (
            "42",
            {
                "email": "person@example.test",
                "name": "person@example.test",
                "status": "enabled",
                "attribs": {
                    "sendwise_client_id": "client_123",
                    "sendwise_contact_id": "contact_123",
                },
            },
        )
    ]
    assert fake_listmonk.assigned_lists == [
        {"ids": [42], "target_list_ids": [7], "status": "confirmed"}
    ]


def test_sync_contact_deduplicates_by_existing_subscriber_email() -> None:
    fake_listmonk = FakeListmonkSubscriberClient()
    fake_listmonk.existing_by_email["person@example.test"] = {"id": 55}
    service, _fake_listmonk, _repository = build_sync_service(
        listmonk_client=fake_listmonk,
    )

    result = service.sync_contact(contact_id="contact_123")

    assert result["status"] == "synced"
    assert result["subscriber_created"] is False
    assert fake_listmonk.created_subscribers == []
    assert fake_listmonk.patched_subscribers[0][0] == "55"
    assert result["listmonk_mapping"]["listmonk_id"] == "55"


def test_sync_contact_recovers_duplicate_create_by_email_lookup() -> None:
    fake_listmonk = FakeListmonkSubscriberClient()
    fake_listmonk.existing_by_email["person@example.test"] = {"id": 56}
    fake_listmonk.create_subscriber_error = ListmonkError(
        "listmonk returned HTTP 409",
        status_code=409,
    )
    service, _fake_listmonk, _repository = build_sync_service(
        listmonk_client=fake_listmonk,
    )

    result = service.sync_contact(contact_id="contact_123")

    assert result["status"] == "synced"
    assert result["subscriber_created"] is False
    assert result["listmonk_mapping"]["listmonk_id"] == "56"


def test_sync_contact_assigns_campaign_list_only_when_business_relationship_exists() -> None:
    campaign_contacts = {("client_123", "campaign_123", "contact_123")}
    service, fake_listmonk, _repository = build_sync_service(
        campaign_contacts=campaign_contacts,
    )

    result = service.sync_contact(
        contact_id="contact_123",
        campaign_id="campaign_123",
    )

    assert result["status"] == "synced"
    assert result["list_mapping"]["entity_type"] == "campaign"
    assert result["list_mapping"]["entity_id"] == "campaign_123"
    assert fake_listmonk.created_lists[0]["name"] == "sendwise-campaign-campaign_123"


def test_sync_contact_rejects_campaign_list_without_business_relationship() -> None:
    service, fake_listmonk, repository = build_sync_service()

    result = service.sync_contact(
        contact_id="contact_123",
        campaign_id="campaign_123",
    )

    assert result["status"] == "not_synced"
    assert result["listmonk_synced"] is False
    assert fake_listmonk.created_lists == []
    assert repository.list_by_client("client_123") == []


def test_blocklisted_business_contact_syncs_as_listmonk_blocklisted() -> None:
    contact = build_contact(status="unsubscribed")
    service, fake_listmonk, _repository = build_sync_service(contact=contact)

    result = service.sync_contact(contact_id="contact_123")

    assert result["status"] == "synced"
    assert fake_listmonk.created_subscribers[0]["status"] == "blocklisted"


def test_sync_endpoint_uses_backend_service_without_sending() -> None:
    service, fake_listmonk, _repository = build_sync_service()
    app.dependency_overrides[require_api_key] = lambda: None
    app.dependency_overrides[get_contact_subscriber_sync_service] = lambda: service

    try:
        response = TestClient(app).post("/contacts/contact_123/sync", json={})
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status"] == "synced"
    assert not hasattr(fake_listmonk, "sent_campaign_ids")


def test_listmonk_client_searches_subscriber_by_email(monkeypatch: Any) -> None:
    captured: dict[str, Any] = {}

    def fake_request(*_args: object, **kwargs: object) -> httpx.Response:
        captured.update(kwargs)
        request = httpx.Request("GET", "http://listmonk.test/api/subscribers")
        return httpx.Response(
            200,
            request=request,
            json={"data": {"results": [{"id": 9, "email": "a@example.test"}]}},
        )

    monkeypatch.setattr(httpx, "request", fake_request)
    client = ListmonkClient(base_url="http://listmonk.test", timeout_seconds=1)

    assert client.get_subscriber_by_email("a@example.test") == {
        "id": 9,
        "email": "a@example.test",
    }
    assert captured["params"] == {
        "query": "subscribers.email = 'a@example.test'",
        "per_page": "1",
    }
