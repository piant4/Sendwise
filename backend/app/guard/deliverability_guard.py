from dataclasses import dataclass
from enum import StrEnum

from app.schemas.common import CampaignStatus, ClientStatus, ContactStatus


class SendDecision(StrEnum):
    AUTHORIZED = "authorized"
    BLOCKED = "blocked"
    DRY_RUN = "dry_run"


@dataclass(frozen=True)
class GuardResult:
    decision: SendDecision
    reason: str


class DeliverabilityGuard:
    """Placeholder fail-closed Deliverability Guard.

    Future milestones will enforce client, campaign, contact, suppression,
    bounce, unsubscribe, blacklist, and usage checks here. Milestone 0 performs
    no advanced scoring and no real sending authorization.
    """

    def authorize_campaign_send(self, email_sending_enabled: bool) -> GuardResult:
        if not email_sending_enabled:
            return GuardResult(
                decision=SendDecision.BLOCKED,
                reason='EMAIL_SENDING_ENABLED is not exactly "true".',
            )
        return GuardResult(
            decision=SendDecision.AUTHORIZED,
            reason='EMAIL_SENDING_ENABLED is exactly "true".',
        )

    def authorize_campaign_state(self, campaign_status: CampaignStatus) -> GuardResult:
        if campaign_status in {CampaignStatus.ready, CampaignStatus.running}:
            return GuardResult(
                decision=SendDecision.AUTHORIZED,
                reason=f"Campaign state {campaign_status.value} is send-simulation eligible.",
            )

        return GuardResult(
            decision=SendDecision.BLOCKED,
            reason=f"Campaign state {campaign_status.value} cannot send.",
        )

    def authorize_client_state(self, client_status: ClientStatus) -> GuardResult:
        if client_status == ClientStatus.active:
            return GuardResult(
                decision=SendDecision.AUTHORIZED,
                reason="Client state active can send.",
            )

        return GuardResult(
            decision=SendDecision.BLOCKED,
            reason=f"Client state {client_status.value} cannot send.",
        )

    def authorize_campaign_targets(self, contact_count: int) -> GuardResult:
        if contact_count > 0:
            return GuardResult(
                decision=SendDecision.AUTHORIZED,
                reason="Campaign has associated contacts.",
            )

        return GuardResult(
            decision=SendDecision.BLOCKED,
            reason="no_campaign_contacts",
        )

    def can_send_to_contact(self, contact_status: ContactStatus) -> GuardResult:
        if contact_status == ContactStatus.sendable:
            return GuardResult(
                decision=SendDecision.AUTHORIZED,
                reason="Contact state sendable can send.",
            )

        return GuardResult(
            decision=SendDecision.BLOCKED,
            reason=f"Contact state {contact_status.value} cannot send.",
        )
