from __future__ import annotations

from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.core.config import Settings, get_settings
from app.guard.deliverability_guard import DeliverabilityGuard
from app.main import app
from app.repositories.blocked_sends import InMemoryBlockedSendRepository
from app.repositories.campaign_slots import InMemoryCampaignSlotRepository
from app.repositories.campaigns import CampaignRecord, InMemoryCampaignRepository
from app.repositories.clients import ClientRecord
from app.repositories.contacts import ContactRecord, InMemoryContactRepository
from app.repositories.email_logs import InMemoryEmailLogRepository
from app.repositories.provider_events import InMemoryProviderEventRepository
from app.repositories.suppression_list import InMemorySuppressionListRepository
from app.services.campaign_slots import CampaignSlotService
from app.services.campaigns import AdminCampaignService
from app.services.provider_events import (
    NormalizedProviderEvent,
    ProviderEventIngestionService,
    get_provider_event_ingestion_service,
)
from app.services.unsubscribe import (
    UnsubscribeService,
    UnsubscribeTokenService,
    get_unsubscribe_service,
)


class FakeClientRepository:
    def __init__(self, clients: list[ClientRecord]) -> None:
        self._clients = {client.id: client for client in clients}

    def get_by_id(self, client_id: str) -> ClientRecord | None:
        return self._clients.get(client_id)

    def list_client_campaigns(self, _client_id: str) -> list[CampaignRecord]:
        return []

    def list_admin_campaigns(self) -> list[CampaignRecord]:
        return []


def build_client(
    client_id: str = "client_123",
    status: str = "active",
) -> ClientRecord:
    now = datetime.now(timezone.utc)
    return ClientRecord(
        id=client_id,
        email=f"{client_id}@example.test",
        personal_name="Client",
        status=status,
        email_limit_per_campaign=None,
        max_campaigns=None,
        monthly_email_limit=None,
        daily_email_limit=None,
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


def build_runtime(
    *,
    contacts: list[ContactRecord] | None = None,
) -> dict[str, object]:
    selected_contacts = contacts or [
        build_contact(contact_id="contact_123", email="person@example.test")
    ]
    contact_relations = {
        ("client_123", "campaign_123", contact.id) for contact in selected_contacts
    }
    settings = Settings(
        environment="test",
        backend_api_key="test-api-key",
        backend_public_url="http://localhost:8000",
        unsubscribe_token_secret="unsubscribe-secret",
    )
    client = build_client()
    campaign_repository = InMemoryCampaignRepository(campaign_contacts=contact_relations)
    campaign = campaign_repository.add_campaign(
        campaign_id="campaign_123",
        client_id="client_123",
        status="ready",
        contacts_ready=True,
        content_ready=True,
        review_ready=True,
        current_step="send",
    )
    contact_repository = InMemoryContactRepository(
        contacts=selected_contacts,
        campaign_contacts=contact_relations,
    )
    email_log_repository = InMemoryEmailLogRepository()
    for index, contact in enumerate(selected_contacts, start=1):
        email_log_repository.create_email_log(
            client_id="client_123",
            campaign_id=campaign.id,
            contact_id=contact.id,
            status="queued",
            provider_message_id=f"msg-{index}",
        )
    suppression_repository = InMemorySuppressionListRepository()
    provider_event_repository = InMemoryProviderEventRepository()
    provider_event_service = ProviderEventIngestionService(
        settings=settings,
        provider_event_repository=provider_event_repository,
        campaign_repository=campaign_repository,
        contact_repository=contact_repository,
        email_log_repository=email_log_repository,
        suppression_list_repository=suppression_repository,
    )
    token_service = UnsubscribeTokenService(settings)
    unsubscribe_service = UnsubscribeService(
        settings=settings,
        token_service=token_service,
        contact_repository=contact_repository,
        provider_event_service=provider_event_service,
    )
    admin_service = AdminCampaignService(
        settings=settings,
        guard=DeliverabilityGuard(),
        repository=campaign_repository,
        client_repository=FakeClientRepository([client]),  # type: ignore[arg-type]
        campaign_slot_service=CampaignSlotService(
            slot_repository=InMemoryCampaignSlotRepository(),
            campaign_repository=campaign_repository,
        ),
        campaign_slot_repository=InMemoryCampaignSlotRepository(),
        contact_repository=contact_repository,
        suppression_list_repository=suppression_repository,
        blocked_send_repository=InMemoryBlockedSendRepository(),
        email_log_repository=email_log_repository,
        provider_event_repository=provider_event_repository,
    )
    return {
        "settings": settings,
        "client": client,
        "campaign": campaign,
        "contacts": selected_contacts,
        "contact_repository": contact_repository,
        "email_log_repository": email_log_repository,
        "suppression_repository": suppression_repository,
        "provider_event_repository": provider_event_repository,
        "provider_event_service": provider_event_service,
        "token_service": token_service,
        "unsubscribe_service": unsubscribe_service,
        "admin_service": admin_service,
    }


def test_unsubscribe_token_valid_creates_suppression() -> None:
    runtime = build_runtime()
    token_service: UnsubscribeTokenService = runtime["token_service"]  # type: ignore[assignment]
    unsubscribe_service: UnsubscribeService = runtime["unsubscribe_service"]  # type: ignore[assignment]
    suppression_repository: InMemorySuppressionListRepository = runtime["suppression_repository"]  # type: ignore[assignment]
    contact_repository: InMemoryContactRepository = runtime["contact_repository"]  # type: ignore[assignment]

    token = token_service.generate_token(client_id="client_123", contact_id="contact_123")
    unsubscribe_service.unsubscribe(token=token, campaign_id="campaign_123")

    assert suppression_repository.list_suppressed_emails_for_campaign(
        client_id="client_123",
        emails=["person@example.test"],
    ) == {"person@example.test"}
    assert contact_repository.get_by_id("contact_123").status == "unsubscribed"


def test_unsubscribe_token_invalid_is_rejected() -> None:
    runtime = build_runtime()
    unsubscribe_service: UnsubscribeService = runtime["unsubscribe_service"]  # type: ignore[assignment]
    app.dependency_overrides[get_unsubscribe_service] = lambda: unsubscribe_service
    try:
        response = TestClient(app).get("/unsubscribe/not-a-valid-token")
    finally:
        app.dependency_overrides.pop(get_unsubscribe_service, None)

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid unsubscribe link."


def test_provider_event_endpoint_requires_api_key() -> None:
    runtime = build_runtime()
    provider_event_service: ProviderEventIngestionService = runtime["provider_event_service"]  # type: ignore[assignment]
    settings = Settings(
        environment="development",
        backend_api_key="test-api-key",
        backend_public_url="http://localhost:8000",
        unsubscribe_token_secret="unsubscribe-secret",
    )
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_provider_event_ingestion_service] = (
        lambda: provider_event_service
    )
    try:
        response = TestClient(app).post(
            "/events/provider",
            json={
                "provider": "ses",
                "event_type": "ses_bounce",
                "campaign_id": "campaign_123",
                "contact_id": "contact_123",
                "provider_event_id": "bounce-route-1",
                "provider_message_id": "msg-1",
                "email": "person@example.test",
            },
        )
    finally:
        app.dependency_overrides.pop(get_provider_event_ingestion_service, None)
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid or missing API key."


def test_provider_event_endpoint_accepts_valid_api_key() -> None:
    runtime = build_runtime()
    provider_event_service: ProviderEventIngestionService = runtime["provider_event_service"]  # type: ignore[assignment]
    settings = Settings(
        environment="development",
        backend_api_key="test-api-key",
        backend_public_url="http://localhost:8000",
        unsubscribe_token_secret="unsubscribe-secret",
    )
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_provider_event_ingestion_service] = (
        lambda: provider_event_service
    )
    try:
        response = TestClient(app).post(
            "/events/provider",
            headers={"X-API-Key": "test-api-key"},
            json={
                "provider": "ses",
                "event_type": "ses_bounce",
                "campaign_id": "campaign_123",
                "contact_id": "contact_123",
                "provider_event_id": "bounce-route-2",
                "provider_message_id": "msg-1",
                "email": "person@example.test",
            },
        )
    finally:
        app.dependency_overrides.pop(get_provider_event_ingestion_service, None)
        app.dependency_overrides.pop(get_settings, None)

    assert response.status_code == 202
    assert response.json()["created"] is True
    assert response.json()["event_type"] == "ses_bounce"


def test_unsubscribe_is_idempotent() -> None:
    runtime = build_runtime()
    token_service: UnsubscribeTokenService = runtime["token_service"]  # type: ignore[assignment]
    unsubscribe_service: UnsubscribeService = runtime["unsubscribe_service"]  # type: ignore[assignment]
    suppression_repository: InMemorySuppressionListRepository = runtime["suppression_repository"]  # type: ignore[assignment]
    provider_event_repository: InMemoryProviderEventRepository = runtime["provider_event_repository"]  # type: ignore[assignment]

    token = token_service.generate_token(client_id="client_123", contact_id="contact_123")
    unsubscribe_service.unsubscribe(token=token, campaign_id="campaign_123")
    unsubscribe_service.unsubscribe(token=token, campaign_id="campaign_123")

    assert len(suppression_repository._records) == 1
    assert len(
        provider_event_repository.list_by_campaign(
            client_id="client_123",
            campaign_id="campaign_123",
        )
    ) == 1


def test_provider_event_insert_is_idempotent() -> None:
    runtime = build_runtime()
    provider_event_service: ProviderEventIngestionService = runtime["provider_event_service"]  # type: ignore[assignment]
    provider_event_repository: InMemoryProviderEventRepository = runtime["provider_event_repository"]  # type: ignore[assignment]

    event = NormalizedProviderEvent(
        provider="ses",
        source="provider_webhook",
        provider_event_id="evt-1",
        event_type="ses_bounce",
        campaign_id="campaign_123",
        contact_id="contact_123",
        email="person@example.test",
    )
    first = provider_event_service.ingest_event(event)
    second = provider_event_service.ingest_event(event)

    assert first.created is True
    assert second.created is False
    assert len(
        provider_event_repository.list_by_campaign(
            client_id="client_123",
            campaign_id="campaign_123",
        )
    ) == 1


def test_ses_bounce_updates_provider_events_email_logs_and_suppression_list() -> None:
    runtime = build_runtime()
    provider_event_service: ProviderEventIngestionService = runtime["provider_event_service"]  # type: ignore[assignment]
    email_log_repository: InMemoryEmailLogRepository = runtime["email_log_repository"]  # type: ignore[assignment]
    suppression_repository: InMemorySuppressionListRepository = runtime["suppression_repository"]  # type: ignore[assignment]
    contact_repository: InMemoryContactRepository = runtime["contact_repository"]  # type: ignore[assignment]

    response = provider_event_service.ingest_event(
        NormalizedProviderEvent(
            provider="ses",
            source="provider_webhook",
            provider_event_id="bounce-1",
            event_type="ses_bounce",
            campaign_id="campaign_123",
            contact_id="contact_123",
            provider_message_id="msg-1",
            email="person@example.test",
        )
    )

    assert response.created is True
    assert email_log_repository.find_latest_for_contact(
        client_id="client_123",
        campaign_id="campaign_123",
        contact_id="contact_123",
    ).status == "bounced"
    assert contact_repository.get_by_id("contact_123").status == "bounced"
    assert suppression_repository.list_suppressed_emails_for_campaign(
        client_id="client_123",
        emails=["person@example.test"],
    ) == {"person@example.test"}


def test_ses_complaint_updates_provider_events_email_logs_and_suppression_list() -> None:
    runtime = build_runtime()
    provider_event_service: ProviderEventIngestionService = runtime["provider_event_service"]  # type: ignore[assignment]
    email_log_repository: InMemoryEmailLogRepository = runtime["email_log_repository"]  # type: ignore[assignment]
    suppression_repository: InMemorySuppressionListRepository = runtime["suppression_repository"]  # type: ignore[assignment]
    contact_repository: InMemoryContactRepository = runtime["contact_repository"]  # type: ignore[assignment]

    provider_event_service.ingest_event(
        NormalizedProviderEvent(
            provider="ses",
            source="provider_webhook",
            provider_event_id="complaint-1",
            event_type="ses_complaint",
            campaign_id="campaign_123",
            contact_id="contact_123",
            provider_message_id="msg-1",
            email="person@example.test",
        )
    )

    assert email_log_repository.find_latest_for_contact(
        client_id="client_123",
        campaign_id="campaign_123",
        contact_id="contact_123",
    ).status == "complained"
    assert contact_repository.get_by_id("contact_123").status == "suppressed"
    assert suppression_repository._records[0].reason == "complaint"


def test_sendwise_unsubscribe_event_updates_provider_events_email_logs_and_suppression_list() -> None:
    runtime = build_runtime()
    provider_event_service: ProviderEventIngestionService = runtime["provider_event_service"]  # type: ignore[assignment]
    email_log_repository: InMemoryEmailLogRepository = runtime["email_log_repository"]  # type: ignore[assignment]
    suppression_repository: InMemorySuppressionListRepository = runtime["suppression_repository"]  # type: ignore[assignment]
    contact_repository: InMemoryContactRepository = runtime["contact_repository"]  # type: ignore[assignment]

    provider_event_service.ingest_event(
        NormalizedProviderEvent(
            provider="sendwise",
            source="unsubscribe_link",
            provider_event_id="unsubscribe-1",
            event_type="sendwise_unsubscribe",
            campaign_id="campaign_123",
            contact_id="contact_123",
            email="person@example.test",
        )
    )

    assert email_log_repository.find_latest_for_contact(
        client_id="client_123",
        campaign_id="campaign_123",
        contact_id="contact_123",
    ).status == "unsubscribed"
    assert contact_repository.get_by_id("contact_123").status == "unsubscribed"
    assert suppression_repository._records[0].reason == "unsubscribe"


def test_ses_open_and_click_update_provider_events_and_stats_without_suppression() -> None:
    runtime = build_runtime()
    provider_event_service: ProviderEventIngestionService = runtime["provider_event_service"]  # type: ignore[assignment]
    admin_service: AdminCampaignService = runtime["admin_service"]  # type: ignore[assignment]
    suppression_repository: InMemorySuppressionListRepository = runtime["suppression_repository"]  # type: ignore[assignment]
    email_log_repository: InMemoryEmailLogRepository = runtime["email_log_repository"]  # type: ignore[assignment]

    provider_event_service.ingest_event(
        NormalizedProviderEvent(
            provider="ses",
            source="provider_webhook",
            provider_event_id="open-1",
            event_type="ses_open",
            campaign_id="campaign_123",
            contact_id="contact_123",
            provider_message_id="msg-1",
            email="person@example.test",
        )
    )
    provider_event_service.ingest_event(
        NormalizedProviderEvent(
            provider="ses",
            source="provider_webhook",
            provider_event_id="click-1",
            event_type="ses_click",
            campaign_id="campaign_123",
            contact_id="contact_123",
            provider_message_id="msg-1",
            email="person@example.test",
        )
    )

    summary = admin_service.get_campaign_summary("campaign_123")
    assert summary.logs.opened == 1
    assert summary.logs.clicked == 1
    assert summary.logs.provider_events_available is True
    assert suppression_repository._records == []
    assert email_log_repository.find_latest_for_contact(
        client_id="client_123",
        campaign_id="campaign_123",
        contact_id="contact_123",
    ).status == "queued"


def test_duplicate_event_does_not_duplicate_side_effects() -> None:
    runtime = build_runtime()
    provider_event_service: ProviderEventIngestionService = runtime["provider_event_service"]  # type: ignore[assignment]
    suppression_repository: InMemorySuppressionListRepository = runtime["suppression_repository"]  # type: ignore[assignment]

    event = NormalizedProviderEvent(
        provider="ses",
        source="provider_webhook",
        provider_event_id="complaint-duplicate",
        event_type="ses_complaint",
        campaign_id="campaign_123",
        contact_id="contact_123",
        provider_message_id="msg-1",
        email="person@example.test",
    )
    provider_event_service.ingest_event(event)
    provider_event_service.ingest_event(event)

    assert len(suppression_repository._records) == 1


def test_guard_blocks_contact_after_suppression_event() -> None:
    runtime = build_runtime()
    provider_event_service: ProviderEventIngestionService = runtime["provider_event_service"]  # type: ignore[assignment]
    suppression_repository: InMemorySuppressionListRepository = runtime["suppression_repository"]  # type: ignore[assignment]
    campaign: CampaignRecord = runtime["campaign"]  # type: ignore[assignment]
    client: ClientRecord = runtime["client"]  # type: ignore[assignment]
    contacts: list[ContactRecord] = runtime["contacts"]  # type: ignore[assignment]

    provider_event_service.ingest_event(
        NormalizedProviderEvent(
            provider="ses",
            source="provider_webhook",
            provider_event_id="bounce-guard",
            event_type="ses_bounce",
            campaign_id="campaign_123",
            contact_id="contact_123",
            provider_message_id="msg-1",
            email="person@example.test",
        )
    )

    suppressed_emails = suppression_repository.list_suppressed_emails_for_campaign(
        client_id="client_123",
        emails=[contact.email for contact in contacts],
    )
    result = DeliverabilityGuard().authorize_campaign_dispatch(
        email_sending_enabled=True,
        client=client,
        campaign=campaign,
        slot=None,
        contacts=contacts,
        suppressed_emails=suppressed_emails,
        active_campaign_count=1,
    )

    assert result.allowed is False
    assert result.code == "no_eligible_contacts"


def test_campaign_stats_read_model_counts_event_metrics() -> None:
    contacts = [
        build_contact(contact_id="contact_open", email="open@example.test"),
        build_contact(contact_id="contact_click", email="click@example.test"),
        build_contact(contact_id="contact_bounce", email="bounce@example.test"),
        build_contact(contact_id="contact_complaint", email="complaint@example.test"),
        build_contact(contact_id="contact_unsubscribe", email="unsubscribe@example.test"),
    ]
    runtime = build_runtime(contacts=contacts)
    provider_event_service: ProviderEventIngestionService = runtime["provider_event_service"]  # type: ignore[assignment]
    admin_service: AdminCampaignService = runtime["admin_service"]  # type: ignore[assignment]

    provider_event_service.ingest_event(
        NormalizedProviderEvent(
            provider="ses",
            source="provider_webhook",
            provider_event_id="open-stat",
            event_type="ses_open",
            campaign_id="campaign_123",
            contact_id="contact_open",
            provider_message_id="msg-1",
            email="open@example.test",
        )
    )
    provider_event_service.ingest_event(
        NormalizedProviderEvent(
            provider="ses",
            source="provider_webhook",
            provider_event_id="click-stat",
            event_type="ses_click",
            campaign_id="campaign_123",
            contact_id="contact_click",
            provider_message_id="msg-2",
            email="click@example.test",
        )
    )
    provider_event_service.ingest_event(
        NormalizedProviderEvent(
            provider="ses",
            source="provider_webhook",
            provider_event_id="bounce-stat",
            event_type="ses_bounce",
            campaign_id="campaign_123",
            contact_id="contact_bounce",
            provider_message_id="msg-3",
            email="bounce@example.test",
        )
    )
    provider_event_service.ingest_event(
        NormalizedProviderEvent(
            provider="ses",
            source="provider_webhook",
            provider_event_id="complaint-stat",
            event_type="ses_complaint",
            campaign_id="campaign_123",
            contact_id="contact_complaint",
            provider_message_id="msg-4",
            email="complaint@example.test",
        )
    )
    provider_event_service.ingest_event(
        NormalizedProviderEvent(
            provider="sendwise",
            source="unsubscribe_link",
            provider_event_id="unsubscribe-stat",
            event_type="sendwise_unsubscribe",
            campaign_id="campaign_123",
            contact_id="contact_unsubscribe",
            provider_message_id="msg-5",
            email="unsubscribe@example.test",
        )
    )

    summary = admin_service.get_campaign_summary("campaign_123")
    assert summary.logs.opened == 1
    assert summary.logs.clicked == 1
    assert summary.logs.bounced == 1
    assert summary.logs.complained == 1
    assert summary.logs.unsubscribed == 1
    assert summary.logs.provider_events_available is True
