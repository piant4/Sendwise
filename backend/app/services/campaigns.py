from app.guard.deliverability_guard import DeliverabilityGuard
from app.repositories.campaigns import CampaignsRepository
from app.schemas.campaigns import Campaign
from app.services.blocked_sends import BlockedSendsService
from app.services.contacts import ContactsService


class CampaignsService:
    def __init__(
        self,
        repository: CampaignsRepository | None = None,
        guard: DeliverabilityGuard | None = None,
        blocked_sends_service: BlockedSendsService | None = None,
        contacts_service: ContactsService | None = None,
    ) -> None:
        self.repository = repository or CampaignsRepository()
        self.guard = guard or DeliverabilityGuard()
        self.blocked_sends_service = blocked_sends_service or BlockedSendsService()
        self.contacts_service = contacts_service or ContactsService()

    def list_admin_campaigns(self) -> list[Campaign]:
        return self.repository.list_admin_campaigns()

    def planned_admin_campaign_stub(self, endpoint: str) -> dict[str, str]:
        return {"status": "stub", "endpoint": endpoint}

    def create_campaign(self) -> dict[str, str]:
        return self.planned_admin_campaign_stub("POST /campaigns")

    def authorize_campaign(self, campaign_id: str) -> dict[str, str]:
        endpoint = f"POST /campaigns/{campaign_id}/authorize"
        campaign = self.repository.get_campaign(campaign_id)
        if campaign is None:
            return self.planned_admin_campaign_stub(endpoint)

        decision = self.guard.authorize_campaign_state(campaign.status)
        if decision.decision.value == "blocked":
            self.blocked_sends_service.log_blocked_authorization(
                client_id=campaign.client_id,
                campaign_id=campaign.id,
                reason=decision.reason,
                decision=decision.decision.value,
            )
            return {"status": decision.decision.value, "endpoint": endpoint}

        contacts = self.contacts_service.list_campaign_contacts(
            campaign_id=campaign.id,
            client_id=campaign.client_id,
        )
        for contact in contacts:
            contact_decision = self.guard.can_send_to_contact(contact.status)
            if contact_decision.decision.value == "blocked":
                self.blocked_sends_service.log_blocked_authorization(
                    client_id=campaign.client_id,
                    campaign_id=campaign.id,
                    reason=contact_decision.reason,
                    decision=contact_decision.decision.value,
                )
                return {
                    "status": contact_decision.decision.value,
                    "endpoint": endpoint,
                }

        return {"status": decision.decision.value, "endpoint": endpoint}

    def send_campaign(self, campaign_id: str) -> dict[str, str]:
        return self.planned_admin_campaign_stub(f"POST /campaigns/{campaign_id}/send")
