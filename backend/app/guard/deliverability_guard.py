from dataclasses import dataclass
from enum import StrEnum


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

    def can_send_to_contact(self, *_args: object, **_kwargs: object) -> GuardResult:
        return GuardResult(
            decision=SendDecision.BLOCKED,
            reason="Contact sendability checks are not implemented in Milestone 0.",
        )
