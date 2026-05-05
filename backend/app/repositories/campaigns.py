from copy import deepcopy

from app.schemas.campaigns import Campaign
from app.schemas.common import CampaignStatus


_ADMIN_CAMPAIGNS: list[Campaign] = [
    Campaign(
        id="campaign_acme_welcome",
        client_id="client_acme",
        name="Welcome Series",
        status=CampaignStatus.ready,
        subject="Welcome to Acme Studio",
        created_at="2026-05-03T08:00:00Z",
        updated_at="2026-05-05T08:00:00Z",
    ),
    Campaign(
        id="campaign_nova_launch",
        client_id="client_nova",
        name="Spring Launch",
        status=CampaignStatus.draft,
        subject="Spring preview",
        created_at="2026-05-04T11:00:00Z",
        updated_at="2026-05-05T11:00:00Z",
    ),
]


class CampaignsRepository:
    """In-memory campaigns data boundary for Milestone 0.5 stubs."""

    def get_campaign(self, campaign_id: str) -> Campaign | None:
        for campaign in self.list_admin_campaigns():
            if campaign.id == campaign_id:
                return campaign
        return None

    def list_admin_campaigns(self, client_id: str | None = None) -> list[Campaign]:
        campaigns = deepcopy(_ADMIN_CAMPAIGNS)
        if client_id is None:
            return campaigns

        return [
            campaign
            for campaign in campaigns
            if campaign.client_id == client_id
        ]
