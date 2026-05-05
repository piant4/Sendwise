from app.guard.deliverability_guard import DeliverabilityGuard, SendDecision
from app.repositories.campaigns import CampaignsRepository
from app.schemas.campaigns import Campaign
from app.schemas.common import CampaignStatus
from app.services.campaigns import CampaignsService


class CampaignStateRepository:
    def __init__(self, campaign: Campaign) -> None:
        self.campaign = campaign

    def get_campaign(self, campaign_id: str) -> Campaign | None:
        if campaign_id == self.campaign.id:
            return self.campaign
        return None


def _campaign_with_status(status: CampaignStatus) -> Campaign:
    campaign = CampaignsRepository().get_campaign("campaign_acme_welcome")
    assert campaign is not None
    return campaign.model_copy(update={"status": status})


def _authorize_status(status: CampaignStatus) -> str:
    campaign = _campaign_with_status(status)
    service = CampaignsService(
        repository=CampaignStateRepository(campaign),
        guard=DeliverabilityGuard(),
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
