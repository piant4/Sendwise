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
from app.repositories.campaign_slots import InMemoryCampaignSlotRepository
from app.repositories.campaign_sending_limits import InMemoryCampaignSendingLimitRepository
from app.repositories.clients import ClientCampaignRecord, ClientRecord
from app.repositories.contacts import ContactRecord, InMemoryContactRepository
from app.repositories.email_logs import InMemoryEmailLogRepository
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


class SesReadyPreparationService(FakePreparationService):
    def prepare_campaign(
        self,
        campaign_id: str,
        _current_user: AuthenticatedUser | None = None,
    ) -> dict[str, Any]:
        prepared = super().prepare_campaign(campaign_id, _current_user)
        unsubscribe_url = (
            "https://sendwise.example.test/unsubscribe/token"
            f"?campaign_id={campaign_id}"
        )
        prepared["content"]["unsubscribe_url"] = unsubscribe_url
        prepared["content"]["body"] = (
            "<html><body><p>Body</p>"
            f'<a href="{unsubscribe_url}">unsubscribe</a>'
            "</body></html>"
        )
        return prepared


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

    def update_campaign_status(
        self,
        *,
        client_id: str,
        campaign_id: str,
        status: str,
    ) -> ClientCampaignRecord | None:
        for index, campaign in enumerate(self._campaigns):
            if campaign.client_id != client_id or campaign.id != campaign_id:
                continue
            updated = campaign.model_copy(update={"status": status})
            self._campaigns[index] = updated
            return updated
        return None


def build_campaign(
    campaign_id: str = "campaign_123",
    client_id: str = "client_123",
    subject: str = "Launch",
    status: str = "ready",
    campaign_slot_id: str | None = None,
    content_ready: bool = True,
    contacts_ready: bool = True,
    review_ready: bool = True,
) -> ClientCampaignRecord:
    now = datetime.now(timezone.utc)
    return ClientCampaignRecord(
        id=campaign_id,
        client_id=client_id,
        name="Launch campaign",
        status=status,
        subject=subject,
        campaign_slot_id=campaign_slot_id,
        body_html="<p>Body</p>",
        content_ready=content_ready,
        contacts_ready=contacts_ready,
        review_ready=review_ready,
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
    environment: str = "development",
    email_provider: str = "mailpit",
    fake_listmonk: FakeListmonkClient | None = None,
    mapping_service: ListmonkMappingService | None = None,
    blocked_send_repository: InMemoryBlockedSendRepository | None = None,
    email_log_repository: InMemoryEmailLogRepository | None = None,
    campaigns: list[ClientCampaignRecord] | None = None,
    clients: list[ClientRecord] | None = None,
    contact_repository: InMemoryContactRepository | None = None,
    suppression_repository: InMemorySuppressionListRepository | None = None,
    campaign_slot_repository: InMemoryCampaignSlotRepository | None = None,
    campaign_limit_repository: InMemoryCampaignSendingLimitRepository | None = None,
    preparation_service: FakePreparationService | None = None,
    settings: Settings | None = None,
) -> CampaignDispatchService:
    selected_campaigns = [build_campaign()] if campaigns is None else campaigns
    selected_clients = [build_client()] if clients is None else clients
    selected_contact_repository = contact_repository or InMemoryContactRepository(
        contacts=[build_contact()],
        campaign_contacts={("client_123", "campaign_123", "contact_123")},
    )
    return CampaignDispatchService(
        settings=settings
        or Settings(
            email_sending_enabled_raw=email_sending_enabled_raw,
            environment=environment,
            email_provider=email_provider,
        ),
        guard=DeliverabilityGuard(),
        listmonk_client=fake_listmonk or FakeListmonkClient(),  # type: ignore[arg-type]
        mapping_service=mapping_service
        or ListmonkMappingService(InMemoryListmonkMappingRepository()),
        client_repository=FakeClientRepository(  # type: ignore[arg-type]
            selected_campaigns,
            selected_clients,
        ),
        campaign_slot_repository=campaign_slot_repository,
        campaign_limit_repository=campaign_limit_repository
        or InMemoryCampaignSendingLimitRepository(),
        contact_repository=selected_contact_repository,
        suppression_list_repository=suppression_repository
        or InMemorySuppressionListRepository(),
        blocked_send_repository=blocked_send_repository
        or InMemoryBlockedSendRepository(),
        email_log_repository=email_log_repository or InMemoryEmailLogRepository(),
        campaign_preparation_service=preparation_service,
    )


def build_multi_contact_repository() -> InMemoryContactRepository:
    return InMemoryContactRepository(
        contacts=[
            build_contact(contact_id="contact_1", email="one@example.test"),
            build_contact(contact_id="contact_2", email="two@example.test"),
        ],
        campaign_contacts={
            ("client_123", "campaign_123", "contact_1"),
            ("client_123", "campaign_123", "contact_2"),
        },
    )


def build_ready_ses_settings(**overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "email_sending_enabled_raw": "true",
        "email_provider": "ses",
        "environment": "development",
        "smtp_host": "email-smtp.eu-west-1.amazonaws.com",
        "smtp_port": 587,
        "smtp_username": "dummy",
        "smtp_password": "dummy",
        "smtp_tls_raw": "true",
        "smtp_from_email": "sender@example.test",
        "backend_public_url": "https://sendwise.example.test",
        "real_send_allowed_recipients_raw": "one@example.test,two@example.test",
        "real_send_require_allowed_recipients_raw": "true",
        "real_send_max_recipients": 1,
    }
    values.update(overrides)
    return Settings(**values)


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
    email_log_repository = InMemoryEmailLogRepository()
    service = build_dispatch_service(
        fake_listmonk=fake_listmonk,
        email_log_repository=email_log_repository,
        preparation_service=FakePreparationService(content_ready=False),
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "dispatch_blocked"
    assert result["code"] == "content_not_ready"
    assert "Compiled template missing." in result["reason"]
    assert result["listmonk_dispatched"] is False
    assert result["dispatch_attempted"] is False
    assert result["email_logs_created"] == 0
    assert email_log_repository.list_by_campaign("campaign_123") == []
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
    email_log_repository = InMemoryEmailLogRepository()
    service = build_dispatch_service(
        email_sending_enabled_raw="false",
        fake_listmonk=fake_listmonk,
        mapping_service=ListmonkMappingService(repository),
        blocked_send_repository=blocked_send_repository,
        email_log_repository=email_log_repository,
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "blocked"
    assert result["decision"] == "blocked"
    assert result["reason"] == 'EMAIL_SENDING_ENABLED is not exactly "true".'
    assert result["code"] == "email_sending_disabled"
    assert result["listmonk_dispatched"] is False
    assert result["client_id"] == "client_123"
    assert result["blocked_send_id"]
    assert result["dispatch_attempted"] is False
    assert result["email_logs_created"] == 0
    assert repository.list_by_client("client_123") == []
    blocked_sends = blocked_send_repository.list_by_campaign("campaign_123")
    assert len(blocked_sends) == 1
    assert blocked_sends[0].id == result["blocked_send_id"]
    assert blocked_sends[0].client_id == "client_123"
    assert blocked_sends[0].reason == f'{result["code"]}: {result["reason"]}'
    assert blocked_sends[0].decision == "blocked"
    assert email_log_repository.list_by_campaign("campaign_123") == []
    assert fake_listmonk.created_campaign_payloads == []
    assert fake_listmonk.sent_campaign_ids == []


def test_ses_send_blocked_when_email_sending_disabled() -> None:
    fake_listmonk = FakeListmonkClient()
    email_log_repository = InMemoryEmailLogRepository()
    service = build_dispatch_service(
        settings=Settings(
            email_sending_enabled_raw="false",
            email_provider="ses",
            environment="development",
            smtp_host="email-smtp.eu-west-1.amazonaws.com",
            smtp_port=587,
            smtp_username="dummy",
            smtp_password="dummy",
            smtp_tls_raw="true",
            smtp_from_email="sender@example.test",
            backend_public_url="https://sendwise.example.test",
            real_send_allowed_recipients_raw="person@example.test",
            real_send_max_recipients=1,
        ),
        fake_listmonk=fake_listmonk,
        email_log_repository=email_log_repository,
        preparation_service=FakePreparationService(content_ready=True),
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "blocked"
    assert result["code"] == "email_sending_disabled"
    assert result["provider"] == "ses"
    assert result["listmonk_dispatched"] is False
    assert email_log_repository.list_by_campaign("campaign_123") == []
    assert fake_listmonk.sent_campaign_ids == []


def test_ses_send_blocked_when_smtp_config_is_incomplete() -> None:
    fake_listmonk = FakeListmonkClient()
    email_log_repository = InMemoryEmailLogRepository()
    service = build_dispatch_service(
        settings=Settings(
            email_sending_enabled_raw="true",
            email_provider="ses",
            environment="development",
            smtp_host="",
            smtp_port=587,
            smtp_username="",
            smtp_password="",
            smtp_tls_raw="true",
            smtp_from_email="sender@example.test",
            backend_public_url="https://sendwise.example.test",
            real_send_allowed_recipients_raw="person@example.test",
            real_send_max_recipients=1,
        ),
        fake_listmonk=fake_listmonk,
        email_log_repository=email_log_repository,
        preparation_service=FakePreparationService(content_ready=True),
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "dispatch_blocked"
    assert result["code"] == "ses_smtp_config_incomplete"
    assert result["safety_checked"] is True
    assert result["safety_passed"] is False
    assert result["listmonk_prepared"] is False
    assert result["listmonk_dispatched"] is False
    assert email_log_repository.list_by_campaign("campaign_123") == []
    assert fake_listmonk.sent_campaign_ids == []


def test_ses_send_blocked_when_recipient_is_not_allowed() -> None:
    fake_listmonk = FakeListmonkClient()
    email_log_repository = InMemoryEmailLogRepository()
    service = build_dispatch_service(
        settings=Settings(
            email_sending_enabled_raw="true",
            email_provider="ses",
            environment="development",
            smtp_host="email-smtp.eu-west-1.amazonaws.com",
            smtp_port=587,
            smtp_username="dummy",
            smtp_password="dummy",
            smtp_tls_raw="true",
            smtp_from_email="sender@example.test",
            backend_public_url="https://sendwise.example.test",
            real_send_allowed_recipients_raw="allowed@example.test",
            real_send_max_recipients=1,
        ),
        fake_listmonk=fake_listmonk,
        email_log_repository=email_log_repository,
        preparation_service=FakePreparationService(content_ready=True),
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "dispatch_blocked"
    assert result["code"] == "real_send_recipient_not_allowed"
    assert result["allowed_recipients_checked"] is True
    assert result["listmonk_dispatched"] is False
    assert email_log_repository.list_by_campaign("campaign_123") == []
    assert fake_listmonk.sent_campaign_ids == []


def test_ses_send_blocked_when_eligible_count_exceeds_real_send_max() -> None:
    fake_listmonk = FakeListmonkClient()
    email_log_repository = InMemoryEmailLogRepository()
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
        settings=Settings(
            email_sending_enabled_raw="true",
            email_provider="ses",
            environment="development",
            smtp_host="email-smtp.eu-west-1.amazonaws.com",
            smtp_port=587,
            smtp_username="dummy",
            smtp_password="dummy",
            smtp_tls_raw="true",
            smtp_from_email="sender@example.test",
            backend_public_url="https://sendwise.example.test",
            real_send_allowed_recipients_raw="one@example.test,two@example.test",
            real_send_max_recipients=1,
        ),
        fake_listmonk=fake_listmonk,
        contact_repository=contact_repository,
        email_log_repository=email_log_repository,
        preparation_service=FakePreparationService(content_ready=True),
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "dispatch_blocked"
    assert result["code"] == "real_send_max_recipients_exceeded"
    assert result["eligible_contact_count"] == 2
    assert result["max_real_send_recipients"] == 1
    assert result["listmonk_dispatched"] is False
    assert email_log_repository.list_by_campaign("campaign_123") == []
    assert fake_listmonk.sent_campaign_ids == []


def test_ses_send_allows_multi_recipient_campaign_when_real_send_max_is_zero() -> None:
    fake_listmonk = FakeListmonkClient()
    email_log_repository = InMemoryEmailLogRepository()
    service = build_dispatch_service(
        settings=build_ready_ses_settings(
            real_send_max_recipients=0,
            real_send_require_allowed_recipients_raw="false",
            real_send_allowed_recipients_raw="",
        ),
        fake_listmonk=fake_listmonk,
        contact_repository=build_multi_contact_repository(),
        email_log_repository=email_log_repository,
        preparation_service=SesReadyPreparationService(content_ready=True),
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "queued"
    assert result["provider"] == "ses"
    assert result["eligible_contact_count"] == 2
    assert result["max_real_send_recipients"] is None
    assert result["allowed_recipients_checked"] is False
    assert result["listmonk_dispatched"] is True
    assert len(email_log_repository.list_by_campaign("campaign_123")) == 2
    assert fake_listmonk.sent_campaign_ids == ["lm_1"]


def test_ses_send_allows_multi_recipient_campaign_when_real_send_max_is_unset() -> None:
    fake_listmonk = FakeListmonkClient()
    service = build_dispatch_service(
        settings=build_ready_ses_settings(
            real_send_max_recipients=None,
            real_send_require_allowed_recipients_raw="false",
            real_send_allowed_recipients_raw="",
        ),
        fake_listmonk=fake_listmonk,
        contact_repository=build_multi_contact_repository(),
        preparation_service=SesReadyPreparationService(content_ready=True),
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "queued"
    assert result["eligible_contact_count"] == 2
    assert result["max_real_send_recipients"] is None
    assert fake_listmonk.sent_campaign_ids == ["lm_1"]


def test_ses_send_allows_multi_recipient_campaign_when_real_send_max_is_empty() -> None:
    fake_listmonk = FakeListmonkClient()
    service = build_dispatch_service(
        settings=build_ready_ses_settings(
            real_send_max_recipients="",
            real_send_require_allowed_recipients_raw="false",
            real_send_allowed_recipients_raw="",
        ),
        fake_listmonk=fake_listmonk,
        contact_repository=build_multi_contact_repository(),
        preparation_service=SesReadyPreparationService(content_ready=True),
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "queued"
    assert result["eligible_contact_count"] == 2
    assert result["max_real_send_recipients"] is None
    assert fake_listmonk.sent_campaign_ids == ["lm_1"]


def test_ses_send_allows_normal_recipients_when_allowlist_is_disabled() -> None:
    fake_listmonk = FakeListmonkClient()
    service = build_dispatch_service(
        settings=build_ready_ses_settings(
            real_send_max_recipients=0,
            real_send_require_allowed_recipients_raw="false",
            real_send_allowed_recipients_raw="allowed@example.test",
        ),
        fake_listmonk=fake_listmonk,
        contact_repository=build_multi_contact_repository(),
        preparation_service=SesReadyPreparationService(content_ready=True),
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "queued"
    assert result["allowed_recipients_checked"] is False
    assert fake_listmonk.sent_campaign_ids == ["lm_1"]


def test_ses_send_blocked_when_unsubscribe_public_url_is_not_ready() -> None:
    fake_listmonk = FakeListmonkClient()
    email_log_repository = InMemoryEmailLogRepository()
    service = build_dispatch_service(
        settings=Settings(
            email_sending_enabled_raw="true",
            email_provider="ses",
            environment="development",
            smtp_host="email-smtp.eu-west-1.amazonaws.com",
            smtp_port=587,
            smtp_username="dummy",
            smtp_password="dummy",
            smtp_tls_raw="true",
            smtp_from_email="sender@example.test",
            backend_public_url="http://localhost:8000",
            real_send_allowed_recipients_raw="person@example.test",
            real_send_max_recipients=1,
        ),
        fake_listmonk=fake_listmonk,
        email_log_repository=email_log_repository,
        preparation_service=FakePreparationService(content_ready=True),
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "dispatch_blocked"
    assert result["code"] == "unsubscribe_public_url_not_ready"
    assert result["unsubscribe_ready"] is False
    assert result["listmonk_prepared"] is False
    assert result["listmonk_dispatched"] is False
    assert email_log_repository.list_by_campaign("campaign_123") == []
    assert fake_listmonk.sent_campaign_ids == []


def test_ses_send_blocked_when_prepared_unsubscribe_link_is_missing() -> None:
    fake_listmonk = FakeListmonkClient()
    email_log_repository = InMemoryEmailLogRepository()
    service = build_dispatch_service(
        settings=Settings(
            email_sending_enabled_raw="true",
            email_provider="ses",
            environment="development",
            smtp_host="email-smtp.eu-west-1.amazonaws.com",
            smtp_port=587,
            smtp_username="dummy",
            smtp_password="dummy",
            smtp_tls_raw="true",
            smtp_from_email="sender@example.test",
            backend_public_url="https://sendwise.example.test",
            real_send_allowed_recipients_raw="person@example.test",
            real_send_max_recipients=1,
        ),
        fake_listmonk=fake_listmonk,
        email_log_repository=email_log_repository,
        preparation_service=FakePreparationService(content_ready=True),
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "dispatch_blocked"
    assert result["code"] == "unsubscribe_not_ready"
    assert result["listmonk_prepared"] is True
    assert result["listmonk_dispatched"] is False
    assert email_log_repository.list_by_campaign("campaign_123") == []
    assert fake_listmonk.sent_campaign_ids == []


def test_ses_send_allowed_only_after_safety_gate_passes() -> None:
    fake_listmonk = FakeListmonkClient()
    email_log_repository = InMemoryEmailLogRepository()

    class SesReadyPreparationService(FakePreparationService):
        def prepare_campaign(
            self,
            campaign_id: str,
            _current_user: AuthenticatedUser | None = None,
        ) -> dict[str, Any]:
            prepared = super().prepare_campaign(campaign_id, _current_user)
            unsubscribe_url = "https://sendwise.example.test/unsubscribe/token?campaign_id=campaign_123"
            prepared["content"]["unsubscribe_url"] = unsubscribe_url
            prepared["content"]["body"] = (
                "<html><body><p>Body</p>"
                f'<a href="{unsubscribe_url}">unsubscribe</a>'
                "</body></html>"
            )
            return prepared

    service = build_dispatch_service(
        settings=Settings(
            email_sending_enabled_raw="true",
            email_provider="ses",
            environment="development",
            smtp_host="email-smtp.eu-west-1.amazonaws.com",
            smtp_port=587,
            smtp_username="dummy",
            smtp_password="dummy",
            smtp_tls_raw="true",
            smtp_from_email="sender@example.test",
            backend_public_url="https://sendwise.example.test",
            real_send_allowed_recipients_raw="person@example.test",
            real_send_max_recipients=1,
        ),
        fake_listmonk=fake_listmonk,
        email_log_repository=email_log_repository,
        preparation_service=SesReadyPreparationService(content_ready=True),
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "queued"
    assert result["provider"] == "ses"
    assert result["safety_checked"] is True
    assert result["safety_passed"] is True
    assert result["allowed_recipients_checked"] is True
    assert result["eligible_contact_count"] == 1
    assert result["max_real_send_recipients"] == 1
    assert result["listmonk_dispatched"] is True
    assert result["real_send_attempted"] is True
    assert result["email_logs_created"] == 1
    assert result["unsubscribe_ready"] is True
    assert result["provider_events_ready"] is True
    assert fake_listmonk.sent_campaign_ids == ["lm_1"]
    logs = email_log_repository.list_by_campaign("campaign_123")
    assert [log.status for log in logs] == ["queued"]
    assert logs[0].provider_message_id is None
    assert "unsubscribe" in (logs[0].body or "")


def test_production_runtime_blocks_controlled_dispatch_before_listmonk() -> None:
    fake_listmonk = FakeListmonkClient()
    email_log_repository = InMemoryEmailLogRepository()
    service = build_dispatch_service(
        fake_listmonk=fake_listmonk,
        email_log_repository=email_log_repository,
        environment="production",
        email_provider="ses",
        preparation_service=FakePreparationService(content_ready=True),
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "dispatch_blocked"
    assert result["code"] == "controlled_runtime_required"
    assert result["listmonk_dispatched"] is False
    assert result["dispatch_attempted"] is False
    assert email_log_repository.list_by_campaign("campaign_123") == []
    assert fake_listmonk.created_campaign_payloads == []
    assert fake_listmonk.sent_campaign_ids == []


def test_paused_client_blocks_campaign_send_without_listmonk() -> None:
    fake_listmonk = FakeListmonkClient()
    blocked_send_repository = InMemoryBlockedSendRepository()
    email_log_repository = InMemoryEmailLogRepository()
    service = build_dispatch_service(
        fake_listmonk=fake_listmonk,
        clients=[build_client(status="paused")],
        blocked_send_repository=blocked_send_repository,
        email_log_repository=email_log_repository,
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "blocked"
    assert result["code"] == "client_status_not_sendable"
    assert result["listmonk_dispatched"] is False
    assert blocked_send_repository.list_by_campaign("campaign_123")
    assert email_log_repository.list_by_campaign("campaign_123") == []
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


def test_ready_campaign_with_no_usage_is_not_blocked_by_campaign_limits() -> None:
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
        contact_repository=contact_repository,
        preparation_service=FakePreparationService(content_ready=True),
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "queued"
    assert result["code"] == "dispatch_authorized"
    assert result["eligible_contact_count"] == 2
    assert result["daily_used"] == 2
    assert result["period_used"] == 2
    assert fake_listmonk.sent_campaign_ids == ["lm_existing"]


def test_campaign_slot_limit_blocks_oversized_batch() -> None:
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
    slot_repository = InMemoryCampaignSlotRepository()
    slot = slot_repository.add_slot(
        slot_id="slot_123",
        client_id="client_123",
        label="Starter",
        max_emails=5,
        status="assigned",
        assigned_campaign_id="campaign_123",
    )
    service = build_dispatch_service(
        fake_listmonk=fake_listmonk,
        clients=[build_client()],
        campaigns=[build_campaign(campaign_slot_id=slot.id)],
        contact_repository=contact_repository,
        campaign_slot_repository=slot_repository,
        preparation_service=FakePreparationService(content_ready=True),
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "queued"
    assert result["limit_source"] == "campaign_slot"
    assert result["limit_value"] == 5
    assert result["guard"]["limit_source"] == "campaign_slot"
    assert result["guard"]["limit_value"] == 5


def test_campaign_daily_limit_blocks_dispatch_when_reached() -> None:
    fake_listmonk = FakeListmonkClient()
    email_log_repository = InMemoryEmailLogRepository()
    email_log_repository.create_email_log(
        client_id="client_123",
        campaign_id="campaign_123",
        contact_id="contact_existing",
        status="queued",
    )
    contact_repository = InMemoryContactRepository(
        contacts=[build_contact(contact_id="contact_1", email="one@example.test")],
        campaign_contacts={("client_123", "campaign_123", "contact_1")},
    )
    limit_repository = InMemoryCampaignSendingLimitRepository()
    limit_repository.ensure_for_campaign(
        campaign_id="campaign_123",
        period_email_limit=1000,
        daily_email_limit=1,
    )
    service = build_dispatch_service(
        fake_listmonk=fake_listmonk,
        email_log_repository=email_log_repository,
        campaign_limit_repository=limit_repository,
        contact_repository=contact_repository,
        preparation_service=FakePreparationService(content_ready=True),
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "blocked"
    assert result["code"] == "campaign_daily_limit_reached"
    assert result["daily_limit"] == 1
    assert result["daily_used"] == 1
    assert result["daily_remaining"] == 0
    assert fake_listmonk.sent_campaign_ids == []


def test_campaign_period_limit_blocks_dispatch_when_reached() -> None:
    fake_listmonk = FakeListmonkClient()
    email_log_repository = InMemoryEmailLogRepository()
    email_log_repository.create_email_log(
        client_id="client_123",
        campaign_id="campaign_123",
        contact_id="contact_existing",
        status="queued",
    )
    contact_repository = InMemoryContactRepository(
        contacts=[build_contact(contact_id="contact_1", email="one@example.test")],
        campaign_contacts={("client_123", "campaign_123", "contact_1")},
    )
    limit_repository = InMemoryCampaignSendingLimitRepository()
    limit_repository.ensure_for_campaign(
        campaign_id="campaign_123",
        period_email_limit=1,
        daily_email_limit=50,
    )
    limit_repository.update_for_campaign(
        campaign_id="campaign_123",
        period_started_at=datetime.now(timezone.utc),
    )
    service = build_dispatch_service(
        fake_listmonk=fake_listmonk,
        email_log_repository=email_log_repository,
        campaign_limit_repository=limit_repository,
        contact_repository=contact_repository,
        campaigns=[build_campaign(status="running")],
        preparation_service=FakePreparationService(content_ready=True),
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "blocked"
    assert result["code"] == "campaign_period_limit_reached"
    assert result["period_limit"] == 1
    assert result["period_used"] == 1
    assert result["period_remaining"] == 0
    assert fake_listmonk.sent_campaign_ids == []


def test_campaign_limit_counts_existing_real_logs_regardless_of_current_status() -> None:
    fake_listmonk = FakeListmonkClient()
    email_log_repository = InMemoryEmailLogRepository()
    email_log_repository.create_email_log(
        client_id="client_123",
        campaign_id="campaign_123",
        contact_id="contact_existing_1",
        status="queued",
    )
    email_log_repository.create_email_log(
        client_id="client_123",
        campaign_id="campaign_123",
        contact_id="contact_existing_2",
        status="bounced",
    )
    contact_repository = InMemoryContactRepository(
        contacts=[build_contact(contact_id="contact_1", email="one@example.test")],
        campaign_contacts={("client_123", "campaign_123", "contact_1")},
    )
    limit_repository = InMemoryCampaignSendingLimitRepository()
    limit_repository.ensure_for_campaign(
        campaign_id="campaign_123",
        period_email_limit=1000,
        daily_email_limit=2,
    )
    service = build_dispatch_service(
        fake_listmonk=fake_listmonk,
        email_log_repository=email_log_repository,
        campaign_limit_repository=limit_repository,
        contact_repository=contact_repository,
        campaigns=[build_campaign(status="running")],
        preparation_service=FakePreparationService(content_ready=True),
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "blocked"
    assert result["code"] == "campaign_daily_limit_reached"
    assert result["daily_used"] == 2
    assert fake_listmonk.sent_campaign_ids == []


def test_campaign_slot_limit_block_persists_blocked_send() -> None:
    fake_listmonk = FakeListmonkClient()
    blocked_send_repository = InMemoryBlockedSendRepository()
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
    slot_repository = InMemoryCampaignSlotRepository()
    slot_repository.add_slot(
        slot_id="slot_123",
        client_id="client_123",
        label="Starter",
        max_emails=1,
        status="assigned",
        assigned_campaign_id="campaign_123",
    )
    service = build_dispatch_service(
        fake_listmonk=fake_listmonk,
        clients=[build_client(email_limit_per_campaign=99)],
        campaigns=[build_campaign(campaign_slot_id="slot_123")],
        contact_repository=contact_repository,
        campaign_slot_repository=slot_repository,
        blocked_send_repository=blocked_send_repository,
        preparation_service=FakePreparationService(content_ready=True),
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "blocked"
    assert result["code"] == "campaign_slot_limit_exceeded"
    assert result["limit_source"] == "campaign_slot"
    assert result["eligible_contact_count"] == 2
    blocked_sends = blocked_send_repository.list_by_campaign("campaign_123")
    assert len(blocked_sends) == 1
    assert blocked_sends[0].reason == f'{result["code"]}: {result["reason"]}'


def test_cross_client_slot_lookup_is_blocked() -> None:
    fake_listmonk = FakeListmonkClient()
    slot_repository = InMemoryCampaignSlotRepository()
    slot_repository.add_slot(
        slot_id="slot_beta",
        client_id="client_beta",
        label="Other",
        max_emails=10,
        status="assigned",
        assigned_campaign_id="campaign_beta",
    )
    service = build_dispatch_service(
        fake_listmonk=fake_listmonk,
        campaigns=[build_campaign(campaign_slot_id="slot_beta")],
        campaign_slot_repository=slot_repository,
        preparation_service=FakePreparationService(content_ready=True),
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "blocked"
    assert result["code"] == "campaign_slot_not_found"
    assert result["limit_source"] == "campaign_slot"
    assert fake_listmonk.sent_campaign_ids == []


def test_archived_campaign_slot_blocks_dispatch() -> None:
    fake_listmonk = FakeListmonkClient()
    slot_repository = InMemoryCampaignSlotRepository()
    slot_repository.add_slot(
        slot_id="slot_123",
        client_id="client_123",
        label="Starter",
        max_emails=10,
        status="archived",
        assigned_campaign_id="campaign_123",
    )
    service = build_dispatch_service(
        fake_listmonk=fake_listmonk,
        campaigns=[build_campaign(campaign_slot_id="slot_123")],
        campaign_slot_repository=slot_repository,
        preparation_service=FakePreparationService(content_ready=True),
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "blocked"
    assert result["code"] == "campaign_slot_archived"
    assert result["limit_source"] == "campaign_slot"
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
    email_log_repository = InMemoryEmailLogRepository()
    preparation_service = FakePreparationService(content_ready=True)
    service = build_dispatch_service(
        fake_listmonk=fake_listmonk,
        email_log_repository=email_log_repository,
        preparation_service=preparation_service,
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "queued"
    assert result["mode"] == "controlled_dev"
    assert result["provider"] == "mailpit"
    assert result["allowed"] is True
    assert result["decision"] == "authorized"
    assert result["dispatch_attempted"] is True
    assert result["real_send_attempted"] is True
    assert result["guard"]["eligible_contact_count"] == 1
    assert result["listmonk_dispatched"] is True
    assert result["content_ready"] is True
    assert result["email_logs_created"] == 1
    assert result["listmonk_mapping"]["listmonk_id"] == "lm_1"
    assert result["listmonk_mapping"]["created"] is True
    assert preparation_service.prepared_campaign_ids == ["campaign_123"]
    assert fake_listmonk.created_campaign_payloads == [
        {"name": "Launch campaign", "subject": "Launch"}
    ]
    assert fake_listmonk.sent_campaign_ids == ["lm_1"]
    logs = email_log_repository.list_by_campaign("campaign_123")
    assert len(logs) == 1
    assert logs[0].status == "queued"
    assert logs[0].provider_message_id is None
    assert logs[0].body == "<html><body><p>Body</p></body></html>"


def test_successful_dispatch_marks_campaign_running_and_starts_period() -> None:
    fake_listmonk = FakeListmonkClient()
    email_log_repository = InMemoryEmailLogRepository()
    limit_repository = InMemoryCampaignSendingLimitRepository()
    service = build_dispatch_service(
        fake_listmonk=fake_listmonk,
        email_log_repository=email_log_repository,
        campaign_limit_repository=limit_repository,
        preparation_service=FakePreparationService(content_ready=True),
    )

    result = service.send_campaign("campaign_123")
    client_repository = service.client_repository

    assert result["status"] == "queued"
    assert result["period_started_at"] is not None
    assert result["period_ends_at"] is not None
    assert limit_repository.get_by_campaign_id(campaign_id="campaign_123") is not None
    assert limit_repository.get_by_campaign_id(
        campaign_id="campaign_123"
    ).period_started_at is not None
    assert client_repository is not None
    assert client_repository.list_admin_campaigns()[0].status == "running"


def test_enabled_campaign_send_reuses_existing_mapping() -> None:
    fake_listmonk = FakeListmonkClient()
    email_log_repository = InMemoryEmailLogRepository()
    preparation_service = FakePreparationService(content_ready=True)
    mapping_service = ListmonkMappingService(InMemoryListmonkMappingRepository())
    mapping_service.ensure_campaign_mapping(
        client_id="client_123",
        campaign_id="campaign_123",
        listmonk_campaign_id="lm_existing",
    )
    service = build_dispatch_service(
        fake_listmonk=fake_listmonk,
        email_log_repository=email_log_repository,
        mapping_service=mapping_service,
        preparation_service=preparation_service,
    )

    result = service.send_campaign("campaign_123")

    assert result["status"] == "queued"
    assert result["email_logs_created"] == 1
    assert result["listmonk_mapping"]["created"] is False
    assert preparation_service.prepared_campaign_ids == ["campaign_123"]
    assert fake_listmonk.created_campaign_payloads == []
    assert fake_listmonk.sent_campaign_ids == ["lm_existing"]
    logs = email_log_repository.list_by_campaign("campaign_123")
    assert [log.status for log in logs] == ["queued"]


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


def test_listmonk_client_falls_back_to_session_login_after_403(monkeypatch: Any) -> None:
    def fake_request(*_args: object, **_kwargs: object) -> httpx.Response:
        request = httpx.Request("GET", "http://listmonk.test/api/health")
        return httpx.Response(403, request=request, json={"message": "forbidden"})

    class FakeSessionClient:
        def __init__(self, *args: object, **kwargs: object) -> None:
            self.logged_in = False

        def __enter__(self) -> "FakeSessionClient":
            return self

        def __exit__(self, *_args: object) -> None:
            return None

        def get(self, path: str) -> httpx.Response:
            request = httpx.Request("GET", f"http://listmonk.test{path}")
            return httpx.Response(
                200,
                request=request,
                text='<input type="hidden" name="nonce" value="nonce123" />',
            )

        def post(self, path: str, data: dict[str, str]) -> httpx.Response:
            assert path == "/admin/login"
            assert data["username"] == "admin"
            assert data["password"] == "change_me"
            assert data["nonce"] == "nonce123"
            self.logged_in = True
            request = httpx.Request("POST", f"http://listmonk.test{path}")
            return httpx.Response(200, request=request, text="ok")

        def request(
            self,
            method: str,
            path: str,
            *,
            json: dict[str, Any] | None = None,
            params: dict[str, Any] | None = None,
        ) -> httpx.Response:
            assert self.logged_in is True
            request = httpx.Request(method, f"http://listmonk.test{path}")
            return httpx.Response(200, request=request, json={"status": "ok"})

    monkeypatch.setattr(httpx, "request", fake_request)
    monkeypatch.setattr(httpx, "Client", FakeSessionClient)
    client = ListmonkClient(
        base_url="http://listmonk.test",
        username="admin",
        password="change_me",
        timeout_seconds=1,
    )

    assert client.health() == {"status": "ok"}
