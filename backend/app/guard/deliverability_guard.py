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
    """Fail-closed Deliverability Guard boundary.

    Future milestones will enforce client, campaign, contact, suppression,
    bounce, unsubscribe, blacklist, and usage checks here. This milestone keeps
    the runtime switch check in the Guard before any listmonk dispatch.
    """

    def authorize_campaign_send(self, email_sending_enabled: bool) -> GuardResult:
        if not email_sending_enabled:
            return GuardResult(
                decision=SendDecision.BLOCKED,
                reason='EMAIL_SENDING_ENABLED is not exactly "true".',
            )
        return GuardResult(
            decision=SendDecision.AUTHORIZED,
            reason="EMAIL_SENDING_ENABLED is explicitly true.",
        )

    def can_send_to_contact(self, *_args: object, **_kwargs: object) -> GuardResult:
        return GuardResult(
            decision=SendDecision.BLOCKED,
            reason="Contact sendability checks are not implemented in Milestone 0.",
        )
