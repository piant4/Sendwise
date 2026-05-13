from __future__ import annotations

from dataclasses import dataclass

from app.repositories.campaign_slots import (
    CampaignSlotRecord,
    CampaignSlotRepository,
    PostgresCampaignSlotRepository,
)
from app.repositories.campaigns import CampaignRepository, PostgresCampaignRepository
from app.core.config import get_settings


class CampaignSlotValidationError(ValueError):
    """Raised when a slot payload is invalid."""


class CampaignSlotConflictError(ValueError):
    """Raised when a slot assignment would violate campaign ownership or status."""


@dataclass(frozen=True)
class CampaignSlotService:
    slot_repository: CampaignSlotRepository
    campaign_repository: CampaignRepository

    def create_slot(
        self,
        *,
        client_id: str,
        label: str,
        max_emails: int,
    ) -> CampaignSlotRecord:
        normalized_label = label.strip()
        if not normalized_label:
            raise CampaignSlotValidationError("campaign slot label is required")
        if max_emails < 0:
            raise CampaignSlotValidationError("campaign slot max_emails must be non-negative")

        return self.slot_repository.create_slot(
            client_id=client_id,
            label=normalized_label,
            max_emails=max_emails,
        )

    def get_slot(
        self,
        *,
        client_id: str,
        slot_id: str,
    ) -> CampaignSlotRecord | None:
        return self.slot_repository.get_by_id(client_id=client_id, slot_id=slot_id)

    def list_slots(self, *, client_id: str) -> list[CampaignSlotRecord]:
        return self.slot_repository.list_by_client(client_id)

    def assign_slot(
        self,
        *,
        client_id: str,
        campaign_id: str,
        slot_id: str,
    ) -> CampaignSlotRecord:
        campaign = self.campaign_repository.get_by_id(
            campaign_id=campaign_id,
            client_id=client_id,
        )
        if campaign is None:
            raise CampaignSlotConflictError("campaign was not found for this client")

        slot = self.slot_repository.get_by_id(client_id=client_id, slot_id=slot_id)
        if slot is None:
            raise CampaignSlotConflictError("campaign slot was not found for this client")
        if slot.status == "archived":
            raise CampaignSlotConflictError("archived campaign slots cannot be assigned")
        if slot.assigned_campaign_id and slot.assigned_campaign_id != campaign_id:
            raise CampaignSlotConflictError("campaign slot is already assigned to another campaign")
        if campaign.campaign_slot_id and campaign.campaign_slot_id != slot.id:
            raise CampaignSlotConflictError("campaign already has a different slot assigned")

        self.campaign_repository.assign_slot(
            client_id=client_id,
            campaign_id=campaign_id,
            campaign_slot_id=slot.id,
        )
        return self.slot_repository.assign_to_campaign(
            client_id=client_id,
            slot_id=slot.id,
            campaign_id=campaign_id,
        )

    def mark_slot_used(
        self,
        *,
        client_id: str,
        slot_id: str,
    ) -> CampaignSlotRecord:
        slot = self.slot_repository.get_by_id(client_id=client_id, slot_id=slot_id)
        if slot is None:
            raise CampaignSlotConflictError("campaign slot was not found for this client")
        return self.slot_repository.mark_used(client_id=client_id, slot_id=slot_id)

    def archive_slot(
        self,
        *,
        client_id: str,
        slot_id: str,
    ) -> CampaignSlotRecord:
        slot = self.slot_repository.get_by_id(client_id=client_id, slot_id=slot_id)
        if slot is None:
            raise CampaignSlotConflictError("campaign slot was not found for this client")
        return self.slot_repository.archive(client_id=client_id, slot_id=slot_id)

    def get_slot_for_campaign(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> CampaignSlotRecord | None:
        return self.slot_repository.get_for_campaign(
            client_id=client_id,
            campaign_id=campaign_id,
        )


def get_campaign_slot_service() -> CampaignSlotService:
    settings = get_settings()
    return CampaignSlotService(
        slot_repository=PostgresCampaignSlotRepository(settings),
        campaign_repository=PostgresCampaignRepository(settings),
    )
