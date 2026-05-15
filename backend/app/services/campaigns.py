from dataclasses import dataclass
from typing import Any
import re
from urllib.parse import urlsplit

from fastapi import HTTPException, status

from app.core.auth import AuthenticatedUser
from app.core.config import Settings, get_settings
from app.guard.deliverability_guard import DeliverabilityGuard, GuardResult, SendDecision
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
    get_campaign_repository,
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
    AdminCampaignContactsResponse,
    AdminCampaignDetail,
    AdminCampaignContactPayload,
    AdminCampaignReviewResponse,
    AdminCampaignSummaryResponse,
    AdminCampaignSlotAssignmentResponse,
    CampaignBlockedSendsSummary,
    CampaignClientSummary,
    CampaignLogsSummary,
    CampaignRecipientsSummary,
    CampaignSlotSummary,
    CampaignSummaryItem,
)
from app.schemas.common import CampaignStatus
from app.services.provider_runtime import build_provider_runtime_summary
from app.services.campaign_slots import (
    CampaignSlotConflictError,
    CampaignSlotService,
    get_campaign_slot_service,
)
from app.services.listmonk_mappings import (
    ENTITY_TYPE_CAMPAIGN,
    LISTMONK_TYPE_CAMPAIGN,
    ListmonkMappingConflictError,
    ListmonkMappingService,
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
RECIPIENT_TEMPLATE_PLACEHOLDERS = {"nome", "cognome"}
TEMPLATE_PLACEHOLDER_PATTERN = re.compile(r"{{\s*([A-Za-z0-9_]+)\s*}}")


def _prefer_provider_metric(
    *,
    status_counts: dict[str, int],
    event_counts: dict[str, int],
    status_keys: tuple[str, ...],
    event_types: tuple[str, ...],
) -> int:
    provider_total = sum(event_counts.get(event_type, 0) for event_type in event_types)
    if provider_total > 0:
        return provider_total
    return sum(status_counts.get(status_key, 0) for status_key in status_keys)


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


@dataclass(frozen=True)
class AdminCampaignService:
    settings: Settings
    guard: DeliverabilityGuard
    repository: CampaignRepository
    client_repository: ClientRepository
    campaign_slot_service: CampaignSlotService
    campaign_slot_repository: CampaignSlotRepository
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
        return self._build_detail(campaign=campaign, client=client)

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
        evaluation = self._evaluate_campaign(
            campaign=campaign,
            client=client,
            contacts=contacts,
            suppressed_emails=suppressed_emails,
            slot=slot,
            contact_summary=contact_summary,
        )
        logs = self._build_campaign_logs_summary(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
        )
        return AdminCampaignSummaryResponse(
            campaign=self._build_campaign_summary_item(
                campaign=campaign,
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
            runtime=build_provider_runtime_summary(
                self.settings,
                provider_events_available=logs.provider_events_available,
            ),
            blocked_sends=self._build_campaign_blocked_sends_summary(
                campaign=campaign,
            ),
            can_send=evaluation.can_send,
            blocking_errors=evaluation.blocking_errors,
            warnings=evaluation.warnings,
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
        return self._build_detail(campaign=campaign, client=client)

    def update_campaign(
        self,
        *,
        campaign_id: str,
        name: str | None = None,
        subject: str | None = None,
        status_value: str | None = None,
        current_step: str | None = None,
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
        self._validate_template_placeholders(next_subject, allowed_placeholders=set())
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
        return self._build_detail(campaign=updated, client=client)

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
        self._validate_template_placeholders(next_subject, allowed_placeholders=set())
        self._validate_template_placeholders(
            next_preview_text,
            allowed_placeholders=RECIPIENT_TEMPLATE_PLACEHOLDERS,
        )
        self._validate_template_placeholders(
            next_body_html,
            allowed_placeholders=RECIPIENT_TEMPLATE_PLACEHOLDERS,
        )
        self._validate_template_placeholders(
            next_body_text,
            allowed_placeholders=RECIPIENT_TEMPLATE_PLACEHOLDERS,
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
        return self._build_detail(campaign=updated, client=client)

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
        summary = self.get_campaign_summary(campaign_id)
        updated = self.repository.update_campaign(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
            content_ready=summary.campaign.content_ready,
            contacts_ready=summary.campaign.contacts_ready,
            review_ready=summary.campaign.review_ready,
            current_step="review",
        )

        return AdminCampaignReviewResponse(
            campaign_id=updated.id,
            client_id=updated.client_id,
            allowed_to_send=summary.can_send,
            can_send_when_enabled=summary.campaign.review_ready,
            sending_enabled=self.settings.email_sending_enabled,
            warnings=summary.warnings,
            blocking_errors=summary.blocking_errors,
            eligible_contact_count=summary.recipients.eligible,
            blocked_contact_count=summary.recipients.blocked,
            slot_limit=summary.slot.max_emails,
            limit_source=summary.slot.limit_source,
            content_ready=updated.content_ready,
            contacts_ready=updated.contacts_ready,
            review_ready=updated.review_ready,
            current_step=updated.current_step,
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

    def _build_detail(
        self,
        *,
        campaign: CampaignRecord,
        client: ClientRecord,
    ) -> AdminCampaignDetail:
        client_name = client.personal_name or client.email
        return AdminCampaignDetail(
            campaign_id=campaign.id,
            client_id=campaign.client_id,
            client_name=client_name,
            client_status=client.status,
            name=campaign.name,
            status=campaign.status,
            subject=campaign.subject,
            preview_text=campaign.preview_text,
            body_html=campaign.body_html,
            body_text=campaign.body_text,
            current_step=campaign.current_step,
            campaign_slot_id=campaign.campaign_slot_id,
            content_ready=campaign.content_ready,
            contacts_ready=campaign.contacts_ready,
            review_ready=campaign.review_ready,
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
    ) -> CampaignEvaluation:
        content_ready = self._content_ready(
            subject=campaign.subject,
            body_html=campaign.body_html,
        )
        contacts_ready = contact_summary.contacts_ready
        active_campaign_count = self._count_active_campaigns(client.id)
        guard_result = self.guard.authorize_campaign_dispatch(
            email_sending_enabled=True,
            client=client,
            campaign=self._to_client_campaign_record(campaign),
            slot=slot,
            contacts=contacts,
            suppressed_emails=suppressed_emails,
            active_campaign_count=active_campaign_count,
        )

        blocking_errors: list[str] = []
        if not content_ready:
            blocking_errors.append("Campaign content is not ready.")
        if not contacts_ready:
            blocking_errors.append("Campaign has no associated contacts.")
        if not guard_result.allowed and guard_result.reason not in blocking_errors:
            blocking_errors.append(guard_result.reason)

        warnings: list[str] = []
        if not self.settings.email_sending_enabled:
            warnings.append(
                'EMAIL_SENDING_ENABLED is not exactly "true"; real dispatch is disabled.'
            )

        can_send_when_enabled = content_ready and contacts_ready and guard_result.allowed
        return CampaignEvaluation(
            content_ready=content_ready,
            contacts_ready=contacts_ready,
            review_ready=can_send_when_enabled,
            can_send_when_enabled=can_send_when_enabled,
            can_send=can_send_when_enabled and self.settings.email_sending_enabled,
            warnings=warnings,
            blocking_errors=blocking_errors,
            guard_result=guard_result,
        )

    def _build_campaign_summary_item(
        self,
        *,
        campaign: CampaignRecord,
        evaluation: CampaignEvaluation,
    ) -> CampaignSummaryItem:
        return CampaignSummaryItem(
            id=campaign.id,
            client_id=campaign.client_id,
            name=campaign.name,
            status=campaign.status,
            subject=campaign.subject,
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
            max_emails=evaluation.guard_result.limit_value,
            status="legacy" if client.email_limit_per_campaign is not None else None,
            limit_source=evaluation.guard_result.limit_source,
        )

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
        return CampaignLogsSummary(
            simulated=status_counts.get("simulated", 0),
            queued=status_counts.get("queued", 0),
            sent=_prefer_provider_metric(
                status_counts=status_counts,
                event_counts=event_counts,
                status_keys=("sent", "dispatched", "delivered"),
                event_types=("ses_send", "ses_delivery"),
            ),
            opened=_prefer_provider_metric(
                status_counts=status_counts,
                event_counts=event_counts,
                status_keys=("opened",),
                event_types=("ses_open",),
            ),
            clicked=_prefer_provider_metric(
                status_counts=status_counts,
                event_counts=event_counts,
                status_keys=("clicked",),
                event_types=("ses_click",),
            ),
            bounced=_prefer_provider_metric(
                status_counts=status_counts,
                event_counts=event_counts,
                status_keys=("bounced",),
                event_types=("ses_bounce",),
            ),
            complained=_prefer_provider_metric(
                status_counts=status_counts,
                event_counts=event_counts,
                status_keys=("complained", "spam"),
                event_types=("ses_complaint",),
            ),
            unsubscribed=_prefer_provider_metric(
                status_counts=status_counts,
                event_counts=event_counts,
                status_keys=("unsubscribed",),
                event_types=("sendwise_unsubscribe",),
            ),
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


@dataclass(frozen=True)
class CampaignDispatchService:
    settings: Settings
    guard: DeliverabilityGuard
    listmonk_client: ListmonkClient
    mapping_service: ListmonkMappingService | None = None
    client_repository: ClientRepository | None = None
    campaign_slot_repository: CampaignSlotRepository | None = None
    contact_repository: ContactRepository | None = None
    suppression_list_repository: SuppressionListRepository | None = None
    blocked_send_repository: BlockedSendRepository | None = None
    email_log_repository: EmailLogRepository | None = None
    campaign_preparation_service: Any | None = None

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

        if (
            mapping_service is None
            or client_repository is None
            or contact_repository is None
            or suppression_repository is None
            or email_log_repository is None
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
        if client is not None and campaign is not None:
            contacts = contact_repository.list_campaign_contacts(
                client_id=client.id,
                campaign_id=campaign.id,
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

        guard_result = self.guard.authorize_campaign_dispatch(
            email_sending_enabled=self.settings.email_sending_enabled,
            client=client,
            campaign=campaign,
            slot=slot,
            contacts=contacts,
            suppressed_emails=suppressed_emails,
            active_campaign_count=active_campaign_count,
        )
        if guard_result.decision != SendDecision.AUTHORIZED:
            return self._blocked_response(
                campaign_id=campaign_id,
                guard_result=guard_result,
                blocked_send_repository=blocked_send_repository,
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
            return self._failed_response(
                campaign_id=campaign_id,
                client_id=campaign.client_id,
                guard_result=guard_result,
                reason=str(error),
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
            create_payload = self._build_listmonk_campaign_payload(campaign)
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
                return self._failed_response(
                    campaign_id=campaign_id,
                    client_id=campaign.client_id,
                    guard_result=guard_result,
                    reason=str(error),
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
            return self._failed_response(
                campaign_id=campaign_id,
                client_id=campaign.client_id,
                guard_result=guard_result,
                reason=str(error),
                provider=runtime_provider,
                stage="dispatch",
                dispatch_attempted=True,
                preparation=preparation,
                content_ready=True,
            )

        logs = email_log_repository.create_dispatched_campaign_logs(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
            contact_ids=[contact.id for contact in contacts],
            body=str(content.get("body") or ""),
        )
        response = {
            "status": "queued",
            "mode": "controlled_dev",
            "provider": runtime_provider,
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
            "guard": guard_result.to_dict(),
            "dispatch_attempted": True,
            "real_send_attempted": True,
            "listmonk_prepared": True,
            "listmonk_dispatched": True,
            "content_ready": True,
            "unsubscribe_ready": safety_result["unsubscribe_ready"],
            "provider_events_ready": True,
            "email_logs_created": len(logs),
            "email_logs_updated": 0,
            "listmonk_mapping": {
                "entity_type": mapping.entity_type,
                "entity_id": mapping.entity_id,
                "listmonk_type": mapping.listmonk_type,
                "listmonk_id": mapping.listmonk_id,
                "created": mapping_created,
            },
            "listmonk": listmonk_result,
        }
        response["preparation"] = preparation
        return response

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

    def _resolve_controlled_provider(self) -> str | None:
        environment = self.settings.environment.strip().lower()
        email_provider = self.settings.email_provider_normalized
        allowed_environments = {"development", "staging", "test"}
        allowed_providers = {"mailpit", "smtp_dev", "ses"}

        if environment not in allowed_environments:
            return None
        if email_provider not in allowed_providers:
            return None

        if email_provider == "ses":
            return "ses"
        return "mailpit"

    def _evaluate_real_send_safety(
        self,
        *,
        provider: str,
        campaign: ClientCampaignRecord,
        contacts: list[ContactRecord],
        guard_result: GuardResult,
        preparation: dict[str, Any] | None,
    ) -> dict[str, Any]:
        if provider != "ses":
            return self._safety_result(
                provider=provider,
                safety_passed=True,
                code="mailpit_controlled_dispatch",
                reason="Mailpit controlled dispatch does not require SES safety gates.",
                eligible_contact_count=guard_result.eligible_contact_count,
                max_real_send_recipients=self.settings.real_send_max_recipients,
                allowed_recipients_checked=False,
                unsubscribe_ready=True,
            )

        checks = [
            self._check_real_send_environment(),
            self._check_ses_smtp_config(),
            self._check_backend_public_url(),
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
                    max_real_send_recipients=self.settings.real_send_max_recipients,
                    allowed_recipients_checked=bool(check.get("allowed_recipients_checked", True)),
                    unsubscribe_ready=bool(check.get("unsubscribe_ready", False)),
                )

        return self._safety_result(
            provider=provider,
            safety_passed=True,
            code="ses_safety_passed",
            reason="SES controlled-send safety gate passed.",
            eligible_contact_count=guard_result.eligible_contact_count,
            max_real_send_recipients=self.settings.real_send_max_recipients,
            allowed_recipients_checked=True,
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

    def _check_backend_public_url(self) -> dict[str, Any]:
        parsed = urlsplit(self.settings.backend_public_url.strip())
        blocked_hosts = {"localhost", "127.0.0.1", "0.0.0.0", "backend"}
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.netloc
            or (parsed.hostname or "").lower() in blocked_hosts
        ):
            return {
                "passed": False,
                "code": "unsubscribe_public_url_not_ready",
                "reason": "BACKEND_PUBLIC_URL must be a reachable public URL for SES unsubscribe links.",
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
        if eligible_contact_count > self.settings.real_send_max_recipients:
            return {
                "passed": False,
                "code": "real_send_max_recipients_exceeded",
                "reason": "Eligible contact count exceeds REAL_SEND_MAX_RECIPIENTS.",
            }
        return {"passed": True}

    def _check_allowed_recipients(self, contacts: list[ContactRecord]) -> dict[str, Any]:
        allowed_recipients = self.settings.real_send_allowed_recipients
        if self.settings.real_send_require_allowed_recipients and not allowed_recipients:
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

    def _safety_result(
        self,
        *,
        provider: str,
        safety_passed: bool,
        code: str,
        reason: str,
        eligible_contact_count: int,
        max_real_send_recipients: int,
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
    ) -> dict[str, Any]:
        blocked_send_id: str | None = None
        if (
            guard_result.client_id is not None
            and guard_result.campaign_id is not None
            and blocked_send_repository is not None
        ):
            blocked_send = blocked_send_repository.create_blocked_send(
                client_id=guard_result.client_id,
                campaign_id=guard_result.campaign_id,
                reason=f"{guard_result.code}: {guard_result.reason}",
                decision=guard_result.decision,
            )
            blocked_send_id = blocked_send.id

        response: dict[str, Any] = {
            "status": "blocked",
            "mode": "controlled_dev",
            "provider": self._resolve_controlled_provider(),
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
            "max_real_send_recipients": self.settings.real_send_max_recipients,
            "blocked_contact_count": guard_result.blocked_contact_count,
            "blocked_reasons": dict(guard_result.blocked_reasons or {}),
            "diagnostic": guard_result.diagnostic,
            "limit_source": guard_result.limit_source,
            "limit_value": guard_result.limit_value,
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
        }
        if guard_result.client_id is not None:
            response["client_id"] = guard_result.client_id
        if blocked_send_id is not None:
            response["blocked_send_id"] = blocked_send_id
        return response

    def _build_listmonk_campaign_payload(
        self,
        campaign: ClientCampaignRecord,
    ) -> dict[str, Any] | None:
        if not campaign.name.strip() or not (campaign.subject or "").strip():
            return None

        return {
            "name": campaign.name,
            "subject": campaign.subject,
        }

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
            }
            decision_value = decision
            default_client_id = client_id
            eligible_contact_count = 0
            blocked_contact_count = 0

        response: dict[str, Any] = {
            "status": "dispatch_blocked",
            "mode": "controlled_dev",
            "provider": self._resolve_controlled_provider(),
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
            "guard": guard_payload,
            "dispatch_attempted": False,
            "real_send_attempted": False,
            "listmonk_prepared": bool(preparation),
            "listmonk_dispatched": False,
            "content_ready": content_ready,
            "email_logs_created": 0,
            "email_logs_updated": 0,
        }
        if preparation is not None:
            response["preparation"] = preparation
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
    ) -> dict[str, Any]:
        response: dict[str, Any] = {
            "status": "dispatch_failed",
            "mode": "controlled_dev",
            "provider": provider,
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
            "guard": guard_result.to_dict(),
            "dispatch_attempted": dispatch_attempted,
            "real_send_attempted": dispatch_attempted,
            "listmonk_prepared": stage != "preparation",
            "listmonk_dispatched": False,
            "content_ready": content_ready,
            "email_logs_created": 0,
            "email_logs_updated": 0,
        }
        if preparation is not None:
            response["preparation"] = preparation
        return response


def build_listmonk_client(settings: Settings) -> ListmonkClient:
    return ListmonkClient(
        base_url=settings.listmonk_url,
        username=settings.listmonk_username,
        password=settings.listmonk_password,
        timeout_seconds=settings.listmonk_timeout_seconds,
    )


def get_campaign_state_service() -> CampaignStateService:
    return CampaignStateService(repository=get_campaign_repository())


def get_admin_campaign_service() -> AdminCampaignService:
    settings = get_settings()
    return AdminCampaignService(
        settings=settings,
        guard=DeliverabilityGuard(),
        repository=get_campaign_repository(),
        client_repository=PostgresClientRepository(settings),
        campaign_slot_service=get_campaign_slot_service(),
        campaign_slot_repository=get_campaign_slot_repository(),
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
        contact_repository=PostgresContactRepository(settings),
        suppression_list_repository=get_suppression_list_repository(),
        blocked_send_repository=get_blocked_send_repository(),
        email_log_repository=get_email_log_repository(),
        campaign_preparation_service=get_campaign_preparation_service(),
    )
