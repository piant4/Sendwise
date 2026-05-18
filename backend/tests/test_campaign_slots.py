from app.repositories.campaign_slots import InMemoryCampaignSlotRepository
from app.repositories.campaigns import InMemoryCampaignRepository
from app.services.campaign_slots import (
    CampaignSlotConflictError,
    CampaignSlotService,
    CampaignSlotValidationError,
)
from app.services.campaigns import CampaignStateService


def build_slot_service(
    *,
    campaign_repository: InMemoryCampaignRepository | None = None,
    slot_repository: InMemoryCampaignSlotRepository | None = None,
) -> CampaignSlotService:
    return CampaignSlotService(
        slot_repository=slot_repository or InMemoryCampaignSlotRepository(),
        campaign_repository=campaign_repository or InMemoryCampaignRepository(),
    )


def test_create_campaign_slot_is_valid() -> None:
    service = build_slot_service()

    slot = service.create_slot(
        client_id="client_123",
        label="Starter",
        max_emails=1000,
    )

    assert slot.client_id == "client_123"
    assert slot.label == "Starter"
    assert slot.max_emails == 1000
    assert slot.status == "available"


def test_negative_max_emails_is_rejected() -> None:
    service = build_slot_service()

    try:
        service.create_slot(
            client_id="client_123",
            label="Starter",
            max_emails=-1,
        )
    except CampaignSlotValidationError as error:
        assert "non-negative" in str(error)
    else:
        raise AssertionError("Expected CampaignSlotValidationError")


def test_archived_slot_cannot_be_assigned() -> None:
    campaign_repository = InMemoryCampaignRepository()
    campaign_repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    slot_repository = InMemoryCampaignSlotRepository()
    slot_repository.add_slot(
        slot_id="slot_123",
        client_id="client_123",
        label="Starter",
        max_emails=100,
        status="archived",
    )
    service = build_slot_service(
        campaign_repository=campaign_repository,
        slot_repository=slot_repository,
    )

    try:
        service.assign_slot(
            client_id="client_123",
            campaign_id="campaign_123",
            slot_id="slot_123",
        )
    except CampaignSlotConflictError as error:
        assert "archived" in str(error)
    else:
        raise AssertionError("Expected CampaignSlotConflictError")


def test_assigned_slot_cannot_be_reused_by_another_campaign() -> None:
    campaign_repository = InMemoryCampaignRepository()
    campaign_repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    campaign_repository.add_campaign(campaign_id="campaign_456", client_id="client_123")
    slot_repository = InMemoryCampaignSlotRepository()
    slot_repository.add_slot(
        slot_id="slot_123",
        client_id="client_123",
        label="Starter",
        max_emails=100,
        status="assigned",
        assigned_campaign_id="campaign_123",
    )
    service = build_slot_service(
        campaign_repository=campaign_repository,
        slot_repository=slot_repository,
    )

    try:
        service.assign_slot(
            client_id="client_123",
            campaign_id="campaign_456",
            slot_id="slot_123",
        )
    except CampaignSlotConflictError as error:
        assert "already assigned" in str(error)
    else:
        raise AssertionError("Expected CampaignSlotConflictError")


def test_cross_client_slot_campaign_mismatch_is_blocked() -> None:
    campaign_repository = InMemoryCampaignRepository()
    campaign_repository.add_campaign(campaign_id="campaign_123", client_id="client_123")
    slot_repository = InMemoryCampaignSlotRepository()
    slot_repository.add_slot(
        slot_id="slot_beta",
        client_id="client_beta",
        label="Other",
        max_emails=100,
    )
    service = build_slot_service(
        campaign_repository=campaign_repository,
        slot_repository=slot_repository,
    )

    try:
        service.assign_slot(
            client_id="client_123",
            campaign_id="campaign_123",
            slot_id="slot_beta",
        )
    except CampaignSlotConflictError as error:
        assert "not found for this client" in str(error)
    else:
        raise AssertionError("Expected CampaignSlotConflictError")


def test_contacts_ready_can_be_refreshed_from_campaign_contacts() -> None:
    repository = InMemoryCampaignRepository(
        campaigns=[],
        campaign_contacts={("client_123", "campaign_123", "contact_123")},
    )
    repository.add_campaign(
        campaign_id="campaign_123",
        client_id="client_123",
        contacts_ready=False,
    )
    service = CampaignStateService(repository=repository)

    updated = service.refresh_contacts_ready(
        client_id="client_123",
        campaign_id="campaign_123",
    )

    assert updated.contacts_ready is True
