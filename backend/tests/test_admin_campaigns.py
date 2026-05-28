from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core.auth import AuthenticatedUser, require_platform_admin
from app.core.config import Settings
from app.guard.deliverability_guard import DeliverabilityGuard
from app.main import app
from app.repositories.blocked_sends import InMemoryBlockedSendRepository
from app.repositories.campaign_slots import InMemoryCampaignSlotRepository
from app.repositories.campaigns import (
    CampaignRecord,
    InMemoryCampaignRepository,
    InMemoryEmailTemplateRepository,
)
from app.repositories.campaign_sending_limits import InMemoryCampaignSendingLimitRepository
from app.repositories.clients import ClientCampaignRecord, ClientRecord
from app.repositories.contacts import ContactRecord, InMemoryContactRepository
from app.repositories.email_logs import InMemoryEmailLogRepository
from app.repositories.listmonk_mappings import InMemoryListmonkMappingRepository
from app.repositories.provider_events import InMemoryProviderEventRepository
from app.repositories.sending_domain_warmup import (
    InMemorySendingDomainWarmupStateRepository,
)
from app.repositories.suppression_list import (
    InMemorySuppressionListRepository,
    SuppressionRecord,
)
from app.schemas.campaigns import AdminCampaignContactPayload
from app.services import campaigns as campaigns_module
from app.services.campaign_slots import CampaignSlotService
from app.services.campaigns import (
    AdminCampaignService,
    CampaignDispatchService,
    get_admin_campaign_service,
    get_campaign_dispatch_service,
)
from app.services.listmonk_mappings import ListmonkMappingService
from app.services.provider_events import ProviderEventIngestionService
from app.services.send_simulation import SendSimulationService, get_send_simulation_service
from app.services.unsubscribe import UnsubscribeService, UnsubscribeTokenService


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


class FakeListmonkClient:
    def __init__(self) -> None:
        self.created_campaign_payloads: list[dict[str, Any]] = []
        self.sent_campaign_ids: list[str] = []
        self.subscribers: dict[str, dict[str, Any]] = {}

    def create_campaign(self, payload: dict[str, Any]) -> dict[str, Any]:
        self.created_campaign_payloads.append(payload)
        return {"data": {"id": "lm_123"}}

    def trigger_campaign_send(self, campaign_id: str) -> dict[str, str]:
        self.sent_campaign_ids.append(campaign_id)
        return {"status": "mocked"}

    def get_subscriber(self, subscriber_id: int | str) -> dict[str, Any]:
        return self.subscribers.get(str(subscriber_id), {"data": {"lists": []}})


class FakePreparationService:
    def __init__(self) -> None:
        self.prepared_campaign_ids: list[str] = []
        self.prepared_followup_campaign_ids: list[str] = []
        self.mapping_service: ListmonkMappingService | None = None

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

    def prepare_followup_campaign(
        self,
        campaign_id: str,
        contact_ids: list[str],
        _current_user: AuthenticatedUser | None = None,
    ) -> dict[str, Any]:
        self.prepared_followup_campaign_ids.append(campaign_id)
        if self.mapping_service is not None:
            self.mapping_service.ensure_followup_campaign_list_mapping(
                client_id="client_123",
                campaign_id=campaign_id,
                listmonk_list_id="lm_followup_list",
            )
            self.mapping_service.ensure_followup_campaign_mapping(
                client_id="client_123",
                campaign_id=campaign_id,
                listmonk_campaign_id="lm_followup_campaign",
            )
        return {
            "status": "synced",
            "campaign_id": campaign_id,
            "listmonk_synced": True,
            "content_ready": True,
            "contact_summary": {
                "total_contacts": len(contact_ids),
                "synced_count": len(contact_ids),
                "skipped_count": 0,
                "failed_count": 0,
                "errors": [],
            },
            "content": {
                "template_name": "campaign_followup_business_db",
                "content_ready": True,
                "reason": None,
                "subject": "Follow-up launch",
                "preview_text": "",
                "body": "<html><body><p>Follow-up body</p></body></html>",
                "body_text": "Follow-up body",
                "unsubscribe_url": "http://localhost/unsubscribe?send_kind=followup",
                "client_name": "Alpha",
            },
            "list_mapping": {
                "entity_type": "campaign_followup",
                "entity_id": campaign_id,
                "listmonk_type": "list",
                "listmonk_id": "lm_followup_list",
                "created": True,
            },
            "listmonk_mapping": {
                "entity_type": "campaign_followup",
                "entity_id": campaign_id,
                "listmonk_type": "campaign",
                "listmonk_id": "lm_followup_campaign",
                "created": True,
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
    metadata: dict[str, Any] | None = None,
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
        metadata=metadata or {},
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


def add_processed_provider_event(
    repository: InMemoryProviderEventRepository,
    *,
    client_id: str,
    campaign_id: str,
    contact_id: str,
    email_log_id: str,
    event_type: str,
    send_kind: str = "campaign",
    event_key: str | None = None,
) -> None:
    now = datetime.now(timezone.utc)
    record, _created = repository.create_or_get_event(
        client_id=client_id,
        campaign_id=campaign_id,
        contact_id=contact_id,
        email_log_id=email_log_id,
        provider="mailgun",
        source="test",
        provider_event_id=f"{campaign_id}-{contact_id}-{event_type}",
        event_key=event_key or f"{campaign_id}:{contact_id}:{event_type}",
        event_type=event_type,
        send_kind=send_kind,
        payload={},
        occurred_at=now,
    )
    repository.mark_processed(event_id=record.id, processed_at=now)


def add_domain_history(
    *,
    email_log_repository: InMemoryEmailLogRepository,
    provider_event_repository: InMemoryProviderEventRepository,
    sending_domain: str = "send.mailerpro.it",
    accepted_count: int,
    delivered_count: int,
    complaint_count: int = 0,
    hard_bounce_count: int = 0,
    unsubscribe_count: int = 0,
) -> None:
    logs = [
        email_log_repository.create_email_log(
            client_id="client_history",
            campaign_id="campaign_history",
            contact_id=f"history_contact_{index}",
            status="sent",
            sending_domain=sending_domain,
            created_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )
        for index in range(accepted_count)
    ]
    for index, log in enumerate(logs):
        add_processed_provider_event(
            provider_event_repository,
            client_id="client_history",
            campaign_id="campaign_history",
            contact_id=f"history_contact_{index}",
            email_log_id=log.id,
            event_type="accepted",
            event_key=f"{sending_domain}:accepted:{index}",
        )
    for index, log in enumerate(logs[:delivered_count]):
        add_processed_provider_event(
            provider_event_repository,
            client_id="client_history",
            campaign_id="campaign_history",
            contact_id=f"history_delivered_{index}",
            email_log_id=log.id,
            event_type="delivered",
            event_key=f"{sending_domain}:delivered:{index}",
        )
    offset = 0
    for index, log in enumerate(logs[offset : offset + complaint_count]):
        add_processed_provider_event(
            provider_event_repository,
            client_id="client_history",
            campaign_id="campaign_history",
            contact_id=f"history_complaint_{index}",
            email_log_id=log.id,
            event_type="complaint",
            event_key=f"{sending_domain}:complaint:{index}",
        )
    offset += complaint_count
    for index, log in enumerate(logs[offset : offset + hard_bounce_count]):
        add_processed_provider_event(
            provider_event_repository,
            client_id="client_history",
            campaign_id="campaign_history",
            contact_id=f"history_bounce_{index}",
            email_log_id=log.id,
            event_type="hard_bounce",
            event_key=f"{sending_domain}:hard_bounce:{index}",
        )
    offset += hard_bounce_count
    for index, log in enumerate(logs[offset : offset + unsubscribe_count]):
        add_processed_provider_event(
            provider_event_repository,
            client_id="client_history",
            campaign_id="campaign_history",
            contact_id=f"history_unsubscribe_{index}",
            email_log_id=log.id,
            event_type="unsubscribe",
            event_key=f"{sending_domain}:unsubscribe:{index}",
        )


def build_ready_listmonk_settings(**overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "email_sending_enabled_raw": "true",
        "email_provider": "listmonk",
        "environment": "staging",
        "smtp_host": "smtp.mailgun.org",
        "smtp_port": 587,
        "smtp_username": "configured",
        "smtp_password": "configured",
        "smtp_tls_raw": "true",
        "smtp_from_email": "sendwise@send.mailerpro.it",
    }
    values.update(overrides)
    return Settings(**values)


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
    client_campaigns: list[ClientCampaignRecord] | None = None,
    contacts: list[ContactRecord] | None = None,
    campaign_contacts: set[tuple[str, str, str]] | None = None,
    suppression_records: list[SuppressionRecord] | None = None,
    blocked_send_repository: InMemoryBlockedSendRepository | None = None,
    email_log_repository: InMemoryEmailLogRepository | None = None,
    provider_event_repository: InMemoryProviderEventRepository | None = None,
    campaign_limit_repository: InMemoryCampaignSendingLimitRepository | None = None,
    email_template_repository: InMemoryEmailTemplateRepository | None = None,
    sending_domain_warmup_repository: InMemorySendingDomainWarmupStateRepository | None = None,
) -> AdminCampaignService:
    repository = campaign_repository or InMemoryCampaignRepository()
    slots = slot_repository or InMemoryCampaignSlotRepository()
    resolved_settings = settings or Settings(
        email_sending_enabled_raw="false",
        email_provider="mailpit",
        smtp_host="mailpit",
        smtp_port=1025,
        smtp_username="",
        smtp_password="",
        smtp_tls_raw="false",
        smtp_from_email="",
        frontend_url="http://localhost:3000",
        backend_public_url="http://localhost:8000",
        clerk_secret_key="",
        real_send_allowed_recipients_raw="",
        real_send_require_allowed_recipients_raw="true",
        real_send_max_recipients=0,
        real_send_environments_raw="development,staging,test",
    )
    return AdminCampaignService(
        settings=resolved_settings,
        guard=DeliverabilityGuard(),
        repository=repository,
        campaign_limit_repository=campaign_limit_repository
        or InMemoryCampaignSendingLimitRepository(),
        client_repository=FakeClientRepository(
            clients=clients or [build_client()],
            campaigns=client_campaigns,
        ),  # type: ignore[arg-type]
        campaign_slot_service=CampaignSlotService(
            slot_repository=slots,
            campaign_repository=repository,
        ),
        campaign_slot_repository=slots,
        template_repository=email_template_repository or InMemoryEmailTemplateRepository(),
        contact_repository=InMemoryContactRepository(
            contacts=contacts or [],
            campaign_contacts=campaign_contacts or set(),
        ),
        suppression_list_repository=InMemorySuppressionListRepository(
            records=suppression_records or []
        ),
        blocked_send_repository=blocked_send_repository or InMemoryBlockedSendRepository(),
        email_log_repository=email_log_repository or InMemoryEmailLogRepository(),
        provider_event_repository=provider_event_repository
        or InMemoryProviderEventRepository(),
        sending_domain_warmup_repository=(
            sending_domain_warmup_repository
            or InMemorySendingDomainWarmupStateRepository()
        ),
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
    campaign_limit_repository: InMemoryCampaignSendingLimitRepository | None = None,
    mapping_service: ListmonkMappingService | None = None,
    suppression_repository: InMemorySuppressionListRepository | None = None,
    email_log_repository: InMemoryEmailLogRepository | None = None,
    provider_event_repository: InMemoryProviderEventRepository | None = None,
    sending_domain_warmup_repository: InMemorySendingDomainWarmupStateRepository | None = None,
) -> CampaignDispatchService:
    contact_repository = InMemoryContactRepository(
        contacts=contacts,
        campaign_contacts=campaign_contacts,
    )
    campaign_repository = InMemoryCampaignRepository(
        campaigns=[CampaignRecord(**campaign.model_dump())],
        campaign_contacts=set(campaign_contacts),
    )
    selected_mapping_service = mapping_service or ListmonkMappingService(
        InMemoryListmonkMappingRepository()
    )
    selected_suppression_repository = (
        suppression_repository or InMemorySuppressionListRepository()
    )
    selected_email_log_repository = email_log_repository or InMemoryEmailLogRepository()
    selected_provider_event_repository = (
        provider_event_repository or InMemoryProviderEventRepository()
    )
    selected_preparation_service = preparation_service or FakePreparationService()
    if hasattr(selected_preparation_service, "mapping_service"):
        selected_preparation_service.mapping_service = selected_mapping_service  # type: ignore[attr-defined]
    unsubscribe_service = UnsubscribeService(
        settings=settings,
        token_service=UnsubscribeTokenService(settings),
        contact_repository=contact_repository,
        provider_event_service=ProviderEventIngestionService(
            settings=settings,
            provider_event_repository=selected_provider_event_repository,
            campaign_repository=campaign_repository,
            contact_repository=contact_repository,
            email_log_repository=selected_email_log_repository,
            suppression_list_repository=selected_suppression_repository,
        ),
    )
    return CampaignDispatchService(
        settings=settings,
        guard=DeliverabilityGuard(),
        listmonk_client=fake_listmonk or FakeListmonkClient(),  # type: ignore[arg-type]
        mapping_service=selected_mapping_service,
        client_repository=FakeClientRepository(  # type: ignore[arg-type]
            clients=[client],
            campaigns=[campaign],
        ),
        campaign_slot_repository=InMemoryCampaignSlotRepository(),
        campaign_limit_repository=campaign_limit_repository
        or InMemoryCampaignSendingLimitRepository(),
        contact_repository=contact_repository,
        suppression_list_repository=selected_suppression_repository,
        blocked_send_repository=InMemoryBlockedSendRepository(),
        email_log_repository=selected_email_log_repository,
        provider_event_repository=selected_provider_event_repository,
        sending_domain_warmup_repository=(
            sending_domain_warmup_repository
            or InMemorySendingDomainWarmupStateRepository()
        ),
        campaign_preparation_service=selected_preparation_service,
        unsubscribe_service=unsubscribe_service,
    )


def build_native_reconciliation_stack(
    *,
    subscriber_payload: dict[str, Any],
    campaign_id: str = "campaign_123",
    client_id: str = "client_123",
    contact_id: str = "contact_123",
    listmonk_list_id: str = "1",
    subscriber_id: str = "sub_123",
) -> tuple[
    AdminCampaignService,
    CampaignDispatchService,
    InMemorySuppressionListRepository,
    InMemoryEmailLogRepository,
    InMemoryProviderEventRepository,
    FakePreparationService,
    FakeListmonkClient,
]:
    campaign = to_client_campaign(
        InMemoryCampaignRepository().add_campaign(
            campaign_id=campaign_id,
            client_id=client_id,
            status="ready",
            content_ready=True,
            contacts_ready=True,
            review_ready=True,
        )
    )
    client = build_client(client_id=client_id)
    contact = build_contact(
        contact_id=contact_id,
        client_id=client_id,
        email="person@example.test",
    )
    mapping_service = ListmonkMappingService(InMemoryListmonkMappingRepository())
    mapping_service.ensure_campaign_list_mapping(
        client_id=client_id,
        campaign_id=campaign_id,
        listmonk_list_id=listmonk_list_id,
    )
    mapping_service.ensure_contact_subscriber_mapping(
        client_id=client_id,
        contact_id=contact_id,
        listmonk_subscriber_id=subscriber_id,
    )
    suppression_repository = InMemorySuppressionListRepository()
    email_log_repository = InMemoryEmailLogRepository()
    provider_event_repository = InMemoryProviderEventRepository()
    preparation_service = FakePreparationService()
    fake_listmonk = FakeListmonkClient()
    fake_listmonk.subscribers[subscriber_id] = subscriber_payload
    campaign_repository = InMemoryCampaignRepository(
        campaigns=[CampaignRecord(**campaign.model_dump())],
        campaign_contacts={(client_id, campaign_id, contact_id)},
    )
    admin_service = build_admin_service(
        settings=build_ready_listmonk_settings(),
        campaign_repository=campaign_repository,
        clients=[client],
        contacts=[contact],
        campaign_contacts={(client_id, campaign_id, contact_id)},
        suppression_records=suppression_repository._records,
        email_log_repository=email_log_repository,
        provider_event_repository=provider_event_repository,
    )
    dispatch_service = build_dispatch_service(
        settings=build_ready_listmonk_settings(),
        campaign=campaign,
        client=client,
        contacts=[contact],
        campaign_contacts={(client_id, campaign_id, contact_id)},
        fake_listmonk=fake_listmonk,
        preparation_service=preparation_service,
        mapping_service=mapping_service,
        suppression_repository=suppression_repository,
        email_log_repository=email_log_repository,
        provider_event_repository=provider_event_repository,
    )
    return (
        admin_service,
        dispatch_service,
        suppression_repository,
        email_log_repository,
        provider_event_repository,
        preparation_service,
        fake_listmonk,
    )


def test_admin_native_reconciliation_requires_platform_admin() -> None:
    app.dependency_overrides.clear()
    response = TestClient(app).post(
        "/admin/campaigns/campaign_123/reconcile-native-unsubscribe"
    )
    app.dependency_overrides.clear()

    assert response.status_code in {401, 403}


def test_admin_native_reconciliation_applies_suppression_without_dispatch() -> None:
    (
        admin_service,
        dispatch_service,
        suppression_repository,
        email_log_repository,
        provider_event_repository,
        preparation_service,
        fake_listmonk,
    ) = build_native_reconciliation_stack(
        subscriber_payload={
            "data": {"lists": [{"id": 1, "subscription_status": "unsubscribed"}]}
        }
    )
    app.dependency_overrides[require_platform_admin] = build_admin_user
    app.dependency_overrides[get_admin_campaign_service] = lambda: admin_service
    app.dependency_overrides[get_campaign_dispatch_service] = lambda: dispatch_service

    try:
        response = TestClient(app).post(
            "/admin/campaigns/campaign_123/reconcile-native-unsubscribe"
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {
        "campaign_id": "campaign_123",
        "status": "applied",
        "reconciliation_attempted": True,
        "native_unsubscribe_found": True,
        "suppression_applied": True,
        "already_suppressed": False,
        "code": "native_unsubscribe_suppression_applied",
        "severity": "info",
    }
    assert len(suppression_repository._records) == 1
    assert suppression_repository._records[0].reason == "unsubscribe"
    assert email_log_repository.list_by_campaign("campaign_123") == []
    assert provider_event_repository.list_by_campaign(
        client_id="client_123",
        campaign_id="campaign_123",
    ) == []
    assert preparation_service.prepared_campaign_ids == []
    assert fake_listmonk.created_campaign_payloads == []
    assert fake_listmonk.sent_campaign_ids == []


def test_admin_native_reconciliation_replay_is_idempotent() -> None:
    (
        _admin_service,
        dispatch_service,
        suppression_repository,
        _email_log_repository,
        provider_event_repository,
        _preparation_service,
        _fake_listmonk,
    ) = build_native_reconciliation_stack(
        subscriber_payload={
            "data": {"lists": [{"id": 1, "subscription_status": "unsubscribed"}]}
        }
    )

    first = dispatch_service.reconcile_native_listmonk_unsubscribe_no_dispatch(
        "campaign_123"
    )
    second = dispatch_service.reconcile_native_listmonk_unsubscribe_no_dispatch(
        "campaign_123"
    )

    assert first["suppression_applied"] is True
    assert second["status"] == "applied"
    assert second["already_suppressed"] is True
    assert len(suppression_repository._records) == 1
    assert provider_event_repository.list_by_campaign(
        client_id="client_123",
        campaign_id="campaign_123",
    ) == []


def test_admin_native_reconciliation_confirmed_membership_does_not_suppress() -> None:
    (
        _admin_service,
        dispatch_service,
        suppression_repository,
        _email_log_repository,
        _provider_event_repository,
        _preparation_service,
        _fake_listmonk,
    ) = build_native_reconciliation_stack(
        subscriber_payload={
            "data": {"lists": [{"id": 1, "subscription_status": "confirmed"}]}
        }
    )

    result = dispatch_service.reconcile_native_listmonk_unsubscribe_no_dispatch(
        "campaign_123"
    )

    assert result["status"] == "not_applied"
    assert result["native_unsubscribe_found"] is False
    assert suppression_repository._records == []


def test_admin_native_reconciliation_unsafe_listmonk_state_does_not_suppress() -> None:
    unsafe_payloads = [
        {"data": {"lists": [{"id": 999, "subscription_status": "unsubscribed"}]}},
        {"data": {"lists": [{"id": 99, "subscription_status": "unsubscribed"}]}},
        {"data": {"lists": [{"id": 2, "subscription_status": "unsubscribed"}]}},
        {"data": {"lists": [{"id": 1}]}},
    ]

    for index, payload in enumerate(unsafe_payloads):
        (
            _admin_service,
            dispatch_service,
            suppression_repository,
            _email_log_repository,
            _provider_event_repository,
            _preparation_service,
            _fake_listmonk,
        ) = build_native_reconciliation_stack(
            subscriber_payload=payload,
            campaign_id=f"campaign_{index}",
        )
        if index == 1:
            assert dispatch_service.mapping_service is not None
            dispatch_service.mapping_service.ensure_campaign_list_mapping(
                client_id="client_other",
                campaign_id="campaign_other",
                listmonk_list_id="99",
            )
        if index == 2:
            assert dispatch_service.mapping_service is not None
            dispatch_service.mapping_service.ensure_campaign_list_mapping(
                client_id="client_123",
                campaign_id="campaign_other",
                listmonk_list_id="2",
            )

        result = dispatch_service.reconcile_native_listmonk_unsubscribe_no_dispatch(
            f"campaign_{index}"
        )

        assert result["suppression_applied"] is False
        assert suppression_repository._records == []


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
    assert created.period_email_limit == 1000
    assert created.daily_email_limit == 50


def test_admin_create_campaign_persists_default_sending_limits() -> None:
    repository = InMemoryCampaignRepository()
    limit_repository = InMemoryCampaignSendingLimitRepository()
    service = build_admin_service(
        campaign_repository=repository,
        campaign_limit_repository=limit_repository,
    )

    created = service.create_campaign(
        client_id="client_123",
        name="Launch campaign",
        subject="Spring launch",
    )

    limits = limit_repository.get_by_campaign_id(campaign_id=created.campaign_id)

    assert limits is not None
    assert limits.period_email_limit == 1000
    assert limits.daily_email_limit == 50


def test_admin_create_campaign_persists_followup_limits() -> None:
    repository = InMemoryCampaignRepository()
    limit_repository = InMemoryCampaignSendingLimitRepository()
    service = build_admin_service(
        campaign_repository=repository,
        campaign_limit_repository=limit_repository,
    )

    created = service.create_campaign(
        client_id="client_123",
        name="Launch campaign",
        subject="Spring launch",
        followup_enabled=True,
        followup_daily_limit=12,
        followup_monthly_limit=120,
        followup_delay_value=3,
        followup_delay_unit="days",
    )

    limits = limit_repository.get_by_campaign_id(campaign_id=created.campaign_id)

    assert created.followup_enabled is True
    assert created.followup_daily_limit == 12
    assert created.followup_monthly_limit == 120
    assert created.followup_delay_value == 3
    assert created.followup_delay_unit == "days"
    assert limits is not None
    assert limits.followup_enabled is True
    assert limits.followup_daily_limit == 12
    assert limits.followup_monthly_limit == 120
    assert limits.followup_delay_value == 3
    assert limits.followup_delay_unit == "days"


def test_admin_update_campaign_limits() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    limit_repository = InMemoryCampaignSendingLimitRepository()
    service = build_admin_service(
        campaign_repository=repository,
        campaign_limit_repository=limit_repository,
    )

    updated = service.update_campaign(
        campaign_id=campaign.id,
        period_email_limit=2400,
        daily_email_limit=120,
    )

    limits = limit_repository.get_by_campaign_id(campaign_id=campaign.id)

    assert updated.period_email_limit == 2400
    assert updated.daily_email_limit == 120
    assert limits is not None
    assert limits.period_email_limit == 2400
    assert limits.daily_email_limit == 120


def test_admin_update_campaign_followup_limits() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    limit_repository = InMemoryCampaignSendingLimitRepository()
    service = build_admin_service(
        campaign_repository=repository,
        campaign_limit_repository=limit_repository,
    )

    updated = service.update_campaign(
        campaign_id=campaign.id,
        followup_enabled=True,
        followup_daily_limit=15,
        followup_monthly_limit=180,
        followup_delay_value=48,
        followup_delay_unit="hours",
    )

    limits = limit_repository.get_by_campaign_id(campaign_id=campaign.id)

    assert updated.followup_enabled is True
    assert updated.followup_daily_limit == 15
    assert updated.followup_monthly_limit == 180
    assert updated.followup_delay_value == 48
    assert updated.followup_delay_unit == "hours"
    assert limits is not None
    assert limits.followup_enabled is True
    assert limits.followup_daily_limit == 15
    assert limits.followup_monthly_limit == 180
    assert limits.followup_delay_value == 48
    assert limits.followup_delay_unit == "hours"


def test_admin_update_campaign_rejects_non_positive_limits() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    service = build_admin_service(campaign_repository=repository)

    try:
        service.update_campaign(
            campaign_id=campaign.id,
            period_email_limit=0,
        )
    except HTTPException as error:
        assert error.status_code == 422
        assert error.detail == "period_email_limit must be greater than zero."
    else:
        raise AssertionError("Expected campaign period limit validation error")


def test_admin_update_campaign_rejects_invalid_followup_limits() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    service = build_admin_service(campaign_repository=repository)

    try:
        service.update_campaign(
            campaign_id=campaign.id,
            followup_enabled=True,
            followup_daily_limit=0,
            followup_monthly_limit=5,
            followup_delay_value=12,
            followup_delay_unit="hours",
        )
    except HTTPException as error:
        assert error.status_code == 422
        assert error.detail == "followup_daily_limit must be greater than zero."
    else:
        raise AssertionError("Expected follow-up daily limit validation error")


def test_admin_update_campaign_rejects_unsafe_followup_delay() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    service = build_admin_service(campaign_repository=repository)

    try:
        service.update_campaign(
            campaign_id=campaign.id,
            followup_enabled=True,
            followup_daily_limit=5,
            followup_monthly_limit=20,
            followup_delay_value=12,
            followup_delay_unit="hours",
        )
    except HTTPException as error:
        assert error.status_code == 422
        assert error.detail == "followup_delay_value must be at least 24 hours."
    else:
        raise AssertionError("Expected follow-up delay validation error")


def test_admin_update_campaign_rejects_negative_followup_limit() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    service = build_admin_service(campaign_repository=repository)

    try:
        service.update_campaign(
            campaign_id=campaign.id,
            followup_enabled=True,
            followup_daily_limit=-1,
            followup_monthly_limit=20,
            followup_delay_value=2,
            followup_delay_unit="days",
        )
    except HTTPException as error:
        assert error.status_code == 422
        assert error.detail == "followup_daily_limit cannot be negative."
    else:
        raise AssertionError("Expected negative follow-up limit validation error")


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


def test_admin_content_update_persists_followup_content_and_readiness() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    service = build_admin_service(campaign_repository=repository)

    updated = service.update_campaign_content(
        campaign_id=campaign.id,
        subject="Updated subject",
        preview_text="Preview line",
        body_html="<p>Hello</p>",
        body_text="Hello",
        followup_subject="Follow-up subject",
        followup_body_html="<p>Follow-up {{unsubscribe_url}}</p>",
        followup_body_text="Follow-up",
        current_step="review",
    )

    limits = service.campaign_limit_repository.ensure_for_campaign(campaign_id=campaign.id)
    assert updated.followup_subject == "Follow-up subject"
    assert updated.followup_body_html == "<p>Follow-up {{unsubscribe_url}}</p>"
    assert updated.followup_body_text == "Follow-up"
    assert updated.followup_content_ready is True
    assert limits.followup_subject == "Follow-up subject"
    assert limits.followup_body_html == "<p>Follow-up {{unsubscribe_url}}</p>"
    assert limits.followup_body_text == "Follow-up"


def test_review_campaign_reports_followup_content_not_ready() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(
        campaign_id="campaign_123",
        client_id="client_123",
        subject="Launch",
        body_html="<p>Hello</p>",
        body_text="Hello",
        content_ready=True,
        contacts_ready=True,
        review_ready=True,
        current_step="send",
    )
    contact = build_contact(contact_id="contact_1", email="one@example.test")
    service = build_admin_service(
        campaign_repository=repository,
        contacts=[contact],
        campaign_contacts={("client_123", campaign.id, contact.id)},
    )
    service.campaign_limit_repository.update_for_campaign(
        campaign_id=campaign.id,
        followup_enabled=True,
        followup_daily_limit=5,
        followup_monthly_limit=50,
        followup_delay_value=3,
        followup_delay_unit="days",
        followup_subject="",
        followup_body_html="",
    )

    result = service.review_campaign(campaign.id)

    assert result.followup_content_ready is False
    assert result.followup_content_reason == (
        "Dedicated follow-up subject and HTML content are required."
    )


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


def test_admin_content_update_accepts_supported_template_placeholders() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    service = build_admin_service(campaign_repository=repository)

    updated = service.update_campaign_content(
        campaign_id=campaign.id,
        subject="Aggiornamento {{campaign_name}}",
        preview_text="Ciao {{nome}}",
        body_html="<p>{{company_name}}</p><p>{{email}}</p><p>{{unsubscribe_url}}</p>",
        body_text="Anno {{current_year}}",
        current_step="content",
    )

    assert updated.subject == "Aggiornamento {{campaign_name}}"
    assert "{{company_name}}" in str(updated.body_html)
    assert "{{email}}" in str(updated.body_html)


def test_admin_content_update_accepts_preview_and_optional_brand_placeholders() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    service = build_admin_service(campaign_repository=repository)

    updated = service.update_campaign_content(
        campaign_id=campaign.id,
        subject="Aggiornamento {{campaign_name}}",
        preview_text="Preview {{nome}}",
        body_html=(
            "<p>{{preview_text}}</p><p>{{logo}}</p><p>{{social_icons}}</p>"
            "<p>{{instagram_url}}</p><p>{{sender_name}}</p>"
        ),
        body_text="Testo {{logo}} {{social_icons}}",
        current_step="content",
    )

    assert "{{preview_text}}" in str(updated.body_html)
    assert "{{logo}}" in str(updated.body_html)
    assert "{{social_icons}}" in str(updated.body_html)
    assert "{{instagram_url}}" in str(updated.body_html)


def test_admin_create_email_template_persists_client_scoped_content() -> None:
    template_repository = InMemoryEmailTemplateRepository()
    service = build_admin_service(email_template_repository=template_repository)

    created = service.create_email_template(
        client_id="client_123",
        name="Promo giugno",
        subject="Promo {{campaign_name}}",
        preview_text="Preview {{nome}}",
        body_html="<p>{{company_name}}</p>",
        body_text="Testo {{current_year}}",
    )

    assert created.client_id == "client_123"
    assert created.name == "Promo giugno"
    assert created.subject == "Promo {{campaign_name}}"
    listed = service.list_email_templates("client_123")
    assert [template.id for template in listed] == [created.id]


def test_admin_create_email_template_rejects_missing_body() -> None:
    service = build_admin_service()

    try:
        service.create_email_template(
            client_id="client_123",
            name="Vuota",
            subject="Oggetto",
            preview_text=None,
            body_html=None,
            body_text=None,
        )
    except HTTPException as error:
        assert error.status_code == 422
        assert error.detail == "Template body_html or body_text is required."
    else:
        raise AssertionError("Expected template body validation error")


def test_admin_review_exposes_template_readiness_blocking_reason() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(
        campaign_id="campaign_123",
        status="draft",
        subject="Launch",
        body_html=(
            "<html><body><p>Ricevi questa email perche sei iscritto agli "
            "aggiornamenti di {{company_name}}.</p></body></html>"
        ),
        content_ready=True,
        contacts_ready=True,
    )
    contact = build_contact(
        contact_id="contact_123",
        email="person@example.test",
    )
    service = build_admin_service(
        settings=Settings(email_sending_enabled_raw="true"),
        campaign_repository=repository,
        clients=[
            build_client(
                metadata={
                    "email_brand": {
                        "website_url": "https://acme.example.test",
                    }
                }
            )
        ],
        contacts=[contact],
        campaign_contacts={(campaign.client_id, campaign.id, contact.id)},
    )

    result = service.review_campaign(campaign.id)

    assert result.allowed_to_send is False
    assert result.can_send_when_enabled is False
    assert result.content_ready is False
    assert result.review_ready is False
    assert any(
        error.startswith("template_missing_company_name:")
        for error in result.blocking_errors
    )


def test_followup_settings_do_not_change_template_readiness_blockers() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(
        campaign_id="campaign_123",
        status="draft",
        subject="Launch",
        body_html=(
            "<html><body><p>Ricevi questa email perche sei iscritto agli "
            "aggiornamenti di {{company_name}}.</p></body></html>"
        ),
        content_ready=True,
        contacts_ready=True,
    )
    contact = build_contact(
        contact_id="contact_123",
        email="person@example.test",
    )
    limit_repository = InMemoryCampaignSendingLimitRepository()
    limit_repository.ensure_for_campaign(
        campaign_id=campaign.id,
        followup_enabled=True,
        followup_daily_limit=5,
        followup_monthly_limit=50,
        followup_delay_value=3,
        followup_delay_unit="days",
    )
    service = build_admin_service(
        settings=Settings(email_sending_enabled_raw="true"),
        campaign_repository=repository,
        campaign_limit_repository=limit_repository,
        clients=[
            build_client(
                metadata={
                    "email_brand": {
                        "website_url": "https://acme.example.test",
                    }
                }
            )
        ],
        contacts=[contact],
        campaign_contacts={(campaign.client_id, campaign.id, contact.id)},
    )

    result = service.review_campaign(campaign.id)

    assert result.followup_enabled is True
    assert result.followup_daily_limit == 5
    assert result.followup_monthly_limit == 50
    assert result.followup_delay_value == 3
    assert result.followup_delay_unit == "days"
    assert any(
        error.startswith("template_missing_company_name:")
        for error in result.blocking_errors
    )


def test_admin_campaign_detail_includes_email_brand() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    service = build_admin_service(
        campaign_repository=repository,
        clients=[
            build_client(
                metadata={
                    "email_brand": {
                        "company_name": "Acme Labs",
                        "sender_name": "Team Acme",
                        "website_url": "https://acme.example.test",
                    }
                }
            )
        ],
    )

    detail = service.get_campaign_detail(campaign.id)

    assert detail.email_brand == {
        "company_name": "Acme Labs",
        "sender_name": "Team Acme",
        "website_url": "https://acme.example.test/",
    }


def test_followup_eligibility_returns_disabled_result() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    service = build_admin_service(campaign_repository=repository)

    result = service.evaluate_followup_eligibility(
        campaign_id=campaign.id,
        contact_id="contact_123",
    )

    assert result.allowed is False
    assert result.code == "followup_disabled"


def test_followup_eligibility_requires_reference_time() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    limit_repository = InMemoryCampaignSendingLimitRepository()
    limit_repository.ensure_for_campaign(
        campaign_id=campaign.id,
        followup_enabled=True,
        followup_daily_limit=5,
        followup_monthly_limit=50,
        followup_delay_value=3,
        followup_delay_unit="days",
    )
    service = build_admin_service(
        campaign_repository=repository,
        campaign_limit_repository=limit_repository,
    )

    result = service.evaluate_followup_eligibility(
        campaign_id=campaign.id,
        contact_id="contact_missing",
    )

    assert result.allowed is False
    assert result.code == "followup_missing_reference_time"


def test_followup_eligibility_blocks_until_delay_elapsed(monkeypatch: Any) -> None:
    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz: timezone | None = None) -> datetime:
            current_time = cls(2026, 5, 27, 10, 0, tzinfo=timezone.utc)
            return current_time.astimezone(tz) if tz is not None else current_time

    monkeypatch.setattr(campaigns_module, "datetime", FixedDateTime)

    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    limit_repository = InMemoryCampaignSendingLimitRepository()
    limit_repository.ensure_for_campaign(
        campaign_id=campaign.id,
        followup_enabled=True,
        followup_daily_limit=5,
        followup_monthly_limit=50,
        followup_delay_value=3,
        followup_delay_unit="days",
    )
    email_log_repository = InMemoryEmailLogRepository()
    email_log_repository.create_email_log(
        client_id=campaign.client_id,
        campaign_id=campaign.id,
        contact_id="contact_123",
        send_kind="campaign",
        status="queued",
        created_at=datetime(2026, 5, 26, 10, 0, tzinfo=timezone.utc),
    )
    service = build_admin_service(
        campaign_repository=repository,
        campaign_limit_repository=limit_repository,
        email_log_repository=email_log_repository,
    )

    result = service.evaluate_followup_eligibility(
        campaign_id=campaign.id,
        contact_id="contact_123",
    )

    assert result.allowed is False
    assert result.code == "followup_delay_not_elapsed"


def test_followup_eligibility_allows_send_after_delay(monkeypatch: Any) -> None:
    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz: timezone | None = None) -> datetime:
            current_time = cls(2026, 5, 27, 10, 0, tzinfo=timezone.utc)
            return current_time.astimezone(tz) if tz is not None else current_time

    monkeypatch.setattr(campaigns_module, "datetime", FixedDateTime)

    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    limit_repository = InMemoryCampaignSendingLimitRepository()
    limit_repository.ensure_for_campaign(
        campaign_id=campaign.id,
        followup_enabled=True,
        followup_daily_limit=5,
        followup_monthly_limit=50,
        followup_delay_value=2,
        followup_delay_unit="days",
    )
    email_log_repository = InMemoryEmailLogRepository()
    email_log_repository.create_email_log(
        client_id=campaign.client_id,
        campaign_id=campaign.id,
        contact_id="contact_123",
        send_kind="campaign",
        status="queued",
        created_at=datetime(2026, 5, 24, 10, 0, tzinfo=timezone.utc),
    )
    service = build_admin_service(
        campaign_repository=repository,
        campaign_limit_repository=limit_repository,
        email_log_repository=email_log_repository,
    )

    result = service.evaluate_followup_eligibility(
        campaign_id=campaign.id,
        contact_id="contact_123",
    )

    assert result.allowed is True
    assert result.code == "followup_allowed"


def test_followup_eligibility_blocks_when_daily_limit_exceeded(monkeypatch: Any) -> None:
    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz: timezone | None = None) -> datetime:
            current_time = cls(2026, 5, 27, 10, 0, tzinfo=timezone.utc)
            return current_time.astimezone(tz) if tz is not None else current_time

    monkeypatch.setattr(campaigns_module, "datetime", FixedDateTime)

    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    limit_repository = InMemoryCampaignSendingLimitRepository()
    limit_repository.ensure_for_campaign(
        campaign_id=campaign.id,
        followup_enabled=True,
        followup_daily_limit=1,
        followup_monthly_limit=50,
        followup_delay_value=2,
        followup_delay_unit="days",
    )
    email_log_repository = InMemoryEmailLogRepository()
    email_log_repository.create_email_log(
        client_id=campaign.client_id,
        campaign_id=campaign.id,
        contact_id="contact_123",
        send_kind="campaign",
        status="queued",
        created_at=datetime(2026, 5, 24, 10, 0, tzinfo=timezone.utc),
    )
    email_log_repository.create_email_log(
        client_id=campaign.client_id,
        campaign_id=campaign.id,
        contact_id="contact_followup",
        send_kind="followup",
        status="queued",
        created_at=datetime(2026, 5, 27, 8, 0, tzinfo=timezone.utc),
    )
    service = build_admin_service(
        campaign_repository=repository,
        campaign_limit_repository=limit_repository,
        email_log_repository=email_log_repository,
    )

    result = service.evaluate_followup_eligibility(
        campaign_id=campaign.id,
        contact_id="contact_123",
    )

    assert result.allowed is False
    assert result.code == "followup_daily_limit_exceeded"


def test_followup_eligibility_blocks_when_monthly_limit_exceeded(monkeypatch: Any) -> None:
    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz: timezone | None = None) -> datetime:
            current_time = cls(2026, 5, 27, 10, 0, tzinfo=timezone.utc)
            return current_time.astimezone(tz) if tz is not None else current_time

    monkeypatch.setattr(campaigns_module, "datetime", FixedDateTime)

    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    limit_repository = InMemoryCampaignSendingLimitRepository()
    limit_repository.ensure_for_campaign(
        campaign_id=campaign.id,
        followup_enabled=True,
        followup_daily_limit=5,
        followup_monthly_limit=1,
        followup_delay_value=2,
        followup_delay_unit="days",
    )
    email_log_repository = InMemoryEmailLogRepository()
    email_log_repository.create_email_log(
        client_id=campaign.client_id,
        campaign_id=campaign.id,
        contact_id="contact_123",
        send_kind="campaign",
        status="queued",
        created_at=datetime(2026, 5, 24, 10, 0, tzinfo=timezone.utc),
    )
    email_log_repository.create_email_log(
        client_id=campaign.client_id,
        campaign_id=campaign.id,
        contact_id="contact_followup",
        send_kind="followup",
        status="queued",
        created_at=datetime(2026, 5, 2, 8, 0, tzinfo=timezone.utc),
    )
    service = build_admin_service(
        campaign_repository=repository,
        campaign_limit_repository=limit_repository,
        email_log_repository=email_log_repository,
    )

    result = service.evaluate_followup_eligibility(
        campaign_id=campaign.id,
        contact_id="contact_123",
    )

    assert result.allowed is False
    assert result.code == "followup_monthly_limit_exceeded"


def test_primary_campaign_limits_ignore_followup_logs(monkeypatch: Any) -> None:
    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz: timezone | None = None) -> datetime:
            current_time = cls(2026, 5, 27, 10, 0, tzinfo=timezone.utc)
            return current_time.astimezone(tz) if tz is not None else current_time

    monkeypatch.setattr(campaigns_module, "datetime", FixedDateTime)

    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(
        campaign_id="campaign_123",
        client_id="client_123",
        subject="Launch",
        body_html="<p>Hello</p>",
        content_ready=True,
        contacts_ready=True,
        review_ready=True,
        current_step="review",
        status="ready",
    )
    contact = build_contact(contact_id="contact_123", email="person@example.test")
    limit_repository = InMemoryCampaignSendingLimitRepository()
    limit_repository.ensure_for_campaign(
        campaign_id=campaign.id,
        period_email_limit=1,
        daily_email_limit=1,
        followup_enabled=True,
        followup_daily_limit=5,
        followup_monthly_limit=50,
        followup_delay_value=2,
        followup_delay_unit="days",
    )
    email_log_repository = InMemoryEmailLogRepository()
    email_log_repository.create_email_log(
        client_id=campaign.client_id,
        campaign_id=campaign.id,
        contact_id="contact_followup",
        send_kind="followup",
        status="queued",
        created_at=datetime(2026, 5, 27, 8, 0, tzinfo=timezone.utc),
    )
    service = build_admin_service(
        settings=Settings(email_sending_enabled_raw="true"),
        campaign_repository=repository,
        campaign_limit_repository=limit_repository,
        email_log_repository=email_log_repository,
        contacts=[contact],
        campaign_contacts={(campaign.client_id, campaign.id, contact.id)},
    )

    result = service.review_campaign(campaign.id)

    assert result.allowed_to_send is True
    assert result.daily_used == 0
    assert result.period_used == 0


def test_review_campaign_ignores_ready_and_completed_campaigns_for_running_slot_limit() -> None:
    repository = InMemoryCampaignRepository()
    current = repository.add_campaign(
        campaign_id="campaign_123",
        client_id="client_123",
        status="ready",
        subject="Launch",
        body_html="<p>Hello</p>",
        content_ready=True,
        contacts_ready=True,
        review_ready=True,
        current_step="review",
    )
    repository.add_campaign(
        campaign_id="campaign_456",
        client_id="client_123",
        status="completed",
        subject="Past launch",
        body_html="<p>Done</p>",
        content_ready=True,
        contacts_ready=True,
        review_ready=True,
        current_step="send",
    )
    contact = build_contact(contact_id="contact_123", email="person@example.test")
    service = build_admin_service(
        settings=Settings(email_sending_enabled_raw="true"),
        campaign_repository=repository,
        clients=[build_client(max_campaigns=1)],
        contacts=[contact],
        campaign_contacts={(current.client_id, current.id, contact.id)},
    )

    result = service.review_campaign(current.id)

    assert result.can_send_when_enabled is True
    assert "Client max_campaigns limit is exceeded." not in result.blocking_errors


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
    assert result.policy_state is not None
    assert result.policy_state.deliverability_guard.code == "dispatch_authorized"
    assert result.policy_state.duplicate_guard.code == "duplicate_guard_clear"
    assert result.policy_state.warmup_guard.code == "warmup_guard_clear"
    assert result.policy_state.score_products_available is False
    assert result.warnings == [
        'EMAIL_SENDING_ENABLED is not exactly "true"; real dispatch is disabled.'
    ]


def test_admin_summary_exposes_domain_warmup_readiness() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(
        campaign_id="campaign_123",
        client_id="client_123",
        subject="Launch campaign",
        body_html="<p>Body</p>",
        content_ready=True,
        contacts_ready=True,
        review_ready=True,
        current_step="review",
        status="ready",
    )
    contact = build_contact(contact_id="contact_1", email="one@example.test")
    email_logs = InMemoryEmailLogRepository()
    provider_events = InMemoryProviderEventRepository()
    warmup_repository = InMemorySendingDomainWarmupStateRepository()
    warmup_repository.upsert_state(
        sending_domain="send.mailerpro.it",
        current_stage=1,
        stage_started_at=datetime(2026, 5, 1, 8, 0, tzinfo=timezone.utc),
    )
    for index in range(20):
        email_logs.create_email_log(
            client_id="client_seed",
            campaign_id=f"campaign_stage_one_{index}",
            contact_id=f"contact_stage_one_{index}",
            status="sent",
            sending_domain="send.mailerpro.it",
            created_at=datetime(2026, 5, 10, 8, 0, tzinfo=timezone.utc),
        )
    failed_log = email_logs.create_email_log(
        client_id="client_seed",
        campaign_id="campaign_failed",
        contact_id="contact_failed",
        status="sent",
        sending_domain="send.mailerpro.it",
        created_at=datetime(2026, 5, 9, 9, 0, tzinfo=timezone.utc),
    )
    provider_events.attach_email_log_records(email_logs._records)
    add_processed_provider_event(
        provider_events,
        client_id="client_seed",
        campaign_id="campaign_failed",
        contact_id="contact_failed",
        email_log_id=failed_log.id,
        event_type="delivery_failed",
    )

    class FixedDateTime(datetime):
        @classmethod
        def now(cls, tz: timezone | None = None) -> datetime:
            current_time = cls(2026, 5, 10, 10, 0, tzinfo=timezone.utc)
            return current_time.astimezone(tz) if tz is not None else current_time

    service = build_admin_service(
        settings=build_ready_listmonk_settings(),
        campaign_repository=repository,
        contacts=[contact],
        campaign_contacts={("client_123", campaign.id, contact.id)},
        email_log_repository=email_logs,
        provider_event_repository=provider_events,
        sending_domain_warmup_repository=warmup_repository,
    )
    admin_campaigns_datetime = campaigns_module.datetime
    try:
        setattr(campaigns_module, "datetime", FixedDateTime)
        result = service.get_campaign_summary(campaign.id)
    finally:
        setattr(campaigns_module, "datetime", admin_campaigns_datetime)

    assert result.policy_state is not None
    assert result.policy_state.domain_warmup is not None
    assert result.policy_state.domain_warmup.sending_domain == "send.mailerpro.it"
    assert result.policy_state.domain_warmup.current_stage == 1
    assert result.policy_state.domain_warmup.cap_today == 20
    assert result.policy_state.domain_warmup.used_today == 20
    assert result.policy_state.domain_warmup.remaining_today == 0
    assert result.policy_state.domain_warmup.next_stage_cap == 30
    assert result.policy_state.domain_warmup.advancement_status == "manual_review_required"
    assert result.policy_state.domain_warmup.initialization_required is False
    assert result.policy_state.domain_warmup.delivery_failed_count == 1
    assert result.policy_state.warmup_guard.code == "sending_domain_warmup_limit_reached"


def test_admin_summary_defaults_domain_warmup_when_persisted_state_is_missing() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(
        campaign_id="campaign_123",
        client_id="client_123",
        subject="Launch campaign",
        body_html="<p>Body</p>",
        content_ready=True,
        contacts_ready=True,
        review_ready=True,
        current_step="review",
        status="ready",
    )
    contact = build_contact(contact_id="contact_1", email="one@example.test")
    service = build_admin_service(
        settings=build_ready_listmonk_settings(),
        campaign_repository=repository,
        contacts=[contact],
        campaign_contacts={("client_123", campaign.id, contact.id)},
    )

    result = service.get_campaign_summary(campaign.id)

    assert result.policy_state is not None
    assert result.policy_state.domain_warmup is not None
    assert result.policy_state.domain_warmup.current_stage == 1
    assert result.policy_state.domain_warmup.cap_today == 20
    assert result.policy_state.domain_warmup.remaining_today == 20
    assert result.policy_state.domain_warmup.advancement_status == "manual_review_required"
    assert result.policy_state.domain_warmup.initialization_required is True


def test_admin_review_exposes_manual_domain_warmup_state() -> None:
    repository = InMemoryCampaignRepository(
        campaign_contacts={("client_123", "campaign_123", "contact_1")},
    )
    campaign = repository.add_campaign(
        campaign_id="campaign_123",
        client_id="client_123",
        subject="Launch",
        body_html="<p>Hello</p>",
        body_text="Hello",
        content_ready=True,
        contacts_ready=True,
        review_ready=True,
        status="ready",
    )
    warmup_repository = InMemorySendingDomainWarmupStateRepository()
    warmup_repository.upsert_state(
        sending_domain="send.mailerpro.it",
        current_stage=2,
        stage_started_at=datetime(2026, 5, 10, 8, 0, tzinfo=timezone.utc),
    )
    service = build_admin_service(
        settings=build_ready_listmonk_settings(),
        campaign_repository=repository,
        contacts=[build_contact(contact_id="contact_1", email="one@example.test")],
        campaign_contacts={("client_123", campaign.id, "contact_1")},
        sending_domain_warmup_repository=warmup_repository,
    )

    result = service.review_campaign(campaign.id)

    assert result.domain_warmup is not None
    assert result.domain_warmup.current_stage == 2
    assert result.domain_warmup.cap_today == 30
    assert result.domain_warmup.next_stage_cap == 50
    assert result.domain_warmup.advancement_status == "manual_review_required"
    assert result.domain_warmup.initialization_required is False


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
    assert payload["policy_state"]["score_products_available"] is False
    assert payload["policy_state"]["deliverability_guard"]["code"] == "campaign_status_not_sendable"
    assert payload["runtime"] == {
        "email_sending_enabled": True,
        "email_provider": "ses",
        "provider_mode_label": "SES sandbox only - production blocked pending AWS approval",
        "real_send_available": False,
        "ses_live_validation_status": "pending",
        "provider_events_available": False,
        "mailpit_dev_mode": False,
    }
    assert "smtp.secret.example" not in response.text
    assert "smtp-user-secret" not in response.text
    assert "smtp-password-secret" not in response.text
    assert "eu-west-1" not in response.text


def test_admin_summary_endpoint_reports_listmonk_mailgun_fallback_without_sender_leak() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    admin_service = build_admin_service(
        settings=Settings(
            email_sending_enabled_raw="false",
            email_provider="listmonk",
            smtp_host="smtp.mailgun.org",
            smtp_port=587,
            smtp_username="postmaster-secret@send.mailerpro.it",
            smtp_password="smtp-password-secret",
            smtp_tls_raw="true",
            smtp_from_email="sendwise@send.mailerpro.it",
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
    assert payload["runtime"] == {
        "email_sending_enabled": False,
        "email_provider": "listmonk",
        "provider_mode_label": (
            "Listmonk SMTP relay configured - Mailgun SMTP ready for production fallback"
        ),
        "real_send_available": False,
        "ses_live_validation_status": None,
        "provider_events_available": False,
        "mailpit_dev_mode": False,
    }
    assert "postmaster-secret@send.mailerpro.it" not in response.text
    assert "smtp-password-secret" not in response.text
    assert "sendwise@send.mailerpro.it" not in response.text


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


def test_admin_summary_aggregates_email_logs_for_operational_reporting() -> None:
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
    email_logs.create_email_log(
        client_id="client_123",
        campaign_id=campaign.id,
        contact_id="contact_4",
        status="failed",
    )
    service = build_admin_service(
        campaign_repository=repository,
        email_log_repository=email_logs,
    )

    result = service.get_campaign_summary(campaign.id)

    assert result.logs.simulated == 1
    assert result.logs.queued == 2
    assert result.logs.sent == 0
    assert result.logs.failed == 1
    assert result.logs.delivered is None
    assert result.logs.delivered_available is False
    assert result.logs.delivery_rate is None
    assert result.logs.delivery_rate_available is False
    assert result.logs.provider_events_available is False


def test_admin_summary_keeps_provider_delivered_metrics_and_rendered_subject() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(
        campaign_id="campaign_123",
        client_id="client_123",
        name="prova-3",
        status="completed",
        subject="Le novita essenziali di {{campaign_name}}",
        body_html="<p>Hello</p>",
        current_step="review",
    )
    contact = build_contact(contact_id="contact_1", email="one@example.test")
    email_logs = InMemoryEmailLogRepository()
    log = email_logs.create_email_log(
        client_id="client_123",
        campaign_id=campaign.id,
        contact_id=contact.id,
        status="delivered",
    )
    provider_events = InMemoryProviderEventRepository()
    add_processed_provider_event(
        provider_events,
        client_id="client_123",
        campaign_id=campaign.id,
        contact_id=contact.id,
        email_log_id=log.id,
        event_type="accepted",
    )
    add_processed_provider_event(
        provider_events,
        client_id="client_123",
        campaign_id=campaign.id,
        contact_id=contact.id,
        email_log_id=log.id,
        event_type="delivered",
    )
    service = build_admin_service(
        campaign_repository=repository,
        contacts=[contact],
        campaign_contacts={("client_123", campaign.id, contact.id)},
        email_log_repository=email_logs,
        provider_event_repository=provider_events,
    )

    result = service.get_campaign_summary(campaign.id)

    assert result.campaign.subject == "Le novita essenziali di {{campaign_name}}"
    assert result.campaign.rendered_subject == "Le novita essenziali di prova-3"
    assert result.logs.sent == 1
    assert result.logs.delivered == 1
    assert result.logs.opened == 0
    assert result.logs.clicked == 0
    assert result.logs.provider_events_available is True
    assert result.logs.delivered_available is True
    assert result.logs.opened_available is True
    assert result.logs.clicked_available is True


def test_admin_summary_accepts_provider_accepted_without_delivered_metric() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(
        campaign_id="campaign_123",
        client_id="client_123",
        status="running",
        subject="Launch",
        body_html="<p>Hello</p>",
    )
    contact = build_contact(contact_id="contact_1", email="one@example.test")
    email_logs = InMemoryEmailLogRepository()
    log = email_logs.create_email_log(
        client_id="client_123",
        campaign_id=campaign.id,
        contact_id=contact.id,
        status="sent",
    )
    provider_events = InMemoryProviderEventRepository()
    add_processed_provider_event(
        provider_events,
        client_id="client_123",
        campaign_id=campaign.id,
        contact_id=contact.id,
        email_log_id=log.id,
        event_type="accepted",
    )
    service = build_admin_service(
        campaign_repository=repository,
        contacts=[contact],
        campaign_contacts={("client_123", campaign.id, contact.id)},
        email_log_repository=email_logs,
        provider_event_repository=provider_events,
    )

    result = service.get_campaign_summary(campaign.id)

    assert result.logs.sent == 1
    assert result.logs.delivered == 0
    assert result.logs.provider_events_available is True
    assert result.logs.delivered_available is True


def test_admin_summary_failed_campaign_keeps_problem_state() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(
        campaign_id="campaign_123",
        client_id="client_123",
        status="failed",
        subject="Launch",
        body_html="<p>Hello</p>",
    )
    contact = build_contact(contact_id="contact_1", email="one@example.test")
    email_logs = InMemoryEmailLogRepository()
    email_logs.create_email_log(
        client_id="client_123",
        campaign_id=campaign.id,
        contact_id=contact.id,
        status="failed",
    )
    service = build_admin_service(
        campaign_repository=repository,
        contacts=[contact],
        campaign_contacts={("client_123", campaign.id, contact.id)},
        email_log_repository=email_logs,
    )

    result = service.get_campaign_summary(campaign.id)

    assert result.campaign.status == "failed"
    assert result.logs.failed == 1
    assert result.can_send is False


def test_admin_summary_successful_sent_campaign_keeps_duplicate_guard_distinct() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(
        campaign_id="campaign_123",
        client_id="client_123",
        status="completed",
        subject="Launch",
        body_html="<p>Hello</p>",
    )
    contact = build_contact(contact_id="contact_1", email="one@example.test")
    email_logs = InMemoryEmailLogRepository()
    email_logs.create_email_log(
        client_id="client_123",
        campaign_id=campaign.id,
        contact_id=contact.id,
        status="sent",
    )
    service = build_admin_service(
        campaign_repository=repository,
        contacts=[contact],
        campaign_contacts={("client_123", campaign.id, contact.id)},
        email_log_repository=email_logs,
    )

    result = service.get_campaign_summary(campaign.id)

    assert result.logs.sent == 1
    assert result.logs.delivered is None
    assert result.logs.provider_events_available is False
    assert "Campaign was already started by Listmonk or accepted for dispatch." in (
        result.blocking_errors
    )
    assert result.policy_state is not None
    assert result.policy_state.duplicate_guard.code == "campaign_send_already_accepted"


def test_admin_summary_evaluates_duplicate_guard_without_crashing() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(
        campaign_id="campaign_123",
        client_id="client_123",
        status="ready",
        subject="Launch",
        body_html="<p>Hello</p>",
        current_step="review",
    )
    contact = build_contact(contact_id="contact_1", email="one@example.test")
    email_logs = InMemoryEmailLogRepository()
    email_logs.create_email_log(
        client_id="client_123",
        campaign_id=campaign.id,
        contact_id=contact.id,
        status="queued",
    )
    service = build_admin_service(
        campaign_repository=repository,
        contacts=[contact],
        campaign_contacts={("client_123", campaign.id, contact.id)},
        email_log_repository=email_logs,
    )

    result = service.get_campaign_summary(campaign.id)

    assert result.can_send is False
    assert result.can_send_when_enabled is False
    assert (
        "Campaign already has queued email logs." in result.blocking_errors
    )


def test_admin_summary_exposes_limit_usage_and_client_safe_period_usage() -> None:
    repository = InMemoryCampaignRepository()
    campaign = repository.add_campaign(
        campaign_id="campaign_123",
        client_id="client_123",
        status="running",
    )
    email_logs = InMemoryEmailLogRepository()
    email_logs.create_email_log(
        client_id="client_123",
        campaign_id=campaign.id,
        contact_id="contact_1",
        status="queued",
    )
    limit_repository = InMemoryCampaignSendingLimitRepository()
    limit_repository.ensure_for_campaign(
        campaign_id=campaign.id,
        period_email_limit=500,
        daily_email_limit=25,
    )
    service = build_admin_service(
        campaign_repository=repository,
        email_log_repository=email_logs,
        campaign_limit_repository=limit_repository,
    )

    result = service.get_campaign_summary(campaign.id)
    period_payload = result.period_usage.model_dump()

    assert result.daily_limit == 25
    assert result.daily_used == 1
    assert result.period_limit == 500
    assert result.period_used == 1
    assert result.period_usage.period_email_limit == 500
    assert result.period_usage.period_used == 1
    assert "daily_limit" not in period_payload
    assert result.period_usage.has_real_usage is True


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


def test_admin_review_exposes_provider_history_review_band() -> None:
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
        contacts_ready=True,
    )
    contact = build_contact(contact_id="contact_1", email="one@example.test")
    email_logs = InMemoryEmailLogRepository()
    provider_events = InMemoryProviderEventRepository()
    add_domain_history(
        email_log_repository=email_logs,
        provider_event_repository=provider_events,
        accepted_count=1000,
        delivered_count=1000,
        complaint_count=2,
    )
    service = build_admin_service(
        settings=build_ready_listmonk_settings(),
        campaign_repository=repository,
        contacts=[contact],
        campaign_contacts={("client_123", campaign.id, contact.id)},
        email_log_repository=email_logs,
        provider_event_repository=provider_events,
    )

    result = service.review_campaign(campaign.id)

    assert result.review_ready is True
    assert result.blocking_errors == []
    assert len(result.provider_history) == 1
    assert result.provider_history[0].code == "provider_history_complaint_rate_review"
    assert result.provider_history[0].severity == "warning"
    assert result.provider_history[0].metric == "complaint_rate"
    assert result.provider_history[0].band == "review"
    assert result.provider_history[0].blocking is False
    assert result.provider_history[0].sending_domain == "send.mailerpro.it"
    assert "review band" in result.warnings[0]


def test_admin_review_exposes_provider_history_stop_band_as_blocking() -> None:
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
        contacts_ready=True,
    )
    contact = build_contact(contact_id="contact_1", email="one@example.test")
    email_logs = InMemoryEmailLogRepository()
    provider_events = InMemoryProviderEventRepository()
    add_domain_history(
        email_log_repository=email_logs,
        provider_event_repository=provider_events,
        accepted_count=1000,
        delivered_count=1000,
        complaint_count=3,
    )
    service = build_admin_service(
        settings=build_ready_listmonk_settings(),
        campaign_repository=repository,
        contacts=[contact],
        campaign_contacts={("client_123", campaign.id, contact.id)},
        email_log_repository=email_logs,
        provider_event_repository=provider_events,
    )

    result = service.review_campaign(campaign.id)

    assert result.review_ready is False
    assert result.provider_history[0].code == "provider_history_complaint_rate_stop"
    assert result.provider_history[0].severity == "critical"
    assert result.provider_history[0].band == "stop"
    assert result.provider_history[0].blocking is True
    assert result.provider_history[0].reason in result.blocking_errors
    assert result.warnings == []


def test_admin_summary_omits_provider_history_when_denominators_unavailable() -> None:
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
        contacts_ready=True,
    )
    contact = build_contact(contact_id="contact_1", email="one@example.test")
    service = build_admin_service(
        settings=build_ready_listmonk_settings(),
        campaign_repository=repository,
        contacts=[contact],
        campaign_contacts={("client_123", campaign.id, contact.id)},
        email_log_repository=InMemoryEmailLogRepository(),
        provider_event_repository=InMemoryProviderEventRepository(),
    )

    result = service.get_campaign_summary(campaign.id)

    assert result.policy_state is not None
    assert result.policy_state.provider_history == []
    assert result.warnings == []

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


def build_followup_simulation_service(
    *,
    campaign_id: str = "campaign_123",
    followup_enabled: bool = True,
    followup_daily_limit: int = 10,
    followup_monthly_limit: int = 100,
    followup_delay_value: int = 1,
    followup_delay_unit: str = "days",
    contacts: list[ContactRecord] | None = None,
    suppression_records: list[SuppressionRecord] | None = None,
    email_logs: InMemoryEmailLogRepository | None = None,
    provider_events: InMemoryProviderEventRepository | None = None,
) -> tuple[
    AdminCampaignService,
    CampaignRecord,
    InMemoryEmailLogRepository,
    InMemoryProviderEventRepository,
]:
    selected_contacts = contacts or [
        build_contact(contact_id="contact_1", email="one@example.test")
    ]
    campaign_contacts = {
        ("client_123", campaign_id, contact.id) for contact in selected_contacts
    }
    campaign_repository = InMemoryCampaignRepository(campaign_contacts=campaign_contacts)
    campaign = campaign_repository.add_campaign(
        campaign_id=campaign_id,
        client_id="client_123",
        status="completed",
        subject="Launch",
        body_html="<p>Hello</p>",
        body_text="Hello",
        content_ready=True,
        contacts_ready=True,
        review_ready=True,
    )
    limits = InMemoryCampaignSendingLimitRepository()
    limits.ensure_for_campaign(
        campaign_id=campaign.id,
        followup_enabled=followup_enabled,
        followup_daily_limit=followup_daily_limit,
        followup_monthly_limit=followup_monthly_limit,
        followup_delay_value=followup_delay_value,
        followup_delay_unit=followup_delay_unit,
    )
    email_log_repository = email_logs or InMemoryEmailLogRepository()
    provider_event_repository = provider_events or InMemoryProviderEventRepository()
    service = build_admin_service(
        campaign_repository=campaign_repository,
        clients=[build_client()],
        contacts=selected_contacts,
        campaign_contacts=campaign_contacts,
        suppression_records=suppression_records,
        email_log_repository=email_log_repository,
        provider_event_repository=provider_event_repository,
        campaign_limit_repository=limits,
    )
    return service, campaign, email_log_repository, provider_event_repository


def add_primary_log_with_events(
    *,
    email_logs: InMemoryEmailLogRepository,
    provider_events: InMemoryProviderEventRepository,
    campaign: CampaignRecord,
    contact_id: str,
    event_types: tuple[str, ...],
    created_at: datetime | None = None,
    send_kind: str = "campaign",
) -> str:
    log = email_logs.create_email_log(
        client_id=campaign.client_id,
        campaign_id=campaign.id,
        contact_id=contact_id,
        send_kind=send_kind,
        status="sent",
        created_at=created_at or datetime.now(timezone.utc) - timedelta(days=3),
    )
    for event_type in event_types:
        add_processed_provider_event(
            provider_events,
            client_id=campaign.client_id,
            campaign_id=campaign.id,
            contact_id=contact_id,
            email_log_id=log.id,
            event_type=event_type,
            event_key=f"{campaign.id}:{contact_id}:{log.id}:{event_type}",
        )
    return log.id


def test_admin_simulate_followup_route_requires_admin_auth() -> None:
    response = TestClient(app).post("/admin/campaigns/campaign_123/simulate-followup")

    assert response.status_code == 401


def test_admin_simulate_followup_route_returns_safe_aggregate_response() -> None:
    service, campaign, email_logs, provider_events = build_followup_simulation_service()
    add_primary_log_with_events(
        email_logs=email_logs,
        provider_events=provider_events,
        campaign=campaign,
        contact_id="contact_1",
        event_types=("delivered",),
    )

    app.dependency_overrides[require_platform_admin] = build_admin_user
    app.dependency_overrides[get_admin_campaign_service] = lambda: service

    try:
        response = TestClient(app).post(
            "/admin/campaigns/campaign_123/simulate-followup"
        )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "followup_simulation"
    assert payload["real_send_attempted"] is False
    assert payload["external_dispatch_performed"] is False
    assert payload["external_preparation_performed"] is False
    assert payload["content_ready"] is False
    assert payload["dedicated_followup_content_ready"] is False
    assert payload["total_primary_recipients_evaluated"] == 1
    assert payload["eligible_count"] == 1
    assert payload["blocked_count"] == 0
    assert "@" not in str(payload)


def test_followup_simulation_disabled_returns_blocked_summary() -> None:
    service, _campaign, _email_logs, _provider_events = build_followup_simulation_service(
        followup_enabled=False
    )

    result = service.simulate_followup_eligibility(campaign_id="campaign_123")

    assert result.status == "blocked"
    assert result.code == "followup_disabled"
    assert result.eligible_count == 0
    assert result.blocked_count == 0
    assert result.blocked_reason_counts == {}


def test_followup_simulation_missing_reference_time_blocks() -> None:
    service, campaign, _email_logs, _provider_events = build_followup_simulation_service()

    result = service.simulate_followup_eligibility(campaign_id=campaign.id)

    assert result.status == "blocked"
    assert result.code == "followup_missing_reference_time"
    assert result.total_primary_recipients_evaluated == 0
    assert result.blocked_count == 0
    assert result.blocked_reason_counts == {}


def test_followup_simulation_delay_not_elapsed_blocks_before_candidates() -> None:
    service, campaign, email_logs, provider_events = build_followup_simulation_service(
        followup_delay_value=3,
        followup_delay_unit="days",
    )
    add_primary_log_with_events(
        email_logs=email_logs,
        provider_events=provider_events,
        campaign=campaign,
        contact_id="contact_1",
        event_types=("delivered",),
        created_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )

    result = service.simulate_followup_eligibility(campaign_id=campaign.id)

    assert result.status == "blocked"
    assert result.code == "followup_delay_not_elapsed"
    assert result.total_primary_recipients_evaluated == 0
    assert result.blocked_count == 0
    assert result.blocked_reason_counts == {}


def test_followup_simulation_daily_cap_exceeded_blocks() -> None:
    service, campaign, email_logs, provider_events = build_followup_simulation_service(
        followup_daily_limit=1,
    )
    add_primary_log_with_events(
        email_logs=email_logs,
        provider_events=provider_events,
        campaign=campaign,
        contact_id="contact_1",
        event_types=("delivered",),
    )
    email_logs.create_email_log(
        client_id=campaign.client_id,
        campaign_id=campaign.id,
        contact_id="other_contact",
        send_kind="followup",
        status="sent",
    )

    result = service.simulate_followup_eligibility(campaign_id=campaign.id)

    assert result.status == "blocked"
    assert result.code == "followup_daily_limit_exceeded"
    assert result.total_primary_recipients_evaluated == 0


def test_followup_simulation_monthly_cap_exceeded_blocks() -> None:
    service, campaign, email_logs, provider_events = build_followup_simulation_service(
        followup_daily_limit=10,
        followup_monthly_limit=1,
    )
    add_primary_log_with_events(
        email_logs=email_logs,
        provider_events=provider_events,
        campaign=campaign,
        contact_id="contact_1",
        event_types=("delivered",),
    )
    email_logs.create_email_log(
        client_id=campaign.client_id,
        campaign_id=campaign.id,
        contact_id="other_contact",
        send_kind="followup",
        status="sent",
    )

    result = service.simulate_followup_eligibility(campaign_id=campaign.id)

    assert result.status == "blocked"
    assert result.code == "followup_monthly_limit_exceeded"
    assert result.total_primary_recipients_evaluated == 0


def test_followup_simulation_candidate_reason_counts_and_no_persistence() -> None:
    contacts = [
        build_contact(contact_id="eligible", email="eligible@example.test"),
        build_contact(contact_id="opened", email="opened@example.test"),
        build_contact(contact_id="missing_delivery", email="missing@example.test"),
        build_contact(contact_id="suppressed", email="suppressed@example.test"),
        build_contact(
            contact_id="unsubscribed",
            email="unsubscribed@example.test",
            status="unsubscribed",
        ),
        build_contact(contact_id="failed", email="failed@example.test"),
        build_contact(contact_id="complaint", email="complaint@example.test"),
        build_contact(contact_id="prior_followup", email="prior@example.test"),
        build_contact(contact_id="normal_primary_log", email="normal@example.test"),
    ]
    email_logs = InMemoryEmailLogRepository()
    provider_events = InMemoryProviderEventRepository()
    service, campaign, email_logs, provider_events = build_followup_simulation_service(
        contacts=contacts,
        suppression_records=[
            SuppressionRecord(
                id="suppression_1",
                client_id="client_123",
                email="suppressed@example.test",
                reason="manual",
                created_at=datetime.now(timezone.utc),
            )
        ],
        email_logs=email_logs,
        provider_events=provider_events,
    )
    add_primary_log_with_events(
        email_logs=email_logs,
        provider_events=provider_events,
        campaign=campaign,
        contact_id="eligible",
        event_types=("delivered",),
    )
    add_primary_log_with_events(
        email_logs=email_logs,
        provider_events=provider_events,
        campaign=campaign,
        contact_id="opened",
        event_types=("delivered", "opened"),
    )
    add_primary_log_with_events(
        email_logs=email_logs,
        provider_events=provider_events,
        campaign=campaign,
        contact_id="missing_delivery",
        event_types=(),
    )
    add_primary_log_with_events(
        email_logs=email_logs,
        provider_events=provider_events,
        campaign=campaign,
        contact_id="suppressed",
        event_types=("delivered",),
    )
    add_primary_log_with_events(
        email_logs=email_logs,
        provider_events=provider_events,
        campaign=campaign,
        contact_id="unsubscribed",
        event_types=("delivered",),
    )
    add_primary_log_with_events(
        email_logs=email_logs,
        provider_events=provider_events,
        campaign=campaign,
        contact_id="failed",
        event_types=("delivered", "hard_bounce"),
    )
    add_primary_log_with_events(
        email_logs=email_logs,
        provider_events=provider_events,
        campaign=campaign,
        contact_id="complaint",
        event_types=("delivered", "complaint"),
    )
    add_primary_log_with_events(
        email_logs=email_logs,
        provider_events=provider_events,
        campaign=campaign,
        contact_id="prior_followup",
        event_types=("delivered",),
    )
    add_primary_log_with_events(
        email_logs=email_logs,
        provider_events=provider_events,
        campaign=campaign,
        contact_id="normal_primary_log",
        event_types=("delivered",),
    )
    email_logs.create_email_log(
        client_id=campaign.client_id,
        campaign_id=campaign.id,
        contact_id="prior_followup",
        send_kind="followup",
        status="sent",
        created_at=datetime.now(timezone.utc) - timedelta(days=1),
    )
    email_logs.create_email_log(
        client_id=campaign.client_id,
        campaign_id=campaign.id,
        contact_id="normal_primary_log",
        send_kind="campaign",
        status="sent",
        created_at=datetime.now(timezone.utc) - timedelta(days=4),
    )
    before_email_logs = len(email_logs._records)
    before_provider_events = len(provider_events._records)

    result = service.simulate_followup_eligibility(campaign_id=campaign.id)

    assert result.status == "simulated"
    assert result.total_primary_recipients_evaluated == 9
    assert result.eligible_count == 2
    assert result.blocked_count == 7
    assert result.blocked_reason_counts == {
        "followup_already_opened": 1,
        "followup_already_sent": 1,
        "followup_complaint": 1,
        "followup_delivery_failed": 1,
        "followup_not_delivered": 1,
        "followup_suppressed": 2,
    }
    assert result.email_logs_created == 0
    assert result.provider_events_created == 0
    assert result.external_mappings_created == 0
    assert result.real_send_attempted is False
    assert result.external_dispatch_performed is False
    assert len(email_logs._records) == before_email_logs
    assert len(provider_events._records) == before_provider_events


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


def test_admin_send_followup_requires_platform_admin() -> None:
    response = TestClient(app, raise_server_exceptions=False).post(
        "/admin/campaigns/campaign_123/send-followup"
    )

    assert response.status_code == 401


def test_admin_send_followup_respects_email_sending_disabled() -> None:
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
    email_log_repository = InMemoryEmailLogRepository()
    primary_log = email_log_repository.create_email_log(
        client_id="client_123",
        campaign_id=campaign_record.id,
        contact_id=contact.id,
        send_kind="campaign",
        status="delivered",
    )
    provider_events = InMemoryProviderEventRepository()
    add_processed_provider_event(
        provider_events,
        client_id="client_123",
        campaign_id=campaign_record.id,
        contact_id=contact.id,
        email_log_id=primary_log.id,
        event_type="delivered",
    )
    campaign_limits = InMemoryCampaignSendingLimitRepository()
    campaign_limits.update_for_campaign(
        campaign_id=campaign_record.id,
        followup_enabled=True,
        followup_daily_limit=5,
        followup_monthly_limit=50,
        followup_delay_value=3,
        followup_delay_unit="days",
        followup_subject="Follow-up",
        followup_body_html="<p>Follow-up {{unsubscribe_url}}</p>",
        followup_body_text="Follow-up",
    )
    fake_listmonk = FakeListmonkClient()
    admin_service = build_admin_service(
        campaign_repository=repository,
        clients=[client],
        contacts=[contact],
        campaign_contacts={("client_123", campaign_record.id, contact.id)},
        email_log_repository=email_log_repository,
        provider_event_repository=provider_events,
        campaign_limit_repository=campaign_limits,
    )
    dispatch_service = build_dispatch_service(
        settings=Settings(email_sending_enabled_raw="false"),
        campaign=to_client_campaign(campaign_record),
        client=client,
        contacts=[contact],
        campaign_contacts={("client_123", campaign_record.id, contact.id)},
        fake_listmonk=fake_listmonk,
        campaign_limit_repository=campaign_limits,
        email_log_repository=email_log_repository,
        provider_event_repository=provider_events,
    )

    app.dependency_overrides[require_platform_admin] = build_admin_user
    app.dependency_overrides[get_admin_campaign_service] = lambda: admin_service
    app.dependency_overrides[get_campaign_dispatch_service] = lambda: dispatch_service

    try:
        response = TestClient(app).post("/admin/campaigns/campaign_123/send-followup")
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
