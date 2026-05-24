from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone
from typing import Any
import re
from urllib.parse import urlsplit

from fastapi import HTTPException, status

from app.core.auth import AuthenticatedUser
from app.core.config import Settings, get_settings
from app.guard.deliverability_guard import (
    CampaignLimitUsage,
    DeliverabilityGuard,
    GuardResult,
    SendDecision,
)
from app.integrations.listmonk.client import (
    ListmonkClient,
    ListmonkError,
    extract_listmonk_id,
)
from app.repositories.campaign_slots import (
    CampaignSlotRepository,
    get_campaign_slot_repository,
)
from app.repositories.campaigns import (
    CampaignRecord,
    CampaignRepository,
    EmailTemplateRepository,
    get_campaign_repository,
    get_email_template_repository,
)
from app.repositories.campaign_sending_limits import (
    CampaignSendingLimitRecord,
    CampaignSendingLimitRepository,
    get_campaign_sending_limit_repository,
)
from app.repositories.blocked_sends import (
    BlockedSendRepository,
    get_blocked_send_repository,
)
from app.repositories.clients import (
    ClientCampaignRecord,
    ClientRecord,
    ClientRepository,
    PostgresClientRepository,
)
from app.repositories.contacts import (
    ContactRecord,
    ContactRepository,
    PostgresContactRepository,
)
from app.repositories.email_logs import EmailLogRepository, get_email_log_repository
from app.repositories.listmonk_mappings import get_listmonk_mapping_repository
from app.repositories.provider_events import (
    ProviderEventRepository,
    get_provider_event_repository,
)
from app.repositories.suppression_list import (
    SuppressionListRepository,
    get_suppression_list_repository,
)
from app.schemas.campaigns import (
    AdminCampaignContactError,
    AdminCampaignContactItem,
    AdminCampaignContactsImportResponse,
    AdminCampaignContactRemoveResponse,
    AdminCampaignContactsResponse,
    AdminCampaignDetail,
    AdminEmailTemplateResponse,
    AdminCampaignContactPayload,
    AdminCampaignReviewResponse,
    AdminCampaignSummaryResponse,
    AdminCampaignSlotAssignmentResponse,
    CampaignBlockedSendsSummary,
    CampaignClientSummary,
    CampaignLogsSummary,
    CampaignPeriodUsageSummary,
    CampaignPolicyStateSummary,
    CampaignPolicyStatusSummary,
    CampaignRecipientsSummary,
    CampaignSlotSummary,
    CampaignSummaryItem,
    ProviderHistoryPolicySummary,
)
from app.schemas.common import CampaignStatus
from app.services.provider_runtime import (
    build_listmonk_client,
    build_provider_runtime_summary,
    get_configured_sending_domain,
)
from app.services.clients import build_client_email_brand
from app.services.template_renderer import (
    KNOWN_TEMPLATE_VARIABLES,
    build_template_variable_values,
    render_template_string,
)
from app.services.campaign_slots import (
    CampaignSlotConflictError,
    CampaignSlotService,
    get_campaign_slot_service,
)
from app.services.listmonk_mappings import (
    ENTITY_TYPE_CAMPAIGN,
    ENTITY_TYPE_CONTACT,
    LISTMONK_TYPE_CAMPAIGN,
    LISTMONK_TYPE_LIST,
    LISTMONK_TYPE_SUBSCRIBER,
    ListmonkMappingConflictError,
    ListmonkMappingService,
)
from app.services.campaign_preparation import build_listmonk_campaign_payload
from app.services.unsubscribe import (
    LISTMONK_UNSUBSCRIBE_TOKEN_PLACEHOLDER,
    UnsubscribeService,
    get_unsubscribe_service,
)

ALLOWED_CAMPAIGN_STEPS = {"setup", "content", "recipients", "review", "send"}
EDITABLE_CAMPAIGN_STATUSES = {
    CampaignStatus.draft.value,
    CampaignStatus.ready.value,
    CampaignStatus.paused.value,
}
NON_WRITABLE_CLIENT_STATUSES = {"blocked", "archived", "suspended"}
BLOCKED_SENDS_LATEST_LIMIT = 5
CONTACT_METADATA_ALLOWED_KEYS = {"nome", "cognome"}
SUPPORTED_TEMPLATE_PLACEHOLDERS = set(KNOWN_TEMPLATE_VARIABLES) - {
    "subject",
    "body",
    "client_name",
}
TEMPLATE_PLACEHOLDER_PATTERN = re.compile(r"{{\s*([A-Za-z0-9_]+)\s*}}")
DEFAULT_CAMPAIGN_PERIOD_EMAIL_LIMIT = 1000
DEFAULT_CAMPAIGN_DAILY_EMAIL_LIMIT = 50
DEFAULT_DOMAIN_WARMUP_DAILY_LIMIT = 20
CAMPAIGN_PERIOD_WINDOW = timedelta(days=30)


def _get_business_day_start(current_time: datetime, settings: Settings) -> datetime:
    business_now = current_time.astimezone(settings.business_timezone)
    return datetime.combine(
        business_now.date(),
        time.min,
        tzinfo=settings.business_timezone,
    ).astimezone(timezone.utc)
IN_PROGRESS_LOG_STATUSES = {"queued"}
ACCEPTED_OR_COMPLETED_LOG_STATUSES = {
    "sent",
    "dispatched",
    "delivered",
    "opened",
    "clicked",
    "bounced",
    "complained",
    "spam",
    "unsubscribed",
}
DOMAIN_WARMUP_COUNTED_LOG_STATUSES = tuple(sorted(ACCEPTED_OR_COMPLETED_LOG_STATUSES))
RETRYABLE_FAILED_LOG_STATUSES = {"failed"}
PREPARATION_CONTENT_REDACTED_KEYS = {
    "subject",
    "preview_text",
    "body",
    "body_text",
    "unsubscribe_url",
    "client_name",
}
PROVIDER_ACCEPTED_EVENT_TYPES = ("accepted", "ses_send")
PROVIDER_DELIVERED_EVENT_TYPES = ("delivered", "ses_delivery")
PROVIDER_OPENED_EVENT_TYPES = ("opened", "ses_open")
PROVIDER_CLICKED_EVENT_TYPES = ("clicked", "ses_click")
PROVIDER_BOUNCE_EVENT_TYPES = ("hard_bounce", "soft_bounce", "delivery_failed", "ses_bounce")
PROVIDER_HARD_BOUNCE_EVENT_TYPES = ("hard_bounce", "ses_bounce")
PROVIDER_COMPLAINT_EVENT_TYPES = ("complaint", "ses_complaint")
PROVIDER_UNSUBSCRIBE_EVENT_TYPES = ("unsubscribe", "sendwise_unsubscribe")
COMPLAINT_REVIEW_RATE = 0.001
COMPLAINT_STOP_RATE = 0.003
HARD_BOUNCE_REVIEW_RATE = 0.03
HARD_BOUNCE_STOP_RATE = 0.05
UNSUBSCRIBE_REVIEW_RATE = 0.02


def _prefer_provider_metric(
    *,
    status_counts: dict[str, int],
    event_counts: dict[str, int],
    provider_events_available: bool,
    status_keys: tuple[str, ...],
    event_types: tuple[str, ...],
    fallback_to_statuses: bool = True,
) -> int:
    provider_total = sum(event_counts.get(event_type, 0) for event_type in event_types)
    if provider_total > 0:
        return provider_total
    if provider_events_available and not fallback_to_statuses:
        return 0
    return sum(status_counts.get(status_key, 0) for status_key in status_keys)


def _provider_metric(
    *,
    event_counts: dict[str, int],
    provider_events_available: bool,
    event_types: tuple[str, ...],
) -> int | None:
    if not provider_events_available:
        return None
    return sum(event_counts.get(event_type, 0) for event_type in event_types)


def _rate(numerator: int | None, denominator: int | None) -> float | None:
    if numerator is None or denominator is None or denominator <= 0:
        return None
    return round(numerator / denominator, 4)


def _resolve_controlled_provider(settings: Settings) -> str | None:
    environment = settings.environment.strip().lower()
    email_provider = settings.email_provider_normalized
    allowed_environments = {"development", "staging", "test"}
    allowed_providers = {"listmonk", "mailpit", "smtp_dev", "ses"}

    if environment not in allowed_environments:
        return None
    if email_provider not in allowed_providers:
        return None

    if email_provider == "ses":
        return "ses"
    if email_provider == "listmonk":
        return "listmonk"
    return "mailpit"


@dataclass(frozen=True)
class CampaignStateService:
    repository: CampaignRepository

    def update_campaign_content(
        self,
        *,
        client_id: str,
        campaign_id: str,
        subject: str | None,
        preview_text: str | None,
        body_html: str | None,
        body_text: str | None,
        content_ready: bool,
        review_ready: bool,
        current_step: str,
    ) -> Any:
        return self.repository.update_campaign(
            client_id=client_id,
            campaign_id=campaign_id,
            subject=subject,
            preview_text=preview_text,
            body_html=body_html,
            body_text=body_text,
            content_ready=content_ready,
            review_ready=review_ready,
            current_step=current_step,
        )

    def refresh_contacts_ready(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> Any:
        contacts_ready = self.repository.has_contacts(
            client_id=client_id,
            campaign_id=campaign_id,
        )
        return self.repository.update_campaign(
            client_id=client_id,
            campaign_id=campaign_id,
            contacts_ready=contacts_ready,
        )


@dataclass(frozen=True)
class CampaignContactsSummary:
    total: int
    valid: int
    invalid: int
    suppressed: int
    unsubscribed: int
    blacklisted: int
    bounced: int
    eligible: int
    contacts_ready: bool
    contacts: list[AdminCampaignContactItem]

    @property
    def blocked(self) -> int:
        return max(self.total - self.eligible, 0)


@dataclass(frozen=True)
class CampaignEvaluation:
    content_ready: bool
    contacts_ready: bool
    review_ready: bool
    can_send_when_enabled: bool
    can_send: bool
    warnings: list[str]
    blocking_errors: list[str]
    guard_result: GuardResult
    duplicate_guard: "CampaignDispatchDuplicateGuard"
    limit_record: CampaignSendingLimitRecord
    limit_usage: CampaignLimitUsage
    provider_history: list[ProviderHistoryPolicySummary]


def _build_domain_warmup_guard_result(
    *,
    client_id: str,
    campaign_id: str,
    eligible_contact_count: int,
    daily_limit: int,
    daily_used: int,
    sending_domain: str,
) -> GuardResult:
    return GuardResult(
        decision=SendDecision.BLOCKED,
        reason=(
            "Configured sending domain reached today's warmup limit. "
            "Reduce eligible recipients or retry on the next Rome business day."
        ),
        code="sending_domain_warmup_limit_reached",
        severity="error",
        client_id=client_id,
        campaign_id=campaign_id,
        eligible_contact_count=eligible_contact_count,
        blocked_contact_count=0,
        blocked_reasons={},
        diagnostic=(
            "Domain warmup guard blocked dispatch before listmonk because "
            f"{sending_domain} would exceed {daily_limit} accepted sends in the current Rome day."
        ),
        limit_source="sending_domain_warmup",
        limit_value=daily_limit,
        daily_limit=daily_limit,
        daily_used=daily_used,
        daily_remaining=max(daily_limit - daily_used, 0),
        sending_domain=sending_domain,
    )


def _format_rate_percent(rate: float) -> str:
    return f"{rate * 100:.2f}%"


def _build_provider_history_policy(
    *,
    metrics: Any,
    sending_domain: str,
) -> list[ProviderHistoryPolicySummary]:
    policy: list[ProviderHistoryPolicySummary] = []
    complaint_rate = _rate(metrics.complaints, metrics.delivered)
    if complaint_rate is not None and complaint_rate >= COMPLAINT_STOP_RATE:
        policy.append(
            ProviderHistoryPolicySummary(
                code="provider_history_complaint_rate_stop",
                severity="critical",
                reason=(
                    "Provider history complaint rate reached stop threshold "
                    f"({_format_rate_percent(complaint_rate)}). "
                    "Admin review is required before resuming dispatch."
                ),
                metric="complaint_rate",
                rate=complaint_rate,
                band="stop",
                sending_domain=sending_domain,
                blocking=True,
            )
        )
    elif complaint_rate is not None and complaint_rate >= COMPLAINT_REVIEW_RATE:
        policy.append(
            ProviderHistoryPolicySummary(
                code="provider_history_complaint_rate_review",
                severity="warning",
                reason=(
                    "Provider history complaint rate is in review band "
                    f"({_format_rate_percent(complaint_rate)}). Require admin review or throttling."
                ),
                metric="complaint_rate",
                rate=complaint_rate,
                band="review",
                sending_domain=sending_domain,
            )
        )

    hard_bounce_rate = _rate(metrics.hard_bounces, metrics.accepted_sends)
    if hard_bounce_rate is not None and hard_bounce_rate >= HARD_BOUNCE_STOP_RATE:
        policy.append(
            ProviderHistoryPolicySummary(
                code="provider_history_hard_bounce_rate_stop",
                severity="critical",
                reason=(
                    "Provider history hard bounce rate reached stop threshold "
                    f"({_format_rate_percent(hard_bounce_rate)}). "
                    "List-quality review is required before resuming dispatch."
                ),
                metric="hard_bounce_rate",
                rate=hard_bounce_rate,
                band="stop",
                sending_domain=sending_domain,
                blocking=True,
            )
        )
    elif hard_bounce_rate is not None and hard_bounce_rate >= HARD_BOUNCE_REVIEW_RATE:
        policy.append(
            ProviderHistoryPolicySummary(
                code="provider_history_hard_bounce_rate_review",
                severity="warning",
                reason=(
                    "Provider history hard bounce rate is in review band "
                    f"({_format_rate_percent(hard_bounce_rate)}). Require list-quality review or throttling."
                ),
                metric="hard_bounce_rate",
                rate=hard_bounce_rate,
                band="review",
                sending_domain=sending_domain,
            )
        )

    unsubscribe_rate = _rate(metrics.unsubscribes, metrics.delivered)
    if unsubscribe_rate is not None and unsubscribe_rate > UNSUBSCRIBE_REVIEW_RATE:
        policy.append(
            ProviderHistoryPolicySummary(
                code="provider_history_unsubscribe_rate_review",
                severity="warning",
                reason=(
                    "Provider history unsubscribe rate is in review band "
                    f"({_format_rate_percent(unsubscribe_rate)}). Review content and audience fit."
                ),
                metric="unsubscribe_rate",
                rate=unsubscribe_rate,
                band="review",
                sending_domain=sending_domain,
            )
        )

    has_usable_denominator = (
        metrics.delivered > 0 or metrics.accepted_sends > 0
    )
    if not policy and has_usable_denominator:
        policy.append(
            ProviderHistoryPolicySummary(
                code="provider_history_clear",
                severity="info",
                reason="Provider history metrics are available and no active deliverability risk was detected.",
                metric="provider_history",
                rate=None,
                band="clear",
                sending_domain=sending_domain,
            )
        )
    return policy


def _evaluate_provider_history_policy(
    *,
    settings: Settings,
    provider: str,
    campaign: ClientCampaignRecord,
    guard_result: GuardResult,
    provider_event_repository: ProviderEventRepository | None,
    email_log_repository: EmailLogRepository,
) -> tuple[GuardResult | None, list[ProviderHistoryPolicySummary]]:
    if provider != "listmonk" or provider_event_repository is None:
        return None, []

    sending_domain = get_configured_sending_domain(settings)
    if sending_domain is None:
        return None, []

    if hasattr(provider_event_repository, "attach_email_log_records") and hasattr(
        email_log_repository,
        "_records",
    ):
        provider_event_repository.attach_email_log_records(email_log_repository._records)  # type: ignore[attr-defined]

    metrics = provider_event_repository.get_domain_threshold_metrics(
        sending_domain=sending_domain,
        accepted_event_types=PROVIDER_ACCEPTED_EVENT_TYPES,
        delivered_event_types=PROVIDER_DELIVERED_EVENT_TYPES,
        hard_bounce_event_types=PROVIDER_HARD_BOUNCE_EVENT_TYPES,
        complaint_event_types=PROVIDER_COMPLAINT_EVENT_TYPES,
        unsubscribe_event_types=PROVIDER_UNSUBSCRIBE_EVENT_TYPES,
    )
    provider_history_policy = _build_provider_history_policy(
        metrics=metrics,
        sending_domain=sending_domain,
    )
    stop_policy = next((item for item in provider_history_policy if item.blocking), None)
    if stop_policy is None:
        return None, provider_history_policy

    diagnostic_metric = (
        "complaints"
        if stop_policy.code == "provider_history_complaint_rate_stop"
        else "hard bounces"
    )
    return (
        GuardResult(
            decision=SendDecision.BLOCKED,
            reason=stop_policy.reason,
            code=stop_policy.code,
            severity=stop_policy.severity,
            client_id=campaign.client_id,
            campaign_id=campaign.id,
            eligible_contact_count=guard_result.eligible_contact_count,
            blocked_contact_count=guard_result.blocked_contact_count,
            blocked_reasons=dict(guard_result.blocked_reasons or {}),
            diagnostic=(
                "Deliverability Guard blocked before listmonk because correlated "
                f"provider {diagnostic_metric} exceeded policy for the sending domain."
            ),
            limit_source="provider_history",
            sending_domain=sending_domain,
        ),
        provider_history_policy,
    )


@dataclass(frozen=True)
class CampaignLimitContext:
    record: CampaignSendingLimitRecord
    usage: CampaignLimitUsage


@dataclass(frozen=True)
class CampaignDispatchDuplicateGuard:
    blocked: bool
    code: str | None = None
    reason: str | None = None
    retryable_log_ids_by_contact: dict[str, str] | None = None


@dataclass(frozen=True)
class ListmonkNativeUnsubscribeReconciliation:
    failed: bool = False
    reason: str | None = None
    code: str | None = None
    suppressed_count: int = 0


@dataclass(frozen=True)
class AdminCampaignService:
    settings: Settings
    guard: DeliverabilityGuard
    repository: CampaignRepository
    campaign_limit_repository: CampaignSendingLimitRepository
    client_repository: ClientRepository
    campaign_slot_service: CampaignSlotService
    campaign_slot_repository: CampaignSlotRepository
    template_repository: EmailTemplateRepository
    contact_repository: ContactRepository
    suppression_list_repository: SuppressionListRepository
    blocked_send_repository: BlockedSendRepository
    email_log_repository: EmailLogRepository
    provider_event_repository: ProviderEventRepository

    def get_campaign_record(self, campaign_id: str) -> CampaignRecord:
        campaign = self.repository.get_by_id(campaign_id=campaign_id)
        if campaign is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Campaign not found.",
            )
        return campaign

    def get_campaign_detail(self, campaign_id: str) -> AdminCampaignDetail:
        campaign = self.get_campaign_record(campaign_id)
        client = self._get_client(campaign.client_id)
        limits = self._ensure_campaign_limits(campaign.id)
        return self._build_detail(campaign=campaign, client=client, limits=limits)

    def get_campaign_summary(self, campaign_id: str) -> AdminCampaignSummaryResponse:
        campaign = self.get_campaign_record(campaign_id)
        client = self._get_client(campaign.client_id)
        contacts = self.contact_repository.list_campaign_contacts(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
        )
        suppressed_emails = self.suppression_list_repository.list_suppressed_emails_for_campaign(
            client_id=campaign.client_id,
            emails=[contact.email for contact in contacts],
        )
        slot = self._get_campaign_slot(campaign=campaign)
        contact_summary = self._summarize_campaign_contacts(
            campaign=campaign,
            contacts=contacts,
            suppressed_emails=suppressed_emails,
        )
        limit_context = self._build_campaign_limit_context(campaign=campaign)
        evaluation = self._evaluate_campaign(
            campaign=campaign,
            client=client,
            contacts=contacts,
            suppressed_emails=suppressed_emails,
            slot=slot,
            contact_summary=contact_summary,
            limit_context=limit_context,
        )
        logs = self._build_campaign_logs_summary(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
        )
        return AdminCampaignSummaryResponse(
            campaign=self._build_campaign_summary_item(
                campaign=campaign,
                client=client,
                evaluation=evaluation,
            ),
            client=CampaignClientSummary(
                id=client.id,
                email=client.email,
                personal_name=client.personal_name,
                status=client.status,
            ),
            slot=self._build_campaign_slot_summary(
                campaign=campaign,
                client=client,
                slot=slot,
                evaluation=evaluation,
            ),
            recipients=self._build_campaign_recipients_summary(contact_summary),
            logs=logs,
            period_usage=self._build_period_usage_summary(limit_context=limit_context),
            policy_state=self._build_policy_state(evaluation=evaluation),
            runtime=build_provider_runtime_summary(
                self.settings,
                provider_events_available=logs.provider_events_available,
            ),
            blocked_sends=self._build_campaign_blocked_sends_summary(
                campaign=campaign,
            ),
            can_send=evaluation.can_send,
            can_send_when_enabled=evaluation.can_send_when_enabled,
            sending_enabled=self.settings.email_sending_enabled,
            blocking_errors=evaluation.blocking_errors,
            warnings=evaluation.warnings,
            daily_limit=evaluation.limit_usage.daily_limit,
            daily_used=evaluation.limit_usage.daily_used,
            daily_remaining=evaluation.limit_usage.daily_remaining,
            period_limit=evaluation.limit_usage.period_limit,
            period_used=evaluation.limit_usage.period_used,
            period_remaining=evaluation.limit_usage.period_remaining,
            period_started_at=evaluation.limit_usage.period_started_at,
            period_ends_at=evaluation.limit_usage.period_ends_at,
            provider_history=evaluation.provider_history,
        )

    def get_campaign_contacts(self, campaign_id: str) -> AdminCampaignContactsResponse:
        campaign = self.get_campaign_record(campaign_id)
        summary = self._summarize_campaign_contacts(campaign=campaign)
        return AdminCampaignContactsResponse(
            campaign_id=campaign.id,
            client_id=campaign.client_id,
            total=summary.total,
            valid=summary.valid,
            invalid=summary.invalid,
            suppressed=summary.suppressed,
            unsubscribed=summary.unsubscribed,
            blacklisted=summary.blacklisted,
            bounced=summary.bounced,
            eligible=summary.eligible,
            contacts_ready=summary.contacts_ready,
            contacts=summary.contacts,
        )

    def create_campaign(
        self,
        *,
        client_id: str,
        name: str,
        subject: str,
        period_email_limit: int | None = None,
        daily_email_limit: int | None = None,
    ) -> AdminCampaignDetail:
        client = self._get_writable_client(client_id)
        campaign = self.repository.create_campaign(
            client_id=client.id,
            name=self._require_text(name, field_label="name"),
            status=CampaignStatus.draft.value,
            subject=self._require_text(subject, field_label="subject"),
            content_ready=False,
            contacts_ready=False,
            review_ready=False,
            current_step="setup",
        )
        limits = self.campaign_limit_repository.ensure_for_campaign(
            campaign_id=campaign.id,
            period_email_limit=self._validate_positive_int(
                period_email_limit,
                field_label="period_email_limit",
                default=DEFAULT_CAMPAIGN_PERIOD_EMAIL_LIMIT,
            ),
            daily_email_limit=self._validate_positive_int(
                daily_email_limit,
                field_label="daily_email_limit",
                default=DEFAULT_CAMPAIGN_DAILY_EMAIL_LIMIT,
            ),
        )
        return self._build_detail(campaign=campaign, client=client, limits=limits)

    def update_campaign(
        self,
        *,
        campaign_id: str,
        name: str | None = None,
        subject: str | None = None,
        status_value: str | None = None,
        current_step: str | None = None,
        period_email_limit: int | None = None,
        daily_email_limit: int | None = None,
    ) -> AdminCampaignDetail:
        campaign = self.get_campaign_record(campaign_id)
        client = self._get_writable_client(campaign.client_id)

        next_name = campaign.name if name is None else self._require_text(
            name,
            field_label="name",
        )
        next_subject = (
            campaign.subject
            if subject is None
            else self._normalize_optional_text(subject)
        )
        self._validate_template_placeholders(
            next_subject,
            allowed_placeholders=SUPPORTED_TEMPLATE_PLACEHOLDERS,
        )
        next_status = campaign.status
        if status_value is not None:
            normalized_status = status_value.strip().lower()
            if normalized_status not in EDITABLE_CAMPAIGN_STATUSES:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Campaign status is not editable through this endpoint.",
                )
            next_status = normalized_status

        next_step = campaign.current_step
        if current_step is not None:
            next_step = self._validate_step(current_step)

        updated = self.repository.update_campaign(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
            name=next_name,
            status=next_status,
            subject=next_subject,
            content_ready=self._content_ready(
                subject=next_subject,
                body_html=campaign.body_html,
            ),
            review_ready=False,
            current_step=next_step,
        )
        limits = self._update_campaign_limits(
            campaign=updated,
            period_email_limit=period_email_limit,
            daily_email_limit=daily_email_limit,
        )
        return self._build_detail(campaign=updated, client=client, limits=limits)

    def update_campaign_content(
        self,
        *,
        campaign_id: str,
        subject: str | None,
        preview_text: str | None,
        body_html: str | None,
        body_text: str | None,
        current_step: str | None,
    ) -> AdminCampaignDetail:
        campaign = self.get_campaign_record(campaign_id)
        client = self._get_writable_client(campaign.client_id)

        next_subject = (
            campaign.subject
            if subject is None
            else self._normalize_optional_text(subject)
        )
        next_preview_text = (
            campaign.preview_text
            if preview_text is None
            else self._normalize_optional_text(preview_text)
        )
        next_body_html = (
            campaign.body_html
            if body_html is None
            else self._normalize_optional_text(body_html)
        )
        next_body_text = (
            campaign.body_text
            if body_text is None
            else self._normalize_optional_text(body_text)
        )
        self._validate_template_placeholders(
            next_subject,
            allowed_placeholders=SUPPORTED_TEMPLATE_PLACEHOLDERS,
        )
        self._validate_template_placeholders(
            next_preview_text,
            allowed_placeholders=SUPPORTED_TEMPLATE_PLACEHOLDERS,
        )
        self._validate_template_placeholders(
            next_body_html,
            allowed_placeholders=SUPPORTED_TEMPLATE_PLACEHOLDERS,
        )
        self._validate_template_placeholders(
            next_body_text,
            allowed_placeholders=SUPPORTED_TEMPLATE_PLACEHOLDERS,
        )
        next_step = (
            self._validate_step(current_step)
            if current_step is not None
            else "content"
        )

        updated = self.repository.update_campaign(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
            subject=next_subject,
            preview_text=next_preview_text,
            body_html=next_body_html,
            body_text=next_body_text,
            content_ready=self._content_ready(
                subject=next_subject,
                body_html=next_body_html,
            ),
            review_ready=False,
            current_step=next_step,
        )
        return self._build_detail(
            campaign=updated,
            client=client,
            limits=self._ensure_campaign_limits(updated.id),
        )

    def list_email_templates(self, client_id: str) -> list[AdminEmailTemplateResponse]:
        self._get_writable_client(client_id)
        return [
            AdminEmailTemplateResponse(
                id=template.id,
                client_id=template.client_id,
                name=template.name,
                subject=template.subject,
                preview_text=template.preview_text,
                body_html=template.body_html,
                body_text=template.body_text,
                created_at=template.created_at,
                updated_at=template.updated_at,
            )
            for template in self.template_repository.list_by_client(client_id)
        ]

    def create_email_template(
        self,
        *,
        client_id: str,
        name: str,
        subject: str,
        preview_text: str | None,
        body_html: str | None,
        body_text: str | None,
    ) -> AdminEmailTemplateResponse:
        self._get_writable_client(client_id)

        normalized_name = self._require_text(name, field_label="name")
        normalized_subject = self._require_text(subject, field_label="subject")
        normalized_preview_text = self._normalize_optional_text(preview_text)
        normalized_body_html = self._normalize_optional_text(body_html)
        normalized_body_text = self._normalize_optional_text(body_text)

        if not normalized_body_html and not normalized_body_text:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Template body_html or body_text is required.",
            )

        self._validate_template_placeholders(
            normalized_subject,
            allowed_placeholders=SUPPORTED_TEMPLATE_PLACEHOLDERS,
        )
        self._validate_template_placeholders(
            normalized_preview_text,
            allowed_placeholders=SUPPORTED_TEMPLATE_PLACEHOLDERS,
        )
        self._validate_template_placeholders(
            normalized_body_html,
            allowed_placeholders=SUPPORTED_TEMPLATE_PLACEHOLDERS,
        )
        self._validate_template_placeholders(
            normalized_body_text,
            allowed_placeholders=SUPPORTED_TEMPLATE_PLACEHOLDERS,
        )

        created = self.template_repository.create_template(
            client_id=client_id,
            name=normalized_name,
            subject=normalized_subject,
            preview_text=normalized_preview_text,
            body_html=normalized_body_html,
            body_text=normalized_body_text,
        )
        return AdminEmailTemplateResponse(
            id=created.id,
            client_id=created.client_id,
            name=created.name,
            subject=created.subject,
            preview_text=created.preview_text,
            body_html=created.body_html,
            body_text=created.body_text,
            created_at=created.created_at,
            updated_at=created.updated_at,
        )

    def add_campaign_contacts(
        self,
        *,
        campaign_id: str,
        contacts: list[AdminCampaignContactPayload],
    ) -> AdminCampaignContactsImportResponse:
        campaign = self.get_campaign_record(campaign_id)
        self._get_writable_client(campaign.client_id)

        received = len(contacts)
        created_contacts = 0
        reused_contacts = 0
        attached_contacts = 0
        duplicate_contacts = 0
        invalid_contacts = 0
        errors: list[AdminCampaignContactError] = []
        seen_emails: set[str] = set()

        for payload in contacts:
            normalized_email = self._normalize_email(payload.email)
            if not normalized_email:
                invalid_contacts += 1
                errors.append(
                    AdminCampaignContactError(
                        email=payload.email,
                        reason="email_required",
                    )
                )
                continue

            if normalized_email in seen_emails:
                duplicate_contacts += 1
                continue
            seen_emails.add(normalized_email)

            if not self._looks_like_email(normalized_email):
                invalid_contacts += 1
                errors.append(
                    AdminCampaignContactError(
                        email=normalized_email,
                        reason="invalid_email",
                    )
                )
                continue

            try:
                normalized_metadata = self._normalize_contact_metadata(payload.metadata)
            except HTTPException as error:
                invalid_contacts += 1
                errors.append(
                    AdminCampaignContactError(
                        email=normalized_email,
                        reason=str(error.detail),
                    )
                )
                continue

            contact = self.contact_repository.get_by_client_email(
                client_id=campaign.client_id,
                email=normalized_email,
            )
            if contact is None:
                contact = self.contact_repository.create_contact(
                    client_id=campaign.client_id,
                    email=normalized_email,
                    status=self.guard.SENDABLE_CONTACT_STATUS,
                    metadata=normalized_metadata,
                )
                created_contacts += 1
            else:
                if self._contact_metadata_changed(contact.metadata, normalized_metadata):
                    updated_contact = self.contact_repository.update_metadata(
                        contact_id=contact.id,
                        metadata=normalized_metadata,
                    )
                    if updated_contact is not None:
                        contact = updated_contact
                reused_contacts += 1

            was_attached = self.contact_repository.attach_contact_to_campaign(
                client_id=campaign.client_id,
                campaign_id=campaign.id,
                contact_id=contact.id,
            )
            if was_attached:
                attached_contacts += 1
                continue

            duplicate_contacts += 1

        summary = self._summarize_campaign_contacts(campaign=campaign)
        if campaign.contacts_ready != summary.contacts_ready or attached_contacts > 0:
            self.repository.update_campaign(
                client_id=campaign.client_id,
                campaign_id=campaign.id,
                contacts_ready=summary.contacts_ready,
                review_ready=False if attached_contacts > 0 else campaign.review_ready,
                current_step="recipients" if attached_contacts > 0 else campaign.current_step,
            )

        return AdminCampaignContactsImportResponse(
            campaign_id=campaign.id,
            client_id=campaign.client_id,
            received=received,
            created_contacts=created_contacts,
            reused_contacts=reused_contacts,
            attached_contacts=attached_contacts,
            duplicate_contacts=duplicate_contacts,
            invalid_contacts=invalid_contacts,
            contacts_ready=summary.contacts_ready,
            errors=errors,
        )

    def remove_campaign_contact(
        self,
        *,
        campaign_id: str,
        contact_id: str,
    ) -> AdminCampaignContactRemoveResponse:
        campaign = self.get_campaign_record(campaign_id)
        self._get_writable_client(campaign.client_id)

        was_removed = self.contact_repository.detach_contact_from_campaign(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
            contact_id=contact_id,
        )
        if not was_removed:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Campaign contact association not found.",
            )

        summary = self._summarize_campaign_contacts(campaign=campaign)
        self.repository.update_campaign(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
            contacts_ready=summary.contacts_ready,
            review_ready=False,
            current_step="recipients",
        )

        return AdminCampaignContactRemoveResponse(
            campaign_id=campaign.id,
            client_id=campaign.client_id,
            contact_id=contact_id,
            removed=True,
            contacts_ready=summary.contacts_ready,
        )

    def select_slot(
        self,
        *,
        campaign_id: str,
        slot_id: str,
    ) -> AdminCampaignSlotAssignmentResponse:
        campaign = self.get_campaign_record(campaign_id)
        self._get_writable_client(campaign.client_id)

        try:
            slot = self.campaign_slot_service.assign_slot(
                client_id=campaign.client_id,
                campaign_id=campaign.id,
                slot_id=slot_id,
            )
        except CampaignSlotConflictError as error:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(error),
            ) from error

        updated_campaign = self.repository.update_campaign(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
            review_ready=False,
        )
        return AdminCampaignSlotAssignmentResponse(
            campaign_id=updated_campaign.id,
            client_id=updated_campaign.client_id,
            campaign_slot_id=slot.id,
            slot_status=slot.status,
            slot_max_emails=slot.max_emails,
            review_ready=updated_campaign.review_ready,
        )

    def review_campaign(self, campaign_id: str) -> AdminCampaignReviewResponse:
        campaign = self.get_campaign_record(campaign_id)
        client = self._get_client(campaign.client_id)
        contacts = self.contact_repository.list_campaign_contacts(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
        )
        suppressed_emails = self.suppression_list_repository.list_suppressed_emails_for_campaign(
            client_id=campaign.client_id,
            emails=[contact.email for contact in contacts],
        )
        slot = self._get_campaign_slot(campaign=campaign)
        contact_summary = self._summarize_campaign_contacts(
            campaign=campaign,
            contacts=contacts,
            suppressed_emails=suppressed_emails,
        )
        limit_context = self._build_campaign_limit_context(campaign=campaign)
        evaluation = self._evaluate_campaign(
            campaign=campaign,
            client=client,
            contacts=contacts,
            suppressed_emails=suppressed_emails,
            slot=slot,
            contact_summary=contact_summary,
            limit_context=limit_context,
            allow_draft_transition=True,
        )
        next_status = campaign.status
        if (
            campaign.status.lower() == CampaignStatus.draft.value
            and evaluation.review_ready
        ):
            next_status = CampaignStatus.ready.value
        updated = self.repository.update_campaign(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
            status=next_status,
            content_ready=evaluation.content_ready,
            contacts_ready=evaluation.contacts_ready,
            review_ready=evaluation.review_ready,
            current_step="review",
        )

        return AdminCampaignReviewResponse(
            campaign_id=updated.id,
            client_id=updated.client_id,
            status=updated.status,
            allowed_to_send=evaluation.can_send,
            can_send_when_enabled=evaluation.can_send_when_enabled,
            sending_enabled=self.settings.email_sending_enabled,
            warnings=evaluation.warnings,
            blocking_errors=evaluation.blocking_errors,
            eligible_contact_count=contact_summary.eligible,
            blocked_contact_count=contact_summary.blocked,
            slot_limit=evaluation.guard_result.limit_value,
            limit_source=evaluation.guard_result.limit_source,
            content_ready=updated.content_ready,
            contacts_ready=updated.contacts_ready,
            review_ready=updated.review_ready,
            current_step=updated.current_step,
            daily_limit=evaluation.limit_usage.daily_limit,
            daily_used=evaluation.limit_usage.daily_used,
            daily_remaining=evaluation.limit_usage.daily_remaining,
            period_limit=evaluation.limit_usage.period_limit,
            period_used=evaluation.limit_usage.period_used,
            period_remaining=evaluation.limit_usage.period_remaining,
            period_started_at=evaluation.limit_usage.period_started_at,
            period_ends_at=evaluation.limit_usage.period_ends_at,
            provider_history=evaluation.provider_history,
        )

    def _get_client(self, client_id: str) -> ClientRecord:
        client = self.client_repository.get_by_id(client_id)
        if client is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client not found.",
            )
        return client

    def _get_writable_client(self, client_id: str) -> ClientRecord:
        client = self._get_client(client_id)
        if client.status.lower() in NON_WRITABLE_CLIENT_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Client status {client.status} does not allow campaign writes.",
            )
        return client

    def _get_campaign_slot(
        self,
        *,
        campaign: CampaignRecord,
    ):
        if not campaign.campaign_slot_id:
            return None

        return self.campaign_slot_repository.get_by_id(
            client_id=campaign.client_id,
            slot_id=campaign.campaign_slot_id,
        )

    def _validate_positive_int(
        self,
        value: int | None,
        *,
        field_label: str,
        default: int | None = None,
    ) -> int:
        if value is None:
            if default is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"{field_label} is required.",
                )
            return default
        if value <= 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{field_label} must be greater than zero.",
            )
        return value

    def _ensure_campaign_limits(
        self,
        campaign_id: str,
    ) -> CampaignSendingLimitRecord:
        return self.campaign_limit_repository.ensure_for_campaign(
            campaign_id=campaign_id,
            period_email_limit=DEFAULT_CAMPAIGN_PERIOD_EMAIL_LIMIT,
            daily_email_limit=DEFAULT_CAMPAIGN_DAILY_EMAIL_LIMIT,
        )

    def _update_campaign_limits(
        self,
        *,
        campaign: CampaignRecord,
        period_email_limit: int | None,
        daily_email_limit: int | None,
    ) -> CampaignSendingLimitRecord:
        limits = self._ensure_campaign_limits(campaign.id)
        if period_email_limit is None and daily_email_limit is None:
            return limits
        return self.campaign_limit_repository.update_for_campaign(
            campaign_id=campaign.id,
            period_email_limit=(
                self._validate_positive_int(
                    period_email_limit,
                    field_label="period_email_limit",
                )
                if period_email_limit is not None
                else limits.period_email_limit
            ),
            daily_email_limit=(
                self._validate_positive_int(
                    daily_email_limit,
                    field_label="daily_email_limit",
                )
                if daily_email_limit is not None
                else limits.daily_email_limit
            ),
        )

    def _build_campaign_limit_context(
        self,
        *,
        campaign: CampaignRecord,
        limits: CampaignSendingLimitRecord | None = None,
    ) -> CampaignLimitContext:
        limit_record = limits or self._ensure_campaign_limits(campaign.id)
        first_activity_at = self.email_log_repository.get_first_real_campaign_log_at(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
        )
        normalized_record = self._normalize_period_started_at(
            campaign=campaign,
            limits=limit_record,
            first_activity_at=first_activity_at,
        )
        period_started_at = normalized_record.period_started_at
        period_ends_at = (
            period_started_at + CAMPAIGN_PERIOD_WINDOW
            if period_started_at is not None
            else None
        )
        today_started_at = _get_business_day_start(
            datetime.now(timezone.utc),
            self.settings,
        )
        daily_used = self.email_log_repository.count_real_campaign_logs_since(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
            started_at=today_started_at,
        )
        period_used = (
            self.email_log_repository.count_real_campaign_logs_since(
                client_id=campaign.client_id,
                campaign_id=campaign.id,
                started_at=period_started_at,
                ended_at=period_ends_at,
            )
            if period_started_at is not None
            else 0
        )
        usage = CampaignLimitUsage(
            daily_limit=normalized_record.daily_email_limit,
            daily_used=daily_used,
            period_limit=normalized_record.period_email_limit,
            period_used=period_used,
            period_started_at=period_started_at,
            period_ends_at=period_ends_at,
        )
        return CampaignLimitContext(record=normalized_record, usage=usage)

    def _normalize_period_started_at(
        self,
        *,
        campaign: CampaignRecord,
        limits: CampaignSendingLimitRecord,
        first_activity_at: datetime | None = None,
    ) -> CampaignSendingLimitRecord:
        resolved_first_activity_at = first_activity_at or self.email_log_repository.get_first_real_campaign_log_at(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
        )
        if resolved_first_activity_at is None:
            return limits
        if (
            limits.period_started_at is not None
            and limits.period_started_at <= resolved_first_activity_at
        ):
            return limits
        return self.campaign_limit_repository.update_for_campaign(
            campaign_id=campaign.id,
            period_started_at=resolved_first_activity_at,
        )

    def _build_period_usage_summary(
        self,
        *,
        limit_context: CampaignLimitContext,
    ) -> CampaignPeriodUsageSummary:
        period_limit = limit_context.record.period_email_limit
        has_real_usage = (
            limit_context.usage.period_used > 0
            or limit_context.usage.period_started_at is not None
        )
        return CampaignPeriodUsageSummary(
            period_email_limit=period_limit,
            period_used=limit_context.usage.period_used,
            period_remaining=max(period_limit - limit_context.usage.period_used, 0),
            period_started_at=limit_context.usage.period_started_at,
            period_ends_at=limit_context.usage.period_ends_at,
            has_real_usage=has_real_usage,
        )

    def _build_detail(
        self,
        *,
        campaign: CampaignRecord,
        client: ClientRecord,
        limits: CampaignSendingLimitRecord | None = None,
    ) -> AdminCampaignDetail:
        client_name = client.personal_name or client.email
        email_brand = build_client_email_brand(client.metadata)
        limit_record = limits or self._ensure_campaign_limits(campaign.id)
        return AdminCampaignDetail(
            campaign_id=campaign.id,
            client_id=campaign.client_id,
            client_name=client_name,
            client_status=client.status,
            email_brand=email_brand.model_dump(exclude_none=True) if email_brand else None,
            name=campaign.name,
            status=campaign.status,
            subject=campaign.subject,
            rendered_subject=self._build_rendered_subject(
                campaign=campaign,
                client=client,
            ),
            preview_text=campaign.preview_text,
            body_html=campaign.body_html,
            body_text=campaign.body_text,
            current_step=campaign.current_step,
            campaign_slot_id=campaign.campaign_slot_id,
            content_ready=campaign.content_ready,
            contacts_ready=campaign.contacts_ready,
            review_ready=campaign.review_ready,
            period_email_limit=limit_record.period_email_limit,
            daily_email_limit=limit_record.daily_email_limit,
            period_started_at=limit_record.period_started_at,
            created_at=campaign.created_at,
            updated_at=campaign.updated_at,
        )

    def _summarize_campaign_contacts(
        self,
        *,
        campaign: CampaignRecord,
        contacts: list[ContactRecord] | None = None,
        suppressed_emails: set[str] | None = None,
    ) -> CampaignContactsSummary:
        campaign_contacts = (
            contacts
            if contacts is not None
            else self.contact_repository.list_campaign_contacts(
                client_id=campaign.client_id,
                campaign_id=campaign.id,
            )
        )
        suppressed = suppressed_emails
        if suppressed is None:
            suppressed = self.suppression_list_repository.list_suppressed_emails_for_campaign(
                client_id=campaign.client_id,
                emails=[contact.email for contact in campaign_contacts],
            )

        items: list[AdminCampaignContactItem] = []
        valid = 0
        invalid = 0
        suppressed_count = 0
        unsubscribed = 0
        blacklisted = 0
        bounced = 0
        eligible = 0

        for contact in campaign_contacts:
            blocked_reasons: list[str] = []
            normalized_email = self._normalize_email(contact.email)
            contact_status = contact.status.strip().lower()
            is_valid = self._looks_like_email(contact.email)
            is_suppressed = (
                contact_status == "suppressed"
                or normalized_email in suppressed
            )
            is_unsubscribed = contact_status == "unsubscribed"
            is_blacklisted = contact_status == "blacklisted"
            is_bounced = contact_status == "bounced"

            if is_valid:
                valid += 1
            else:
                invalid += 1
                blocked_reasons.append("invalid_email")

            if is_suppressed:
                suppressed_count += 1
                if contact_status == "suppressed":
                    blocked_reasons.append("suppressed")
                if normalized_email in suppressed:
                    blocked_reasons.append("suppression_list")

            if is_unsubscribed:
                unsubscribed += 1
                blocked_reasons.append("unsubscribed")

            if is_blacklisted:
                blacklisted += 1
                blocked_reasons.append("blacklisted")

            if is_bounced:
                bounced += 1
                blocked_reasons.append("bounced")

            if contact_status != self.guard.SENDABLE_CONTACT_STATUS:
                if (
                    contact_status
                    and contact_status
                    not in {"suppressed", "unsubscribed", "blacklisted", "bounced"}
                ):
                    blocked_reasons.append(f"contact_{contact_status}")
            is_eligible = (
                is_valid
                and contact_status == self.guard.SENDABLE_CONTACT_STATUS
                and not is_suppressed
            )
            if is_eligible:
                eligible += 1

            items.append(
                AdminCampaignContactItem(
                    contact_id=contact.id,
                    email=contact.email,
                    metadata={
                        key: str(value).strip()
                        for key, value in (contact.metadata or {}).items()
                        if key in CONTACT_METADATA_ALLOWED_KEYS and str(value).strip()
                    },
                    status=contact.status,
                    is_valid=is_valid,
                    is_eligible=is_eligible,
                    blocked_reasons=blocked_reasons,
                )
            )

        total = self.contact_repository.count_campaign_contacts(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
        )
        return CampaignContactsSummary(
            total=total,
            valid=valid,
            invalid=invalid,
            suppressed=suppressed_count,
            unsubscribed=unsubscribed,
            blacklisted=blacklisted,
            bounced=bounced,
            eligible=eligible,
            contacts_ready=eligible > 0,
            contacts=items,
        )

    def _evaluate_campaign(
        self,
        *,
        campaign: CampaignRecord,
        client: ClientRecord,
        contacts: list[ContactRecord],
        suppressed_emails: set[str],
        slot,
        contact_summary: CampaignContactsSummary,
        limit_context: CampaignLimitContext,
        allow_draft_transition: bool = False,
    ) -> CampaignEvaluation:
        content_ready = self._content_ready(
            subject=campaign.subject,
            body_html=campaign.body_html,
        )
        contacts_ready = contact_summary.contacts_ready
        active_campaign_count = self._count_active_campaigns(client.id)
        duplicate_guard = self._evaluate_duplicate_dispatch_guard(
            campaign=self._to_client_campaign_record(campaign),
            contacts=contacts,
            email_log_repository=self.email_log_repository,
        )
        guard_campaign = self._build_guard_campaign(
            campaign=campaign,
            allow_draft_transition=allow_draft_transition,
        )
        if (
            campaign.status.lower() == CampaignStatus.failed.value
            and not duplicate_guard.blocked
            and duplicate_guard.retryable_log_ids_by_contact is not None
        ):
            guard_campaign = guard_campaign.model_copy(
                update={"status": CampaignStatus.ready.value}
            )
        guard_result = self.guard.authorize_campaign_dispatch(
            email_sending_enabled=True,
            client=client,
            campaign=guard_campaign,
            slot=slot,
            contacts=contacts,
            suppressed_emails=suppressed_emails,
            active_campaign_count=active_campaign_count,
            campaign_limit_usage=limit_context.usage,
        )
        provider_history_policy: list[ProviderHistoryPolicySummary] = []
        if guard_result.allowed:
            provider_history_result, provider_history_policy = (
                _evaluate_provider_history_policy(
                    settings=self.settings,
                    provider=_resolve_controlled_provider(self.settings) or "",
                    campaign=guard_campaign,
                    guard_result=guard_result,
                    provider_event_repository=self.provider_event_repository,
                    email_log_repository=self.email_log_repository,
                )
            )
            if provider_history_result is not None:
                guard_result = provider_history_result
        blocking_errors: list[str] = []
        if not content_ready:
            blocking_errors.append("Campaign content is not ready.")
        if not contacts_ready:
            blocking_errors.append("Campaign has no associated contacts.")
        if not guard_result.allowed and guard_result.reason not in blocking_errors:
            blocking_errors.append(guard_result.reason)
        if (
            duplicate_guard.blocked
            and duplicate_guard.reason is not None
            and duplicate_guard.reason not in blocking_errors
        ):
            blocking_errors.append(duplicate_guard.reason)

        warnings: list[str] = []
        if not self.settings.email_sending_enabled:
            warnings.append(
                'EMAIL_SENDING_ENABLED is not exactly "true"; real dispatch is disabled.'
            )
        warnings.extend(
            item.reason
            for item in provider_history_policy
            if item.band == "review" and not item.blocking
        )

        can_send_when_enabled = (
            content_ready
            and contacts_ready
            and guard_result.allowed
            and not duplicate_guard.blocked
        )
        return CampaignEvaluation(
            content_ready=content_ready,
            contacts_ready=contacts_ready,
            review_ready=can_send_when_enabled,
            can_send_when_enabled=can_send_when_enabled,
            can_send=can_send_when_enabled and self.settings.email_sending_enabled,
            warnings=warnings,
            blocking_errors=blocking_errors,
            guard_result=guard_result,
            duplicate_guard=duplicate_guard,
            limit_record=limit_context.record,
            limit_usage=limit_context.usage,
            provider_history=provider_history_policy,
        )

    def _build_guard_campaign(
        self,
        *,
        campaign: CampaignRecord,
        allow_draft_transition: bool,
    ) -> ClientCampaignRecord:
        guard_campaign = self._to_client_campaign_record(campaign)
        if (
            allow_draft_transition
            and campaign.status.lower() == CampaignStatus.draft.value
        ):
            return guard_campaign.model_copy(
                update={"status": CampaignStatus.ready.value}
            )
        return guard_campaign

    def _build_campaign_summary_item(
        self,
        *,
        campaign: CampaignRecord,
        client: ClientRecord,
        evaluation: CampaignEvaluation,
    ) -> CampaignSummaryItem:
        return CampaignSummaryItem(
            id=campaign.id,
            client_id=campaign.client_id,
            name=campaign.name,
            status=campaign.status,
            subject=campaign.subject,
            rendered_subject=self._build_rendered_subject(
                campaign=campaign,
                client=client,
            ),
            preview_text=campaign.preview_text,
            current_step=campaign.current_step,
            content_ready=evaluation.content_ready,
            contacts_ready=evaluation.contacts_ready,
            review_ready=evaluation.review_ready,
        )

    def _build_campaign_slot_summary(
        self,
        *,
        campaign: CampaignRecord,
        client: ClientRecord,
        slot,
        evaluation: CampaignEvaluation,
    ) -> CampaignSlotSummary:
        if slot is not None:
            return CampaignSlotSummary(
                id=slot.id,
                label=slot.label,
                max_emails=evaluation.guard_result.limit_value,
                status=slot.status,
                limit_source=evaluation.guard_result.limit_source,
            )

        return CampaignSlotSummary(
            id=campaign.campaign_slot_id,
            label=None,
            max_emails=None,
            status=None,
            limit_source=evaluation.guard_result.limit_source,
        )

    def _build_rendered_subject(
        self,
        *,
        campaign: CampaignRecord,
        client: ClientRecord,
    ) -> str | None:
        subject = (campaign.subject or "").strip()
        if not subject:
            return None

        email_brand = build_client_email_brand(client.metadata)
        replacements = build_template_variable_values(
            subject=subject,
            preview_text=(campaign.preview_text or "").strip(),
            client_name=client.personal_name or client.email,
            campaign_name=campaign.name,
            current_year=datetime.now(timezone.utc).year,
            email_brand=email_brand.model_dump(exclude_none=True) if email_brand else None,
        )
        rendered = render_template_string(subject, replacements).strip()
        return rendered or subject

    def _build_campaign_recipients_summary(
        self,
        contact_summary: CampaignContactsSummary,
    ) -> CampaignRecipientsSummary:
        return CampaignRecipientsSummary(
            total=contact_summary.total,
            eligible=contact_summary.eligible,
            invalid=contact_summary.invalid,
            suppressed=contact_summary.suppressed,
            blocked=contact_summary.blocked,
        )

    def _build_policy_state(
        self,
        *,
        evaluation: CampaignEvaluation,
    ) -> CampaignPolicyStateSummary:
        duplicate_guard = evaluation.duplicate_guard
        limit_usage = evaluation.limit_usage
        warmup_blocked = (
            evaluation.guard_result.limit_source == "sending_domain_warmup"
            and not evaluation.guard_result.allowed
        )
        warmup_at_limit = limit_usage.daily_used >= limit_usage.daily_limit
        warmup_allowed = not warmup_blocked and not warmup_at_limit
        return CampaignPolicyStateSummary(
            deliverability_guard=CampaignPolicyStatusSummary(
                allowed=evaluation.guard_result.allowed,
                decision=evaluation.guard_result.decision.value,
                code=evaluation.guard_result.code,
                severity=evaluation.guard_result.severity,
                reason=evaluation.guard_result.reason,
            ),
            duplicate_guard=CampaignPolicyStatusSummary(
                allowed=not duplicate_guard.blocked,
                decision="blocked" if duplicate_guard.blocked else "authorized",
                code=duplicate_guard.code or "duplicate_guard_clear",
                severity="error" if duplicate_guard.blocked else "info",
                reason=duplicate_guard.reason or "No existing real dispatch logs block this campaign.",
            ),
            warmup_guard=CampaignPolicyStatusSummary(
                allowed=warmup_allowed,
                decision="blocked" if not warmup_allowed else "authorized",
                code=(
                    evaluation.guard_result.code
                    if warmup_blocked
                    else (
                        "campaign_daily_limit_reached"
                        if warmup_at_limit
                        else "warmup_guard_clear"
                    )
                ),
                severity="error" if not warmup_allowed else "info",
                reason=(
                    evaluation.guard_result.reason
                    if warmup_blocked
                    else (
                        "Campaign daily pacing limit reached."
                        if warmup_at_limit
                        else "Campaign warmup and pacing limits have remaining capacity."
                    )
                ),
            ),
            provider_history=evaluation.provider_history,
        )

    def _build_campaign_logs_summary(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> CampaignLogsSummary:
        status_counts = self.email_log_repository.get_campaign_status_counts(
            client_id=client_id,
            campaign_id=campaign_id,
        )
        event_counts = self.provider_event_repository.get_campaign_event_counts(
            client_id=client_id,
            campaign_id=campaign_id,
        )
        provider_events_available = self.provider_event_repository.has_events_for_campaign(
            client_id=client_id,
            campaign_id=campaign_id,
        )
        sent = _prefer_provider_metric(
            status_counts=status_counts,
            event_counts=event_counts,
            provider_events_available=provider_events_available,
            status_keys=("sent", "dispatched", "delivered"),
            event_types=PROVIDER_ACCEPTED_EVENT_TYPES,
        )
        delivered = _provider_metric(
            event_counts=event_counts,
            provider_events_available=provider_events_available,
            event_types=PROVIDER_DELIVERED_EVENT_TYPES,
        )
        opened = _provider_metric(
            event_counts=event_counts,
            provider_events_available=provider_events_available,
            event_types=PROVIDER_OPENED_EVENT_TYPES,
        )
        clicked = _provider_metric(
            event_counts=event_counts,
            provider_events_available=provider_events_available,
            event_types=PROVIDER_CLICKED_EVENT_TYPES,
        )
        bounced = _provider_metric(
            event_counts=event_counts,
            provider_events_available=provider_events_available,
            event_types=PROVIDER_BOUNCE_EVENT_TYPES,
        )
        complained = _provider_metric(
            event_counts=event_counts,
            provider_events_available=provider_events_available,
            event_types=PROVIDER_COMPLAINT_EVENT_TYPES,
        )
        unsubscribed = _provider_metric(
            event_counts=event_counts,
            provider_events_available=provider_events_available,
            event_types=PROVIDER_UNSUBSCRIBE_EVENT_TYPES,
        )
        delivery_rate = _rate(delivered, sent)
        open_rate = _rate(opened, delivered)
        click_rate = _rate(clicked, delivered)
        bounce_rate = _rate(bounced, sent)
        complaint_rate = _rate(complained, sent)
        unsubscribe_rate = _rate(unsubscribed, sent)
        return CampaignLogsSummary(
            simulated=status_counts.get("simulated", 0),
            queued=status_counts.get("queued", 0),
            sent=sent,
            failed=status_counts.get("failed", 0),
            delivered=delivered,
            opened=opened,
            clicked=clicked,
            bounced=bounced,
            complained=complained,
            unsubscribed=unsubscribed,
            sent_available=True,
            failed_available=True,
            delivered_available=provider_events_available,
            opened_available=provider_events_available,
            clicked_available=provider_events_available,
            bounced_available=provider_events_available,
            complained_available=provider_events_available,
            unsubscribed_available=provider_events_available,
            delivery_rate=delivery_rate,
            open_rate=open_rate,
            click_rate=click_rate,
            bounce_rate=bounce_rate,
            complaint_rate=complaint_rate,
            unsubscribe_rate=unsubscribe_rate,
            delivery_rate_available=delivery_rate is not None,
            open_rate_available=open_rate is not None,
            click_rate_available=click_rate is not None,
            bounce_rate_available=bounce_rate is not None,
            complaint_rate_available=complaint_rate is not None,
            unsubscribe_rate_available=unsubscribe_rate is not None,
            provider_events_available=provider_events_available,
        )

    def _build_campaign_blocked_sends_summary(
        self,
        *,
        campaign: CampaignRecord,
    ) -> CampaignBlockedSendsSummary:
        total = self.blocked_send_repository.count_by_campaign(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
        )
        latest = [
            {
                "id": record.id,
                "client_id": record.client_id,
                "campaign_id": record.campaign_id,
                "campaign_name": campaign.name,
                "contact_id": record.contact_id,
                "reason": record.reason,
                "decision": record.decision,
                "created_at": record.created_at,
            }
            for record in self.blocked_send_repository.list_recent_by_campaign(
                client_id=campaign.client_id,
                campaign_id=campaign.id,
                limit=BLOCKED_SENDS_LATEST_LIMIT,
            )
        ]
        return CampaignBlockedSendsSummary(
            total=total,
            latest=latest,
        )

    def _count_active_campaigns(self, client_id: str) -> int:
        return sum(
            1
            for campaign in self.repository.list_by_client(client_id)
            if campaign.status.lower() in self.guard.SENDABLE_CAMPAIGN_STATUSES
        )

    def _to_client_campaign_record(self, campaign: CampaignRecord) -> ClientCampaignRecord:
        return ClientCampaignRecord(
            id=campaign.id,
            client_id=campaign.client_id,
            name=campaign.name,
            status=campaign.status,
            subject=campaign.subject,
            campaign_slot_id=campaign.campaign_slot_id,
            preview_text=campaign.preview_text,
            body_html=campaign.body_html,
            body_text=campaign.body_text,
            content_ready=campaign.content_ready,
            contacts_ready=campaign.contacts_ready,
            review_ready=campaign.review_ready,
            current_step=campaign.current_step,
            created_at=campaign.created_at,
            updated_at=campaign.updated_at,
        )

    def _content_ready(self, *, subject: str | None, body_html: str | None) -> bool:
        return bool((subject or "").strip() and (body_html or "").strip())

    def _normalize_email(self, email: str) -> str:
        return email.strip().lower()

    def _normalize_contact_metadata(self, metadata: dict[str, object]) -> dict[str, str]:
        normalized: dict[str, str] = {}
        for key in CONTACT_METADATA_ALLOWED_KEYS:
            raw_value = metadata.get(key)
            if raw_value is None:
                continue
            value = str(raw_value).strip()
            if value:
                normalized[key] = value

        if not normalized.get("nome"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="nome_required",
            )

        return normalized

    def _contact_metadata_changed(
        self,
        current: dict[str, Any] | None,
        next_metadata: dict[str, str],
    ) -> bool:
        if not current:
            return True
        current_normalized = {
            key: str(value).strip()
            for key, value in current.items()
            if key in CONTACT_METADATA_ALLOWED_KEYS and str(value).strip()
        }
        return current_normalized != next_metadata

    def _validate_template_placeholders(
        self,
        value: str | None,
        *,
        allowed_placeholders: set[str],
    ) -> None:
        if not value:
            return

        placeholders = {
            match.group(1).strip().lower()
            for match in TEMPLATE_PLACEHOLDER_PATTERN.finditer(value)
        }
        unsupported = {
            placeholder for placeholder in placeholders if placeholder not in allowed_placeholders
        }
        if unsupported:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Completa o rimuovi le variabili del template prima di salvare.",
            )

    def _looks_like_email(self, email: str) -> bool:
        value = email.strip()
        return "@" in value and "." in value.rsplit("@", 1)[-1]

    def _require_text(self, value: str, *, field_label: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{field_label} is required.",
            )
        return normalized

    def _normalize_optional_text(self, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    def _validate_step(self, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in ALLOWED_CAMPAIGN_STEPS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Campaign current_step is invalid.",
            )
        return normalized

    def _evaluate_duplicate_dispatch_guard(
        self,
        *,
        campaign: ClientCampaignRecord,
        contacts: list[ContactRecord],
        email_log_repository: EmailLogRepository,
    ) -> CampaignDispatchDuplicateGuard:
        campaign_status = campaign.status.strip().lower()
        if campaign_status == CampaignStatus.running.value:
            return CampaignDispatchDuplicateGuard(
                blocked=True,
                code="campaign_send_already_in_progress",
                reason="Campaign send is already in progress.",
            )
        if campaign_status == CampaignStatus.completed.value:
            return CampaignDispatchDuplicateGuard(
                blocked=True,
                code="campaign_send_already_accepted",
                reason="Campaign was already started by Listmonk or accepted for dispatch.",
            )

        status_counts = email_log_repository.get_campaign_status_counts(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
        )
        real_status_counts = {
            log_status: count
            for log_status, count in status_counts.items()
            if log_status != "simulated" and count > 0
        }
        if not real_status_counts:
            return CampaignDispatchDuplicateGuard(blocked=False)

        if any(
            log_status in IN_PROGRESS_LOG_STATUSES for log_status in real_status_counts
        ):
            return CampaignDispatchDuplicateGuard(
                blocked=True,
                code="campaign_send_already_in_progress",
                reason="Campaign already has queued email logs.",
            )

        if any(
            log_status in ACCEPTED_OR_COMPLETED_LOG_STATUSES
            for log_status in real_status_counts
        ):
            return CampaignDispatchDuplicateGuard(
                blocked=True,
                code="campaign_send_already_accepted",
                reason="Campaign already has Listmonk-accepted or processed email logs.",
            )

        latest_logs = email_log_repository.list_latest_for_campaign(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
        )
        real_log_total = sum(real_status_counts.values())
        if (
            not latest_logs
            or len(latest_logs) != real_log_total
            or any(log.status not in RETRYABLE_FAILED_LOG_STATUSES for log in latest_logs)
        ):
            return CampaignDispatchDuplicateGuard(
                blocked=True,
                code="campaign_already_dispatched",
                reason="Campaign already has existing email logs and cannot be retried safely.",
            )

        current_contact_ids = {contact.id for contact in contacts}
        logged_contact_ids = {str(log.contact_id) for log in latest_logs if log.contact_id}
        if logged_contact_ids != current_contact_ids:
            return CampaignDispatchDuplicateGuard(
                blocked=True,
                code="campaign_already_dispatched",
                reason="Campaign failed previously, but the recipient set changed and cannot be retried safely.",
            )

        return CampaignDispatchDuplicateGuard(
            blocked=False,
            retryable_log_ids_by_contact={
                str(log.contact_id): log.id
                for log in latest_logs
                if log.contact_id is not None
            },
        )


@dataclass(frozen=True)
class CampaignDispatchService:
    settings: Settings
    guard: DeliverabilityGuard
    listmonk_client: ListmonkClient
    mapping_service: ListmonkMappingService | None = None
    client_repository: ClientRepository | None = None
    campaign_slot_repository: CampaignSlotRepository | None = None
    campaign_limit_repository: CampaignSendingLimitRepository | None = None
    contact_repository: ContactRepository | None = None
    suppression_list_repository: SuppressionListRepository | None = None
    blocked_send_repository: BlockedSendRepository | None = None
    email_log_repository: EmailLogRepository | None = None
    provider_event_repository: ProviderEventRepository | None = None
    campaign_preparation_service: Any | None = None
    unsubscribe_service: UnsubscribeService | None = None

    def _evaluate_duplicate_dispatch_guard(
        self,
        *,
        campaign: ClientCampaignRecord,
        contacts: list[ContactRecord],
        email_log_repository: EmailLogRepository,
    ) -> CampaignDispatchDuplicateGuard:
        campaign_status = campaign.status.strip().lower()
        if campaign_status == CampaignStatus.running.value:
            return CampaignDispatchDuplicateGuard(
                blocked=True,
                code="campaign_send_already_in_progress",
                reason="Campaign send is already in progress.",
            )
        if campaign_status == CampaignStatus.completed.value:
            return CampaignDispatchDuplicateGuard(
                blocked=True,
                code="campaign_send_already_accepted",
                reason="Campaign was already started by Listmonk or accepted for dispatch.",
            )

        status_counts = email_log_repository.get_campaign_status_counts(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
        )
        real_status_counts = {
            status: count
            for status, count in status_counts.items()
            if status != "simulated" and count > 0
        }
        if not real_status_counts:
            return CampaignDispatchDuplicateGuard(blocked=False)

        if any(
            status in IN_PROGRESS_LOG_STATUSES for status in real_status_counts
        ):
            return CampaignDispatchDuplicateGuard(
                blocked=True,
                code="campaign_send_already_in_progress",
                reason="Campaign already has queued email logs.",
            )

        if any(
            status in ACCEPTED_OR_COMPLETED_LOG_STATUSES
            for status in real_status_counts
        ):
            return CampaignDispatchDuplicateGuard(
                blocked=True,
                code="campaign_send_already_accepted",
                reason="Campaign already has Listmonk-accepted or processed email logs.",
            )

        latest_logs = email_log_repository.list_latest_for_campaign(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
        )
        real_log_total = sum(real_status_counts.values())
        if (
            not latest_logs
            or len(latest_logs) != real_log_total
            or any(log.status not in RETRYABLE_FAILED_LOG_STATUSES for log in latest_logs)
        ):
            return CampaignDispatchDuplicateGuard(
                blocked=True,
                code="campaign_already_dispatched",
                reason="Campaign already has existing email logs and cannot be retried safely.",
            )

        current_contact_ids = {contact.id for contact in contacts}
        logged_contact_ids = {str(log.contact_id) for log in latest_logs if log.contact_id}
        if logged_contact_ids != current_contact_ids:
            return CampaignDispatchDuplicateGuard(
                blocked=True,
                code="campaign_already_dispatched",
                reason="Campaign failed previously, but the recipient set changed and cannot be retried safely.",
            )

        return CampaignDispatchDuplicateGuard(
            blocked=False,
            retryable_log_ids_by_contact={
                str(log.contact_id): log.id
                for log in latest_logs
                if log.contact_id is not None
            },
        )

    def _persist_dispatch_logs(
        self,
        *,
        email_log_repository: EmailLogRepository,
        client_id: str,
        campaign_id: str,
        contacts: list[ContactRecord],
        status: str,
        sending_domain: str | None,
        body: str,
        retryable_log_ids_by_contact: dict[str, str] | None,
    ) -> tuple[list[Any], int, int]:
        logs: list[Any] = []
        created_count = 0
        updated_count = 0
        retryable_map = retryable_log_ids_by_contact or {}
        for contact in contacts:
            existing_log_id = retryable_map.get(contact.id)
            if existing_log_id is not None:
                updated = email_log_repository.update_status(
                    email_log_id=existing_log_id,
                    status=status,
                )
                if updated is not None:
                    logs.append(updated)
                    updated_count += 1
                    continue
            created = email_log_repository.create_email_log(
                client_id=client_id,
                campaign_id=campaign_id,
                contact_id=contact.id,
                status=status,
                sending_domain=sending_domain,
                body=body,
            )
            logs.append(created)
            created_count += 1
        return logs, created_count, updated_count

    def send_campaign(
        self,
        campaign_id: str,
        current_user: AuthenticatedUser | None = None,
    ) -> dict[str, Any]:
        mapping_service = self.mapping_service
        client_repository = self.client_repository
        contact_repository = self.contact_repository
        suppression_repository = self.suppression_list_repository
        blocked_send_repository = self.blocked_send_repository
        email_log_repository = self.email_log_repository
        provider_event_repository = self.provider_event_repository
        campaign_limit_repository = self.campaign_limit_repository
        unsubscribe_service = self.unsubscribe_service

        if (
            mapping_service is None
            or client_repository is None
            or campaign_limit_repository is None
            or contact_repository is None
            or suppression_repository is None
            or email_log_repository is None
            or unsubscribe_service is None
        ):
            guard_result = self.guard.authorize_campaign_send(
                self.settings.email_sending_enabled
            )
            return self._diagnostic_response(
                campaign_id=campaign_id,
                decision=guard_result,
                reason="Campaign dispatch persistence is not configured.",
                code="dispatch_persistence_unavailable",
            )

        with email_log_repository.campaign_dispatch_lock(campaign_id=campaign_id):
            campaign = self._get_campaign_for_dispatch(
                campaign_id=campaign_id,
                current_user=current_user,
                client_repository=client_repository,
            )
            client = self._get_client_for_dispatch(
                campaign=campaign,
                client_repository=client_repository,
            )
            contacts = []
            suppressed_emails: set[str] = set()
            active_campaign_count: int | None = None
            slot = None
            limit_usage: CampaignLimitUsage | None = None
            if client is not None and campaign is not None:
                contacts = contact_repository.list_campaign_contacts(
                    client_id=client.id,
                    campaign_id=campaign.id,
                )
                reconciliation = self._reconcile_native_listmonk_unsubscribes(
                    campaign=campaign,
                    contacts=contacts,
                    mapping_service=mapping_service,
                    unsubscribe_service=unsubscribe_service,
                )
                if reconciliation.failed:
                    return self._native_unsubscribe_reconciliation_blocked_response(
                        campaign=campaign,
                        reason=reconciliation.reason
                        or "Listmonk subscription state could not be checked safely.",
                        code=reconciliation.code
                        or "listmonk_unsubscribe_reconciliation_failed",
                        blocked_send_repository=blocked_send_repository,
                    )
                suppressed_emails = suppression_repository.list_suppressed_emails_for_campaign(
                    client_id=client.id,
                    emails=[contact.email for contact in contacts],
                )
                active_campaign_count = self._count_active_campaigns_for_client(
                    client_id=client.id,
                    client_repository=client_repository,
                )
                if (
                    campaign.campaign_slot_id
                    and self.campaign_slot_repository is not None
                ):
                    slot = self.campaign_slot_repository.get_by_id(
                        client_id=client.id,
                        slot_id=campaign.campaign_slot_id,
                    )
                limit_usage = self._build_dispatch_limit_usage(
                    campaign=campaign,
                    client_id=client.id,
                    campaign_limit_repository=campaign_limit_repository,
                    email_log_repository=email_log_repository,
                )

            duplicate_guard = self._evaluate_duplicate_dispatch_guard(
                campaign=campaign,
                contacts=contacts,
                email_log_repository=email_log_repository,
            ) if campaign is not None else CampaignDispatchDuplicateGuard(blocked=False)

            guard_campaign = campaign
            if (
                campaign is not None
                and campaign.status.lower() == CampaignStatus.failed.value
                and not duplicate_guard.blocked
                and duplicate_guard.retryable_log_ids_by_contact is not None
            ):
                guard_campaign = campaign.model_copy(
                    update={"status": CampaignStatus.ready.value}
                )

            guard_result = self.guard.authorize_campaign_dispatch(
                email_sending_enabled=self.settings.email_sending_enabled,
                client=client,
                campaign=guard_campaign,
                slot=slot,
                contacts=contacts,
                suppressed_emails=suppressed_emails,
                active_campaign_count=active_campaign_count,
                campaign_limit_usage=limit_usage,
            )
            if guard_result.decision != SendDecision.AUTHORIZED:
                return self._blocked_response(
                    campaign_id=campaign_id,
                    guard_result=guard_result,
                    blocked_send_repository=blocked_send_repository,
                )

            if campaign is None or client is None:
                return self._diagnostic_response(
                    campaign_id=campaign_id,
                    decision=guard_result,
                    reason="Campaign not found.",
                    code="campaign_not_found",
                )
            if duplicate_guard.blocked:
                return self._diagnostic_response(
                    campaign_id=campaign_id,
                    decision=guard_result,
                    reason=str(duplicate_guard.reason),
                    client_id=campaign.client_id,
                    code=str(duplicate_guard.code),
                    content_ready=campaign.content_ready,
                )

            runtime_provider = self._resolve_controlled_provider()
            if runtime_provider is None:
                return self._diagnostic_response(
                    campaign_id=campaign_id,
                    decision=guard_result,
                    reason=(
                        "Controlled dispatch requires development or staging runtime "
                        "with Mailpit-compatible provider configuration."
                    ),
                    client_id=campaign.client_id,
                    code="controlled_runtime_required",
                )

            sending_domain = (
                get_configured_sending_domain(self.settings)
                if runtime_provider == "listmonk"
                else None
            )
            domain_warmup_result = self._evaluate_domain_warmup_guard(
                provider=runtime_provider,
                campaign=campaign,
                guard_result=guard_result,
                email_log_repository=email_log_repository,
            )
            if domain_warmup_result is not None:
                return self._blocked_response(
                    campaign_id=campaign_id,
                    guard_result=domain_warmup_result,
                    blocked_send_repository=blocked_send_repository,
                    sending_domain=sending_domain,
                )

            provider_history_result, _provider_history_warnings = (
                self._evaluate_provider_history_guard(
                    provider=runtime_provider,
                    campaign=campaign,
                    guard_result=guard_result,
                    provider_event_repository=provider_event_repository,
                    email_log_repository=email_log_repository,
                )
            )
            if provider_history_result is not None:
                return self._blocked_response(
                    campaign_id=campaign_id,
                    guard_result=provider_history_result,
                    blocked_send_repository=blocked_send_repository,
                    sending_domain=sending_domain,
                )

            safety_result = self._evaluate_real_send_safety(
                provider=runtime_provider,
                campaign=campaign,
                contacts=contacts,
                guard_result=guard_result,
                preparation=None,
            )
            if not safety_result["safety_passed"]:
                return self._safety_failed_response(
                    campaign_id=campaign_id,
                    client_id=campaign.client_id,
                    guard_result=guard_result,
                    safety_result=safety_result,
                )

            if self.campaign_preparation_service is None:
                return self._diagnostic_response(
                    campaign_id=campaign_id,
                    decision=guard_result,
                    reason="Campaign preparation service is not configured.",
                    client_id=campaign.client_id,
                    code="campaign_preparation_unavailable",
                )

            try:
                preparation = self.campaign_preparation_service.prepare_campaign(
                    campaign_id,
                    current_user,
                )
            except ListmonkError as error:
                return self._failed_response_from_listmonk_error(
                    campaign_id=campaign_id,
                    client_id=campaign.client_id,
                    guard_result=guard_result,
                    error=error,
                    provider=runtime_provider,
                    stage="preparation",
                    dispatch_attempted=False,
                )

            if preparation.get("status") != "synced":
                return self._diagnostic_response(
                    campaign_id=campaign_id,
                    decision=guard_result,
                    reason=str(
                        preparation.get(
                            "reason",
                            "Campaign listmonk preparation failed.",
                        )
                    ),
                    client_id=campaign.client_id,
                    code="campaign_preparation_failed",
                    preparation=preparation,
                )

            content = preparation.get("content")
            if not isinstance(content, dict) or not content.get("content_ready"):
                reason = "Campaign HTML template is not ready for dispatch."
                if isinstance(content, dict):
                    reason = str(content.get("reason", reason))
                return self._diagnostic_response(
                    campaign_id=campaign_id,
                    decision=guard_result,
                    reason=reason,
                    client_id=campaign.client_id,
                    code="content_not_ready",
                    content_ready=False,
                    preparation=preparation,
                )

            safety_result = self._evaluate_real_send_safety(
                provider=runtime_provider,
                campaign=campaign,
                contacts=contacts,
                guard_result=guard_result,
                preparation=preparation,
            )
            if not safety_result["safety_passed"]:
                return self._safety_failed_response(
                    campaign_id=campaign_id,
                    client_id=campaign.client_id,
                    guard_result=guard_result,
                    safety_result=safety_result,
                    preparation=preparation,
                    content_ready=True,
                )

            mapping = mapping_service.get_mapping(
                client_id=campaign.client_id,
                entity_type=ENTITY_TYPE_CAMPAIGN,
                entity_id=campaign.id,
                listmonk_type=LISTMONK_TYPE_CAMPAIGN,
            )
            mapping_created = bool(
                preparation
                and isinstance(preparation.get("listmonk_mapping"), dict)
                and preparation["listmonk_mapping"].get("created")
            )

            if mapping is None:
                create_payload = self._build_listmonk_campaign_payload(
                    campaign=campaign,
                    preparation=preparation,
                    mapping_service=mapping_service,
                )
                if create_payload is None:
                    return self._diagnostic_response(
                        campaign_id=campaign_id,
                        decision=guard_result,
                        reason="Campaign is missing required Business DB data for listmonk mapping.",
                        client_id=campaign.client_id,
                        code="listmonk_campaign_payload_invalid",
                        preparation=preparation,
                        content_ready=True,
                    )

                try:
                    listmonk_campaign = self.listmonk_client.create_campaign(create_payload)
                except ListmonkError as error:
                    return self._failed_response_from_listmonk_error(
                        campaign_id=campaign_id,
                        client_id=campaign.client_id,
                        guard_result=guard_result,
                        error=error,
                        provider=runtime_provider,
                        stage="campaign_create",
                        dispatch_attempted=False,
                        preparation=preparation,
                        content_ready=True,
                    )
                listmonk_campaign_id = extract_listmonk_id(listmonk_campaign)
                try:
                    mapping = mapping_service.ensure_campaign_mapping(
                        client_id=campaign.client_id,
                        campaign_id=campaign.id,
                        listmonk_campaign_id=listmonk_campaign_id,
                    )
                except ListmonkMappingConflictError as error:
                    return self._diagnostic_response(
                        campaign_id=campaign_id,
                        decision=guard_result,
                        reason=str(error),
                        client_id=campaign.client_id,
                        code="listmonk_mapping_conflict",
                        preparation=preparation,
                    )
                mapping_created = True

            try:
                listmonk_result = self.listmonk_client.trigger_campaign_send(mapping.listmonk_id)
            except ListmonkError as error:
                failed_logs, created_count, updated_count = self._persist_dispatch_logs(
                    email_log_repository=email_log_repository,
                    client_id=campaign.client_id,
                    campaign_id=campaign.id,
                    contacts=contacts,
                    status="failed",
                    body=str(content.get("body") or ""),
                    retryable_log_ids_by_contact=duplicate_guard.retryable_log_ids_by_contact,
                )
                limit_usage = self._build_dispatch_limit_usage(
                    campaign=campaign,
                    client_id=campaign.client_id,
                    campaign_limit_repository=campaign_limit_repository,
                    email_log_repository=email_log_repository,
                )
                return self._failed_response_from_listmonk_error(
                    campaign_id=campaign_id,
                    client_id=campaign.client_id,
                    guard_result=guard_result,
                    error=error,
                    provider=runtime_provider,
                    stage="dispatch",
                    dispatch_attempted=True,
                    preparation=preparation,
                    content_ready=True,
                    queued_count=0,
                    sent_or_accepted_count=0,
                    failed_count=len(failed_logs),
                    email_logs_created=created_count,
                    email_logs_updated=updated_count,
                    limit_usage=limit_usage,
                )

            log_status, provider_status = self._classify_listmonk_dispatch_result(
                listmonk_result
            )
            logs, created_count, updated_count = self._persist_dispatch_logs(
                email_log_repository=email_log_repository,
                client_id=campaign.client_id,
                campaign_id=campaign.id,
                contacts=contacts,
                status=log_status,
                sending_domain=sending_domain,
                body=str(content.get("body") or ""),
                retryable_log_ids_by_contact=duplicate_guard.retryable_log_ids_by_contact,
            )
            if log_status == "failed":
                limit_usage = self._build_dispatch_limit_usage(
                    campaign=campaign,
                    client_id=campaign.client_id,
                    campaign_limit_repository=campaign_limit_repository,
                    email_log_repository=email_log_repository,
                )
                return self._failed_response(
                    campaign_id=campaign_id,
                    client_id=campaign.client_id,
                    guard_result=guard_result,
                    reason=self._extract_listmonk_failure_reason(listmonk_result),
                    provider=runtime_provider,
                    stage="dispatch",
                    dispatch_attempted=True,
                    preparation=preparation,
                    content_ready=True,
                    provider_status=provider_status,
                    queued_count=0,
                    sent_or_accepted_count=0,
                    failed_count=len(logs),
                    email_logs_created=created_count,
                    email_logs_updated=updated_count,
                    limit_usage=limit_usage,
                )

            campaign = self._mark_campaign_running(
                campaign=campaign,
                client_repository=client_repository,
                campaign_limit_repository=campaign_limit_repository,
                email_log_repository=email_log_repository,
            )
            limit_usage = self._build_dispatch_limit_usage(
                campaign=campaign,
                client_id=campaign.client_id,
                campaign_limit_repository=campaign_limit_repository,
                email_log_repository=email_log_repository,
            )
            response = {
                "status": "accepted",
                "mode": "controlled_dev",
                "provider": runtime_provider,
                "provider_status": provider_status,
                "campaign_id": campaign_id,
                "client_id": campaign.client_id,
                "allowed": True,
                "decision": guard_result.decision,
                "reason": guard_result.reason,
                "code": guard_result.code,
                "severity": guard_result.severity,
                "safety_checked": True,
                "safety_passed": True,
                "allowed_recipients_checked": safety_result["allowed_recipients_checked"],
                "eligible_contact_count": guard_result.eligible_contact_count,
                "max_real_send_recipients": safety_result["max_real_send_recipients"],
                "blocked_contact_count": guard_result.blocked_contact_count,
                "blocked_reasons": dict(guard_result.blocked_reasons or {}),
                "diagnostic": guard_result.diagnostic,
                "limit_source": guard_result.limit_source,
                "limit_value": guard_result.limit_value,
                "daily_limit": limit_usage.daily_limit if limit_usage else None,
                "daily_used": limit_usage.daily_used if limit_usage else 0,
                "daily_remaining": limit_usage.daily_remaining if limit_usage else None,
                "period_limit": limit_usage.period_limit if limit_usage else None,
                "period_used": limit_usage.period_used if limit_usage else 0,
                "period_remaining": limit_usage.period_remaining if limit_usage else None,
                "period_started_at": limit_usage.period_started_at if limit_usage else None,
                "period_ends_at": limit_usage.period_ends_at if limit_usage else None,
                "guard": guard_result.to_dict(),
                "dispatch_attempted": True,
                "real_send_attempted": True,
                "listmonk_prepared": True,
                "listmonk_dispatched": True,
                "content_ready": True,
                "unsubscribe_ready": safety_result["unsubscribe_ready"],
                "provider_events_ready": True,
                "email_logs_created": created_count,
                "email_logs_updated": updated_count,
                "queued_count": 0,
                "sent_or_accepted_count": len(logs),
                "failed_count": 0,
                "listmonk_mapping": {
                    "entity_type": mapping.entity_type,
                    "entity_id": mapping.entity_id,
                    "listmonk_type": mapping.listmonk_type,
                    "listmonk_id": mapping.listmonk_id,
                    "created": mapping_created,
                },
                "listmonk": listmonk_result,
            }
            response["preparation"] = self._sanitize_preparation_snapshot(preparation)
            return response

    def _classify_listmonk_dispatch_result(
        self,
        payload: dict[str, Any],
    ) -> tuple[str, str]:
        provider_status = self._extract_provider_status(payload)
        if provider_status in {
            "failed",
            "failure",
            "error",
            "errored",
            "cancelled",
            "canceled",
            "rejected",
        }:
            return "failed", provider_status
        if self._payload_signals_dispatch_failure(payload):
            return "failed", provider_status or "dispatch_failed"
        return "sent", provider_status or "accepted_by_listmonk"

    def _extract_provider_status(self, payload: Any) -> str | None:
        if not isinstance(payload, dict):
            return None

        candidates = [
            payload.get("status"),
            payload.get("state"),
            payload.get("campaign_status"),
        ]
        data = payload.get("data")
        if isinstance(data, dict):
            candidates.extend(
                [
                    data.get("status"),
                    data.get("state"),
                    data.get("campaign_status"),
                ]
            )

        for candidate in candidates:
            normalized = str(candidate or "").strip().lower()
            if normalized:
                return normalized
        return None

    def _payload_signals_dispatch_failure(self, payload: Any) -> bool:
        if not isinstance(payload, dict):
            return False
        for key in ("error", "errors"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return True
            if isinstance(value, list) and any(str(item).strip() for item in value):
                return True
        message = str(payload.get("message") or "").strip().lower()
        if message and any(token in message for token in ("failed", "error", "smtp")):
            return True
        return False

    def _extract_listmonk_failure_reason(self, payload: Any) -> str:
        if not isinstance(payload, dict):
            return "Listmonk reported a dispatch failure."

        error_value = payload.get("error")
        if isinstance(error_value, str) and error_value.strip():
            return error_value.strip()

        errors_value = payload.get("errors")
        if isinstance(errors_value, list):
            normalized_errors = [str(item).strip() for item in errors_value if str(item).strip()]
            if normalized_errors:
                return "; ".join(normalized_errors)

        message = str(payload.get("message") or "").strip()
        if message:
            return message

        provider_status = self._extract_provider_status(payload)
        if provider_status:
            return f"Listmonk reported campaign status {provider_status}."
        return "Listmonk reported a dispatch failure."

    def _get_campaign_for_dispatch(
        self,
        *,
        campaign_id: str,
        current_user: AuthenticatedUser | None,
        client_repository: ClientRepository,
    ) -> ClientCampaignRecord | None:
        if current_user is not None and current_user.access_type == "client":
            if not current_user.client_id:
                return None
            for campaign in client_repository.list_client_campaigns(
                current_user.client_id
            ):
                if campaign.id == campaign_id:
                    return campaign
            return None

        for campaign in client_repository.list_admin_campaigns():
            if campaign.id == campaign_id:
                return ClientCampaignRecord(
                    id=campaign.id,
                    client_id=campaign.client_id,
                    name=campaign.name,
                    status=campaign.status,
                    subject=campaign.subject,
                    campaign_slot_id=campaign.campaign_slot_id,
                    preview_text=campaign.preview_text,
                    body_html=campaign.body_html,
                    body_text=campaign.body_text,
                    content_ready=campaign.content_ready,
                    contacts_ready=campaign.contacts_ready,
                    review_ready=campaign.review_ready,
                    current_step=campaign.current_step,
                    created_at=campaign.created_at,
                    updated_at=campaign.updated_at,
                )

        return None

    def _get_client_for_dispatch(
        self,
        *,
        campaign: ClientCampaignRecord | None,
        client_repository: ClientRepository,
    ) -> ClientRecord | None:
        if campaign is None:
            return None
        return client_repository.get_by_id(campaign.client_id)

    def _count_active_campaigns_for_client(
        self,
        *,
        client_id: str,
        client_repository: ClientRepository,
    ) -> int:
        return sum(
            1
            for campaign in client_repository.list_client_campaigns(client_id)
            if campaign.status.lower() in self.guard.SENDABLE_CAMPAIGN_STATUSES
        )

    def _build_dispatch_limit_usage(
        self,
        *,
        campaign: ClientCampaignRecord,
        client_id: str,
        campaign_limit_repository: CampaignSendingLimitRepository,
        email_log_repository: EmailLogRepository,
    ) -> CampaignLimitUsage:
        limits = campaign_limit_repository.ensure_for_campaign(
            campaign_id=campaign.id,
            period_email_limit=DEFAULT_CAMPAIGN_PERIOD_EMAIL_LIMIT,
            daily_email_limit=DEFAULT_CAMPAIGN_DAILY_EMAIL_LIMIT,
        )
        first_activity_at = email_log_repository.get_first_real_campaign_log_at(
            client_id=client_id,
            campaign_id=campaign.id,
        )
        if first_activity_at is not None and (
            limits.period_started_at is None
            or limits.period_started_at > first_activity_at
        ):
            limits = campaign_limit_repository.update_for_campaign(
                campaign_id=campaign.id,
                period_started_at=first_activity_at,
            )
        period_started_at = limits.period_started_at
        period_ends_at = (
            period_started_at + CAMPAIGN_PERIOD_WINDOW
            if period_started_at is not None
            else None
        )
        today_started_at = _get_business_day_start(
            datetime.now(timezone.utc),
            self.settings,
        )
        daily_used = email_log_repository.count_real_campaign_logs_since(
            client_id=client_id,
            campaign_id=campaign.id,
            started_at=today_started_at,
        )
        period_used = (
            email_log_repository.count_real_campaign_logs_since(
                client_id=client_id,
                campaign_id=campaign.id,
                started_at=period_started_at,
                ended_at=period_ends_at,
            )
            if period_started_at is not None
            else 0
        )
        return CampaignLimitUsage(
            daily_limit=limits.daily_email_limit,
            daily_used=daily_used,
            period_limit=limits.period_email_limit,
            period_used=period_used,
            period_started_at=period_started_at,
            period_ends_at=period_ends_at,
        )

    def _evaluate_domain_warmup_guard(
        self,
        *,
        provider: str,
        campaign: ClientCampaignRecord,
        guard_result: GuardResult,
        email_log_repository: EmailLogRepository,
    ) -> GuardResult | None:
        if provider != "listmonk":
            return None

        sending_domain = get_configured_sending_domain(self.settings)
        if sending_domain is None:
            return GuardResult(
                decision=SendDecision.BLOCKED,
                reason=(
                    "Configured sending domain is unavailable for the active Listmonk runtime."
                ),
                code="sending_domain_not_configured",
                severity="critical",
                client_id=campaign.client_id,
                campaign_id=campaign.id,
                eligible_contact_count=guard_result.eligible_contact_count,
                blocked_contact_count=guard_result.blocked_contact_count,
                blocked_reasons=dict(guard_result.blocked_reasons or {}),
                diagnostic=(
                    "Domain warmup guard failed closed because SMTP_FROM_EMAIL does not "
                    "contain a usable sending domain."
                ),
                limit_source="sending_domain_warmup",
            )

        today_started_at = _get_business_day_start(
            datetime.now(timezone.utc),
            self.settings,
        )
        today_accepted = email_log_repository.count_logs_by_status_since(
            statuses=DOMAIN_WARMUP_COUNTED_LOG_STATUSES,
            started_at=today_started_at,
            sending_domain=sending_domain,
        )
        projected_total = today_accepted + guard_result.eligible_contact_count
        if projected_total <= DEFAULT_DOMAIN_WARMUP_DAILY_LIMIT:
            return None

        return _build_domain_warmup_guard_result(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
            eligible_contact_count=guard_result.eligible_contact_count,
            daily_limit=DEFAULT_DOMAIN_WARMUP_DAILY_LIMIT,
            daily_used=today_accepted,
            sending_domain=sending_domain,
        )

    def _evaluate_provider_history_guard(
        self,
        *,
        provider: str,
        campaign: ClientCampaignRecord,
        guard_result: GuardResult,
        provider_event_repository: ProviderEventRepository | None,
        email_log_repository: EmailLogRepository,
    ) -> tuple[GuardResult | None, list[ProviderHistoryPolicySummary]]:
        return _evaluate_provider_history_policy(
            settings=self.settings,
            provider=provider,
            campaign=campaign,
            guard_result=guard_result,
            provider_event_repository=provider_event_repository,
            email_log_repository=email_log_repository,
        )

    def _reconcile_native_listmonk_unsubscribes(
        self,
        *,
        campaign: ClientCampaignRecord,
        contacts: list[ContactRecord],
        mapping_service: ListmonkMappingService,
        unsubscribe_service: UnsubscribeService,
    ) -> ListmonkNativeUnsubscribeReconciliation:
        if (
            not self.settings.email_sending_enabled
            or self._resolve_controlled_provider() != "listmonk"
        ):
            return ListmonkNativeUnsubscribeReconciliation()

        suppressed_count = 0
        for contact in contacts:
            subscriber_mapping = mapping_service.get_mapping(
                client_id=campaign.client_id,
                entity_type=ENTITY_TYPE_CONTACT,
                entity_id=contact.id,
                listmonk_type=LISTMONK_TYPE_SUBSCRIBER,
            )
            if subscriber_mapping is None:
                continue

            try:
                subscriber_payload = self.listmonk_client.get_subscriber(
                    subscriber_mapping.listmonk_id
                )
            except ListmonkError:
                return ListmonkNativeUnsubscribeReconciliation(
                    failed=True,
                    code="listmonk_unsubscribe_reconciliation_failed",
                    reason=(
                        "Listmonk subscription state could not be checked safely."
                    ),
                )

            memberships = self._extract_listmonk_subscriber_memberships(
                subscriber_payload
            )
            if memberships is None:
                return ListmonkNativeUnsubscribeReconciliation(
                    failed=True,
                    code="listmonk_unsubscribe_reconciliation_malformed",
                    reason=(
                        "Listmonk subscription state response could not be validated safely."
                    ),
                )

            actionable = self._resolve_validated_unsubscribed_membership(
                client_id=campaign.client_id,
                memberships=memberships,
                mapping_service=mapping_service,
            )
            if actionable is None:
                continue

            unsubscribe_service.record_native_listmonk_unsubscribe(
                client_id=campaign.client_id,
                contact_id=contact.id,
                campaign_id=actionable["campaign_id"],
                listmonk_subscriber_id=subscriber_mapping.listmonk_id,
                listmonk_list_id=actionable["list_id"],
            )
            suppressed_count += 1

        return ListmonkNativeUnsubscribeReconciliation(
            suppressed_count=suppressed_count
        )

    def _extract_listmonk_subscriber_memberships(
        self,
        payload: Any,
    ) -> list[dict[str, str]] | None:
        data = payload.get("data") if isinstance(payload, dict) else None
        subscriber = data if isinstance(data, dict) else payload
        if not isinstance(subscriber, dict):
            return None
        raw_lists = subscriber.get("lists")
        if raw_lists is None:
            raw_lists = subscriber.get("subscriptions")
        if not isinstance(raw_lists, list):
            return None

        memberships: list[dict[str, str]] = []
        for item in raw_lists:
            if not isinstance(item, dict):
                return None
            raw_id = item.get("id")
            if raw_id is None:
                raw_id = item.get("list_id")
            list_id = str(raw_id or "").strip()
            status_value = (
                item.get("subscription_status")
                or item.get("status")
                or item.get("subscriber_list_status")
            )
            status = str(status_value or "").strip().lower()
            if not list_id or not status:
                return None
            memberships.append({"list_id": list_id, "status": status})
        return memberships

    def _resolve_validated_unsubscribed_membership(
        self,
        *,
        client_id: str,
        memberships: list[dict[str, str]],
        mapping_service: ListmonkMappingService,
    ) -> dict[str, str] | None:
        for membership in memberships:
            if membership["status"] != "unsubscribed":
                continue
            campaign_mappings = [
                mapping
                for mapping in mapping_service.list_by_listmonk_id(
                    client_id=client_id,
                    listmonk_type=LISTMONK_TYPE_LIST,
                    listmonk_id=membership["list_id"],
                )
                if mapping.entity_type == ENTITY_TYPE_CAMPAIGN
            ]
            if len(campaign_mappings) != 1:
                continue
            return {
                "campaign_id": campaign_mappings[0].entity_id,
                "list_id": membership["list_id"],
            }
        return None

    def _native_unsubscribe_reconciliation_blocked_response(
        self,
        *,
        campaign: ClientCampaignRecord,
        reason: str,
        code: str,
        blocked_send_repository: BlockedSendRepository | None,
    ) -> dict[str, Any]:
        guard_result = GuardResult(
            decision=SendDecision.BLOCKED,
            reason=reason,
            code=code,
            severity="critical",
            client_id=campaign.client_id,
            campaign_id=campaign.id,
            diagnostic=(
                "Dispatch authorization failed closed before listmonk because "
                "native subscription state reconciliation was unavailable."
            ),
        )
        return self._blocked_response(
            campaign_id=campaign.id,
            guard_result=guard_result,
            blocked_send_repository=blocked_send_repository,
        )

    def _mark_campaign_running(
        self,
        *,
        campaign: ClientCampaignRecord,
        client_repository: ClientRepository,
        campaign_limit_repository: CampaignSendingLimitRepository,
        email_log_repository: EmailLogRepository,
    ) -> ClientCampaignRecord:
        if not hasattr(client_repository, "update_campaign_status"):
            if campaign.status.lower() != CampaignStatus.running.value:
                return campaign.model_copy(update={"status": CampaignStatus.running.value})
            return campaign

        next_campaign = campaign
        if campaign.status.lower() != CampaignStatus.running.value:
            updated = client_repository.update_campaign_status(  # type: ignore[attr-defined]
                client_id=campaign.client_id,
                campaign_id=campaign.id,
                status=CampaignStatus.running.value,
            )
            if updated is not None:
                next_campaign = updated
        limits = campaign_limit_repository.ensure_for_campaign(
            campaign_id=campaign.id,
            period_email_limit=DEFAULT_CAMPAIGN_PERIOD_EMAIL_LIMIT,
            daily_email_limit=DEFAULT_CAMPAIGN_DAILY_EMAIL_LIMIT,
        )
        if limits.period_started_at is None:
            first_activity_at = email_log_repository.get_first_real_campaign_log_at(
                client_id=campaign.client_id,
                campaign_id=campaign.id,
            )
            if first_activity_at is not None:
                campaign_limit_repository.update_for_campaign(
                    campaign_id=campaign.id,
                    period_started_at=first_activity_at,
                )
        return next_campaign

    def _resolve_controlled_provider(self) -> str | None:
        return _resolve_controlled_provider(self.settings)

    def _evaluate_real_send_safety(
        self,
        *,
        provider: str,
        campaign: ClientCampaignRecord,
        contacts: list[ContactRecord],
        guard_result: GuardResult,
        preparation: dict[str, Any] | None,
    ) -> dict[str, Any]:
        if provider == "listmonk":
            if preparation is not None and not self._listmonk_unsubscribe_headers_ready(
                preparation
            ):
                return self._safety_result(
                    provider=provider,
                    safety_passed=False,
                    code="listmonk_unsubscribe_headers_not_ready",
                    reason=(
                        "Prepared listmonk campaign content does not include a "
                        "recipient-specific HTTPS unsubscribe URL for one-click headers."
                    ),
                    eligible_contact_count=guard_result.eligible_contact_count,
                    max_real_send_recipients=self.settings.effective_real_send_max_recipients,
                    allowed_recipients_checked=False,
                    unsubscribe_ready=False,
                )
            return self._safety_result(
                provider=provider,
                safety_passed=True,
                code="listmonk_controlled_dispatch",
                reason=(
                    "Listmonk remains the dispatch boundary and uses the configured SMTP relay."
                ),
                eligible_contact_count=guard_result.eligible_contact_count,
                max_real_send_recipients=self.settings.effective_real_send_max_recipients,
                allowed_recipients_checked=False,
                unsubscribe_ready=True,
            )

        if provider != "ses":
            return self._safety_result(
                provider=provider,
                safety_passed=True,
                code="mailpit_controlled_dispatch",
                reason="Mailpit controlled dispatch does not require SES safety gates.",
                eligible_contact_count=guard_result.eligible_contact_count,
                max_real_send_recipients=self.settings.effective_real_send_max_recipients,
                allowed_recipients_checked=False,
                unsubscribe_ready=True,
            )

        checks = [
            self._check_real_send_environment(),
            self._check_ses_smtp_config(),
            self._check_frontend_public_url(),
            self._check_campaign_review_ready(campaign),
            self._check_real_send_recipient_limit(guard_result.eligible_contact_count),
            self._check_allowed_recipients(contacts),
        ]
        if preparation is not None:
            checks.append(self._check_unsubscribe_ready(preparation))

        for check in checks:
            if not check["passed"]:
                return self._safety_result(
                    provider=provider,
                    safety_passed=False,
                    code=str(check["code"]),
                    reason=str(check["reason"]),
                    eligible_contact_count=guard_result.eligible_contact_count,
                    max_real_send_recipients=self.settings.effective_real_send_max_recipients,
                    allowed_recipients_checked=bool(check.get("allowed_recipients_checked", True)),
                    unsubscribe_ready=bool(check.get("unsubscribe_ready", False)),
                )

        allowed_recipients_checked = any(
            bool(check.get("allowed_recipients_checked", False)) for check in checks
        )
        return self._safety_result(
            provider=provider,
            safety_passed=True,
            code="ses_safety_passed",
            reason="SES controlled-send safety gate passed.",
            eligible_contact_count=guard_result.eligible_contact_count,
            max_real_send_recipients=self.settings.effective_real_send_max_recipients,
            allowed_recipients_checked=allowed_recipients_checked,
            unsubscribe_ready=preparation is None or self._unsubscribe_ready(preparation),
        )

    def _check_real_send_environment(self) -> dict[str, Any]:
        environment = self.settings.environment.strip().lower()
        if environment not in self.settings.real_send_environments:
            return {
                "passed": False,
                "code": "real_send_environment_not_allowed",
                "reason": "SES controlled send is not allowed in this runtime environment.",
            }
        return {"passed": True}

    def _check_ses_smtp_config(self) -> dict[str, Any]:
        missing = []
        if not self.settings.smtp_host.strip():
            missing.append("SMTP_HOST")
        if self.settings.smtp_port <= 0:
            missing.append("SMTP_PORT")
        if not self.settings.smtp_username.strip():
            missing.append("SMTP_USERNAME")
        if not self.settings.smtp_password.strip():
            missing.append("SMTP_PASSWORD")
        if not self.settings.smtp_from_email.strip():
            missing.append("SMTP_FROM_EMAIL")
        if not self.settings.smtp_tls:
            missing.append("SMTP_TLS=true")
        if missing:
            return {
                "passed": False,
                "code": "ses_smtp_config_incomplete",
                "reason": f"SES SMTP config is incomplete: {', '.join(missing)}.",
            }
        return {"passed": True}

    def _check_frontend_public_url(self) -> dict[str, Any]:
        parsed = urlsplit(self.settings.frontend_url.strip())
        blocked_hosts = {"localhost", "127.0.0.1", "0.0.0.0", "backend"}
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.netloc
            or (parsed.hostname or "").lower() in blocked_hosts
        ):
            return {
                "passed": False,
                "code": "unsubscribe_public_url_not_ready",
                "reason": "FRONTEND_URL must be a reachable public URL for public unsubscribe pages.",
                "unsubscribe_ready": False,
            }
        return {"passed": True, "unsubscribe_ready": True}

    def _check_campaign_review_ready(
        self,
        campaign: ClientCampaignRecord,
    ) -> dict[str, Any]:
        if not campaign.content_ready or not campaign.contacts_ready or not campaign.review_ready:
            return {
                "passed": False,
                "code": "campaign_review_not_ready",
                "reason": "SES controlled send requires content_ready, contacts_ready, and review_ready.",
            }
        return {"passed": True}

    def _check_real_send_recipient_limit(self, eligible_contact_count: int) -> dict[str, Any]:
        max_recipients = self.settings.effective_real_send_max_recipients
        if max_recipients is not None and eligible_contact_count > max_recipients:
            return {
                "passed": False,
                "code": "real_send_max_recipients_exceeded",
                "reason": "Eligible contact count exceeds REAL_SEND_MAX_RECIPIENTS.",
            }
        return {"passed": True}

    def _check_allowed_recipients(self, contacts: list[ContactRecord]) -> dict[str, Any]:
        if not self.settings.real_send_require_allowed_recipients:
            return {"passed": True, "allowed_recipients_checked": False}

        allowed_recipients = self.settings.real_send_allowed_recipients
        if not allowed_recipients:
            return {
                "passed": False,
                "code": "real_send_allowed_recipients_missing",
                "reason": "REAL_SEND_ALLOWED_RECIPIENTS is required for SES controlled send.",
                "allowed_recipients_checked": True,
            }
        unauthorized = [
            contact.email
            for contact in contacts
            if contact.email.strip().lower() not in allowed_recipients
        ]
        if unauthorized:
            return {
                "passed": False,
                "code": "real_send_recipient_not_allowed",
                "reason": "SES controlled send includes recipients outside REAL_SEND_ALLOWED_RECIPIENTS.",
                "allowed_recipients_checked": True,
            }
        return {"passed": True, "allowed_recipients_checked": True}

    def _check_unsubscribe_ready(self, preparation: dict[str, Any]) -> dict[str, Any]:
        if not self._unsubscribe_ready(preparation):
            return {
                "passed": False,
                "code": "unsubscribe_not_ready",
                "reason": "Prepared SES campaign content does not include a real unsubscribe URL.",
                "unsubscribe_ready": False,
            }
        return {"passed": True, "unsubscribe_ready": True}

    def _unsubscribe_ready(self, preparation: dict[str, Any]) -> bool:
        content = preparation.get("content")
        if not isinstance(content, dict):
            return False
        unsubscribe_url = str(content.get("unsubscribe_url") or "").strip()
        body = str(content.get("body") or "")
        parsed = urlsplit(unsubscribe_url)
        return (
            parsed.scheme in {"http", "https"}
            and bool(parsed.netloc)
            and "/unsubscribe/" in parsed.path
            and unsubscribe_url in body
        )

    def _listmonk_unsubscribe_headers_ready(self, preparation: dict[str, Any]) -> bool:
        content = preparation.get("content")
        if not isinstance(content, dict):
            return False
        unsubscribe_url = str(content.get("unsubscribe_url") or "").strip()
        body = str(content.get("body") or "")
        parsed = urlsplit(unsubscribe_url)
        return (
            parsed.scheme == "https"
            and bool(parsed.netloc)
            and "/unsubscribe/" in parsed.path
            and LISTMONK_UNSUBSCRIBE_TOKEN_PLACEHOLDER in unsubscribe_url
            and unsubscribe_url in body
        )

    def _safety_result(
        self,
        *,
        provider: str,
        safety_passed: bool,
        code: str,
        reason: str,
        eligible_contact_count: int,
        max_real_send_recipients: int | None,
        allowed_recipients_checked: bool,
        unsubscribe_ready: bool,
    ) -> dict[str, Any]:
        return {
            "provider": provider,
            "safety_checked": True,
            "safety_passed": safety_passed,
            "code": code,
            "reason": reason,
            "eligible_contact_count": eligible_contact_count,
            "max_real_send_recipients": max_real_send_recipients,
            "allowed_recipients_checked": allowed_recipients_checked,
            "unsubscribe_ready": unsubscribe_ready,
            "provider_events_ready": True,
        }

    def _safety_failed_response(
        self,
        *,
        campaign_id: str,
        client_id: str,
        guard_result: GuardResult,
        safety_result: dict[str, Any],
        preparation: dict[str, Any] | None = None,
        content_ready: bool = False,
    ) -> dict[str, Any]:
        response = self._diagnostic_response(
            campaign_id=campaign_id,
            decision=guard_result,
            reason=str(safety_result["reason"]),
            client_id=client_id,
            code=str(safety_result["code"]),
            severity="critical",
            content_ready=content_ready,
            preparation=preparation,
        )
        response.update(
            {
                "provider": safety_result["provider"],
                "safety_checked": True,
                "safety_passed": False,
                "allowed_recipients_checked": safety_result[
                    "allowed_recipients_checked"
                ],
                "max_real_send_recipients": safety_result["max_real_send_recipients"],
                "unsubscribe_ready": safety_result["unsubscribe_ready"],
                "provider_events_ready": safety_result["provider_events_ready"],
            }
        )
        return response

    def _blocked_response(
        self,
        *,
        campaign_id: str,
        guard_result: Any,
        blocked_send_repository: BlockedSendRepository | None,
        sending_domain: str | None = None,
    ) -> dict[str, Any]:
        blocked_send_id: str | None = None
        if (
            guard_result.client_id is not None
            and guard_result.campaign_id is not None
            and blocked_send_repository is not None
        ):
            blocked_send_domain = (
                sending_domain
                if guard_result.limit_source in {"sending_domain_warmup", "provider_history"}
                else None
            )
            blocked_send = blocked_send_repository.create_blocked_send(
                client_id=guard_result.client_id,
                campaign_id=guard_result.campaign_id,
                reason=f"{guard_result.code}: {guard_result.reason}",
                decision=guard_result.decision,
                sending_domain=blocked_send_domain,
            )
            blocked_send_id = blocked_send.id

        response: dict[str, Any] = {
            "status": "blocked",
            "mode": "controlled_dev",
            "provider": self._resolve_controlled_provider(),
            "provider_status": "not_attempted",
            "campaign_id": campaign_id,
            "allowed": False,
            "decision": guard_result.decision,
            "reason": guard_result.reason,
            "code": guard_result.code,
            "severity": guard_result.severity,
            "safety_checked": True,
            "safety_passed": False,
            "allowed_recipients_checked": False,
            "eligible_contact_count": guard_result.eligible_contact_count,
            "max_real_send_recipients": self.settings.effective_real_send_max_recipients,
            "blocked_contact_count": guard_result.blocked_contact_count,
            "blocked_reasons": dict(guard_result.blocked_reasons or {}),
            "diagnostic": guard_result.diagnostic,
            "limit_source": guard_result.limit_source,
            "limit_value": guard_result.limit_value,
            "daily_limit": guard_result.daily_limit,
            "daily_used": guard_result.daily_used,
            "daily_remaining": guard_result.daily_remaining,
            "period_limit": guard_result.period_limit,
            "period_used": guard_result.period_used,
            "period_remaining": guard_result.period_remaining,
            "period_started_at": guard_result.period_started_at,
            "period_ends_at": guard_result.period_ends_at,
            "guard": guard_result.to_dict(),
            "dispatch_attempted": False,
            "real_send_attempted": False,
            "listmonk_prepared": False,
            "listmonk_dispatched": False,
            "content_ready": False,
            "unsubscribe_ready": False,
            "provider_events_ready": True,
            "email_logs_created": 0,
            "email_logs_updated": 0,
            "queued_count": 0,
            "sent_or_accepted_count": 0,
            "failed_count": 0,
        }
        if guard_result.client_id is not None:
            response["client_id"] = guard_result.client_id
        if blocked_send_id is not None:
            response["blocked_send_id"] = blocked_send_id
        return response

    def _build_listmonk_campaign_payload(
        self,
        *,
        campaign: ClientCampaignRecord,
        preparation: dict[str, Any],
        mapping_service: ListmonkMappingService,
    ) -> dict[str, Any] | None:
        if not campaign.name.strip() or not (campaign.subject or "").strip():
            return None
        content = preparation.get("content")
        if not isinstance(content, dict):
            return None

        list_mapping = mapping_service.get_mapping(
            client_id=campaign.client_id,
            entity_type=ENTITY_TYPE_CAMPAIGN,
            entity_id=campaign.id,
            listmonk_type=LISTMONK_TYPE_LIST,
        )
        if list_mapping is None:
            return None

        try:
            list_id = int(str(list_mapping.listmonk_id).strip())
        except ValueError:
            return None

        payload, _content_ready = build_listmonk_campaign_payload(
            settings=self.settings,
            campaign=campaign,
            list_id=list_id,
            content=content,
        )
        return payload

    def _diagnostic_response(
        self,
        *,
        campaign_id: str,
        decision: Any,
        reason: str,
        client_id: str | None = None,
        code: str = "dispatch_blocked",
        severity: str = "error",
        content_ready: bool = False,
        preparation: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if hasattr(decision, "to_dict"):
            guard_payload = decision.to_dict()
            decision_value = decision.decision
            default_client_id = decision.client_id
            eligible_contact_count = decision.eligible_contact_count
            blocked_contact_count = decision.blocked_contact_count
        else:
            guard_payload = {
                "allowed": False,
                "decision": str(decision),
                "reason": reason,
                "code": code,
                "severity": severity,
                "client_id": client_id,
                "campaign_id": campaign_id,
                "eligible_contact_count": 0,
                "blocked_contact_count": 0,
                "blocked_reasons": {},
                "diagnostic": reason,
                "limit_source": None,
                "limit_value": None,
                "daily_limit": None,
                "daily_used": 0,
                "daily_remaining": None,
                "period_limit": None,
                "period_used": 0,
                "period_remaining": None,
                "period_started_at": None,
                "period_ends_at": None,
            }
            decision_value = decision
            default_client_id = client_id
            eligible_contact_count = 0
            blocked_contact_count = 0

        response: dict[str, Any] = {
            "status": "dispatch_blocked",
            "mode": "controlled_dev",
            "provider": self._resolve_controlled_provider(),
            "provider_status": "not_attempted",
            "campaign_id": campaign_id,
            "client_id": client_id or default_client_id,
            "allowed": False,
            "decision": decision_value,
            "reason": reason,
            "code": code,
            "severity": severity,
            "eligible_contact_count": eligible_contact_count,
            "blocked_contact_count": blocked_contact_count,
            "limit_source": guard_payload.get("limit_source"),
            "limit_value": guard_payload.get("limit_value"),
            "daily_limit": guard_payload.get("daily_limit"),
            "daily_used": guard_payload.get("daily_used", 0),
            "daily_remaining": guard_payload.get("daily_remaining"),
            "period_limit": guard_payload.get("period_limit"),
            "period_used": guard_payload.get("period_used", 0),
            "period_remaining": guard_payload.get("period_remaining"),
            "period_started_at": guard_payload.get("period_started_at"),
            "period_ends_at": guard_payload.get("period_ends_at"),
            "guard": guard_payload,
            "dispatch_attempted": False,
            "real_send_attempted": False,
            "listmonk_prepared": bool(preparation),
            "listmonk_dispatched": False,
            "content_ready": content_ready,
            "email_logs_created": 0,
            "email_logs_updated": 0,
            "queued_count": 0,
            "sent_or_accepted_count": 0,
            "failed_count": 0,
        }
        if preparation is not None:
            response["preparation"] = self._sanitize_preparation_snapshot(preparation)
        return response

    def _failed_response(
        self,
        *,
        campaign_id: str,
        client_id: str,
        guard_result: Any,
        reason: str,
        provider: str,
        stage: str,
        dispatch_attempted: bool,
        preparation: dict[str, Any] | None = None,
        content_ready: bool = False,
        provider_status: str = "dispatch_failed",
        queued_count: int = 0,
        sent_or_accepted_count: int = 0,
        failed_count: int = 0,
        email_logs_created: int = 0,
        email_logs_updated: int = 0,
        limit_usage: CampaignLimitUsage | None = None,
    ) -> dict[str, Any]:
        response: dict[str, Any] = {
            "status": "dispatch_failed",
            "mode": "controlled_dev",
            "provider": provider,
            "provider_status": provider_status,
            "campaign_id": campaign_id,
            "client_id": client_id,
            "allowed": False,
            "decision": guard_result.decision,
            "reason": reason,
            "code": f"listmonk_{stage}_failed",
            "severity": "error",
            "eligible_contact_count": guard_result.eligible_contact_count,
            "blocked_contact_count": guard_result.blocked_contact_count,
            "blocked_reasons": dict(guard_result.blocked_reasons or {}),
            "diagnostic": guard_result.diagnostic,
            "limit_source": guard_result.limit_source,
            "limit_value": guard_result.limit_value,
            "daily_limit": (
                limit_usage.daily_limit if limit_usage is not None else guard_result.daily_limit
            ),
            "daily_used": (
                limit_usage.daily_used if limit_usage is not None else guard_result.daily_used
            ),
            "daily_remaining": (
                limit_usage.daily_remaining
                if limit_usage is not None
                else guard_result.daily_remaining
            ),
            "period_limit": (
                limit_usage.period_limit if limit_usage is not None else guard_result.period_limit
            ),
            "period_used": (
                limit_usage.period_used if limit_usage is not None else guard_result.period_used
            ),
            "period_remaining": (
                limit_usage.period_remaining
                if limit_usage is not None
                else guard_result.period_remaining
            ),
            "period_started_at": (
                limit_usage.period_started_at
                if limit_usage is not None
                else guard_result.period_started_at
            ),
            "period_ends_at": (
                limit_usage.period_ends_at
                if limit_usage is not None
                else guard_result.period_ends_at
            ),
            "guard": guard_result.to_dict(),
            "dispatch_attempted": dispatch_attempted,
            "real_send_attempted": dispatch_attempted,
            "listmonk_prepared": stage != "preparation",
            "listmonk_dispatched": False,
            "content_ready": content_ready,
            "email_logs_created": email_logs_created,
            "email_logs_updated": email_logs_updated,
            "queued_count": queued_count,
            "sent_or_accepted_count": sent_or_accepted_count,
            "failed_count": failed_count,
        }
        if preparation is not None:
            response["preparation"] = self._sanitize_preparation_snapshot(preparation)
        return response

    def _failed_response_from_listmonk_error(
        self,
        *,
        campaign_id: str,
        client_id: str,
        guard_result: Any,
        error: ListmonkError,
        provider: str,
        stage: str,
        dispatch_attempted: bool,
        preparation: dict[str, Any] | None = None,
        content_ready: bool = False,
        queued_count: int = 0,
        sent_or_accepted_count: int = 0,
        failed_count: int = 0,
        email_logs_created: int = 0,
        email_logs_updated: int = 0,
        limit_usage: CampaignLimitUsage | None = None,
    ) -> dict[str, Any]:
        response = self._failed_response(
            campaign_id=campaign_id,
            client_id=client_id,
            guard_result=guard_result,
            reason=str(error),
            provider=provider,
            stage=stage,
            dispatch_attempted=dispatch_attempted,
            preparation=preparation,
            content_ready=content_ready,
            provider_status="forbidden" if error.status_code == 403 else "dispatch_failed",
            queued_count=queued_count,
            sent_or_accepted_count=sent_or_accepted_count,
            failed_count=failed_count,
            email_logs_created=email_logs_created,
            email_logs_updated=email_logs_updated,
            limit_usage=limit_usage,
        )
        if error.status_code == 403:
            response["code"] = f"listmonk_{stage}_forbidden"
            response["provider_status"] = "forbidden"
        if error.method:
            response["provider_method"] = error.method
        if error.path:
            response["provider_endpoint"] = error.path
        return response

    def _sanitize_preparation_snapshot(
        self,
        preparation: dict[str, Any],
    ) -> dict[str, Any]:
        sanitized = dict(preparation)
        content = sanitized.get("content")
        if isinstance(content, dict):
            sanitized_content = {
                key: value
                for key, value in content.items()
                if key not in PREPARATION_CONTENT_REDACTED_KEYS
            }
            sanitized_content["content_redacted"] = True
            sanitized["content"] = sanitized_content
        return sanitized


def get_campaign_state_service() -> CampaignStateService:
    return CampaignStateService(repository=get_campaign_repository())


def get_admin_campaign_service() -> AdminCampaignService:
    settings = get_settings()
    return AdminCampaignService(
        settings=settings,
        guard=DeliverabilityGuard(),
        repository=get_campaign_repository(),
        campaign_limit_repository=get_campaign_sending_limit_repository(),
        client_repository=PostgresClientRepository(settings),
        campaign_slot_service=get_campaign_slot_service(),
        campaign_slot_repository=get_campaign_slot_repository(),
        template_repository=get_email_template_repository(),
        contact_repository=PostgresContactRepository(settings),
        suppression_list_repository=get_suppression_list_repository(),
        blocked_send_repository=get_blocked_send_repository(),
        email_log_repository=get_email_log_repository(),
        provider_event_repository=get_provider_event_repository(),
    )


def get_campaign_dispatch_service() -> CampaignDispatchService:
    settings = get_settings()
    mapping_repository = get_listmonk_mapping_repository()
    from app.services.campaign_preparation import get_campaign_preparation_service

    return CampaignDispatchService(
        settings=settings,
        guard=DeliverabilityGuard(),
        listmonk_client=build_listmonk_client(settings),
        mapping_service=ListmonkMappingService(mapping_repository),
        client_repository=PostgresClientRepository(settings),
        campaign_slot_repository=get_campaign_slot_repository(),
        campaign_limit_repository=get_campaign_sending_limit_repository(),
        contact_repository=PostgresContactRepository(settings),
        suppression_list_repository=get_suppression_list_repository(),
        blocked_send_repository=get_blocked_send_repository(),
        email_log_repository=get_email_log_repository(),
        provider_event_repository=get_provider_event_repository(),
        campaign_preparation_service=get_campaign_preparation_service(),
        unsubscribe_service=get_unsubscribe_service(),
    )
