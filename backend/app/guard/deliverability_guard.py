from dataclasses import dataclass
from enum import StrEnum
from typing import Mapping, Sequence

from app.repositories.clients import ClientCampaignRecord, ClientRecord
from app.repositories.contacts import ContactRecord


class SendDecision(StrEnum):
    AUTHORIZED = "authorized"
    BLOCKED = "blocked"
    DRY_RUN = "dry_run"


@dataclass(frozen=True)
class GuardResult:
    decision: SendDecision
    reason: str
    code: str = "authorized"
    severity: str = "info"
    client_id: str | None = None
    campaign_id: str | None = None
    eligible_contact_count: int = 0
    blocked_contact_count: int = 0
    blocked_reasons: Mapping[str, int] | None = None
    diagnostic: str = "Dispatch authorized by Deliverability Guard."

    @property
    def allowed(self) -> bool:
        return self.decision == SendDecision.AUTHORIZED

    def to_dict(self) -> dict[str, object]:
        return {
            "allowed": self.allowed,
            "decision": self.decision.value,
            "reason": self.reason,
            "code": self.code,
            "severity": self.severity,
            "client_id": self.client_id,
            "campaign_id": self.campaign_id,
            "eligible_contact_count": self.eligible_contact_count,
            "blocked_contact_count": self.blocked_contact_count,
            "blocked_reasons": dict(self.blocked_reasons or {}),
            "diagnostic": self.diagnostic,
        }


class DeliverabilityGuard:
    """Fail-closed Deliverability Guard boundary."""

    SENDABLE_CLIENT_STATUSES = {"active", "trial"}
    SENDABLE_CAMPAIGN_STATUSES = {"ready", "running"}
    SENDABLE_CONTACT_STATUS = "sendable"
    BLOCKED_CLIENT_STATUSES = {"paused", "blocked", "archived", "suspended"}
    NON_SENDABLE_CONTACT_STATUSES = {
        "pending",
        "suppressed",
        "bounced",
        "unsubscribed",
        "blacklisted",
        "error",
    }

    def authorize_campaign_send(self, email_sending_enabled: bool) -> GuardResult:
        if not email_sending_enabled:
            return GuardResult(
                decision=SendDecision.BLOCKED,
                reason='EMAIL_SENDING_ENABLED is not exactly "true".',
                code="email_sending_disabled",
                severity="critical",
                diagnostic="Runtime kill switch blocked dispatch before listmonk.",
            )
        return GuardResult(
            decision=SendDecision.AUTHORIZED,
            reason="EMAIL_SENDING_ENABLED is explicitly true.",
            code="email_sending_enabled",
        )

    def authorize_campaign_dispatch(
        self,
        *,
        email_sending_enabled: bool,
        client: ClientRecord | None,
        campaign: ClientCampaignRecord | None,
        contacts: Sequence[ContactRecord],
        suppressed_emails: set[str],
        active_campaign_count: int | None,
    ) -> GuardResult:
        switch_result = self.authorize_campaign_send(email_sending_enabled)
        client_id = client.id if client is not None else campaign.client_id if campaign else None
        campaign_id = campaign.id if campaign is not None else None
        if not switch_result.allowed:
            return self._blocked(
                code=switch_result.code,
                reason=switch_result.reason,
                severity=switch_result.severity,
                client_id=client_id,
                campaign_id=campaign_id,
                diagnostic=switch_result.diagnostic,
            )

        if campaign is None:
            return self._blocked(
                code="campaign_not_found",
                reason="Campaign was not found in Business DB for this caller.",
                severity="error",
                diagnostic="Business DB campaign lookup returned no dispatchable record.",
            )

        if client is None:
            return self._blocked(
                code="client_not_found",
                reason="Client was not found in Business DB for this campaign.",
                severity="error",
                client_id=campaign.client_id,
                campaign_id=campaign.id,
                diagnostic="Campaign has no resolvable client in Business DB.",
            )

        if campaign.client_id != client.id:
            return self._blocked(
                code="campaign_client_mismatch",
                reason="Campaign does not belong to the resolved client.",
                severity="critical",
                client_id=client.id,
                campaign_id=campaign.id,
                diagnostic="campaign.client_id and client.id differ.",
            )

        client_status = client.status.lower()
        if client_status in self.BLOCKED_CLIENT_STATUSES or client_status not in self.SENDABLE_CLIENT_STATUSES:
            return self._blocked(
                code="client_status_not_sendable",
                reason=f"Client status {client.status} is not sendable.",
                severity="error",
                client_id=client.id,
                campaign_id=campaign.id,
                diagnostic="Only active or trial clients may dispatch campaigns.",
            )

        campaign_status = campaign.status.lower()
        if campaign_status not in self.SENDABLE_CAMPAIGN_STATUSES:
            return self._blocked(
                code="campaign_status_not_sendable",
                reason=f"Campaign status {campaign.status} is not sendable.",
                severity="error",
                client_id=client.id,
                campaign_id=campaign.id,
                diagnostic="Only ready or running campaigns may dispatch.",
            )

        if active_campaign_count is None:
            return self._blocked(
                code="active_campaign_count_unavailable",
                reason="Client active campaign count is unavailable.",
                severity="error",
                client_id=client.id,
                campaign_id=campaign.id,
                diagnostic="Guard failed closed because max_campaigns cannot be evaluated.",
            )

        if client.max_campaigns is not None and active_campaign_count > client.max_campaigns:
            return self._blocked(
                code="max_campaigns_exceeded",
                reason="Client max_campaigns limit is exceeded.",
                severity="error",
                client_id=client.id,
                campaign_id=campaign.id,
                diagnostic="Active sendable campaigns exceed the configured client limit.",
            )

        if not contacts:
            return self._blocked(
                code="empty_campaign_batch",
                reason="Campaign has no associated contacts.",
                severity="error",
                client_id=client.id,
                campaign_id=campaign.id,
                diagnostic="Business DB campaign_contacts returned an empty batch.",
            )

        eligible_count, blocked_reasons = self._classify_contacts(
            client_id=client.id,
            campaign_id=campaign.id,
            contacts=contacts,
            suppressed_emails=suppressed_emails,
        )
        blocked_count = len(contacts) - eligible_count

        if client.email_limit_per_campaign is not None and eligible_count > client.email_limit_per_campaign:
            return self._blocked(
                code="email_limit_per_campaign_exceeded",
                reason="Campaign eligible contact count exceeds email_limit_per_campaign.",
                severity="error",
                client_id=client.id,
                campaign_id=campaign.id,
                eligible_contact_count=eligible_count,
                blocked_contact_count=blocked_count,
                blocked_reasons=blocked_reasons,
                diagnostic="Guard blocked before listmonk because client campaign email limit would be exceeded.",
            )

        if eligible_count == 0:
            return self._blocked(
                code="no_eligible_contacts",
                reason="Campaign has no eligible contacts to send.",
                severity="error",
                client_id=client.id,
                campaign_id=campaign.id,
                eligible_contact_count=eligible_count,
                blocked_contact_count=blocked_count,
                blocked_reasons=blocked_reasons,
                diagnostic="All campaign contacts were non-sendable.",
            )

        if blocked_count > 0:
            return self._blocked(
                code="partial_batch_not_supported",
                reason="Campaign contains non-sendable contacts and partial dispatch is not supported.",
                severity="error",
                client_id=client.id,
                campaign_id=campaign.id,
                eligible_contact_count=eligible_count,
                blocked_contact_count=blocked_count,
                blocked_reasons=blocked_reasons,
                diagnostic="Guard blocked to avoid sending listmonk's full campaign list.",
            )

        return GuardResult(
            decision=SendDecision.AUTHORIZED,
            reason="Campaign dispatch authorized by Deliverability Guard.",
            code="dispatch_authorized",
            severity="info",
            client_id=client.id,
            campaign_id=campaign.id,
            eligible_contact_count=eligible_count,
            blocked_contact_count=0,
            blocked_reasons={},
            diagnostic="Client, campaign, contact, suppression, and limit checks passed.",
        )

    def can_send_to_contact(self, *_args: object, **_kwargs: object) -> GuardResult:
        return GuardResult(
            decision=SendDecision.BLOCKED,
            reason="Contact sendability checks are not implemented in Milestone 0.",
            code="contact_guard_not_implemented",
            severity="error",
        )

    def _classify_contacts(
        self,
        *,
        client_id: str,
        campaign_id: str,
        contacts: Sequence[ContactRecord],
        suppressed_emails: set[str],
    ) -> tuple[int, dict[str, int]]:
        eligible_count = 0
        blocked_reasons: dict[str, int] = {}
        seen_contact_ids: set[str] = set()

        for contact in contacts:
            reason = self._contact_block_reason(
                client_id=client_id,
                campaign_id=campaign_id,
                contact=contact,
                suppressed_emails=suppressed_emails,
                seen_contact_ids=seen_contact_ids,
            )
            seen_contact_ids.add(contact.id)
            if reason is None:
                eligible_count += 1
                continue
            blocked_reasons[reason] = blocked_reasons.get(reason, 0) + 1

        return eligible_count, blocked_reasons

    def _contact_block_reason(
        self,
        *,
        client_id: str,
        campaign_id: str,
        contact: ContactRecord,
        suppressed_emails: set[str],
        seen_contact_ids: set[str],
    ) -> str | None:
        if contact.id in seen_contact_ids:
            return "duplicate_campaign_contact"
        if contact.client_id != client_id:
            return "contact_client_mismatch"
        if not contact.email.strip():
            return "missing_email"
        if not self._looks_like_email(contact.email):
            return "invalid_email"
        if contact.status.lower() != self.SENDABLE_CONTACT_STATUS:
            if contact.status.lower() in self.NON_SENDABLE_CONTACT_STATUSES:
                return f"contact_{contact.status.lower()}"
            return "contact_status_not_sendable"
        if contact.email.strip().lower() in suppressed_emails:
            return "suppression_list"
        return None

    def _looks_like_email(self, email: str) -> bool:
        value = email.strip()
        return "@" in value and "." in value.rsplit("@", 1)[-1]

    def _blocked(
        self,
        *,
        code: str,
        reason: str,
        severity: str,
        client_id: str | None = None,
        campaign_id: str | None = None,
        eligible_contact_count: int = 0,
        blocked_contact_count: int = 0,
        blocked_reasons: Mapping[str, int] | None = None,
        diagnostic: str,
    ) -> GuardResult:
        return GuardResult(
            decision=SendDecision.BLOCKED,
            reason=reason,
            code=code,
            severity=severity,
            client_id=client_id,
            campaign_id=campaign_id,
            eligible_contact_count=eligible_contact_count,
            blocked_contact_count=blocked_contact_count,
            blocked_reasons=blocked_reasons or {},
            diagnostic=diagnostic,
        )
