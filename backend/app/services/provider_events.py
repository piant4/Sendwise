from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status

from app.core.config import Settings, get_settings
from app.integrations.mailgun.webhooks import coerce_mailgun_datetime
from app.repositories.campaigns import CampaignRepository, get_campaign_repository
from app.repositories.contacts import ContactRecord, ContactRepository, get_contact_repository
from app.repositories.email_logs import EmailLogRecord, EmailLogRepository, get_email_log_repository
from app.repositories.provider_events import (
    ProviderEventRecord,
    ProviderEventRepository,
    get_provider_event_repository,
)
from app.repositories.suppression_list import (
    SuppressionListRepository,
    get_suppression_list_repository,
)
from app.schemas.common import CampaignStatus, campaign_consumes_running_slot
from app.schemas.provider_events import ProviderEventIngestResponse

PROVIDER_EVENT_TERMINAL = {
    "hard_bounce",
    "complaint",
    "unsubscribe",
    "ses_bounce",
    "ses_complaint",
    "sendwise_unsubscribe",
}
GENERIC_SES_EVENT_TYPE_ALIASES = {
    "send": "ses_send",
    "delivery": "ses_delivery",
    "bounce": "ses_bounce",
    "complaint": "ses_complaint",
    "spam": "ses_complaint",
    "open": "ses_open",
    "click": "ses_click",
    "reject": "ses_reject",
}
GENERIC_UNSUBSCRIBE_EVENT_TYPE_ALIASES = {
    "unsubscribe": "sendwise_unsubscribe",
    "sendwise_unsubscribe": "sendwise_unsubscribe",
    "listmonk_unsubscribe": "sendwise_unsubscribe",
}
REDACTED_PAYLOAD_KEYS = {
    "authorization",
    "body",
    "email",
    "headers",
    "html",
    "message",
    "mime",
    "recipient",
    "signature",
    "signing_key",
    "smtp_password",
    "subject",
    "text",
    "token",
}
RUNNING_SLOT_PENDING_LOG_STATUSES = {"queued"}
RUNNING_SLOT_COMPLETION_LOG_STATUSES = {
    "sent",
    "delivered",
    "opened",
    "clicked",
    "failed",
    "bounced",
    "complained",
    "unsubscribed",
}


@dataclass(frozen=True)
class NormalizedProviderEvent:
    provider: str
    event_type: str
    send_kind: str = "campaign"
    source: str = "webhook"
    provider_event_id: str | None = None
    occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    client_id: str | None = None
    campaign_id: str | None = None
    contact_id: str | None = None
    email_log_id: str | None = None
    provider_message_id: str | None = None
    email: str | None = None
    payload: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class CorrelatedProviderEvent:
    client_id: str | None
    campaign_id: str | None
    contact_id: str | None
    email_log: EmailLogRecord | None
    contact: ContactRecord | None


@dataclass(frozen=True)
class ProviderEventIngestionService:
    settings: Settings
    provider_event_repository: ProviderEventRepository
    campaign_repository: CampaignRepository
    contact_repository: ContactRepository
    email_log_repository: EmailLogRepository
    suppression_list_repository: SuppressionListRepository

    def ingest_payload(self, payload: dict[str, Any]) -> ProviderEventIngestResponse:
        normalized = self._normalize_payload(payload)
        return self.ingest_event(normalized)

    def ingest_event(
        self,
        event: NormalizedProviderEvent,
    ) -> ProviderEventIngestResponse:
        correlation = self._correlate_event(event)
        event_key = self._build_event_key(event=event, correlation=correlation)
        analytics_correlated = self._is_analytics_correlated(correlation)
        stored_event, created = self.provider_event_repository.create_or_get_event(
            client_id=correlation.client_id if analytics_correlated else None,
            campaign_id=correlation.campaign_id if analytics_correlated else None,
            contact_id=correlation.contact_id if analytics_correlated else None,
            email_log_id=correlation.email_log.id if correlation.email_log else event.email_log_id,
            send_kind=(
                correlation.email_log.send_kind
                if correlation.email_log is not None
                else event.send_kind
            ),
            provider=event.provider,
            source=event.source,
            provider_event_id=event.provider_event_id,
            event_key=event_key,
            event_type=event.event_type,
            payload=self._build_persisted_payload(event),
            occurred_at=event.occurred_at,
        )

        if stored_event.processed_at is not None:
            return self._build_response(
                event=stored_event,
                created=created,
                processed=True,
                correlated=analytics_correlated,
                suppressed=(
                    self._triggers_suppression(stored_event)
                    and self._is_side_effect_correlated(correlation)
                ),
            )

        suppressed = False
        if self._is_side_effect_correlated(correlation):
            suppressed = self._apply_side_effects(
                event=stored_event,
                correlation=correlation,
            )

        processed_event = self.provider_event_repository.mark_processed(
            event_id=stored_event.id
        )
        return self._build_response(
            event=processed_event,
            created=created,
            processed=True,
            correlated=analytics_correlated,
            suppressed=suppressed,
        )

    def _normalize_payload(self, payload: dict[str, Any]) -> NormalizedProviderEvent:
        if payload.get("Type") == "Notification" and "Message" in payload:
            message = payload["Message"]
            if isinstance(message, str):
                try:
                    message = json.loads(message)
                except json.JSONDecodeError as error:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Invalid SNS message payload.",
                    ) from error
            if not isinstance(message, dict):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Unsupported SNS message payload.",
                )
            return self._normalize_ses_payload(message, source="sns")

        if "provider" in payload or "event_type" in payload:
            return self._normalize_generic_payload(payload)

        if "eventType" in payload or "notificationType" in payload:
            return self._normalize_ses_payload(payload, source="provider_webhook")

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported provider event payload.",
        )

    def _normalize_generic_payload(self, payload: dict[str, Any]) -> NormalizedProviderEvent:
        provider = str(payload.get("provider") or "").strip().lower()
        source = str(payload.get("source") or "provider_webhook").strip() or "provider_webhook"
        raw_payload = payload.get("payload")
        if provider == "mailgun":
            if not isinstance(raw_payload, dict):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Mailgun event payload is required.",
                )
            return self._normalize_mailgun_payload(raw_payload, source=source)

        raw_event_type = str(payload.get("event_type") or "").strip()
        event_type = self._canonicalize_generic_event_type(
            provider=provider,
            event_type=raw_event_type,
        )
        if not provider or not event_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="provider and event_type are required.",
            )
        occurred_at = self._coerce_datetime(payload.get("occurred_at"))
        if not isinstance(raw_payload, dict):
            raw_payload = payload
        return NormalizedProviderEvent(
            provider=provider,
            send_kind=self._coerce_send_kind(payload.get("send_kind")),
            source=source,
            provider_event_id=self._coerce_optional_string(payload.get("provider_event_id")),
            event_type=event_type,
            occurred_at=occurred_at,
            client_id=self._coerce_optional_string(payload.get("client_id")),
            campaign_id=self._coerce_optional_string(payload.get("campaign_id")),
            contact_id=self._coerce_optional_string(payload.get("contact_id")),
            email_log_id=self._coerce_optional_string(payload.get("email_log_id")),
            provider_message_id=self._coerce_optional_string(payload.get("provider_message_id")),
            email=self._coerce_optional_string(payload.get("email")),
            payload=self._sanitize_payload(raw_payload),
        )

    def _canonicalize_generic_event_type(
        self,
        *,
        provider: str,
        event_type: str,
    ) -> str:
        normalized = event_type.strip().lower()
        if not normalized:
            return ""
        if provider == "ses":
            return GENERIC_SES_EVENT_TYPE_ALIASES.get(normalized, normalized)
        if provider in {"sendwise", "listmonk"}:
            return GENERIC_UNSUBSCRIBE_EVENT_TYPE_ALIASES.get(normalized, normalized)
        return normalized

    def _normalize_ses_payload(
        self,
        payload: dict[str, Any],
        *,
        source: str,
    ) -> NormalizedProviderEvent:
        event_label = str(
            payload.get("eventType") or payload.get("notificationType") or ""
        ).strip()
        event_type_map = {
            "Send": "ses_send",
            "Delivery": "ses_delivery",
            "Bounce": "ses_bounce",
            "Complaint": "ses_complaint",
            "Reject": "ses_reject",
            "Open": "ses_open",
            "Click": "ses_click",
        }
        event_type = event_type_map.get(
            event_label,
            f"ses_{event_label.lower()}" if event_label else "ses_unknown",
        )
        mail = payload.get("mail") if isinstance(payload.get("mail"), dict) else {}
        occurred_at = self._coerce_datetime(mail.get("timestamp") or payload.get("timestamp"))
        destination = mail.get("destination")
        email = None
        if isinstance(destination, list) and destination:
            email = self._coerce_optional_string(destination[0])
        tags = mail.get("tags") if isinstance(mail.get("tags"), dict) else {}
        campaign_id = self._extract_tag_value(tags, "sendwise_campaign_id")
        contact_id = self._extract_tag_value(tags, "sendwise_contact_id")
        client_id = self._extract_tag_value(tags, "sendwise_client_id")
        provider_event_id = self._coerce_optional_string(
            payload.get("eventId") or mail.get("messageId")
        )
        provider_message_id = self._coerce_optional_string(mail.get("messageId"))
        return NormalizedProviderEvent(
            provider="ses",
            send_kind=self._coerce_send_kind(self._extract_tag_value(tags, "sendwise_send_kind")),
            source=source,
            provider_event_id=provider_event_id,
            event_type=event_type,
            occurred_at=occurred_at,
            client_id=client_id,
            campaign_id=campaign_id,
            contact_id=contact_id,
            provider_message_id=provider_message_id,
            email=email,
            payload={
                "event_label": event_label or None,
                "message_id": provider_message_id,
                "tag_keys": sorted(tags.keys()),
                "recipient_hash": self._hash_email(email),
            },
        )

    def _normalize_mailgun_payload(
        self,
        payload: dict[str, Any],
        *,
        source: str,
    ) -> NormalizedProviderEvent:
        event_name = self._coerce_optional_string(payload.get("event")) or ""
        event_type = self._map_mailgun_event_type(payload)
        if not event_type:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported Mailgun event payload.",
            )
        custom_variables = self._extract_mailgun_custom_variables(payload)
        message_payload = payload.get("message") if isinstance(payload.get("message"), dict) else {}
        headers = message_payload.get("headers") if isinstance(message_payload.get("headers"), dict) else {}
        provider_message_id = self._normalize_message_id(
            payload.get("message-id")
            or headers.get("message-id")
            or headers.get("Message-Id")
        )
        recipient = self._coerce_optional_string(payload.get("recipient"))
        provider_event_id = self._coerce_optional_string(payload.get("id"))
        occurred_at = coerce_mailgun_datetime(
            payload.get("timestamp") or payload.get("event-timestamp")
        )
        severity = self._mailgun_failed_severity(payload)
        sanitized_custom_variables = {
            key: coerced
            for key in (
                "sendwise_client_id",
                "sendwise_campaign_id",
                "sendwise_contact_id",
                "sendwise_email_log_id",
                "sendwise_send_kind",
            )
            if (
                coerced := self._coerce_provider_identifier(custom_variables.get(key))
            )
            is not None
        }
        return NormalizedProviderEvent(
            provider="mailgun",
            send_kind=self._coerce_send_kind(
                custom_variables.get("sendwise_send_kind")
            ),
            source=source,
            provider_event_id=provider_event_id,
            event_type=event_type,
            occurred_at=occurred_at,
            client_id=self._coerce_provider_identifier(
                custom_variables.get("sendwise_client_id")
            ),
            campaign_id=self._coerce_provider_identifier(
                custom_variables.get("sendwise_campaign_id")
            ),
            contact_id=self._coerce_provider_identifier(
                custom_variables.get("sendwise_contact_id")
            ),
            email_log_id=self._coerce_provider_identifier(
                custom_variables.get("sendwise_email_log_id")
            ),
            provider_message_id=provider_message_id,
            email=recipient,
            payload={
                "event": event_name,
                "severity": severity,
                "reason": self._coerce_optional_string(payload.get("reason")),
                "recipient_hash": self._hash_email(recipient),
                "message_id": provider_message_id,
                "delivery_status": self._sanitize_payload(
                    payload.get("delivery-status")
                    if isinstance(payload.get("delivery-status"), dict)
                    else {}
                ),
                "custom_variables": {
                    key: sanitized_custom_variables[key]
                    for key in sanitized_custom_variables
                },
            },
        )

    def _map_mailgun_event_type(self, payload: dict[str, Any]) -> str:
        event_name = (self._coerce_optional_string(payload.get("event")) or "").lower()
        if event_name == "accepted":
            return "accepted"
        if event_name == "delivered":
            return "delivered"
        if event_name == "opened":
            return "opened"
        if event_name == "clicked":
            return "clicked"
        if event_name == "unsubscribed":
            return "unsubscribe"
        if event_name == "complained":
            return "complaint"
        if event_name == "rejected":
            return "rejected"
        if event_name == "failed":
            severity = self._mailgun_failed_severity(payload)
            if severity == "temporary":
                return "soft_bounce"
            if severity == "permanent":
                return "hard_bounce"
            return "delivery_failed"
        return ""

    def _mailgun_failed_severity(self, payload: dict[str, Any]) -> str | None:
        delivery_status = (
            payload.get("delivery-status")
            if isinstance(payload.get("delivery-status"), dict)
            else {}
        )
        severity = self._coerce_optional_string(delivery_status.get("severity"))
        if severity is None:
            return None
        normalized = severity.lower()
        if normalized in {"temporary", "temp"}:
            return "temporary"
        if normalized in {"permanent", "perm"}:
            return "permanent"
        return normalized

    def _extract_mailgun_custom_variables(self, payload: dict[str, Any]) -> dict[str, Any]:
        candidates: list[dict[str, Any]] = []
        for key in ("user-variables", "user_variables"):
            value = payload.get(key)
            if isinstance(value, dict):
                candidates.append(value)
            elif isinstance(value, str) and value.strip():
                try:
                    parsed = json.loads(value)
                except json.JSONDecodeError:
                    parsed = None
                if isinstance(parsed, dict):
                    candidates.append(parsed)

        message_payload = payload.get("message") if isinstance(payload.get("message"), dict) else {}
        headers = message_payload.get("headers") if isinstance(message_payload.get("headers"), dict) else {}
        header_value = headers.get("X-Mailgun-Variables") or headers.get("x-mailgun-variables")
        if isinstance(header_value, str) and header_value.strip():
            try:
                parsed_header = json.loads(header_value)
            except json.JSONDecodeError:
                parsed_header = None
            if isinstance(parsed_header, dict):
                candidates.append(parsed_header)

        merged: dict[str, Any] = {}
        for candidate in candidates:
            for key, value in candidate.items():
                merged[str(key)] = value
        return merged

    def _correlate_event(self, event: NormalizedProviderEvent) -> CorrelatedProviderEvent:
        if event.provider == "mailgun":
            return self._correlate_mailgun_event(event)

        email_log = None
        if event.email_log_id:
            email_log = self.email_log_repository.get_by_id(event.email_log_id)
        if email_log is None and event.provider_message_id:
            email_log = self.email_log_repository.find_by_provider_message_id(
                provider_message_id=event.provider_message_id
            )

        if email_log is not None and not self._event_matches_email_log(
            event=event,
            email_log=email_log,
        ):
            return self._uncorrelated_event()

        campaign_id = event.campaign_id or (email_log.campaign_id if email_log else None)
        contact_id = event.contact_id or (email_log.contact_id if email_log else None)
        client_id = event.client_id or (email_log.client_id if email_log else None)
        contact = None

        if campaign_id:
            campaign = self.campaign_repository.get_by_id(campaign_id=campaign_id)
            if campaign is None:
                return self._uncorrelated_event()
            if client_id is not None and campaign.client_id != client_id:
                return self._uncorrelated_event()
            client_id = campaign.client_id

        if contact_id:
            candidate = self.contact_repository.get_by_id(contact_id)
            if candidate is None:
                return self._uncorrelated_event()
            if client_id is not None and candidate.client_id != client_id:
                return self._uncorrelated_event()
            contact = candidate
            client_id = candidate.client_id

        if contact is None and client_id and event.email:
            candidate = self.contact_repository.get_by_client_email(
                client_id=client_id,
                email=event.email,
            )
            if candidate is not None:
                if campaign_id is None or self.contact_repository.campaign_contact_exists(
                    client_id=client_id,
                    campaign_id=campaign_id,
                    contact_id=candidate.id,
                ):
                    contact = candidate
                    contact_id = candidate.id

        if (
            client_id is not None
            and campaign_id is not None
            and contact_id is not None
            and not self._has_valid_campaign_contact_correlation(
                client_id=client_id,
                campaign_id=campaign_id,
                contact_id=contact_id,
                email_log=email_log,
            )
        ):
            return self._uncorrelated_event()

        if email_log is None and client_id and campaign_id and contact_id:
            email_log = self.email_log_repository.find_latest_for_contact(
                client_id=client_id,
                campaign_id=campaign_id,
                contact_id=contact_id,
                send_kind=event.send_kind,
            )

        if email_log is not None and not self._correlation_matches_email_log(
            client_id=client_id,
            campaign_id=campaign_id,
            contact_id=contact_id,
            email_log=email_log,
        ):
            return self._uncorrelated_event()

        return CorrelatedProviderEvent(
            client_id=client_id,
            campaign_id=campaign_id,
            contact_id=contact_id,
            email_log=email_log,
            contact=contact,
        )

    def _correlate_mailgun_event(
        self,
        event: NormalizedProviderEvent,
    ) -> CorrelatedProviderEvent:
        if event.client_id is None or event.campaign_id is None:
            return self._uncorrelated_event()

        campaign = self.campaign_repository.get_by_id(campaign_id=event.campaign_id)
        if campaign is None or campaign.client_id != event.client_id:
            return self._uncorrelated_event()

        contact = None
        contact_id = event.contact_id
        if contact_id is not None:
            candidate = self.contact_repository.get_by_id(contact_id)
            if candidate is None or candidate.client_id != event.client_id:
                return self._uncorrelated_event()
            contact = candidate

        if contact is None and event.email:
            candidate = self.contact_repository.get_by_client_email(
                client_id=event.client_id,
                email=event.email,
            )
            if candidate is not None:
                contact = candidate
                contact_id = candidate.id

        if contact is None or contact_id is None:
            return self._uncorrelated_event()

        if not self.contact_repository.campaign_contact_exists(
            client_id=event.client_id,
            campaign_id=event.campaign_id,
            contact_id=contact_id,
        ):
            return self._uncorrelated_event()

        email_log = None
        if event.email_log_id:
            candidate_log = self.email_log_repository.get_by_id(event.email_log_id)
            if candidate_log is None:
                return self._uncorrelated_event()
            email_log = candidate_log

        if email_log is None:
            email_log = self.email_log_repository.find_latest_for_contact(
                client_id=event.client_id,
                campaign_id=event.campaign_id,
                contact_id=contact_id,
                send_kind=event.send_kind,
            )

        if email_log is None or not self._correlation_matches_email_log(
            client_id=event.client_id,
            campaign_id=event.campaign_id,
            contact_id=contact_id,
            email_log=email_log,
        ):
            return self._uncorrelated_event()

        return CorrelatedProviderEvent(
            client_id=event.client_id,
            campaign_id=event.campaign_id,
            contact_id=contact_id,
            email_log=email_log,
            contact=contact,
        )

    def _event_matches_email_log(
        self,
        *,
        event: NormalizedProviderEvent,
        email_log: EmailLogRecord,
    ) -> bool:
        if event.client_id is not None and event.client_id != email_log.client_id:
            return False
        if event.campaign_id is not None and event.campaign_id != email_log.campaign_id:
            return False
        if event.contact_id is not None and event.contact_id != email_log.contact_id:
            return False
        if event.send_kind != email_log.send_kind:
            return False
        return True

    def _correlation_matches_email_log(
        self,
        *,
        client_id: str | None,
        campaign_id: str | None,
        contact_id: str | None,
        email_log: EmailLogRecord,
    ) -> bool:
        return (
            client_id == email_log.client_id
            and campaign_id == email_log.campaign_id
            and contact_id == email_log.contact_id
        )

    def _has_valid_campaign_contact_correlation(
        self,
        *,
        client_id: str,
        campaign_id: str,
        contact_id: str,
        email_log: EmailLogRecord | None,
    ) -> bool:
        if email_log is not None and self._correlation_matches_email_log(
            client_id=client_id,
            campaign_id=campaign_id,
            contact_id=contact_id,
            email_log=email_log,
        ):
            return True
        return self.contact_repository.campaign_contact_exists(
            client_id=client_id,
            campaign_id=campaign_id,
            contact_id=contact_id,
        )

    def _uncorrelated_event(self) -> CorrelatedProviderEvent:
        return CorrelatedProviderEvent(
            client_id=None,
            campaign_id=None,
            contact_id=None,
            email_log=None,
            contact=None,
        )

    def _apply_side_effects(
        self,
        *,
        event: ProviderEventRecord,
        correlation: CorrelatedProviderEvent,
    ) -> bool:
        if correlation.email_log is not None:
            next_status = self._next_email_log_status(
                current_status=correlation.email_log.status,
                event_type=event.event_type,
            )
            if next_status is not None:
                updated_log = self.email_log_repository.update_status(
                    email_log_id=correlation.email_log.id,
                    status=next_status,
                )
                self._complete_running_campaign_if_dispatch_finished(
                    email_log=updated_log or correlation.email_log,
                )

        suppressed = False
        if correlation.contact is not None:
            next_contact_status = self._next_contact_status(
                current_status=correlation.contact.status,
                event_type=event.event_type,
            )
            if next_contact_status is not None:
                self.contact_repository.update_status(
                    contact_id=correlation.contact.id,
                    status=next_contact_status,
                )

            if self._triggers_suppression(event):
                self.suppression_list_repository.add_suppression(
                    email=correlation.contact.email,
                    client_id=correlation.contact.client_id,
                    reason=self._suppression_reason(event.event_type),
                )
                suppressed = True

        return suppressed

    def _complete_running_campaign_if_dispatch_finished(
        self,
        *,
        email_log: EmailLogRecord,
    ) -> None:
        if email_log.send_kind != "campaign":
            return
        campaign_id = email_log.campaign_id
        client_id = email_log.client_id
        if campaign_id is None:
            return

        campaign = self.campaign_repository.get_by_id(
            campaign_id=campaign_id,
            client_id=client_id,
        )
        if campaign is None or not campaign_consumes_running_slot(campaign.status):
            return

        contacts = self.contact_repository.list_campaign_contacts(
            client_id=client_id,
            campaign_id=campaign_id,
        )
        if not contacts:
            return

        latest_logs = self.email_log_repository.list_latest_for_campaign(
            client_id=client_id,
            campaign_id=campaign_id,
        )
        if len(latest_logs) != len(contacts):
            return
        if any(log.status in RUNNING_SLOT_PENDING_LOG_STATUSES for log in latest_logs):
            return
        if any(log.status not in RUNNING_SLOT_COMPLETION_LOG_STATUSES for log in latest_logs):
            return

        self.campaign_repository.update_campaign(
            client_id=client_id,
            campaign_id=campaign_id,
            status=CampaignStatus.completed.value,
        )

    def _next_email_log_status(
        self,
        *,
        current_status: str,
        event_type: str,
    ) -> str | None:
        normalized = current_status.strip().lower()
        if normalized == "simulated":
            return None
        if event_type in {"accepted", "ses_send"}:
            return "sent" if normalized in {"queued", "pending", "sent"} else None
        if event_type in {"delivered", "ses_delivery"}:
            return "delivered" if normalized in {"queued", "pending", "sent", "delivered"} else None
        if event_type in {"opened", "ses_open"}:
            return "opened" if normalized in {"queued", "pending", "sent", "delivered", "opened"} else None
        if event_type in {"clicked", "ses_click"}:
            return "clicked" if normalized in {"queued", "pending", "sent", "delivered", "opened", "clicked"} else None
        if event_type in {"rejected", "ses_reject", "delivery_failed", "soft_bounce"}:
            return "failed"
        if event_type in {"hard_bounce", "ses_bounce"}:
            return "bounced"
        if event_type in {"complaint", "ses_complaint"}:
            return "complained"
        if event_type in {"unsubscribe", "sendwise_unsubscribe"}:
            return "unsubscribed"
        return None

    def _next_contact_status(
        self,
        *,
        current_status: str,
        event_type: str,
    ) -> str | None:
        normalized = current_status.strip().lower()
        if event_type in {"unsubscribe", "sendwise_unsubscribe"}:
            return None if normalized == "unsubscribed" else "unsubscribed"
        if event_type in {"hard_bounce", "ses_bounce"}:
            return None if normalized in {"unsubscribed", "bounced"} else "bounced"
        if event_type in {"complaint", "ses_complaint"}:
            return None if normalized in {"unsubscribed", "bounced", "suppressed"} else "suppressed"
        return None

    def _build_event_key(
        self,
        *,
        event: NormalizedProviderEvent,
        correlation: CorrelatedProviderEvent,
    ) -> str:
        if event.provider_event_id:
            return f"{event.provider}:{event.provider_event_id}"
        raw = {
            "provider": event.provider,
            "event_type": event.event_type,
            "send_kind": event.send_kind,
            "source": event.source,
            "occurred_at": event.occurred_at.isoformat(),
            "campaign_id": correlation.campaign_id or event.campaign_id,
            "contact_id": correlation.contact_id or event.contact_id,
            "email_log_id": correlation.email_log.id if correlation.email_log else event.email_log_id,
            "provider_message_id": event.provider_message_id,
            "recipient_hash": self._hash_email(event.email),
        }
        digest = hashlib.sha256(
            json.dumps(raw, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()
        return f"{event.provider}:{digest}"

    def _build_persisted_payload(self, event: NormalizedProviderEvent) -> dict[str, Any]:
        return {
            "provider": event.provider,
            "source": event.source,
            "provider_event_id": event.provider_event_id,
            "provider_message_id": event.provider_message_id,
            "campaign_id": event.campaign_id,
            "contact_id": event.contact_id,
            "client_id": event.client_id,
            "email_log_id": event.email_log_id,
            "send_kind": event.send_kind,
            "recipient_hash": self._hash_email(event.email),
            "payload": self._sanitize_payload(event.payload),
        }

    def _build_response(
        self,
        *,
        event: ProviderEventRecord,
        created: bool,
        processed: bool,
        correlated: bool,
        suppressed: bool,
    ) -> ProviderEventIngestResponse:
        return ProviderEventIngestResponse(
            status="accepted",
            provider=event.provider,
            event_type=event.event_type,
            event_id=event.id,
            created=created,
            processed=processed,
            correlated=correlated,
            suppressed=suppressed,
            campaign_id=event.campaign_id,
            contact_id=event.contact_id,
            email_log_id=event.email_log_id,
            occurred_at=event.occurred_at,
        )

    def _extract_tag_value(self, tags: dict[str, Any], key: str) -> str | None:
        value = tags.get(key)
        if isinstance(value, list) and value:
            return self._coerce_optional_string(value[0])
        return self._coerce_optional_string(value)

    def _coerce_datetime(self, value: Any) -> datetime:
        if isinstance(value, datetime):
            return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        if isinstance(value, str) and value.strip():
            candidate = value.strip().replace("Z", "+00:00")
            try:
                parsed = datetime.fromisoformat(candidate)
            except ValueError as error:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid occurred_at timestamp.",
                ) from error
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        return datetime.now(timezone.utc)

    def _coerce_optional_string(self, value: Any) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip()
        return normalized or None

    def _coerce_provider_identifier(self, value: Any) -> str | None:
        normalized = self._coerce_optional_string(value)
        if normalized is None:
            return None
        if "{{" in normalized or "}}" in normalized:
            return None
        return normalized

    def _coerce_send_kind(self, value: Any) -> str:
        normalized = (self._coerce_optional_string(value) or "campaign").strip().lower()
        if normalized == "followup":
            return "followup"
        return "campaign"

    def _normalize_message_id(self, value: Any) -> str | None:
        normalized = self._coerce_optional_string(value)
        if normalized is None:
            return None
        if normalized.startswith("<") and normalized.endswith(">") and len(normalized) > 2:
            return normalized[1:-1].strip() or None
        return normalized

    def _is_analytics_correlated(self, correlation: CorrelatedProviderEvent) -> bool:
        return correlation.client_id is not None and correlation.campaign_id is not None

    def _is_side_effect_correlated(self, correlation: CorrelatedProviderEvent) -> bool:
        return correlation.contact is not None or correlation.email_log is not None

    def _triggers_suppression(self, event: ProviderEventRecord) -> bool:
        return event.event_type in PROVIDER_EVENT_TERMINAL

    def _suppression_reason(self, event_type: str) -> str:
        if event_type in {"unsubscribe", "sendwise_unsubscribe"}:
            return "unsubscribe"
        if event_type in {"complaint", "ses_complaint"}:
            return "complaint"
        return "bounce"

    def _hash_email(self, email: str | None) -> str | None:
        normalized = (email or "").strip().lower()
        if not normalized:
            return None
        digest = hashlib.sha256(
            f"{self.settings.unsubscribe_token_secret}:{normalized}".encode("utf-8")
        ).hexdigest()
        return digest[:24]

    def _sanitize_payload(self, payload: Any) -> dict[str, Any]:
        if not isinstance(payload, dict):
            return {}
        sanitized: dict[str, Any] = {}
        for key, value in payload.items():
            normalized_key = str(key)
            if normalized_key.strip().lower() in REDACTED_PAYLOAD_KEYS:
                continue
            scalar = self._sanitize_payload_value(value)
            if scalar is not None:
                sanitized[normalized_key] = scalar
        return sanitized

    def _sanitize_payload_value(self, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, (str, int, float, bool)):
            return value
        if isinstance(value, datetime):
            return value.isoformat()
        if isinstance(value, dict):
            nested = self._sanitize_payload(value)
            return nested or None
        if isinstance(value, list):
            items = [
                item
                for item in (self._sanitize_payload_value(entry) for entry in value[:10])
                if item is not None
            ]
            return items or None
        return str(value)


def get_provider_event_ingestion_service() -> ProviderEventIngestionService:
    settings = get_settings()
    return ProviderEventIngestionService(
        settings=settings,
        provider_event_repository=get_provider_event_repository(),
        campaign_repository=get_campaign_repository(),
        contact_repository=get_contact_repository(),
        email_log_repository=get_email_log_repository(),
        suppression_list_repository=get_suppression_list_repository(),
    )
