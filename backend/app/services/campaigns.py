from app.core.config import get_settings
from app.guard.deliverability_guard import DeliverabilityGuard
from app.repositories.campaigns import CampaignsRepository
from app.schemas.campaigns import Campaign
from app.services.blocked_sends import BlockedSendsService
from app.services.clients import ClientsService
from app.services.contacts import ContactsService


class CampaignsService:
    def __init__(
        self,
        repository: CampaignsRepository | None = None,
        guard: DeliverabilityGuard | None = None,
        blocked_sends_service: BlockedSendsService | None = None,
        contacts_service: ContactsService | None = None,
        clients_service: ClientsService | None = None,
        email_sending_enabled: bool | None = None,
    ) -> None:
        self.repository = repository or CampaignsRepository()
        self.guard = guard or DeliverabilityGuard()
        self.blocked_sends_service = blocked_sends_service or BlockedSendsService()
        self.contacts_service = contacts_service or ContactsService()
        self.clients_service = clients_service or ClientsService()
        self.email_sending_enabled = (
            get_settings().email_sending_enabled
            if email_sending_enabled is None
            else email_sending_enabled
        )

    def list_admin_campaigns(self) -> list[Campaign]:
        return self.repository.list_admin_campaigns()

    def planned_admin_campaign_stub(self, endpoint: str) -> dict[str, str]:
        return {"status": "stub", "endpoint": endpoint}

    def create_campaign(self) -> dict[str, str]:
        return self.planned_admin_campaign_stub("POST /campaigns")

    def authorize_campaign(self, campaign_id: str) -> dict[str, str]:
        endpoint = f"POST /campaigns/{campaign_id}/authorize"
        decision = self._preflight_campaign_send(campaign_id)
        if decision is None:
            return self.planned_admin_campaign_stub(endpoint)

        return {"status": decision, "endpoint": endpoint}

    def _preflight_campaign_send(self, campaign_id: str) -> str | None:
        campaign = self.repository.get_campaign(campaign_id)
        if campaign is None:
            return None

        send_gate = self.guard.authorize_campaign_send(self.email_sending_enabled)
        if send_gate.decision.value == "blocked":
            self.blocked_sends_service.log_blocked_authorization(
                client_id=campaign.client_id,
                campaign_id=campaign.id,
                reason=send_gate.reason,
                decision=send_gate.decision.value,
            )
            return send_gate.decision.value

        client = self.clients_service.get_client(campaign.client_id)
        if client is None:
            return None

        client_decision = self.guard.authorize_client_state(client.status)
        if client_decision.decision.value == "blocked":
            self.blocked_sends_service.log_blocked_authorization(
                client_id=campaign.client_id,
                campaign_id=campaign.id,
                reason=client_decision.reason,
                decision=client_decision.decision.value,
            )
            return client_decision.decision.value

        decision = self.guard.authorize_campaign_state(campaign.status)
        if decision.decision.value == "blocked":
            self.blocked_sends_service.log_blocked_authorization(
                client_id=campaign.client_id,
                campaign_id=campaign.id,
                reason=decision.reason,
                decision=decision.decision.value,
            )
            return decision.decision.value

        contacts = self.contacts_service.list_campaign_contacts(
            campaign_id=campaign.id,
            client_id=campaign.client_id,
        )
        target_decision = self.guard.authorize_campaign_targets(len(contacts))
        if target_decision.decision.value == "blocked":
            self.blocked_sends_service.log_blocked_authorization(
                client_id=campaign.client_id,
                campaign_id=campaign.id,
                reason=target_decision.reason,
                decision=target_decision.decision.value,
            )
            return target_decision.decision.value

        for contact in contacts:
            contact_decision = self.guard.can_send_to_contact(contact.status)
            if contact_decision.decision.value == "blocked":
                self.blocked_sends_service.log_blocked_authorization(
                    client_id=campaign.client_id,
                    campaign_id=campaign.id,
                    reason=contact_decision.reason,
                    decision=contact_decision.decision.value,
                    contact_id=contact.id,
                )
                return contact_decision.decision.value

        return decision.decision.value

    def send_campaign(self, campaign_id: str) -> dict[str, str]:
        self._preflight_campaign_send(campaign_id)
        return self.planned_admin_campaign_stub(f"POST /campaigns/{campaign_id}/send")
