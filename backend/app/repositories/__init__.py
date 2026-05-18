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
from app.repositories.campaign_sending_limits import (
    CampaignSendingLimitRecord,
    CampaignSendingLimitRepository,
    InMemoryCampaignSendingLimitRepository,
    PostgresCampaignSendingLimitRepository,
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
    "CampaignSendingLimitRecord",
    "CampaignSendingLimitRepository",
    "CampaignSlotRecord",
    "CampaignSlotRepository",
    "InMemoryCampaignRepository",
    "InMemoryCampaignSendingLimitRepository",
    "InMemoryCampaignSlotRepository",
    "InMemoryProviderEventRepository",
    "PostgresCampaignRepository",
    "PostgresCampaignSendingLimitRepository",
    "PostgresCampaignSlotRepository",
    "PostgresProviderEventRepository",
    "ProviderEventRecord",
    "ProviderEventRepository",
]
