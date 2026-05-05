from dataclasses import dataclass
from enum import StrEnum

from app.schemas.common import CampaignStatus, ContactStatus


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
                decision=SendDecision.DRY_RUN,
                reason='EMAIL_SENDING_ENABLED is not exactly "true".',
            )
        return GuardResult(
            decision=SendDecision.BLOCKED,
            reason="Real send authorization is not implemented in Milestone 0.",
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
