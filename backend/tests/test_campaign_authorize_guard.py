from app.core.config import get_settings
from app.guard.deliverability_guard import (
    DeliverabilityGuard,
    GuardResult,
    SendDecision,
)
from app.repositories.campaigns import CampaignsRepository
from app.schemas.campaigns import Campaign
from app.schemas.clients import Client, ClientContext, ClientUser
from app.schemas.common import CampaignStatus, ClientStatus, ContactStatus
from app.schemas.contacts import Contact
from app.services.blocked_sends import BlockedSendsService
from app.services.campaigns import CampaignsService


class CampaignStateRepository:
    def __init__(self, campaign: Campaign) -> None:
        self.campaign = campaign

    def get_campaign(self, campaign_id: str) -> Campaign | None:
        if campaign_id == self.campaign.id:
            return self.campaign
        return None


class RecordingBlockedSendsRepository:
    def __init__(self) -> None:
        self.records: list[object] = []

    def append_blocked_send(self, record: object) -> object:
        self.records.append(record)
        return record


class StubContactsService:
    def __init__(self, contacts: list[Contact]) -> None:
        self.contacts = contacts
        self.calls: list[tuple[str, str]] = []

    def list_campaign_contacts(
        self,
        campaign_id: str,
        client_id: str,
    ) -> list[Contact]:
        self.calls.append((campaign_id, client_id))
        return self.contacts


class FailingContactsService:
    def list_campaign_contacts(self, *_args: object, **_kwargs: object) -> list[Contact]:
        raise AssertionError("contacts should not be checked for blocked campaigns")


class StubClientsService:
    def __init__(self, client_status: ClientStatus = ClientStatus.active) -> None:
        self.client_status = client_status
        self.calls = 0
        self.client_ids: list[str] = []

    def get_client(self, client_id: str) -> Client | None:
        self.calls += 1
        self.client_ids.append(client_id)
        return Client(
            id=client_id,
            name="Scoped Client",
            status=self.client_status,
            created_at="2026-05-01T09:00:00Z",
            updated_at="2026-05-05T09:00:00Z",
        )

    def get_current_client_context(self) -> ClientContext:
        self.calls += 1
        return ClientContext(
            client=Client(
                id="client_acme",
                name="Acme Studio",
                status=self.client_status,
                created_at="2026-05-01T09:00:00Z",
                updated_at="2026-05-05T09:00:00Z",
            ),
            user=ClientUser(
                id="user_acme_manager",
                client_id="client_acme",
                email="manager@example.test",
                role="client_manager",
                created_at="2026-05-01T09:05:00Z",
                updated_at="2026-05-05T09:05:00Z",
            ),
        )


class OrderTrackingGuard(DeliverabilityGuard):
    def __init__(self) -> None:
        self.calls: list[str] = []

    def authorize_campaign_send(self, email_sending_enabled: bool) -> GuardResult:
        self.calls.append("send")
        return super().authorize_campaign_send(email_sending_enabled)

    def authorize_client_state(self, client_status: ClientStatus) -> GuardResult:
        self.calls.append("client")
        return super().authorize_client_state(client_status)

    def authorize_campaign_state(self, campaign_status: CampaignStatus) -> GuardResult:
        self.calls.append("campaign")
        return super().authorize_campaign_state(campaign_status)

    def authorize_campaign_targets(self, contact_count: int) -> GuardResult:
        self.calls.append("target")
        return super().authorize_campaign_targets(contact_count)


def _campaign_with_status(status: CampaignStatus) -> Campaign:
    campaign = CampaignsRepository().get_campaign("campaign_acme_welcome")
    assert campaign is not None
    return campaign.model_copy(update={"status": status})


def _contact_with_status(status: ContactStatus) -> Contact:
    return Contact(
        id=f"contact_test_{status.value}",
        client_id="client_acme",
        email=f"{status.value}@example.test",
        status=status,
        created_at="2026-05-05T09:00:00Z",
        updated_at="2026-05-05T09:00:00Z",
    )


def _campaign_for_client(client_id: str) -> Campaign:
    return _campaign_with_status(CampaignStatus.ready).model_copy(
        update={"client_id": client_id}
    )


def _authorize_status(status: CampaignStatus) -> str:
    campaign = _campaign_with_status(status)
    service = CampaignsService(
        repository=CampaignStateRepository(campaign),
        guard=DeliverabilityGuard(),
        blocked_sends_service=BlockedSendsService(RecordingBlockedSendsRepository()),
        clients_service=StubClientsService(),
        email_sending_enabled=True,
    )

    response = service.authorize_campaign(campaign.id)

    assert set(response.keys()) == {"status", "endpoint"}
    assert response["endpoint"] == f"POST /campaigns/{campaign.id}/authorize"
    return response["status"]


def test_ready_campaign_authorize_preserves_existing_shape() -> None:
    assert _authorize_status(CampaignStatus.ready) == SendDecision.AUTHORIZED.value


def test_running_campaign_is_authorized() -> None:
    assert _authorize_status(CampaignStatus.running) == SendDecision.AUTHORIZED.value


def test_draft_campaign_is_blocked() -> None:
    assert _authorize_status(CampaignStatus.draft) == SendDecision.BLOCKED.value


def test_paused_blocked_completed_failed_campaigns_are_blocked() -> None:
    blocked_statuses = [
        CampaignStatus.paused,
        CampaignStatus.blocked,
        CampaignStatus.completed,
        CampaignStatus.failed,
    ]

    for status in blocked_statuses:
        assert _authorize_status(status) == SendDecision.BLOCKED.value


def test_blocked_campaign_authorize_logs_blocked_send_attempt() -> None:
    campaign = _campaign_with_status(CampaignStatus.draft)
    blocked_sends_repository = RecordingBlockedSendsRepository()
    blocked_sends_service = BlockedSendsService(blocked_sends_repository)
    service = CampaignsService(
        repository=CampaignStateRepository(campaign),
        guard=DeliverabilityGuard(),
        blocked_sends_service=blocked_sends_service,
        email_sending_enabled=True,
    )

    response = service.authorize_campaign(campaign.id)

    assert response == {
        "status": SendDecision.BLOCKED.value,
        "endpoint": f"POST /campaigns/{campaign.id}/authorize",
    }
    assert len(blocked_sends_repository.records) == 1

    record = blocked_sends_repository.records[0]
    assert record.client_id == campaign.client_id
    assert record.campaign_id == campaign.id
    assert record.contact_id is None
    assert record.reason == "Campaign state draft cannot send."
    assert record.decision.value == SendDecision.BLOCKED.value
    assert record.created_at is not None
    assert record.id == f"blocked_{campaign.client_id}_{campaign.id}_authorization"


def test_allowed_campaign_authorize_does_not_log_blocked_send_attempt() -> None:
    campaign = _campaign_with_status(CampaignStatus.ready)
    blocked_sends_repository = RecordingBlockedSendsRepository()
    blocked_sends_service = BlockedSendsService(blocked_sends_repository)
    service = CampaignsService(
        repository=CampaignStateRepository(campaign),
        guard=DeliverabilityGuard(),
        blocked_sends_service=blocked_sends_service,
        email_sending_enabled=True,
    )

    response = service.authorize_campaign(campaign.id)

    assert response == {
        "status": SendDecision.AUTHORIZED.value,
        "endpoint": f"POST /campaigns/{campaign.id}/authorize",
    }
    assert blocked_sends_repository.records == []


def test_active_client_authorize_preserves_existing_behavior() -> None:
    campaign = _campaign_with_status(CampaignStatus.ready)
    blocked_sends_repository = RecordingBlockedSendsRepository()
    service = CampaignsService(
        repository=CampaignStateRepository(campaign),
        guard=DeliverabilityGuard(),
        blocked_sends_service=BlockedSendsService(blocked_sends_repository),
        contacts_service=StubContactsService(
            contacts=[_contact_with_status(ContactStatus.sendable)]
        ),
        clients_service=StubClientsService(ClientStatus.active),
        email_sending_enabled=True,
    )

    response = service.authorize_campaign(campaign.id)

    assert response == {
        "status": SendDecision.AUTHORIZED.value,
        "endpoint": f"POST /campaigns/{campaign.id}/authorize",
    }
    assert blocked_sends_repository.records == []


def test_authorize_checks_lifecycle_for_campaign_client_id() -> None:
    campaign = _campaign_for_client("client_nova")
    clients_service = StubClientsService(ClientStatus.active)
    service = CampaignsService(
        repository=CampaignStateRepository(campaign),
        guard=DeliverabilityGuard(),
        blocked_sends_service=BlockedSendsService(RecordingBlockedSendsRepository()),
        contacts_service=StubContactsService(
            contacts=[_contact_with_status(ContactStatus.sendable)]
        ),
        clients_service=clients_service,
        email_sending_enabled=True,
    )

    response = service.authorize_campaign(campaign.id)

    assert response == {
        "status": SendDecision.AUTHORIZED.value,
        "endpoint": f"POST /campaigns/{campaign.id}/authorize",
    }
    assert clients_service.client_ids == [campaign.client_id]


def test_paused_blocked_archived_campaign_client_blocks_when_current_is_active() -> None:
    class MixedClientsService(StubClientsService):
        def __init__(self, campaign_client_status: ClientStatus) -> None:
            super().__init__(ClientStatus.active)
            self.campaign_client_status = campaign_client_status

        def get_client(self, client_id: str) -> Client | None:
            client = super().get_client(client_id)
            assert client is not None
            return client.model_copy(update={"status": self.campaign_client_status})

        def get_current_client_context(self) -> ClientContext:
            context = super().get_current_client_context()
            return context.model_copy(
                update={
                    "client": context.client.model_copy(
                        update={"status": ClientStatus.active}
                    )
                }
            )

    for status in [ClientStatus.paused, ClientStatus.blocked, ClientStatus.archived]:
        campaign = _campaign_for_client("client_nova")
        blocked_sends_repository = RecordingBlockedSendsRepository()
        service = CampaignsService(
            repository=CampaignStateRepository(campaign),
            guard=DeliverabilityGuard(),
            blocked_sends_service=BlockedSendsService(blocked_sends_repository),
            contacts_service=FailingContactsService(),
            clients_service=MixedClientsService(status),
            email_sending_enabled=True,
        )

        response = service.authorize_campaign(campaign.id)

        assert response == {
            "status": SendDecision.BLOCKED.value,
            "endpoint": f"POST /campaigns/{campaign.id}/authorize",
        }
        assert len(blocked_sends_repository.records) == 1
        record = blocked_sends_repository.records[0]
        assert record.client_id == campaign.client_id
        assert record.reason == f"Client state {status.value} cannot send."


def test_paused_blocked_archived_clients_are_blocked_and_logged() -> None:
    for status in [ClientStatus.paused, ClientStatus.blocked, ClientStatus.archived]:
        campaign = _campaign_with_status(CampaignStatus.ready)
        blocked_sends_repository = RecordingBlockedSendsRepository()
        service = CampaignsService(
            repository=CampaignStateRepository(campaign),
            guard=DeliverabilityGuard(),
            blocked_sends_service=BlockedSendsService(blocked_sends_repository),
            contacts_service=FailingContactsService(),
            clients_service=StubClientsService(status),
            email_sending_enabled=True,
        )

        response = service.authorize_campaign(campaign.id)

        assert response == {
            "status": SendDecision.BLOCKED.value,
            "endpoint": f"POST /campaigns/{campaign.id}/authorize",
        }
        assert len(blocked_sends_repository.records) == 1
        record = blocked_sends_repository.records[0]
        assert record.client_id == campaign.client_id
        assert record.campaign_id == campaign.id
        assert record.reason == f"Client state {status.value} cannot send."
        assert record.decision.value == SendDecision.BLOCKED.value


def test_client_lifecycle_check_runs_after_env_and_before_campaign_state() -> None:
    campaign = _campaign_with_status(CampaignStatus.ready)
    guard = OrderTrackingGuard()
    service = CampaignsService(
        repository=CampaignStateRepository(campaign),
        guard=guard,
        blocked_sends_service=BlockedSendsService(RecordingBlockedSendsRepository()),
        contacts_service=StubContactsService(
            contacts=[_contact_with_status(ContactStatus.sendable)]
        ),
        clients_service=StubClientsService(ClientStatus.active),
        email_sending_enabled=True,
    )

    response = service.authorize_campaign(campaign.id)

    assert response["status"] == SendDecision.AUTHORIZED.value
    assert guard.calls == ["send", "client", "campaign", "target"]


def test_fail_closed_env_runs_before_client_lifecycle_check() -> None:
    campaign = _campaign_with_status(CampaignStatus.ready)
    guard = OrderTrackingGuard()
    clients_service = StubClientsService(ClientStatus.paused)
    service = CampaignsService(
        repository=CampaignStateRepository(campaign),
        guard=guard,
        blocked_sends_service=BlockedSendsService(RecordingBlockedSendsRepository()),
        contacts_service=FailingContactsService(),
        clients_service=clients_service,
        email_sending_enabled=False,
    )

    response = service.authorize_campaign(campaign.id)

    assert response["status"] == SendDecision.BLOCKED.value
    assert guard.calls == ["send"]
    assert clients_service.calls == 0


def test_ready_campaign_with_all_sendable_contacts_is_authorized() -> None:
    campaign = _campaign_with_status(CampaignStatus.ready)
    contacts_service = StubContactsService(
        contacts=[
            _contact_with_status(ContactStatus.sendable),
            _contact_with_status(ContactStatus.sendable),
        ]
    )
    blocked_sends_repository = RecordingBlockedSendsRepository()
    service = CampaignsService(
        repository=CampaignStateRepository(campaign),
        guard=DeliverabilityGuard(),
        blocked_sends_service=BlockedSendsService(blocked_sends_repository),
        contacts_service=contacts_service,
        email_sending_enabled=True,
    )

    response = service.authorize_campaign(campaign.id)

    assert response == {
        "status": SendDecision.AUTHORIZED.value,
        "endpoint": f"POST /campaigns/{campaign.id}/authorize",
    }
    assert contacts_service.calls == [(campaign.id, campaign.client_id)]
    assert blocked_sends_repository.records == []


def test_ready_campaign_with_no_associated_contacts_is_blocked_and_logged() -> None:
    campaign = _campaign_with_status(CampaignStatus.ready)
    contacts_service = StubContactsService(contacts=[])
    blocked_sends_repository = RecordingBlockedSendsRepository()
    service = CampaignsService(
        repository=CampaignStateRepository(campaign),
        guard=DeliverabilityGuard(),
        blocked_sends_service=BlockedSendsService(blocked_sends_repository),
        contacts_service=contacts_service,
        email_sending_enabled=True,
    )

    response = service.authorize_campaign(campaign.id)

    assert response == {
        "status": SendDecision.BLOCKED.value,
        "endpoint": f"POST /campaigns/{campaign.id}/authorize",
    }
    assert contacts_service.calls == [(campaign.id, campaign.client_id)]
    assert len(blocked_sends_repository.records) == 1

    record = blocked_sends_repository.records[0]
    assert record.client_id == campaign.client_id
    assert record.campaign_id == campaign.id
    assert record.contact_id is None
    assert record.reason == "no_campaign_contacts"
    assert record.decision.value == SendDecision.BLOCKED.value


def test_ready_campaign_with_non_sendable_contact_is_blocked() -> None:
    blocked_statuses = [
        ContactStatus.unsubscribed,
        ContactStatus.suppressed,
        ContactStatus.bounced,
        ContactStatus.blacklisted,
        ContactStatus.error,
        ContactStatus.pending,
    ]

    for status in blocked_statuses:
        campaign = _campaign_with_status(CampaignStatus.ready)
        service = CampaignsService(
            repository=CampaignStateRepository(campaign),
            guard=DeliverabilityGuard(),
            blocked_sends_service=BlockedSendsService(
                RecordingBlockedSendsRepository()
            ),
            contacts_service=StubContactsService(
                contacts=[_contact_with_status(status)]
            ),
            email_sending_enabled=True,
        )

        response = service.authorize_campaign(campaign.id)

        assert response == {
            "status": SendDecision.BLOCKED.value,
            "endpoint": f"POST /campaigns/{campaign.id}/authorize",
        }


def test_draft_and_paused_campaigns_block_before_contact_checks() -> None:
    for status in [CampaignStatus.draft, CampaignStatus.paused]:
        campaign = _campaign_with_status(status)
        service = CampaignsService(
            repository=CampaignStateRepository(campaign),
            guard=DeliverabilityGuard(),
            blocked_sends_service=BlockedSendsService(
                RecordingBlockedSendsRepository()
            ),
            contacts_service=FailingContactsService(),
            email_sending_enabled=True,
        )

        response = service.authorize_campaign(campaign.id)

        assert response == {
            "status": SendDecision.BLOCKED.value,
            "endpoint": f"POST /campaigns/{campaign.id}/authorize",
        }


def test_blocked_contact_authorization_logs_blocked_send_attempt() -> None:
    campaign = _campaign_with_status(CampaignStatus.ready)
    blocked_contact = _contact_with_status(ContactStatus.unsubscribed)
    blocked_sends_repository = RecordingBlockedSendsRepository()
    service = CampaignsService(
        repository=CampaignStateRepository(campaign),
        guard=DeliverabilityGuard(),
        blocked_sends_service=BlockedSendsService(blocked_sends_repository),
        contacts_service=StubContactsService(contacts=[blocked_contact]),
        email_sending_enabled=True,
    )

    response = service.authorize_campaign(campaign.id)

    assert response == {
        "status": SendDecision.BLOCKED.value,
        "endpoint": f"POST /campaigns/{campaign.id}/authorize",
    }
    assert len(blocked_sends_repository.records) == 1

    record = blocked_sends_repository.records[0]
    assert record.client_id == campaign.client_id
    assert record.campaign_id == campaign.id
    assert record.contact_id == blocked_contact.id
    assert record.reason == "Contact state unsubscribed cannot send."
    assert record.decision.value == SendDecision.BLOCKED.value


def test_missing_email_sending_enabled_blocks_and_logs(monkeypatch) -> None:
    monkeypatch.delenv("EMAIL_SENDING_ENABLED", raising=False)
    get_settings.cache_clear()
    campaign = _campaign_with_status(CampaignStatus.ready)
    blocked_sends_repository = RecordingBlockedSendsRepository()
    service = CampaignsService(
        repository=CampaignStateRepository(campaign),
        guard=DeliverabilityGuard(),
        blocked_sends_service=BlockedSendsService(blocked_sends_repository),
        contacts_service=FailingContactsService(),
    )

    response = service.authorize_campaign(campaign.id)

    assert response == {
        "status": SendDecision.BLOCKED.value,
        "endpoint": f"POST /campaigns/{campaign.id}/authorize",
    }
    assert len(blocked_sends_repository.records) == 1
    assert blocked_sends_repository.records[0].reason == (
        'EMAIL_SENDING_ENABLED is not exactly "true".'
    )
    get_settings.cache_clear()


def test_false_email_sending_enabled_blocks_and_logs(monkeypatch) -> None:
    monkeypatch.setenv("EMAIL_SENDING_ENABLED", "false")
    get_settings.cache_clear()
    campaign = _campaign_with_status(CampaignStatus.ready)
    blocked_sends_repository = RecordingBlockedSendsRepository()
    service = CampaignsService(
        repository=CampaignStateRepository(campaign),
        guard=DeliverabilityGuard(),
        blocked_sends_service=BlockedSendsService(blocked_sends_repository),
        contacts_service=FailingContactsService(),
    )

    response = service.authorize_campaign(campaign.id)

    assert set(response.keys()) == {"status", "endpoint"}
    assert response["status"] == SendDecision.BLOCKED.value
    assert response["endpoint"] == f"POST /campaigns/{campaign.id}/authorize"
    assert len(blocked_sends_repository.records) == 1
    assert blocked_sends_repository.records[0].decision.value == (
        SendDecision.BLOCKED.value
    )
    get_settings.cache_clear()


def test_send_with_missing_email_sending_enabled_runs_blocked_preflight_and_logs(
    monkeypatch,
) -> None:
    monkeypatch.delenv("EMAIL_SENDING_ENABLED", raising=False)
    get_settings.cache_clear()
    campaign = _campaign_with_status(CampaignStatus.ready)
    blocked_sends_repository = RecordingBlockedSendsRepository()
    service = CampaignsService(
        repository=CampaignStateRepository(campaign),
        guard=DeliverabilityGuard(),
        blocked_sends_service=BlockedSendsService(blocked_sends_repository),
        contacts_service=FailingContactsService(),
    )

    response = service.send_campaign(campaign.id)

    assert response == {
        "status": "stub",
        "endpoint": f"POST /campaigns/{campaign.id}/send",
    }
    assert len(blocked_sends_repository.records) == 1
    assert blocked_sends_repository.records[0].reason == (
        'EMAIL_SENDING_ENABLED is not exactly "true".'
    )
    get_settings.cache_clear()


def test_send_with_false_email_sending_enabled_runs_blocked_preflight_and_logs(
    monkeypatch,
) -> None:
    monkeypatch.setenv("EMAIL_SENDING_ENABLED", "false")
    get_settings.cache_clear()
    campaign = _campaign_with_status(CampaignStatus.ready)
    blocked_sends_repository = RecordingBlockedSendsRepository()
    service = CampaignsService(
        repository=CampaignStateRepository(campaign),
        guard=DeliverabilityGuard(),
        blocked_sends_service=BlockedSendsService(blocked_sends_repository),
        contacts_service=FailingContactsService(),
    )

    response = service.send_campaign(campaign.id)

    assert set(response.keys()) == {"status", "endpoint"}
    assert response["status"] == "stub"
    assert response["endpoint"] == f"POST /campaigns/{campaign.id}/send"
    assert len(blocked_sends_repository.records) == 1
    assert blocked_sends_repository.records[0].decision.value == (
        SendDecision.BLOCKED.value
    )
    get_settings.cache_clear()


def test_send_ready_campaign_with_sendable_contacts_stays_stub_allowed_path() -> None:
    campaign = _campaign_with_status(CampaignStatus.ready)
    contacts_service = StubContactsService(
        contacts=[_contact_with_status(ContactStatus.sendable)]
    )
    blocked_sends_repository = RecordingBlockedSendsRepository()
    service = CampaignsService(
        repository=CampaignStateRepository(campaign),
        guard=DeliverabilityGuard(),
        blocked_sends_service=BlockedSendsService(blocked_sends_repository),
        contacts_service=contacts_service,
        clients_service=StubClientsService(ClientStatus.active),
        email_sending_enabled=True,
    )

    response = service.send_campaign(campaign.id)

    assert response == {
        "status": "stub",
        "endpoint": f"POST /campaigns/{campaign.id}/send",
    }
    assert contacts_service.calls == [(campaign.id, campaign.client_id)]
    assert blocked_sends_repository.records == []


def test_send_with_blocked_campaign_client_or_contact_logs_preflight_block() -> None:
    blocked_cases = [
        (
            _campaign_with_status(CampaignStatus.draft),
            StubClientsService(ClientStatus.active),
            FailingContactsService(),
            "Campaign state draft cannot send.",
        ),
        (
            _campaign_with_status(CampaignStatus.ready),
            StubClientsService(ClientStatus.blocked),
            FailingContactsService(),
            "Client state blocked cannot send.",
        ),
        (
            _campaign_with_status(CampaignStatus.ready),
            StubClientsService(ClientStatus.active),
            StubContactsService(
                contacts=[_contact_with_status(ContactStatus.unsubscribed)]
            ),
            "Contact state unsubscribed cannot send.",
        ),
    ]

    for campaign, clients_service, contacts_service, reason in blocked_cases:
        blocked_sends_repository = RecordingBlockedSendsRepository()
        service = CampaignsService(
            repository=CampaignStateRepository(campaign),
            guard=DeliverabilityGuard(),
            blocked_sends_service=BlockedSendsService(blocked_sends_repository),
            contacts_service=contacts_service,
            clients_service=clients_service,
            email_sending_enabled=True,
        )

        response = service.send_campaign(campaign.id)

        assert response == {
            "status": "stub",
            "endpoint": f"POST /campaigns/{campaign.id}/send",
        }
        assert len(blocked_sends_repository.records) == 1
        record = blocked_sends_repository.records[0]
        assert record.client_id == campaign.client_id
        assert record.campaign_id == campaign.id
        assert record.reason == reason
        assert record.decision.value == SendDecision.BLOCKED.value
