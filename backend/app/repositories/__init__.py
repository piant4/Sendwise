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
from app.repositories.provider_events import (
    InMemoryProviderEventRepository,
    PostgresProviderEventRepository,
    ProviderEventRecord,
    ProviderEventRepository,
)

__all__ = [
    "CampaignRecord",
    "CampaignRepository",
    "CampaignSlotRecord",
    "CampaignSlotRepository",
    "InMemoryCampaignRepository",
    "InMemoryCampaignSlotRepository",
    "InMemoryProviderEventRepository",
    "PostgresCampaignRepository",
    "PostgresCampaignSlotRepository",
    "PostgresProviderEventRepository",
    "ProviderEventRecord",
    "ProviderEventRepository",
]
