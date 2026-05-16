from datetime import datetime, timezone
from typing import Any

from fastapi.testclient import TestClient

from app.core.auth import AuthenticatedUser, require_platform_admin
from app.core.config import Settings
from app.guard.deliverability_guard import DeliverabilityGuard
from app.main import app
from app.repositories.blocked_sends import InMemoryBlockedSendRepository
from app.repositories.campaign_slots import InMemoryCampaignSlotRepository
from app.repositories.campaigns import CampaignRecord, InMemoryCampaignRepository
from app.repositories.clients import ClientCampaignRecord, ClientRecord
from app.repositories.contacts import ContactRecord, InMemoryContactRepository
from app.repositories.email_logs import InMemoryEmailLogRepository
from app.repositories.listmonk_mappings import InMemoryListmonkMappingRepository
from app.repositories.provider_events import InMemoryProviderEventRepository
from app.repositories.suppression_list import (
    InMemorySuppressionListRepository,
    SuppressionRecord,
)
from app.schemas.campaigns import AdminCampaignContactPayload
from app.services.campaign_slots import CampaignSlotService
from app.services.campaigns import (
    AdminCampaignService,
    CampaignDispatchService,
    get_admin_campaign_service,
    get_campaign_dispatch_service,
)
from app.services.listmonk_mappings import ListmonkMappingService
from app.services.send_simulation import SendSimulationService, get_send_simulation_service


class FakeClientRepository:
    def __init__(
        self,
        *,
        clients: list[ClientRecord],
        campaigns: list[ClientCampaignRecord] | None = None,
    ) -> None:
        self._clients = {client.id: client for client in clients}
        self._campaigns = campaigns or []

    def get_by_id(self, client_id: str) -> ClientRecord | None:
        return self._clients.get(client_id)

    def list_client_campaigns(self, client_id: str) -> list[ClientCampaignRecord]:
        return [
            campaign for campaign in self._campaigns if campaign.client_id == client_id
        ]

    def list_admin_campaigns(self) -> list[ClientCampaignRecord]:
        return list(self._campaigns)


class FakeListmonkClient:
    def __init__(self) -> None:
        self.sent_campaign_ids: list[str] = []

    def create_campaign(self, _payload: dict[str, Any]) -> dict[str, Any]:
        return {"data": {"id": "lm_123"}}

    def trigger_campaign_send(self, campaign_id: str) -> dict[str, str]:
        self.sent_campaign_ids.append(campaign_id)
        return {"status": "mocked"}


class FakePreparationService:
    def __init__(self) -> None:
        self.prepared_campaign_ids: list[str] = []

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
            "content_ready": True,
            "content": {
                "template_name": "campaign_business_db",
                "content_ready": True,
                "reason": None,
                "subject": "Launch",
                "preview_text": "Preview",
                "body": "<html><body><p>Body</p></body></html>",
                "body_text": "Body",
                "unsubscribe_url": "http://localhost/unsubscribe",
                "client_name": "Alpha",
            },
            "listmonk_mapping": {
                "entity_type": "campaign",
                "entity_id": campaign_id,
                "listmonk_type": "campaign",
                "listmonk_id": "lm_existing",
                "created": False,
            },
        }


def build_admin_user() -> AuthenticatedUser:
    return AuthenticatedUser(
        id="admin_1",
        clerk_user_id="clerk_admin_1",
        email="admin@sendwise.test",
        access_type="platform_admin",
        status="active",
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
        personal_name=client_id.title(),
        status=status,
        email_limit_per_campaign=email_limit_per_campaign,
        max_campaigns=max_campaigns,
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
    metadata: dict[str, str] | None = None,
) -> ContactRecord:
    now = datetime.now(timezone.utc)
    return ContactRecord(
        id=contact_id,
        client_id=client_id,
        email=email,
        status=status,
        metadata=metadata or {},
        created_at=now,
        updated_at=now,
    )


def to_client_campaign(campaign: CampaignRecord) -> ClientCampaignRecord:
    return ClientCampaignRecord(
        id=campaign.id,
        client_id=campaign.client_id,
        name=campaign.name,
        status=campaign.status,
        subject=campaign.subject,
        campaign_slot_id=campaign.campaign_slot_id,
        preview_text=campaign.preview_text,
        body_html=campaign.body_html,
        body_text=campaign.body_text,
        content_ready=campaign.content_ready,
        contacts_ready=campaign.contacts_ready,
        review_ready=campaign.review_ready,
        current_step=campaign.current_step,
        created_at=campaign.created_at,
        updated_at=campaign.updated_at,
    )


def build_admin_service(
    *,
    settings: Settings | None = None,
    campaign_repository: InMemoryCampaignRepository | None = None,
    slot_repository: InMemoryCampaignSlotRepository | None = None,
    clients: list[ClientRecord] | None = None,
    contacts: list[ContactRecord] | None = None,
    campaign_contacts: set[tuple[str, str, str]] | None = None,
    suppression_records: list[SuppressionRecord] | None = None,
    blocked_send_repository: InMemoryBlockedSendRepository | None = None,
    email_log_repository: InMemoryEmailLogRepository | None = None,
) -> AdminCampaignService:
    repository = campaign_repository or InMemoryCampaignRepository()
    slots = slot_repository or InMemoryCampaignSlotRepository()
    return AdminCampaignService(
        settings=settings or Settings(),
        guard=DeliverabilityGuard(),
        repository=repository,
        client_repository=FakeClientRepository(clients=clients or [build_client()]),  # type: ignore[arg-type]
        campaign_slot_service=CampaignSlotService(
            slot_repository=slots,
            campaign_repository=repository,
        ),
        campaign_slot_repository=slots,
        contact_repository=InMemoryContactRepository(
            contacts=contacts or [],
            campaign_contacts=campaign_contacts or set(),
        ),
        suppression_list_repository=InMemorySuppressionListRepository(
            records=suppression_records or []
        ),
        blocked_send_repository=blocked_send_repository or InMemoryBlockedSendRepository(),
        email_log_repository=email_log_repository or InMemoryEmailLogRepository(),
        provider_event_repository=InMemoryProviderEventRepository(),
    )


def build_simulation_service(
    *,
    campaign: ClientCampaignRecord,
    client: ClientRecord,
    contacts: list[ContactRecord],
    campaign_contacts: set[tuple[str, str, str]],
    preparation_service: FakePreparationService | None = None,
) -> SendSimulationService:
    return SendSimulationService(
        guard=DeliverabilityGuard(),
        client_repository=FakeClientRepository(  # type: ignore[arg-type]
            clients=[client],
            campaigns=[campaign],
        ),
        campaign_slot_repository=InMemoryCampaignSlotRepository(),
        contact_repository=InMemoryContactRepository(
            contacts=contacts,
            campaign_contacts=campaign_contacts,
        ),
        suppression_list_repository=InMemorySuppressionListRepository(),
        blocked_send_repository=InMemoryBlockedSendRepository(),
        email_log_repository=InMemoryEmailLogRepository(),
        campaign_preparation_service=preparation_service or FakePreparationService(),
    )


def build_dispatch_service(
    *,
    settings: Settings,
    campaign: ClientCampaignRecord,
    client: ClientRecord,
    contacts: list[ContactRecord],
    campaign_contacts: set[tuple[str, str, str]],
    fake_listmonk: FakeListmonkClient | None = None,
    preparation_service: FakePreparationService | None = None,
) -> CampaignDispatchService:
    return CampaignDispatchService(
        settings=settings,
        guard=DeliverabilityGuard(),
        listmonk_client=fake_listmonk or FakeListmonkClient(),  # type: ignore[arg-type]
        mapping_service=ListmonkMappingService(InMemoryListmonkMappingRepository()),
        client_repository=FakeClientRepository(  # type: ignore[arg-type]
            clients=[client],
            campaigns=[campaign],
        ),
        campaign_slot_repository=InMemoryCampaignSlotRepository(),
        contact_repository=InMemoryContactRepository(
            contacts=contacts,
            campaign_contacts=campaign_contacts,
        ),
        suppression_list_repository=InMemorySuppressionListRepository(),
        blocked_send_repository=InMemoryBlockedSendRepository(),
        email_log_repository=InMemoryEmailLogRepository(),
        campaign_preparation_service=preparation_service or FakePreparationService(),
    )


def test_admin_create_campaign_for_valid_client() -> None:
    service = build_admin_service()

    created = service.create_campaign(
        client_id="client_123",
        name="Launch campaign",
        subject="Spring launch",
    )

    assert created.client_id == "client_123"
    assert created.name == "Launch campaign"
    assert created.subject == "Spring launch"
    assert created.status == "draft"
    assert created.current_step == "setup"
    assert created.content_ready is False
    assert created.contacts_ready is False
    assert created.review_ready is False
    assert created.campaign_slot_id is None


def test_admin_create_rejects_archived_blocked_and_suspended_clients() -> None:
    for blocked_status in ("archived", "blocked", "suspended"):
        service = build_admin_service(
            clients=[build_client(status=blocked_status)],
        )

        try:
            service.create_campaign(
                client_id="client_123",
                name="Launch campaign",
                subject="Spring launch",
            )
        except Exception as error:
            assert "does not allow campaign writes" in str(error)
        else:
            raise AssertionError("Expected client write rejection")


def test_admin_update_rejects_client_id_change_payload() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    admin_service = build_admin_service(campaign_repository=repository)

    app.dependency_overrides[require_platform_admin] = build_admin_user
    app.dependency_overrides[get_admin_campaign_service] = lambda: admin_service

    try:
        response = TestClient(app).patch(
            f"/admin/campaigns/{campaign.id}",
            json={"client_id": "client_456"},
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422


def test_admin_content_update_saves_fields_and_sets_content_ready() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    service = build_admin_service(campaign_repository=repository)

    updated = service.update_campaign_content(
        campaign_id=campaign.id,
        subject="Updated subject",
        preview_text="Preview line",
        body_html="<p>Hello</p>",
        body_text="Hello",
        current_step="review",
    )

    assert updated.subject == "Updated subject"
    assert updated.preview_text == "Preview line"
    assert updated.body_html == "<p>Hello</p>"
    assert updated.body_text == "Hello"
    assert updated.content_ready is True
    assert updated.current_step == "review"
    assert updated.review_ready is False


def test_admin_content_update_rejects_unsupported_template_placeholders() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    service = build_admin_service(campaign_repository=repository)

    try:
        service.update_campaign_content(
            campaign_id=campaign.id,
            subject="Updated subject",
            preview_text="Preview line",
            body_html="<p>Hello {{azienda}}</p>",
            body_text="Hello",
            current_step="content",
        )
    except Exception as error:
        assert "Completa o rimuovi le variabili del template prima di salvare." in str(error)
    else:
        raise AssertionError("Expected unsupported placeholder validation")


def test_admin_select_slot_assigns_valid_slot() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    slot_repository = InMemoryCampaignSlotRepository()
    slot = slot_repository.add_slot(
        slot_id="slot_123",
        client_id="client_123",
        label="Starter",
        max_emails=500,
    )
    service = build_admin_service(
        campaign_repository=repository,
        slot_repository=slot_repository,
    )

    result = service.select_slot(campaign_id=campaign.id, slot_id=slot.id)

    assert result.campaign_id == campaign.id
    assert result.campaign_slot_id == slot.id
    assert result.slot_status == "assigned"
    assert result.slot_max_emails == 500


def test_admin_select_slot_blocks_cross_client_mismatch() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    slot_repository = InMemoryCampaignSlotRepository()
    slot_repository.add_slot(
        slot_id="slot_beta",
        client_id="client_beta",
        label="Other",
        max_emails=100,
    )
    service = build_admin_service(
        campaign_repository=repository,
        slot_repository=slot_repository,
    )

    try:
        service.select_slot(campaign_id=campaign.id, slot_id="slot_beta")
    except Exception as error:
        assert "not found for this client" in str(error)
    else:
        raise AssertionError("Expected cross-client mismatch rejection")


def test_admin_summary_returns_campaign_client_slot_and_readiness() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(
        campaign_id="campaign_123",
        client_id="client_123",
        status="ready",
        subject="Launch",
        preview_text="Preview line",
        body_html="<p>Hello</p>",
        body_text="Hello",
        current_step="review",
    )
    slot_repository = InMemoryCampaignSlotRepository()
    slot_repository.add_slot(
        slot_id="slot_123",
        client_id="client_123",
        label="Starter",
        max_emails=500,
        status="assigned",
        assigned_campaign_id=campaign.id,
    )
    campaign = repository.update_campaign(
        client_id=campaign.client_id,
        campaign_id=campaign.id,
        campaign_slot_id="slot_123",
    )
    contact = build_contact(contact_id="contact_1", email="one@example.test")
    service = build_admin_service(
        campaign_repository=repository,
        slot_repository=slot_repository,
        contacts=[contact],
        campaign_contacts={("client_123", campaign.id, contact.id)},
    )

    result = service.get_campaign_summary(campaign.id)

    assert result.campaign.id == campaign.id
    assert result.campaign.client_id == "client_123"
    assert result.campaign.preview_text == "Preview line"
    assert result.campaign.current_step == "review"
    assert result.campaign.content_ready is True
    assert result.campaign.contacts_ready is True
    assert result.campaign.review_ready is True
    assert result.client.id == "client_123"
    assert result.client.email == "client_123@example.test"
    assert result.slot.id == "slot_123"
    assert result.slot.label == "Starter"
    assert result.slot.max_emails == 500
    assert result.slot.status == "assigned"
    assert result.slot.limit_source == "campaign_slot"
    assert result.can_send is False
    assert result.can_send_when_enabled is True
    assert result.sending_enabled is False
    assert result.runtime.email_sending_enabled is False
    assert result.runtime.email_provider == "mailpit"
    assert result.runtime.provider_mode_label == "Sending disabled"
    assert result.runtime.real_send_available is False
    assert result.runtime.ses_live_validation_status is None
    assert result.runtime.provider_events_available is False
    assert result.runtime.mailpit_dev_mode is True
    assert result.warnings == [
        'EMAIL_SENDING_ENABLED is not exactly "true"; real dispatch is disabled.'
    ]


def test_admin_summary_endpoint_exposes_safe_runtime_shape_without_secrets() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    admin_service = build_admin_service(
        settings=Settings(
            email_sending_enabled_raw="true",
            email_provider="ses",
            smtp_host="smtp.secret.example",
            smtp_username="smtp-user-secret",
            smtp_password="smtp-password-secret",
            aws_ses_region="eu-west-1",
        ),
        campaign_repository=repository,
    )

    app.dependency_overrides[require_platform_admin] = build_admin_user
    app.dependency_overrides[get_admin_campaign_service] = lambda: admin_service

    try:
        response = TestClient(app).get(f"/admin/campaigns/{campaign.id}/summary")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["can_send"] is False
    assert payload["can_send_when_enabled"] is False
    assert payload["sending_enabled"] is True
    assert payload["runtime"] == {
        "email_sending_enabled": True,
        "email_provider": "ses",
        "provider_mode_label": "SES configured but live validation pending",
        "real_send_available": False,
        "ses_live_validation_status": "pending",
        "provider_events_available": False,
        "mailpit_dev_mode": False,
    }
    assert "smtp.secret.example" not in response.text
    assert "smtp-user-secret" not in response.text
    assert "smtp-password-secret" not in response.text
    assert "eu-west-1" not in response.text


def test_admin_summary_returns_recipients_summary() -> None:
    repository = InMemoryCampaignRepository(
        campaign_contacts={
            ("client_123", "campaign_123", "contact_valid"),
            ("client_123", "campaign_123", "contact_invalid"),
            ("client_123", "campaign_123", "contact_suppressed"),
        },
    )
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    contacts = [
        build_contact(contact_id="contact_valid", email="valid@example.test"),
        build_contact(contact_id="contact_invalid", email="invalid-email"),
        build_contact(contact_id="contact_suppressed", email="suppressed@example.test"),
    ]
    service = build_admin_service(
        campaign_repository=repository,
        contacts=contacts,
        campaign_contacts={
            ("client_123", campaign.id, "contact_valid"),
            ("client_123", campaign.id, "contact_invalid"),
            ("client_123", campaign.id, "contact_suppressed"),
        },
        suppression_records=[
            SuppressionRecord(
                id="suppression_1",
                client_id="client_123",
                email="suppressed@example.test",
                reason="manual",
                created_at=datetime.now(timezone.utc),
            )
        ],
    )

    result = service.get_campaign_summary(campaign.id)

    assert result.recipients.total == 3
    assert result.recipients.eligible == 1
    assert result.recipients.invalid == 1
    assert result.recipients.suppressed == 1
    assert result.recipients.blocked == 2


def test_admin_summary_aggregates_email_logs_simulated_and_queued() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    email_logs = InMemoryEmailLogRepository()
    email_logs.create_email_log(
        client_id="client_123",
        campaign_id=campaign.id,
        contact_id="contact_1",
        status="simulated",
    )
    email_logs.create_email_log(
        client_id="client_123",
        campaign_id=campaign.id,
        contact_id="contact_2",
        status="queued",
    )
    email_logs.create_email_log(
        client_id="client_123",
        campaign_id=campaign.id,
        contact_id="contact_3",
        status="queued",
    )
    service = build_admin_service(
        campaign_repository=repository,
        email_log_repository=email_logs,
    )

    result = service.get_campaign_summary(campaign.id)

    assert result.logs.simulated == 1
    assert result.logs.queued == 2
    assert result.logs.sent == 0
    assert result.logs.provider_events_available is False


def test_admin_summary_aggregates_blocked_sends() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    blocked_sends = InMemoryBlockedSendRepository()
    blocked_sends.create_blocked_send(
        client_id="client_123",
        campaign_id=campaign.id,
        contact_id="contact_2",
        reason="Campaign has no associated contacts.",
        decision="blocked",
    )
    blocked_sends.create_blocked_send(
        client_id="client_123",
        campaign_id=campaign.id,
        contact_id="contact_1",
        reason="Campaign content is not ready.",
        decision="blocked",
    )
    service = build_admin_service(
        campaign_repository=repository,
        blocked_send_repository=blocked_sends,
    )

    result = service.get_campaign_summary(campaign.id)

    assert result.blocked_sends.total == 2
    assert len(result.blocked_sends.latest) == 2
    assert result.blocked_sends.latest[0].campaign_name == "Launch campaign"
    assert {item.contact_id for item in result.blocked_sends.latest} == {
        "contact_1",
        "contact_2",
    }


def test_admin_review_returns_not_ready_when_content_or_contacts_are_missing() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(
        campaign_id="campaign_123",
        client_id="client_123",
        status="ready",
        subject="Subject only",
    )
    service = build_admin_service(campaign_repository=repository)

    result = service.review_campaign(campaign.id)

    assert result.allowed_to_send is False
    assert result.review_ready is False
    assert "Campaign content is not ready." in result.blocking_errors
    assert "Campaign has no associated contacts." in result.blocking_errors


def test_admin_review_not_ready_when_content_ready_is_false() -> None:
    repository = InMemoryCampaignRepository(
        campaign_contacts={("client_123", "campaign_123", "contact_1")},
    )
    campaign = repository.add_campaign(
        campaign_id="campaign_123",
        client_id="client_123",
        status="ready",
        subject="Launch",
        body_html="",
    )
    contact = build_contact(contact_id="contact_1", email="one@example.test")
    service = build_admin_service(
        campaign_repository=repository,
        contacts=[contact],
        campaign_contacts={("client_123", campaign.id, contact.id)},
    )

    result = service.review_campaign(campaign.id)

    assert result.allowed_to_send is False
    assert result.can_send_when_enabled is False
    assert result.content_ready is False
    assert result.contacts_ready is True
    assert result.review_ready is False
    assert "Campaign content is not ready." in result.blocking_errors


def test_admin_review_not_ready_when_contacts_ready_is_false() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(
        campaign_id="campaign_123",
        client_id="client_123",
        status="ready",
        subject="Launch",
        body_html="<p>Hello</p>",
        content_ready=True,
    )
    service = build_admin_service(campaign_repository=repository)

    result = service.review_campaign(campaign.id)

    assert result.allowed_to_send is False
    assert result.can_send_when_enabled is False
    assert result.content_ready is True
    assert result.contacts_ready is False
    assert result.review_ready is False
    assert "Campaign has no associated contacts." in result.blocking_errors


def test_admin_review_can_be_ready_with_email_sending_disabled() -> None:
    repository = InMemoryCampaignRepository(
        campaign_contacts={("client_123", "campaign_123", "contact_1")},
    )
    campaign = repository.add_campaign(
        campaign_id="campaign_123",
        client_id="client_123",
        status="ready",
        subject="Launch",
        body_html="<p>Hello</p>",
        body_text="Hello",
        content_ready=True,
    )
    contact = build_contact(contact_id="contact_1", email="one@example.test")
    service = build_admin_service(
        settings=Settings(email_sending_enabled_raw="false"),
        campaign_repository=repository,
        contacts=[contact],
        campaign_contacts={("client_123", campaign.id, contact.id)},
    )

    result = service.review_campaign(campaign.id)

    assert result.allowed_to_send is False
    assert result.can_send_when_enabled is True
    assert result.sending_enabled is False
    assert result.review_ready is True
    assert result.current_step == "review"
    assert result.warnings == [
        'EMAIL_SENDING_ENABLED is not exactly "true"; real dispatch is disabled.'
    ]


def test_admin_review_promotes_sendable_draft_campaign_to_ready() -> None:
    repository = InMemoryCampaignRepository(
        campaign_contacts={("client_123", "campaign_123", "contact_1")},
    )
    campaign = repository.add_campaign(
        campaign_id="campaign_123",
        client_id="client_123",
        status="draft",
        subject="Launch",
        body_html="<p>Hello</p>",
        body_text="Hello",
        content_ready=True,
        contacts_ready=True,
        current_step="review",
    )
    contact = build_contact(contact_id="contact_1", email="one@example.test")
    service = build_admin_service(
        campaign_repository=repository,
        contacts=[contact],
        campaign_contacts={("client_123", campaign.id, contact.id)},
    )

    result = service.review_campaign(campaign.id)

    assert result.status == "ready"
    assert result.allowed_to_send is False
    assert result.can_send_when_enabled is True
    assert result.review_ready is True
    assert result.blocking_errors == []
    assert result.warnings == [
        'EMAIL_SENDING_ENABLED is not exactly "true"; real dispatch is disabled.'
    ]

    updated = repository.get_by_id(campaign_id=campaign.id, client_id=campaign.client_id)
    assert updated is not None
    assert updated.status == "ready"
    assert updated.current_step == "review"
    assert updated.review_ready is True


def test_admin_review_keeps_real_send_disabled_warning_when_promoting_draft() -> None:
    repository = InMemoryCampaignRepository(
        campaign_contacts={("client_123", "campaign_123", "contact_1")},
    )
    campaign = repository.add_campaign(
        campaign_id="campaign_123",
        client_id="client_123",
        status="draft",
        subject="Launch",
        body_html="<p>Hello</p>",
        body_text="Hello",
        content_ready=True,
        contacts_ready=True,
        current_step="review",
    )
    contact = build_contact(contact_id="contact_1", email="one@example.test")
    service = build_admin_service(
        settings=Settings(email_sending_enabled_raw="false"),
        campaign_repository=repository,
        contacts=[contact],
        campaign_contacts={("client_123", campaign.id, contact.id)},
    )

    result = service.review_campaign(campaign.id)

    assert result.status == "ready"
    assert result.allowed_to_send is False
    assert result.can_send_when_enabled is True
    assert result.review_ready is True
    assert result.warnings == [
        'EMAIL_SENDING_ENABLED is not exactly "true"; real dispatch is disabled.'
    ]

def test_admin_simulate_send_endpoint_uses_simulation_service() -> None:
    repository = InMemoryCampaignRepository(
        campaign_contacts={
            ("client_123", "campaign_123", "contact_1"),
            ("client_123", "campaign_123", "contact_2"),
        }
    )
    campaign_record = repository.add_campaign(
        campaign_id="campaign_123",
        client_id="client_123",
        status="ready",
        subject="Launch",
        body_html="<p>Hello</p>",
        body_text="Hello",
        content_ready=True,
    )
    client = build_client()
    contacts = [
        build_contact(contact_id="contact_1", email="one@example.test"),
        build_contact(contact_id="contact_2", email="two@example.test"),
    ]
    preparation_service = FakePreparationService()
    admin_service = build_admin_service(
        campaign_repository=repository,
        clients=[client],
        contacts=contacts,
        campaign_contacts={
            ("client_123", campaign_record.id, "contact_1"),
            ("client_123", campaign_record.id, "contact_2"),
        },
    )
    simulation_service = build_simulation_service(
        campaign=to_client_campaign(campaign_record),
        client=client,
        contacts=contacts,
        campaign_contacts={
            ("client_123", campaign_record.id, "contact_1"),
            ("client_123", campaign_record.id, "contact_2"),
        },
        preparation_service=preparation_service,
    )

    app.dependency_overrides[require_platform_admin] = build_admin_user
    app.dependency_overrides[get_admin_campaign_service] = lambda: admin_service
    app.dependency_overrides[get_send_simulation_service] = lambda: simulation_service

    try:
        response = TestClient(app).post("/admin/campaigns/campaign_123/simulate-send")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "simulated"
    assert payload["listmonk_dispatched"] is False
    assert preparation_service.prepared_campaign_ids == ["campaign_123"]


def test_admin_send_passes_guard_and_respects_email_sending_disabled() -> None:
    repository = InMemoryCampaignRepository(
        campaign_contacts={("client_123", "campaign_123", "contact_1")},
    )
    campaign_record = repository.add_campaign(
        campaign_id="campaign_123",
        client_id="client_123",
        status="ready",
        subject="Launch",
        body_html="<p>Hello</p>",
        body_text="Hello",
        content_ready=True,
        contacts_ready=True,
        review_ready=True,
    )
    client = build_client()
    contact = build_contact(contact_id="contact_1", email="one@example.test")
    fake_listmonk = FakeListmonkClient()
    admin_service = build_admin_service(
        campaign_repository=repository,
        clients=[client],
        contacts=[contact],
        campaign_contacts={("client_123", campaign_record.id, contact.id)},
    )
    dispatch_service = build_dispatch_service(
        settings=Settings(email_sending_enabled_raw="false"),
        campaign=to_client_campaign(campaign_record),
        client=client,
        contacts=[contact],
        campaign_contacts={("client_123", campaign_record.id, contact.id)},
        fake_listmonk=fake_listmonk,
    )

    app.dependency_overrides[require_platform_admin] = build_admin_user
    app.dependency_overrides[get_admin_campaign_service] = lambda: admin_service
    app.dependency_overrides[get_campaign_dispatch_service] = lambda: dispatch_service

    try:
        response = TestClient(app).post("/admin/campaigns/campaign_123/send")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "blocked"
    assert payload["code"] == "email_sending_disabled"
    assert fake_listmonk.sent_campaign_ids == []


def test_admin_add_contacts_endpoint_attaches_valid_contacts_and_sets_flags() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(
        campaign_id="campaign_123",
        client_id="client_123",
        review_ready=True,
    )
    admin_service = build_admin_service(campaign_repository=repository)

    app.dependency_overrides[require_platform_admin] = build_admin_user
    app.dependency_overrides[get_admin_campaign_service] = lambda: admin_service

    try:
        response = TestClient(app).post(
            f"/admin/campaigns/{campaign.id}/contacts",
            json={
                "contacts": [
                    {"email": "One@Example.test", "metadata": {"nome": "One"}},
                    {"email": " two@example.test ", "metadata": {"nome": "Two", "cognome": "Bianchi"}},
                ]
            },
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["received"] == 2
    assert payload["created_contacts"] == 2
    assert payload["reused_contacts"] == 0
    assert payload["attached_contacts"] == 2
    assert payload["duplicate_contacts"] == 0
    assert payload["invalid_contacts"] == 0
    assert payload["contacts_ready"] is True

    updated = repository.get_by_id(campaign_id=campaign.id, client_id=campaign.client_id)
    assert updated is not None
    assert updated.contacts_ready is True
    assert updated.review_ready is False


def test_admin_add_contacts_normalizes_email_and_reuses_existing_client_contact() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    existing = build_contact(
        contact_id="contact_existing",
        client_id="client_123",
        email="person@example.test",
    )
    service = build_admin_service(
        campaign_repository=repository,
        contacts=[existing],
    )

    result = service.add_campaign_contacts(
        campaign_id=campaign.id,
        contacts=[
            AdminCampaignContactPayload(
                email="  PERSON@example.test  ",
                metadata={"nome": "Mario", "cognome": "Rossi"},
            ),
        ],
    )

    assert result.created_contacts == 0
    assert result.reused_contacts == 1
    assert result.attached_contacts == 1
    attached_contacts = service.contact_repository.list_campaign_contacts(
        client_id=campaign.client_id,
        campaign_id=campaign.id,
    )
    assert [contact.id for contact in attached_contacts] == [existing.id]
    assert attached_contacts[0].metadata == {"nome": "Mario", "cognome": "Rossi"}


def test_admin_add_contacts_rejects_invalid_email_without_creating_contact() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    service = build_admin_service(campaign_repository=repository)

    result = service.add_campaign_contacts(
        campaign_id=campaign.id,
        contacts=[
            AdminCampaignContactPayload(email="not-an-email"),
        ],
    )

    assert result.created_contacts == 0
    assert result.reused_contacts == 0
    assert result.attached_contacts == 0
    assert result.invalid_contacts == 1
    assert result.contacts_ready is False
    assert result.errors[0].reason == "invalid_email"
    assert service.contact_repository.count_campaign_contacts(
        client_id=campaign.client_id,
        campaign_id=campaign.id,
    ) == 0


def test_admin_add_contacts_requires_nome_metadata() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    service = build_admin_service(campaign_repository=repository)

    result = service.add_campaign_contacts(
        campaign_id=campaign.id,
        contacts=[
            AdminCampaignContactPayload(email="person@example.test", metadata={}),
        ],
    )

    assert result.created_contacts == 0
    assert result.attached_contacts == 0
    assert result.invalid_contacts == 1
    assert result.errors[0].reason == "nome_required"


def test_admin_add_contacts_deduplicates_payload_and_existing_association() -> None:
    repository = InMemoryCampaignRepository(
        campaign_contacts={("client_123", "campaign_123", "contact_1")},
    )
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    existing = build_contact(
        contact_id="contact_1",
        client_id="client_123",
        email="person@example.test",
    )
    service = build_admin_service(
        campaign_repository=repository,
        contacts=[existing],
        campaign_contacts={("client_123", campaign.id, existing.id)},
    )

    result = service.add_campaign_contacts(
        campaign_id=campaign.id,
        contacts=[
            AdminCampaignContactPayload(
                email="person@example.test",
                metadata={"nome": "Mario"},
            ),
            AdminCampaignContactPayload(
                email="PERSON@example.test",
                metadata={"nome": "Mario"},
            ),
        ],
    )

    assert result.created_contacts == 0
    assert result.reused_contacts == 1
    assert result.attached_contacts == 0
    assert result.duplicate_contacts == 2
    assert service.contact_repository.count_campaign_contacts(
        client_id=campaign.client_id,
        campaign_id=campaign.id,
    ) == 1


def test_admin_add_contacts_does_not_reuse_cross_client_contact() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    foreign_contact = build_contact(
        contact_id="contact_foreign",
        client_id="client_999",
        email="person@example.test",
    )
    service = build_admin_service(
        campaign_repository=repository,
        contacts=[foreign_contact],
    )

    result = service.add_campaign_contacts(
        campaign_id=campaign.id,
        contacts=[
            AdminCampaignContactPayload(
                email="person@example.test",
                metadata={"nome": "Mario"},
            ),
        ],
    )

    assert result.created_contacts == 1
    assert result.reused_contacts == 0
    assert result.attached_contacts == 1
    attached_contacts = service.contact_repository.list_campaign_contacts(
        client_id=campaign.client_id,
        campaign_id=campaign.id,
    )
    assert len(attached_contacts) == 1
    assert attached_contacts[0].client_id == campaign.client_id
    assert attached_contacts[0].id != foreign_contact.id


def test_admin_get_campaign_contacts_summary_classifies_contacts() -> None:
    repository = InMemoryCampaignRepository(
        campaign_contacts={
            ("client_123", "campaign_123", "contact_valid"),
            ("client_123", "campaign_123", "contact_invalid"),
            ("client_123", "campaign_123", "contact_suppressed"),
            ("client_123", "campaign_123", "contact_unsubscribed"),
            ("client_123", "campaign_123", "contact_blacklisted"),
            ("client_123", "campaign_123", "contact_bounced"),
        },
    )
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    contacts = [
        build_contact(
            contact_id="contact_valid",
            email="valid@example.test",
            status="sendable",
            metadata={"nome": "Valid", "cognome": "Person"},
        ),
        build_contact(
            contact_id="contact_invalid",
            email="invalid-email",
            status="sendable",
        ),
        build_contact(
            contact_id="contact_suppressed",
            email="suppressed@example.test",
            status="sendable",
        ),
        build_contact(
            contact_id="contact_unsubscribed",
            email="unsubscribed@example.test",
            status="unsubscribed",
        ),
        build_contact(
            contact_id="contact_blacklisted",
            email="blacklisted@example.test",
            status="blacklisted",
        ),
        build_contact(
            contact_id="contact_bounced",
            email="bounced@example.test",
            status="bounced",
        ),
    ]
    admin_service = build_admin_service(
        campaign_repository=repository,
        contacts=contacts,
        campaign_contacts={
            ("client_123", campaign.id, "contact_valid"),
            ("client_123", campaign.id, "contact_invalid"),
            ("client_123", campaign.id, "contact_suppressed"),
            ("client_123", campaign.id, "contact_unsubscribed"),
            ("client_123", campaign.id, "contact_blacklisted"),
            ("client_123", campaign.id, "contact_bounced"),
        },
        suppression_records=[
            SuppressionRecord(
                id="suppression_1",
                client_id="client_123",
                email="suppressed@example.test",
                reason="manual",
                created_at=datetime.now(timezone.utc),
            )
        ],
    )

    app.dependency_overrides[require_platform_admin] = build_admin_user
    app.dependency_overrides[get_admin_campaign_service] = lambda: admin_service

    try:
        response = TestClient(app).get(f"/admin/campaigns/{campaign.id}/contacts")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["campaign_id"] == campaign.id
    assert payload["client_id"] == campaign.client_id
    assert payload["total"] == 6
    assert payload["valid"] == 5
    assert payload["invalid"] == 1
    assert payload["suppressed"] == 1
    assert payload["unsubscribed"] == 1
    assert payload["blacklisted"] == 1
    assert payload["bounced"] == 1
    assert payload["eligible"] == 1
    assert payload["contacts_ready"] is True
    invalid_row = next(
        row for row in payload["contacts"] if row["contact_id"] == "contact_invalid"
    )
    valid_row = next(
        row for row in payload["contacts"] if row["contact_id"] == "contact_valid"
    )
    assert valid_row["metadata"] == {"nome": "Valid", "cognome": "Person"}
    assert invalid_row["is_valid"] is False
    assert invalid_row["is_eligible"] is False
    assert "invalid_email" in invalid_row["blocked_reasons"]


def test_admin_remove_campaign_contact_detaches_association_only() -> None:
    campaign_repository = InMemoryCampaignRepository()
    campaign = campaign_repository.add_campaign(
        contacts_ready=True,
        review_ready=True,
        current_step="review",
    )
    contact = build_contact(
        contact_id="contact_1",
        email="keep@example.test",
        metadata={"nome": "Mario"},
    )
    service = build_admin_service(
        campaign_repository=campaign_repository,
        contacts=[contact],
        campaign_contacts={("client_123", campaign.id, contact.id)},
    )

    result = service.remove_campaign_contact(
        campaign_id=campaign.id,
        contact_id=contact.id,
    )

    assert result.removed is True
    assert result.contact_id == contact.id
    assert result.contacts_ready is False
    assert service.contact_repository.get_by_id(contact.id) is not None
    assert service.contact_repository.count_campaign_contacts(
        client_id=campaign.client_id,
        campaign_id=campaign.id,
    ) == 0

    updated = service.repository.get_by_id(campaign_id=campaign.id)
    assert updated is not None
    assert updated.contacts_ready is False
    assert updated.review_ready is False
    assert updated.current_step == "recipients"


def test_admin_remove_campaign_contact_endpoint_returns_backend_owned_state() -> None:
    campaign_repository = InMemoryCampaignRepository()
    campaign = campaign_repository.add_campaign(
        contacts_ready=True,
        review_ready=True,
    )
    contact = build_contact(
        contact_id="contact_1",
        email="remove@example.test",
        metadata={"nome": "Giulia"},
    )
    admin_service = build_admin_service(
        campaign_repository=campaign_repository,
        contacts=[contact],
        campaign_contacts={("client_123", campaign.id, contact.id)},
    )

    app.dependency_overrides[require_platform_admin] = build_admin_user
    app.dependency_overrides[get_admin_campaign_service] = lambda: admin_service

    try:
        response = TestClient(app).delete(
            f"/admin/campaigns/{campaign.id}/contacts/{contact.id}"
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["campaign_id"] == campaign.id
    assert payload["client_id"] == campaign.client_id
    assert payload["contact_id"] == contact.id
    assert payload["removed"] is True
    assert payload["contacts_ready"] is False
    assert admin_service.contact_repository.get_by_id(contact.id) is not None


def test_admin_remove_campaign_contact_preflight_allows_delete() -> None:
    response = TestClient(app).options(
        "/admin/campaigns/campaign_123/contacts/contact_123",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "DELETE",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "DELETE" in response.headers["access-control-allow-methods"]
    assert "authorization" in response.headers["access-control-allow-headers"].lower()


def test_client_campaign_routes_remain_read_only() -> None:
    client = TestClient(app, raise_server_exceptions=False)

    assert client.post("/client/campaigns").status_code == 405
    assert client.patch("/client/campaigns/campaign_123").status_code == 405
    assert client.post("/client/campaigns/campaign_123/send").status_code == 404
    assert client.post("/client/campaigns/campaign_123/simulate-send").status_code == 404
    assert client.post("/client/campaigns/campaign_123/content").status_code == 404
    assert client.post("/client/campaigns/campaign_123/select-slot").status_code == 404
    assert client.post("/client/campaigns/campaign_123/contacts").status_code == 404
    assert client.post("/client/campaigns/campaign_123/contacts/import").status_code == 404
    assert client.delete("/client/campaigns/campaign_123/contacts/contact_123").status_code == 404
    assert client.patch("/client/campaigns/campaign_123/contacts/contact_123").status_code == 404
