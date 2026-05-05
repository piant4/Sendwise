from app.guard.deliverability_guard import DeliverabilityGuard, SendDecision
from app.repositories.campaigns import CampaignsRepository
from app.schemas.campaigns import Campaign
from app.schemas.common import CampaignStatus
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


def _campaign_with_status(status: CampaignStatus) -> Campaign:
    campaign = CampaignsRepository().get_campaign("campaign_acme_welcome")
    assert campaign is not None
    return campaign.model_copy(update={"status": status})


def _authorize_status(status: CampaignStatus) -> str:
    campaign = _campaign_with_status(status)
    service = CampaignsService(
        repository=CampaignStateRepository(campaign),
        guard=DeliverabilityGuard(),
        blocked_sends_service=BlockedSendsService(RecordingBlockedSendsRepository()),
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
    )

    response = service.authorize_campaign(campaign.id)

    assert response == {
        "status": SendDecision.AUTHORIZED.value,
        "endpoint": f"POST /campaigns/{campaign.id}/authorize",
    }
    assert blocked_sends_repository.records == []
