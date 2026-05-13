"""Repository package."""

from app.repositories.campaign_slots import (
    CampaignSlotRecord,
    CampaignSlotRepository,
    InMemoryCampaignSlotRepository,
    PostgresCampaignSlotRepository,
)
from app.repositories.campaigns import (
    CampaignRecord,
    CampaignRepository,
    InMemoryCampaignRepository,
    PostgresCampaignRepository,
)

__all__ = [
    "CampaignRecord",
    "CampaignRepository",
    "CampaignSlotRecord",
    "CampaignSlotRepository",
    "InMemoryCampaignRepository",
    "InMemoryCampaignSlotRepository",
    "PostgresCampaignRepository",
    "PostgresCampaignSlotRepository",
]
