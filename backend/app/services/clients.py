from __future__ import annotations

import secrets
import string
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from pathlib import Path
from typing import Optional

import httpx

from fastapi import Depends, HTTPException, status

from app.core.config import Settings, get_settings
from app.repositories.blocked_sends import BlockedSendRepository, get_blocked_send_repository
from app.repositories.campaign_slots import CampaignSlotRepository, get_campaign_slot_repository
from app.repositories.campaigns import CampaignRepository, get_campaign_repository
from app.repositories.client_access import (
    ClientAccessRecord,
    ClientAccessRepository,
    get_client_access_repository,
)
from app.repositories.clients import (
    AdminBlockedSendRecord,
    AdminCampaignEmailVolumeRecord,
    AdminCampaignRecord,
    AdminTopClientVolumeRecord,
    ClientBlockedSendRecord,
    ClientCampaignRecord,
    ClientRecord,
    ClientRepository,
    ClientUsageRecord,
    get_client_repository,
)
from app.repositories.contacts import ContactRepository, PostgresContactRepository
from app.repositories.email_logs import EmailLogRepository, get_email_log_repository
from app.repositories.provider_events import (
    ProviderEventRepository,
    get_provider_event_repository,
)
from app.repositories.suppression_list import (
    SuppressionListRepository,
    get_suppression_list_repository,
)
from app.schemas.clients import (
    AdminBlockedSendItem,
    AdminCampaignStatusCounts,
    AdminCampaignSummary,
    AdminClientNearLimit,
    AdminClientStatusCounts,
    AdminCriticalEvent,
    ClientEmailBrand,
    AdminEmailLimitRow,
    AdminEmailLimitsResponse,
    AdminEmailLimitsSummary,
    AdminOverviewBlocksSummary,
    AdminOverviewCampaignsSummary,
    AdminOverviewClientsSummary,
    AdminOverviewLimitsSummary,
    AdminOverviewSendingSummary,
    AdminOverviewSummary,
    AdminRecentCampaign,
    AdminSystemStatus,
    AdminTopClientByVolume,
    Client,
    ClientDashboardActionItem,
    ClientDashboardActionsRequired,
    ClientDashboardCta,
    ClientDashboardKpis,
    ClientDashboardKpiValue,
    ClientDashboardPerformanceAnalytics,
    ClientDashboardPeriodUsage,
    ClientDashboardStatusSummary,
    ClientDashboardSummary,
    ClientDashboardWindowKey,
    ClientDashboardWindowMetrics,
    ClientCampaignStatusCounts,
    ClientAccessSummary,
    ClientContext,
    ClientOverviewBlockedSends,
    ClientOverviewCampaigns,
    ClientOverviewIdentity,
    ClientOverviewLimits,
    ClientOverviewSummary,
    ClientOverviewUsage,
    ClientUsageSummaryItem,
    ClientUser,
    build_client_access_error_detail,
)
from app.schemas.blocked_sends import BlockedSend
from app.schemas.campaigns import (
    Campaign,
    CampaignBlockedSendsSummary,
    CampaignLogsSummary,
    CampaignRecipientsSummary,
    CampaignSlotSummary,
    CampaignSummaryItem,
    ClientCampaignDetailResponse,
    ClientCampaignStatsResponse,
)
from app.schemas.common import CampaignStatus
from app.schemas.usage import ApiUsage
from app.services.emails import ClientAccessEmailService
from app.services.provider_runtime import build_provider_runtime_summary

ACTIVE_CAMPAIGN_STATUSES = {CampaignStatus.ready.value, CampaignStatus.running.value}
RUNNING_CAMPAIGN_STATUSES = {CampaignStatus.running.value}
LIMITED_CAMPAIGN_STATUSES = {
    CampaignStatus.draft.value,
    CampaignStatus.ready.value,
    CampaignStatus.running.value,
    CampaignStatus.paused.value,
    CampaignStatus.blocked.value,
}
NEAR_LIMIT_THRESHOLD = 0.8
RECENT_ADMIN_CAMPAIGNS_LIMIT = 5
RECENT_ADMIN_BLOCKED_SENDS_LIMIT = 5
TOP_CLIENTS_LIMIT = 5
CLIENTS_NEAR_LIMIT_LIMIT = 5
CLIENT_DASHBOARD_DEFAULT_WINDOW: ClientDashboardWindowKey = "7d"
CLIENT_DASHBOARD_WINDOW_DELTAS: tuple[tuple[ClientDashboardWindowKey, timedelta | None], ...] = (
    ("24h", timedelta(hours=24)),
    ("7d", timedelta(days=7)),
    ("14d", timedelta(days=14)),
    ("30d", timedelta(days=30)),
    ("allTime", None),
)
PROVIDER_EVENT_METRIC_TYPES = (
    "ses_delivery",
    "ses_bounce",
    "ses_complaint",
    "ses_open",
    "ses_click",
    "sendwise_unsubscribe",
)
ACCEPTED_EMAIL_LOG_STATUSES = (
    "sent",
    "dispatched",
    "delivered",
    "opened",
    "clicked",
    "bounced",
    "complained",
    "spam",
    "unsubscribed",
)
CLIENT_ACCESS_LINK_EXPIRATION_SECONDS = 60 * 60 * 24 * 30
PORTAL_SLUG_ALPHABET = string.ascii_lowercase + string.digits
PORTAL_SLUG_LENGTH = 32
CLIENT_ACCESS_EMAIL_INVALID = "client_access_email_invalid"
CLIENT_ACCESS_CLERK_CONFIG_MISSING = "client_access_clerk_config_missing"
CLIENT_ACCESS_CLERK_LINK_FAILED = "client_access_clerk_link_failed"
CLIENT_ACCESS_CLERK_EMAIL_FAILED = "client_access_clerk_email_failed"
CLIENT_ACCESS_EMAIL_CONFIG_MISSING = "client_access_email_config_missing"
CLIENT_ACCESS_EMAIL_SEND_FAILED = "client_access_email_send_failed"
CLIENT_ACCESS_EXISTING_USER_CONFLICT = "client_access_existing_user_conflict"
CLIENT_ACCESS_EXISTING_USER_RESEND_UNSUPPORTED = (
    "client_access_existing_user_resend_unsupported"
)
CLIENT_BRAND_LOGO_UPLOAD_DIR = (
    Path(__file__).resolve().parents[2] / "uploads" / "client-brand-logos"
)
CLIENT_BRAND_LOGO_PUBLIC_PREFIX = "/static/client-brand-logos"
CLIENT_BRAND_LOGO_MAX_BYTES = 500 * 1024


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


def _is_invalid_email_error(detail: object) -> bool:
    if not isinstance(detail, str):
        return False
    normalized_detail = detail.strip().lower()
    return "email" in normalized_detail and "invalid" in normalized_detail


RECENT_CAMPAIGNS_LIMIT = 5
RECENT_USAGE_LIMIT = 5
RECENT_BLOCKED_SENDS_LIMIT = 5
CAMPAIGN_BLOCKED_SENDS_LATEST_LIMIT = 5


def _get_business_period_start(current_time: datetime, settings: Settings) -> datetime:
    business_now = current_time.astimezone(settings.business_timezone)
    return business_now.replace(
        day=1,
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    ).astimezone(timezone.utc)


def _get_business_day_start(current_time: datetime, settings: Settings) -> datetime:
    business_now = current_time.astimezone(settings.business_timezone)
    return business_now.replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    ).astimezone(timezone.utc)


def _build_client_name(client: ClientRecord) -> str:
    if client.personal_name:
        return client.personal_name

    return client.email


def _build_greeting_name(client: ClientRecord) -> str:
    display_name = _build_client_name(client).strip()
    if not display_name:
        return "cliente"

    local_part = display_name.split("@", 1)[0].strip() if "@" in display_name else display_name
    first_token = next((token for token in local_part.split() if token), "")
    return first_token or "cliente"


def normalize_profile_value(
    value: Optional[str],
    *,
    field_label: str,
    required: bool = False,
) -> Optional[str]:
    if value is None:
        if required:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{field_label} is required.",
            )
        return None

    normalized_value = value.strip()

    if not normalized_value:
        if required:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{field_label} is required.",
            )
        return None

    return normalized_value


def is_client_profile_complete(client: ClientRecord) -> bool:
    return bool(client.email.strip())


def validate_non_negative_int(
    value: Optional[int],
    *,
    field_label: str,
) -> Optional[int]:
    if value is None:
        return None

    if value < 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{field_label} must be greater than or equal to zero.",
        )

    return value


def build_client_email_brand(metadata: Optional[dict[str, object]]) -> Optional[ClientEmailBrand]:
    if not isinstance(metadata, dict):
        return None

    raw_brand = metadata.get("email_brand")
    if not isinstance(raw_brand, dict):
        return None

    brand = ClientEmailBrand.model_validate(raw_brand)
    return brand if brand.has_any_value() else None


def merge_client_email_brand_metadata(
    *,
    metadata: Optional[dict[str, object]],
    email_brand: Optional[ClientEmailBrand],
) -> dict[str, object]:
    next_metadata: dict[str, object] = dict(metadata or {})
    if email_brand is None or not email_brand.has_any_value():
        next_metadata.pop("email_brand", None)
        return next_metadata

    next_metadata["email_brand"] = email_brand.model_dump(exclude_none=True)
    return next_metadata


def build_client_brand_logo_filename(client_id: str) -> str:
    client_hash = sha256(client_id.encode("utf-8")).hexdigest()[:24]
    return f"client-brand-{client_hash}.webp"


def validate_client_brand_logo_upload(
    *,
    upload_filename: Optional[str],
    upload_bytes: bytes,
) -> None:
    if not upload_filename or not upload_filename.strip().lower().endswith(".webp"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Brand logo upload accepts only .webp files.",
        )

    if not upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Brand logo upload is empty.",
        )

    if len(upload_bytes) > CLIENT_BRAND_LOGO_MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Brand logo upload exceeds the 500 KB limit.",
        )

    if len(upload_bytes) < 12:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Brand logo upload is not a valid WebP file.",
        )

    if upload_bytes[:4] != b"RIFF" or upload_bytes[8:12] != b"WEBP":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Brand logo upload is not a valid WebP file.",
        )


def build_client_schema(
    client: ClientRecord,
    *,
    access: Optional[ClientAccessRecord] = None,
) -> Client:
    access_summary = build_client_access_summary(access)
    email_brand = build_client_email_brand(client.metadata)
    return Client(
        id=client.id,
        email=client.email,
        personal_name=client.personal_name,
        name=_build_client_name(client),
        status=client.status,
        email_limit_per_campaign=client.email_limit_per_campaign,
        max_campaigns=client.max_campaigns,
        monthly_email_limit=client.monthly_email_limit,
        daily_email_limit=client.daily_email_limit,
        email_brand=email_brand,
        created_at=client.created_at,
        updated_at=client.updated_at,
        access=access_summary,
    )


def build_client_access_summary(
    access: Optional[ClientAccessRecord],
) -> Optional[ClientAccessSummary]:
    if access is None:
        return None

    payload = access.model_dump()
    should_expose_portal_slug = (
        access.status == "active" and (access.invitation_status or "pending") == "accepted"
    )
    payload["portal_slug"] = access.portal_slug if should_expose_portal_slug else None
    return ClientAccessSummary.model_validate(payload)


def build_admin_email_limit_row(
    client: ClientRecord,
    *,
    access: Optional[ClientAccessRecord] = None,
) -> AdminEmailLimitRow:
    return AdminEmailLimitRow(
        client_id=client.id,
        client_name=_build_client_name(client),
        client_email=client.email,
        client_status=client.status,
        access_status=access.status if access else None,
        invitation_status=access.invitation_status if access else None,
        email_limit_per_campaign=client.email_limit_per_campaign,
        max_campaigns=client.max_campaigns,
        updated_at=client.updated_at,
    )


def has_any_email_limit_configured(client: ClientRecord) -> bool:
    return (
        client.email_limit_per_campaign is not None
        or client.max_campaigns is not None
    )


@dataclass(frozen=True)
class ClerkAccessLinkResult:
    reference_id: str
    url: str | None
    kind: str


class ClerkAccessGateway:
    def create_invitation(
        self,
        *,
        email: str,
        redirect_url: str,
        public_metadata: Optional[dict[str, object]] = None,
    ) -> ClerkAccessLinkResult:
        raise NotImplementedError

    def create_sign_in_token(
        self,
        *,
        clerk_user_id: str,
    ) -> ClerkAccessLinkResult:
        raise NotImplementedError


class HttpClerkAccessGateway(ClerkAccessGateway):
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def create_invitation(
        self,
        *,
        email: str,
        redirect_url: str,
        public_metadata: Optional[dict[str, object]] = None,
    ) -> ClerkAccessLinkResult:
        payload: dict[str, object] = {
            "email_address": email,
            "redirect_url": redirect_url,
            "notify": True,
            "ignore_existing": True,
        }
        if public_metadata:
            payload["public_metadata"] = public_metadata

        payload = self._post(
            "/invitations",
            payload,
        )

        invitation_id = str(payload.get("id") or "").strip()
        if not invitation_id:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=build_client_access_error_detail(CLIENT_ACCESS_CLERK_EMAIL_FAILED),
            )

        return ClerkAccessLinkResult(
            reference_id=invitation_id,
            url=None,
            kind="invitation",
        )

    def create_sign_in_token(
        self,
        *,
        clerk_user_id: str,
    ) -> ClerkAccessLinkResult:
        payload = self._post(
            "/sign_in_tokens",
            {
                "user_id": clerk_user_id,
                "expires_in_seconds": CLIENT_ACCESS_LINK_EXPIRATION_SECONDS,
            },
        )

        token_url = str(payload.get("url") or "").strip()
        token_id = str(payload.get("id") or "").strip()
        if not token_url or not token_id:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=build_client_access_error_detail(CLIENT_ACCESS_CLERK_LINK_FAILED),
            )

        return ClerkAccessLinkResult(
            reference_id=token_id,
            url=token_url,
            kind="sign_in_token",
        )

    def _post(
        self,
        path: str,
        payload: dict[str, object],
    ) -> dict[str, object]:
        if not self._settings.clerk_secret_key.strip():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=build_client_access_error_detail(CLIENT_ACCESS_CLERK_CONFIG_MISSING),
            )

        try:
            response = httpx.post(
                f"{self._settings.clerk_api_base_url.rstrip('/')}{path}",
                headers={
                    "Authorization": f"Bearer {self._settings.clerk_secret_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=10.0,
            )
        except httpx.RequestError as error:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=build_client_access_error_detail(CLIENT_ACCESS_CLERK_EMAIL_FAILED),
            ) from error

        if response.status_code in {401, 403}:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=build_client_access_error_detail(CLIENT_ACCESS_CLERK_EMAIL_FAILED),
            )

        if response.status_code >= 400:
            try:
                error_payload = response.json()
            except ValueError:
                error_payload = None

            first_error = None
            if isinstance(error_payload, dict):
                errors = error_payload.get("errors")
                if isinstance(errors, list) and errors:
                    first_error = errors[0]

            detail = None
            if isinstance(first_error, dict):
                detail = first_error.get("long_message") or first_error.get("message")

            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=build_client_access_error_detail(CLIENT_ACCESS_EMAIL_INVALID)
                if _is_invalid_email_error(detail)
                else build_client_access_error_detail(CLIENT_ACCESS_CLERK_EMAIL_FAILED),
            )

        payload = response.json()
        if not isinstance(payload, dict):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=build_client_access_error_detail(CLIENT_ACCESS_CLERK_EMAIL_FAILED),
            )

        return payload


@dataclass(frozen=True)
class ProvisionClientAccessResult:
    client: ClientRecord
    access_link_kind: str


class ClientsService:
    def __init__(
        self,
        repository: ClientRepository,
        settings: Optional[Settings] = None,
        client_access_repository: ClientAccessRepository | None = None,
        clerk_access_gateway: ClerkAccessGateway | None = None,
        client_access_email_service: ClientAccessEmailService | None = None,
        campaign_repository: CampaignRepository | None = None,
        campaign_slot_repository: CampaignSlotRepository | None = None,
        contact_repository: ContactRepository | None = None,
        suppression_list_repository: SuppressionListRepository | None = None,
        blocked_send_repository: BlockedSendRepository | None = None,
        email_log_repository: EmailLogRepository | None = None,
        provider_event_repository: ProviderEventRepository | None = None,
    ) -> None:
        self._repository = repository
        self._settings = settings or get_settings()
        self._client_access_repository = client_access_repository
        self._clerk_access_gateway = clerk_access_gateway
        self._client_access_email_service = client_access_email_service
        self._campaign_repository = campaign_repository
        self._campaign_slot_repository = campaign_slot_repository
        self._contact_repository = contact_repository
        self._suppression_list_repository = suppression_list_repository
        self._blocked_send_repository = blocked_send_repository
        self._email_log_repository = email_log_repository
        self._provider_event_repository = provider_event_repository

    def list_clients(self) -> list[ClientRecord]:
        return self._repository.list_clients()

    def get_client_by_id(self, client_id: str) -> ClientRecord:
        client = self._repository.get_by_id(client_id)

        if client is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client not found.",
            )

        return client

    def get_client_by_email(self, email: str) -> Optional[ClientRecord]:
        return self._repository.get_by_email(email)

    def upsert_client_profile(
        self,
        *,
        email: str,
        personal_name: Optional[str],
    ) -> ClientRecord:
        existing = self._repository.get_by_email(email)

        if existing is None:
            return self._repository.create_client(
                email=email,
                personal_name=personal_name,
                status="active",
                metadata={},
            )

        return self._repository.update_client(
            client_id=existing.id,
            email=email,
            personal_name=personal_name,
            status=existing.status,
            email_limit_per_campaign=existing.email_limit_per_campaign,
            max_campaigns=existing.max_campaigns,
            monthly_email_limit=existing.monthly_email_limit,
            daily_email_limit=existing.daily_email_limit,
            metadata=existing.metadata,
        )

    def provision_client_access(
        self,
        *,
        email: str,
        first_name: Optional[str],
        last_name: Optional[str],
    ) -> ProvisionClientAccessResult:
        normalized_email = self._normalize_email(email)
        personal_name = self._build_personal_name(first_name=first_name, last_name=last_name)
        client = self.upsert_client_profile(
            email=normalized_email,
            personal_name=personal_name,
        )
        access_repository = self._require_client_access_repository()
        existing_access = access_repository.get_by_client_id(client.id)
        conflicting_access = access_repository.get_by_email(normalized_email)

        if (
            conflicting_access is not None
            and conflicting_access.client_id != client.id
            and conflicting_access.status in {"active", "invited"}
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=build_client_access_error_detail(
                    CLIENT_ACCESS_EXISTING_USER_CONFLICT
                ),
            )

        portal_slug = self._resolve_portal_slug(existing_access=existing_access)
        link_result = self._build_client_access_link(
            existing_access=existing_access,
            email=normalized_email,
            personal_name=client.personal_name,
            first_name=first_name,
            last_name=last_name,
        )

        if link_result.kind == "invitation":
            access = access_repository.upsert_invited_access(
                client_id=client.id,
                email=normalized_email,
                clerk_invitation_id=link_result.reference_id,
                portal_slug=portal_slug,
                invited_at=datetime.now(timezone.utc),
            )
            if access.status != "active":
                access_repository.update_access(
                    access_id=access.id,
                    status="active",
                    invitation_status="pending",
                    accepted_at=None,
                )
        elif existing_access is not None and existing_access.status != "active":
            access_repository.update_access(
                access_id=existing_access.id,
                status="active",
                invitation_status="accepted",
                accepted_at=existing_access.accepted_at or datetime.now(timezone.utc),
            )

        return ProvisionClientAccessResult(
            client=client,
            access_link_kind=link_result.kind,
        )

    def _normalize_email(self, email: str) -> str:
        normalized_email = email.strip().lower()
        if not normalized_email:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=build_client_access_error_detail(CLIENT_ACCESS_EMAIL_INVALID),
            )
        if "@" not in normalized_email or "." not in normalized_email.rsplit("@", 1)[-1]:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=build_client_access_error_detail(CLIENT_ACCESS_EMAIL_INVALID),
            )
        return normalized_email

    def _build_personal_name(
        self,
        *,
        first_name: Optional[str],
        last_name: Optional[str],
    ) -> Optional[str]:
        first = normalize_profile_value(first_name, field_label="first_name")
        last = normalize_profile_value(last_name, field_label="last_name")
        combined = " ".join(part for part in (first, last) if part)
        return combined or None

    def _build_client_access_link(
        self,
        *,
        existing_access: Optional[ClientAccessRecord],
        email: str,
        personal_name: Optional[str],
        first_name: Optional[str],
        last_name: Optional[str],
    ) -> ClerkAccessLinkResult:
        gateway = self._require_clerk_access_gateway()
        if (
            existing_access is not None
            and existing_access.clerk_user_id
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=build_client_access_error_detail(
                    CLIENT_ACCESS_EXISTING_USER_RESEND_UNSUPPORTED
                ),
            )

        return gateway.create_invitation(
            email=email,
            redirect_url=self._build_invitation_redirect_url(),
            public_metadata=self._build_invitation_public_metadata(
                personal_name=personal_name,
                first_name=first_name,
                last_name=last_name,
            ),
        )

    def _build_invitation_public_metadata(
        self,
        *,
        personal_name: Optional[str],
        first_name: Optional[str],
        last_name: Optional[str],
    ) -> Optional[dict[str, object]]:
        resolved_first_name = normalize_profile_value(
            first_name,
            field_label="first_name",
        )
        resolved_last_name = normalize_profile_value(
            last_name,
            field_label="last_name",
        )

        if resolved_first_name is None and resolved_last_name is None:
            resolved_first_name, resolved_last_name = self._split_personal_name(
                personal_name
            )

        metadata: dict[str, object] = {}
        if resolved_first_name is not None:
            metadata["sendwise_first_name"] = resolved_first_name
        if resolved_last_name is not None:
            metadata["sendwise_last_name"] = resolved_last_name

        return metadata or None

    def _split_personal_name(
        self,
        personal_name: Optional[str],
    ) -> tuple[Optional[str], Optional[str]]:
        normalized_personal_name = normalize_profile_value(
            personal_name,
            field_label="personal_name",
        )
        if normalized_personal_name is None:
            return None, None

        parts = normalized_personal_name.split()
        if len(parts) == 1:
            return parts[0], None

        return parts[0], " ".join(parts[1:])

    def _build_invitation_redirect_url(self) -> str:
        redirect_url = self._settings.frontend_auth_redirect_url

        if not redirect_url:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="FRONTEND_URL must be an absolute URL for client invitations.",
            )

        return redirect_url

    def _resolve_portal_slug(
        self,
        *,
        existing_access: Optional[ClientAccessRecord],
    ) -> str:
        if existing_access is not None:
            portal_slug = existing_access.portal_slug.strip()
            if portal_slug and len(portal_slug) >= PORTAL_SLUG_LENGTH and portal_slug.isalnum():
                return portal_slug
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Existing client access has an invalid portal slug.",
            )

        access_repository = self._require_client_access_repository()
        for _ in range(10):
            portal_slug = "".join(
                secrets.choice(PORTAL_SLUG_ALPHABET) for _ in range(PORTAL_SLUG_LENGTH)
            )
            if access_repository.get_by_portal_slug(portal_slug) is None:
                return portal_slug

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to allocate a unique portal slug.",
        )

    def _require_client_access_repository(self) -> ClientAccessRepository:
        if self._client_access_repository is None:
            raise RuntimeError("Client access repository is not configured.")
        return self._client_access_repository

    def _require_clerk_access_gateway(self) -> ClerkAccessGateway:
        if self._clerk_access_gateway is None:
            raise RuntimeError("Clerk access gateway is not configured.")
        return self._clerk_access_gateway

    def update_client(
        self,
        *,
        client_id: str,
        email: str,
        personal_name: Optional[str],
        status: Optional[str] = None,
        email_limit_per_campaign: Optional[int] = None,
        max_campaigns: Optional[int] = None,
        monthly_email_limit: Optional[int] = None,
        daily_email_limit: Optional[int] = None,
        email_brand: Optional[ClientEmailBrand] = None,
    ) -> ClientRecord:
        existing = self.get_client_by_id(client_id)
        return self._repository.update_client(
            client_id=client_id,
            email=email,
            personal_name=normalize_profile_value(
                personal_name,
                field_label="personal_name",
            ),
            status=status,
            email_limit_per_campaign=validate_non_negative_int(
                email_limit_per_campaign,
                field_label="email_limit_per_campaign",
            ),
            max_campaigns=validate_non_negative_int(
                max_campaigns,
                field_label="max_campaigns",
            ),
            monthly_email_limit=validate_non_negative_int(
                monthly_email_limit,
                field_label="monthly_email_limit",
            ),
            daily_email_limit=validate_non_negative_int(
                daily_email_limit,
                field_label="daily_email_limit",
            ),
            metadata=merge_client_email_brand_metadata(
                metadata=existing.metadata,
                email_brand=email_brand,
            ),
        )

    def upload_client_email_brand_logo(
        self,
        *,
        client_id: str,
        upload_filename: Optional[str],
        upload_bytes: bytes,
    ) -> ClientRecord:
        existing = self.get_client_by_id(client_id)
        validate_client_brand_logo_upload(
            upload_filename=upload_filename,
            upload_bytes=upload_bytes,
        )

        CLIENT_BRAND_LOGO_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        generated_filename = build_client_brand_logo_filename(client_id)
        upload_path = CLIENT_BRAND_LOGO_UPLOAD_DIR / generated_filename
        temp_path = CLIENT_BRAND_LOGO_UPLOAD_DIR / f".{generated_filename}.tmp"
        temp_path.write_bytes(upload_bytes)
        temp_path.replace(upload_path)

        email_brand = build_client_email_brand(existing.metadata) or ClientEmailBrand()
        next_email_brand = email_brand.model_copy(
            update={
                "logo_url": (
                    f"{CLIENT_BRAND_LOGO_PUBLIC_PREFIX}/{generated_filename}"
                )
            }
        )
        return self._repository.update_client(
            client_id=existing.id,
            email=existing.email,
            personal_name=existing.personal_name,
            status=existing.status,
            email_limit_per_campaign=existing.email_limit_per_campaign,
            max_campaigns=existing.max_campaigns,
            monthly_email_limit=existing.monthly_email_limit,
            daily_email_limit=existing.daily_email_limit,
            metadata=merge_client_email_brand_metadata(
                metadata=existing.metadata,
                email_brand=next_email_brand,
            ),
        )

    def complete_onboarding_profile(
        self,
        *,
        client_id: str,
        personal_name: str,
    ) -> ClientRecord:
        existing = self.get_client_by_id(client_id)
        normalized_personal_name = normalize_profile_value(
            personal_name,
            field_label="personal_name",
            required=True,
        )

        return self.update_client(
            client_id=existing.id,
            email=existing.email,
            personal_name=normalized_personal_name,
            status=existing.status,
            email_limit_per_campaign=existing.email_limit_per_campaign,
            max_campaigns=existing.max_campaigns,
            monthly_email_limit=existing.monthly_email_limit,
            daily_email_limit=existing.daily_email_limit,
            email_brand=build_client_email_brand(existing.metadata),
        )

    def archive_client(self, client_id: str) -> ClientRecord:
        existing = self.get_client_by_id(client_id)
        return self.update_client(
            client_id=existing.id,
            email=existing.email,
            personal_name=existing.personal_name,
            status="archived",
            email_limit_per_campaign=existing.email_limit_per_campaign,
            max_campaigns=existing.max_campaigns,
            monthly_email_limit=existing.monthly_email_limit,
            daily_email_limit=existing.daily_email_limit,
            email_brand=build_client_email_brand(existing.metadata),
        )

    def get_client_context(
        self,
        *,
        client_id: str,
        portal_slug: str,
        client_access_service,
    ) -> ClientContext:
        client, access = self._require_active_client_access(
            client_id=client_id,
            portal_slug=portal_slug,
            client_access_service=client_access_service,
        )
        return ClientContext(
            client=build_client_schema(client, access=access),
            user=ClientUser(
                id=access.id,
                client_id=client.id,
                email=access.email,
                portal_slug=access.portal_slug,
                status=access.status,
                created_at=access.created_at,
                updated_at=access.updated_at,
            ),
        )

    def get_client_overview(
        self,
        *,
        client_id: str,
        portal_slug: str,
        client_access_service,
        now: Optional[datetime] = None,
    ) -> ClientOverviewSummary:
        client, access = self._require_active_client_access(
            client_id=client_id,
            portal_slug=portal_slug,
            client_access_service=client_access_service,
        )
        current_time = now or datetime.now(timezone.utc)
        current_period_started_at = _get_business_period_start(
            current_time,
            self._settings,
        )
        campaigns = self._repository.list_client_campaigns(client_id)
        usage = self._repository.list_client_usage(client_id)
        blocked_sends = self._repository.list_client_blocked_sends(client_id)

        status_counts = ClientCampaignStatusCounts()
        running_campaigns = 0

        for campaign in campaigns:
            if campaign.status in status_counts.model_fields:
                setattr(
                    status_counts,
                    campaign.status,
                    getattr(status_counts, campaign.status) + 1,
                )

            if campaign.status in RUNNING_CAMPAIGN_STATUSES:
                running_campaigns += 1

        usage_totals: dict[str, int] = {}
        for entry in usage:
            if entry.created_at < current_period_started_at:
                continue

            usage_totals[entry.usage_type] = usage_totals.get(entry.usage_type, 0) + entry.quantity

        client_dashboard = self._build_client_dashboard_summary(
            client=client,
            portal_slug=access.portal_slug,
            campaigns=campaigns,
            status_counts=status_counts,
            now=current_time,
        )

        return ClientOverviewSummary(
            client=ClientOverviewIdentity(
                id=client.id,
                name=_build_client_name(client),
                email=client.email,
                portal_slug=access.portal_slug,
                client_status=client.status,
                access_status=access.status,
                invitation_status=access.invitation_status,
            ),
            campaigns=ClientOverviewCampaigns(
                total_campaigns=len(campaigns),
                active_campaigns=running_campaigns,
                running_campaigns=running_campaigns,
                status_counts=status_counts,
                recent_campaigns=[
                    self._build_client_campaign(campaign)
                    for campaign in campaigns[:RECENT_CAMPAIGNS_LIMIT]
                ],
            ),
            usage=ClientOverviewUsage(
                has_data=bool(usage),
                total_records=len(usage),
                current_period_started_at=current_period_started_at,
                current_period_totals=[
                    ClientUsageSummaryItem(
                        usage_type=usage_type,
                        total_quantity=usage_totals[usage_type],
                    )
                    for usage_type in sorted(usage_totals)
                ],
                recent_usage=[
                    self._build_client_usage(entry)
                    for entry in usage[:RECENT_USAGE_LIMIT]
                ],
            ),
            blocked_sends=ClientOverviewBlockedSends(
                current_period_started_at=current_period_started_at,
                current_period_count=sum(
                    1
                    for blocked_send in blocked_sends
                    if blocked_send.created_at >= current_period_started_at
                ),
                recent_blocked_sends=[
                    self._build_client_blocked_send(blocked_send)
                    for blocked_send in blocked_sends[:RECENT_BLOCKED_SENDS_LIMIT]
                ],
            ),
            limits=ClientOverviewLimits(
                email_limit_per_campaign=client.email_limit_per_campaign,
                max_campaigns=client.max_campaigns,
            ),
            client_dashboard=client_dashboard,
        )

    def _build_client_dashboard_summary(
        self,
        *,
        client: ClientRecord,
        portal_slug: str,
        campaigns: list[ClientCampaignRecord],
        status_counts: ClientCampaignStatusCounts,
        now: datetime,
    ) -> ClientDashboardSummary:
        performance_windows = self._build_client_dashboard_windows(
            client_id=client.id,
            now=now,
        )
        default_window = performance_windows[CLIENT_DASHBOARD_DEFAULT_WINDOW]
        campaigns_to_complete = status_counts.draft + status_counts.paused
        blocked_campaigns = status_counts.blocked + status_counts.failed
        blocked_sends_to_review = (
            self._blocked_send_repository.count_by_client(
                client_id=client.id,
                started_at=now - timedelta(days=7),
                ended_at=now,
            )
            if self._blocked_send_repository is not None
            else 0
        )
        action_items: list[ClientDashboardActionItem] = []

        if campaigns_to_complete > 0:
            action_items.append(
                ClientDashboardActionItem(
                    label="Campagne da completare",
                    count=campaigns_to_complete,
                    severity="warning",
                )
            )

        if blocked_sends_to_review > 0:
            action_items.append(
                ClientDashboardActionItem(
                    label="Blocchi da verificare",
                    count=blocked_sends_to_review,
                    severity="danger",
                )
            )

        has_period_usage = (
            (default_window.sent_available and (default_window.sent or 0) > 0)
            or (default_window.failed_available and (default_window.failed or 0) > 0)
            or (
                default_window.delivered_available
                and (default_window.delivered or 0) > 0
            )
            or (default_window.opened_available and (default_window.opened or 0) > 0)
            or (default_window.clicked_available and (default_window.clicked or 0) > 0)
        )

        return ClientDashboardSummary(
            greeting_name=_build_greeting_name(client),
            cta=ClientDashboardCta(campaigns_href=f"/c/{portal_slug}/campaigns"),
            kpis=ClientDashboardKpis(
                active_campaigns=ClientDashboardKpiValue(
                    value=status_counts.running,
                    limit=client.max_campaigns,
                    available=True,
                ),
                sent_last_7d=ClientDashboardKpiValue(
                    value=performance_windows["7d"].sent,
                    available=performance_windows["7d"].sent_available,
                ),
                delivered_last_7d=ClientDashboardKpiValue(
                    value=performance_windows["7d"].delivered,
                    available=performance_windows["7d"].delivered_available,
                ),
                opened_last_7d=ClientDashboardKpiValue(
                    value=performance_windows["7d"].opened,
                    available=performance_windows["7d"].opened_available,
                ),
                clicked_last_7d=ClientDashboardKpiValue(
                    value=performance_windows["7d"].clicked,
                    available=performance_windows["7d"].clicked_available,
                ),
            ),
            performance_analytics=ClientDashboardPerformanceAnalytics(
                default_window=CLIENT_DASHBOARD_DEFAULT_WINDOW,
                windows=performance_windows,
            ),
            actions_required=ClientDashboardActionsRequired(
                campaigns_to_complete=campaigns_to_complete,
                blocked_sends_to_review=blocked_sends_to_review,
                provider_events_issues=None,
                items=action_items,
            ),
            status_summary=ClientDashboardStatusSummary(
                total_campaigns=len(campaigns),
                running=status_counts.running,
                ready=status_counts.ready,
                to_complete=campaigns_to_complete,
                blocked=blocked_campaigns,
                completed=status_counts.completed,
            ),
            period_usage=ClientDashboardPeriodUsage(
                has_real_usage=has_period_usage,
                sent=default_window.sent if default_window.sent_available else None,
                failed=default_window.failed if default_window.failed_available else None,
                delivered=(
                    default_window.delivered
                    if default_window.delivered_available
                    else None
                ),
                opened=default_window.opened if default_window.opened_available else None,
                clicked=default_window.clicked if default_window.clicked_available else None,
            ),
        )

    def _build_client_dashboard_windows(
        self,
        *,
        client_id: str,
        now: datetime,
    ) -> dict[ClientDashboardWindowKey, ClientDashboardWindowMetrics]:
        windows: dict[ClientDashboardWindowKey, ClientDashboardWindowMetrics] = {}

        email_log_repository = self._email_log_repository
        provider_event_repository = self._provider_event_repository

        for window_key, delta in CLIENT_DASHBOARD_WINDOW_DELTAS:
            started_at = now - delta if delta is not None else None
            sent_available = email_log_repository is not None
            failed_available = email_log_repository is not None
            delivered_available = False
            opened_available = False
            clicked_available = False
            delivered_value: int | None = None
            opened_value: int | None = None
            clicked_value: int | None = None

            if provider_event_repository is not None:
                provider_events_available = provider_event_repository.count_client_events(
                    client_id=client_id,
                    event_types=PROVIDER_EVENT_METRIC_TYPES,
                    started_at=started_at,
                    ended_at=now,
                ) > 0
                delivered_available = provider_events_available
                opened_available = provider_events_available
                clicked_available = provider_events_available
                if provider_events_available:
                    delivered_value = provider_event_repository.count_client_events(
                        client_id=client_id,
                        event_types=("ses_delivery",),
                        started_at=started_at,
                        ended_at=now,
                    )
                    clicked_value = provider_event_repository.count_client_events(
                        client_id=client_id,
                        event_types=("ses_click",),
                        started_at=started_at,
                        ended_at=now,
                    )
                if provider_events_available:
                    opened_value = provider_event_repository.count_client_events(
                        client_id=client_id,
                        event_types=("ses_open",),
                        started_at=started_at,
                        ended_at=now,
                    )

            windows[window_key] = ClientDashboardWindowMetrics(
                sent=(
                    email_log_repository.count_client_real_logs(
                        client_id=client_id,
                        started_at=started_at,
                        ended_at=now,
                        statuses=ACCEPTED_EMAIL_LOG_STATUSES,
                    )
                    if email_log_repository is not None
                    else None
                ),
                failed=(
                    email_log_repository.count_client_real_logs(
                        client_id=client_id,
                        started_at=started_at,
                        ended_at=now,
                        statuses=("failed",),
                    )
                    if email_log_repository is not None
                    else None
                ),
                delivered=delivered_value,
                opened=opened_value,
                clicked=clicked_value,
                sent_available=sent_available,
                failed_available=failed_available,
                delivered_available=delivered_available,
                opened_available=opened_available,
                clicked_available=clicked_available,
                window_started_at=started_at,
                window_ended_at=now,
            )

        return windows

    def list_client_campaigns(
        self,
        *,
        client_id: str,
        portal_slug: str,
        client_access_service,
    ) -> list[Campaign]:
        self._require_active_client_access(
            client_id=client_id,
            portal_slug=portal_slug,
            client_access_service=client_access_service,
        )
        return [
            self._build_client_campaign(campaign)
            for campaign in self._repository.list_client_campaigns(client_id)
        ]

    def get_client_campaign_detail(
        self,
        *,
        client_id: str,
        portal_slug: str,
        campaign_id: str,
        client_access_service,
    ) -> ClientCampaignDetailResponse:
        self._require_active_client_access(
            client_id=client_id,
            portal_slug=portal_slug,
            client_access_service=client_access_service,
        )
        return self._build_client_campaign_read_model(
            client_id=client_id,
            campaign_id=campaign_id,
        )

    def get_client_campaign_stats(
        self,
        *,
        client_id: str,
        portal_slug: str,
        campaign_id: str,
        client_access_service,
    ) -> ClientCampaignStatsResponse:
        self._require_active_client_access(
            client_id=client_id,
            portal_slug=portal_slug,
            client_access_service=client_access_service,
        )
        detail = self._build_client_campaign_read_model(
            client_id=client_id,
            campaign_id=campaign_id,
        )
        return ClientCampaignStatsResponse(
            campaign_id=detail.campaign.id,
            client_id=detail.campaign.client_id,
            recipients=detail.recipients,
            logs=detail.logs,
            blocked_sends=detail.blocked_sends,
        )

    def list_client_usage(
        self,
        *,
        client_id: str,
        portal_slug: str,
        client_access_service,
    ) -> list[ApiUsage]:
        self._require_active_client_access(
            client_id=client_id,
            portal_slug=portal_slug,
            client_access_service=client_access_service,
        )
        return [
            self._build_client_usage(entry)
            for entry in self._repository.list_client_usage(client_id)
        ]

    def list_client_blocked_sends(
        self,
        *,
        client_id: str,
        portal_slug: str,
        client_access_service,
    ) -> list[BlockedSend]:
        self._require_active_client_access(
            client_id=client_id,
            portal_slug=portal_slug,
            client_access_service=client_access_service,
        )
        return [
            self._build_client_blocked_send(blocked_send)
            for blocked_send in self._repository.list_client_blocked_sends(client_id)
        ]

    def list_admin_campaigns(self) -> list[AdminCampaignSummary]:
        return [
            AdminCampaignSummary(
                id=campaign.id,
                client_id=campaign.client_id,
                client_name=campaign.client_name,
                client_email=campaign.client_email,
                name=campaign.name,
                status=campaign.status,
                subject=campaign.subject,
                created_at=campaign.created_at,
                updated_at=campaign.updated_at,
                blocked_sends_count=campaign.blocked_sends_count,
            )
            for campaign in self._repository.list_admin_campaigns()
        ]

    def get_admin_overview(
        self,
        *,
        client_access_service,
        now: Optional[datetime] = None,
    ) -> AdminOverviewSummary:
        current_time = now or datetime.now(timezone.utc)
        clients = self.list_clients()
        campaigns = self._repository.list_admin_campaigns()
        campaign_email_volumes = self._repository.list_admin_campaign_email_volumes()

        client_status_counts = AdminClientStatusCounts()
        for client in clients:
            if client.status in client_status_counts.model_fields:
                setattr(
                    client_status_counts,
                    client.status,
                    getattr(client_status_counts, client.status) + 1,
                )

        campaign_status_counts = AdminCampaignStatusCounts()
        running_campaigns = 0
        for campaign in campaigns:
            if campaign.status in ACTIVE_CAMPAIGN_STATUSES:
                campaign_status_counts.active += 1
                if campaign.status in RUNNING_CAMPAIGN_STATUSES:
                    running_campaigns += 1
                continue

            if campaign.status == CampaignStatus.paused.value:
                campaign_status_counts.paused += 1
                continue

            if campaign.status == CampaignStatus.blocked.value:
                campaign_status_counts.blocked += 1
                continue

            if campaign.status == CampaignStatus.draft.value:
                campaign_status_counts.draft += 1
                continue

            if campaign.status == CampaignStatus.completed.value:
                campaign_status_counts.completed += 1
                continue

            if campaign.status == CampaignStatus.failed.value:
                campaign_status_counts.failed += 1

        recent_campaigns = [
            self._build_recent_campaign_summary(campaign)
            for campaign in campaigns[:RECENT_ADMIN_CAMPAIGNS_LIMIT]
        ]
        recent_critical_events = [
            self._build_recent_critical_event(blocked_send)
            for blocked_send in self._repository.list_recent_admin_blocked_sends(
                limit=RECENT_ADMIN_BLOCKED_SENDS_LIMIT,
            )
        ]
        start_of_day = _get_business_day_start(current_time, self._settings)
        start_of_month = _get_business_period_start(current_time, self._settings)
        configured_limits_count = sum(
            1 for client in clients if has_any_email_limit_configured(client)
        )
        client_access_by_client_id = {
            client.id: client_access_service.get_access_by_client_id(client.id)
            for client in clients
        }

        return AdminOverviewSummary(
            clients=AdminOverviewClientsSummary(
                total_clients=len(clients),
                active_clients=sum(1 for client in clients if client.status == "active"),
                invited_or_pending_clients=sum(
                    1
                    for access in client_access_by_client_id.values()
                    if access
                    and (
                        access.status == "invited"
                        or (access.invitation_status or "pending") == "pending"
                    )
                ),
                archived_or_blocked_clients=sum(
                    1
                    for client in clients
                    if client.status in {"archived", "blocked"}
                ),
                status_counts=client_status_counts,
            ),
            campaigns=AdminOverviewCampaignsSummary(
                total_campaigns=len(campaigns),
                running_campaigns=running_campaigns,
                paused_campaigns=campaign_status_counts.paused,
                blocked_campaigns=campaign_status_counts.blocked,
                status_counts=campaign_status_counts,
                recent_campaigns=recent_campaigns,
            ),
            sending=AdminOverviewSendingSummary(
                emails_sent_today=self._repository.count_admin_email_logs_since(
                    start_of_day
                ),
                emails_sent_this_month=self._repository.count_admin_email_logs_since(
                    start_of_month
                ),
                top_clients_by_volume=[
                    self._build_top_client_volume(record)
                    for record in self._repository.list_admin_top_sending_clients_since(
                        started_at=start_of_month,
                        limit=TOP_CLIENTS_LIMIT,
                    )
                ],
            ),
            blocks=AdminOverviewBlocksSummary(
                blocked_sends_today=self._repository.count_admin_blocked_sends_since(
                    start_of_day
                ),
                recent_critical_events=recent_critical_events,
            ),
            limits=AdminOverviewLimitsSummary(
                clients_near_limit=self._build_clients_near_limit(
                    clients=clients,
                    campaigns=campaigns,
                    campaign_email_volumes=campaign_email_volumes,
                ),
                configured_limits_count=configured_limits_count,
                unconfigured_limits_count=max(len(clients) - configured_limits_count, 0),
            ),
            system=self.get_admin_system_status(now=current_time),
        )

    def get_admin_email_limits(
        self,
        *,
        client_access_service,
    ) -> AdminEmailLimitsResponse:
        clients = self.list_clients()
        rows = [
            build_admin_email_limit_row(
                client,
                access=client_access_service.get_access_by_client_id(client.id),
            )
            for client in clients
        ]
        configured_clients = sum(
            1 for client in clients if has_any_email_limit_configured(client)
        )
        return AdminEmailLimitsResponse(
            summary=AdminEmailLimitsSummary(
                total_clients=len(rows),
                configured_clients=configured_clients,
                unconfigured_clients=max(len(rows) - configured_clients, 0),
            ),
            rows=rows,
        )

    def get_admin_blocked_sends(
        self,
        *,
        limit: Optional[int] = None,
    ) -> list[AdminBlockedSendItem]:
        return [
            AdminBlockedSendItem(
                id=blocked_send.id,
                client_id=blocked_send.client_id,
                client_name=blocked_send.client_name,
                client_email=blocked_send.client_email,
                campaign_id=blocked_send.campaign_id,
                campaign_name=blocked_send.campaign_name,
                reason=blocked_send.reason,
                decision=blocked_send.decision,
                created_at=blocked_send.created_at,
            )
            for blocked_send in self._repository.list_admin_blocked_sends(limit=limit)
        ]

    def get_admin_system_status(
        self,
        *,
        now: Optional[datetime] = None,
    ) -> AdminSystemStatus:
        current_time = now or datetime.now(timezone.utc)
        auth_provider_configured = bool(
            self._settings.clerk_issuer.strip() and self._settings.clerk_jwks_url.strip()
        )
        runtime = build_provider_runtime_summary(self._settings)
        return AdminSystemStatus(
            api_status="ok",
            db_status="ok" if self._repository.is_database_available() else "degraded",
            email_sending_enabled=self._settings.email_sending_enabled,
            email_provider=runtime.email_provider,
            provider_mode_label=runtime.provider_mode_label,
            real_send_available=runtime.real_send_available,
            ses_live_validation_status=runtime.ses_live_validation_status,
            provider_events_available=runtime.provider_events_available,
            mailpit_dev_mode=runtime.mailpit_dev_mode,
            runtime=runtime,
            environment=self._settings.environment.strip() or "unknown",
            auth_provider_configured=auth_provider_configured,
            clerk_management_api_configured=bool(self._settings.clerk_secret_key.strip()),
            frontend_origin_configured=bool(self._settings.frontend_origin),
            delivery_engine_configured=bool(self._settings.listmonk_url.strip()),
            generated_at=current_time,
        )

    def _require_active_client_access(
        self,
        *,
        client_id: str,
        portal_slug: str,
        client_access_service,
    ):
        client = self.get_client_by_id(client_id)
        access = client_access_service.get_access_by_client_id(client_id)

        if access is None or access.status != "active":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Client access is not available for this Sendwise account.",
            )

        if access.portal_slug != portal_slug:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Authenticated client scope does not match the requested portal.",
            )

        return client, access

    def _build_client_campaign(self, campaign: ClientCampaignRecord) -> Campaign:
        return Campaign(
            id=campaign.id,
            client_id=campaign.client_id,
            name=campaign.name,
            status=campaign.status,
            subject=campaign.subject,
            created_at=campaign.created_at,
            updated_at=campaign.updated_at,
        )

    def _build_client_campaign_read_model(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> ClientCampaignDetailResponse:
        campaign = self._require_client_campaign_record(
            client_id=client_id,
            campaign_id=campaign_id,
        )
        client = self.get_client_by_id(client_id)
        contacts = self._require_contact_repository().list_campaign_contacts(
            client_id=client_id,
            campaign_id=campaign_id,
        )
        suppressed_emails = self._require_suppression_list_repository().list_suppressed_emails_for_campaign(
            client_id=client_id,
            emails=[contact.email for contact in contacts],
        )
        recipients = self._build_campaign_recipients_summary(
            contacts=contacts,
            suppressed_emails=suppressed_emails,
        )
        slot_repository = self._campaign_slot_repository
        slot = None
        if campaign.campaign_slot_id and slot_repository is not None:
            slot = slot_repository.get_by_id(
                client_id=client_id,
                slot_id=campaign.campaign_slot_id,
            )

        logs = self._build_campaign_logs_summary(
            client_id=client_id,
            campaign_id=campaign_id,
        )
        return ClientCampaignDetailResponse(
            campaign=CampaignSummaryItem(
                id=campaign.id,
                client_id=campaign.client_id,
                name=campaign.name,
                status=campaign.status,
                subject=campaign.subject,
                preview_text=campaign.preview_text,
                current_step=campaign.current_step,
                content_ready=campaign.content_ready,
                contacts_ready=campaign.contacts_ready,
                review_ready=campaign.review_ready,
            ),
            slot=CampaignSlotSummary(
                id=campaign.campaign_slot_id,
                label=slot.label if slot is not None else None,
                max_emails=slot.max_emails if slot is not None else client.email_limit_per_campaign,
                status=slot.status if slot is not None else (
                    "legacy" if client.email_limit_per_campaign is not None else None
                ),
                limit_source="campaign_slot" if slot is not None else "legacy_client_limit",
            ),
            recipients=recipients,
            logs=logs,
            runtime=build_provider_runtime_summary(
                self._settings,
                provider_events_available=logs.provider_events_available,
            ),
            blocked_sends=self._build_campaign_blocked_sends_summary(
                client_id=client_id,
                campaign_id=campaign_id,
                campaign_name=campaign.name,
            ),
        )

    def _require_client_campaign_record(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> ClientCampaignRecord:
        if self._campaign_repository is not None:
            campaign = self._campaign_repository.get_by_id(
                campaign_id=campaign_id,
                client_id=client_id,
            )
            if campaign is not None:
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

        for campaign in self._repository.list_client_campaigns(client_id):
            if campaign.id == campaign_id:
                return campaign

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found.",
        )

    def _build_campaign_recipients_summary(
        self,
        *,
        contacts,
        suppressed_emails: set[str],
    ) -> CampaignRecipientsSummary:
        total = len(contacts)
        eligible = 0
        invalid = 0
        suppressed = 0

        for contact in contacts:
            normalized_email = contact.email.strip().lower()
            is_valid = "@" in contact.email and "." in contact.email.rsplit("@", 1)[-1]
            is_suppressed = (
                contact.status.strip().lower() == "suppressed"
                or normalized_email in suppressed_emails
            )

            if not is_valid:
                invalid += 1
            if is_suppressed:
                suppressed += 1
            if is_valid and contact.status.strip().lower() == "sendable" and not is_suppressed:
                eligible += 1

        return CampaignRecipientsSummary(
            total=total,
            eligible=eligible,
            invalid=invalid,
            suppressed=suppressed,
            blocked=max(total - eligible, 0),
        )

    def _build_campaign_logs_summary(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> CampaignLogsSummary:
        status_counts = self._require_email_log_repository().get_campaign_status_counts(
            client_id=client_id,
            campaign_id=campaign_id,
        )
        provider_event_repository = self._require_provider_event_repository()
        event_counts = provider_event_repository.get_campaign_event_counts(
            client_id=client_id,
            campaign_id=campaign_id,
        )
        provider_events_available = provider_event_repository.has_events_for_campaign(
            client_id=client_id,
            campaign_id=campaign_id,
        )
        return CampaignLogsSummary(
            simulated=status_counts.get("simulated", 0),
            queued=status_counts.get("queued", 0),
            sent=_prefer_provider_metric(
                status_counts=status_counts,
                event_counts=event_counts,
                provider_events_available=provider_events_available,
                status_keys=("sent", "dispatched", "delivered"),
                event_types=("ses_send",),
            ),
            failed=status_counts.get("failed", 0),
            delivered=_prefer_provider_metric(
                status_counts=status_counts,
                event_counts=event_counts,
                provider_events_available=provider_events_available,
                status_keys=("delivered",),
                event_types=("ses_delivery",),
                fallback_to_statuses=False,
            ),
            opened=_prefer_provider_metric(
                status_counts=status_counts,
                event_counts=event_counts,
                provider_events_available=provider_events_available,
                status_keys=("opened",),
                event_types=("ses_open",),
                fallback_to_statuses=False,
            ),
            clicked=_prefer_provider_metric(
                status_counts=status_counts,
                event_counts=event_counts,
                provider_events_available=provider_events_available,
                status_keys=("clicked",),
                event_types=("ses_click",),
                fallback_to_statuses=False,
            ),
            bounced=_prefer_provider_metric(
                status_counts=status_counts,
                event_counts=event_counts,
                provider_events_available=provider_events_available,
                status_keys=("bounced",),
                event_types=("ses_bounce",),
                fallback_to_statuses=False,
            ),
            complained=_prefer_provider_metric(
                status_counts=status_counts,
                event_counts=event_counts,
                provider_events_available=provider_events_available,
                status_keys=("complained", "spam"),
                event_types=("ses_complaint",),
                fallback_to_statuses=False,
            ),
            unsubscribed=_prefer_provider_metric(
                status_counts=status_counts,
                event_counts=event_counts,
                provider_events_available=provider_events_available,
                status_keys=("unsubscribed",),
                event_types=("sendwise_unsubscribe",),
                fallback_to_statuses=False,
            ),
            provider_events_available=provider_events_available,
        )

    def _build_campaign_blocked_sends_summary(
        self,
        *,
        client_id: str,
        campaign_id: str,
        campaign_name: str,
    ) -> CampaignBlockedSendsSummary:
        repository = self._require_blocked_send_repository()
        latest = [
            BlockedSend(
                id=record.id,
                client_id=record.client_id,
                campaign_id=record.campaign_id,
                campaign_name=campaign_name,
                contact_id=record.contact_id,
                reason=record.reason,
                decision=record.decision,
                created_at=record.created_at,
            )
            for record in repository.list_recent_by_campaign(
                client_id=client_id,
                campaign_id=campaign_id,
                limit=CAMPAIGN_BLOCKED_SENDS_LATEST_LIMIT,
            )
        ]
        return CampaignBlockedSendsSummary(
            total=repository.count_by_campaign(
                client_id=client_id,
                campaign_id=campaign_id,
            ),
            latest=latest,
        )

    def _require_contact_repository(self) -> ContactRepository:
        if self._contact_repository is None:
            raise RuntimeError("Contact repository is required for client campaign reads.")
        return self._contact_repository

    def _require_suppression_list_repository(self) -> SuppressionListRepository:
        if self._suppression_list_repository is None:
            raise RuntimeError(
                "Suppression list repository is required for client campaign reads."
            )
        return self._suppression_list_repository

    def _require_blocked_send_repository(self) -> BlockedSendRepository:
        if self._blocked_send_repository is None:
            raise RuntimeError(
                "Blocked send repository is required for client campaign reads."
            )
        return self._blocked_send_repository

    def _require_email_log_repository(self) -> EmailLogRepository:
        if self._email_log_repository is None:
            raise RuntimeError("Email log repository is required for client campaign reads.")
        return self._email_log_repository

    def _require_provider_event_repository(self) -> ProviderEventRepository:
        if self._provider_event_repository is None:
            raise RuntimeError(
                "Provider event repository is required for client campaign reads."
            )
        return self._provider_event_repository

    def _build_client_usage(self, entry: ClientUsageRecord) -> ApiUsage:
        return ApiUsage(
            id=entry.id,
            client_id=entry.client_id,
            usage_type=entry.usage_type,
            quantity=entry.quantity,
            metadata=entry.metadata,
            created_at=entry.created_at,
        )

    def _build_client_blocked_send(
        self,
        blocked_send: ClientBlockedSendRecord,
    ) -> BlockedSend:
        return BlockedSend(
            id=blocked_send.id,
            client_id=blocked_send.client_id,
            campaign_id=blocked_send.campaign_id,
            campaign_name=blocked_send.campaign_name,
            contact_id=blocked_send.contact_id,
            reason=blocked_send.reason,
            decision=blocked_send.decision,
            created_at=blocked_send.created_at,
        )

    def _build_recent_campaign_summary(
        self,
        campaign: AdminCampaignRecord,
    ) -> AdminRecentCampaign:
        return AdminRecentCampaign(
            id=campaign.id,
            client_id=campaign.client_id,
            client_name=campaign.client_name,
            client_email=campaign.client_email,
            campaign_name=campaign.name,
            subject=campaign.subject,
            status=campaign.status,
            created_at=campaign.created_at,
            updated_at=campaign.updated_at,
        )

    def _build_recent_critical_event(
        self,
        blocked_send: AdminBlockedSendRecord,
    ) -> AdminCriticalEvent:
        return AdminCriticalEvent(
            id=blocked_send.id,
            client_id=blocked_send.client_id,
            client_name=blocked_send.client_name,
            client_email=blocked_send.client_email,
            campaign_id=blocked_send.campaign_id,
            campaign_name=blocked_send.campaign_name,
            reason=blocked_send.reason,
            decision=blocked_send.decision,
            created_at=blocked_send.created_at,
        )

    def _build_top_client_volume(
        self,
        record: AdminTopClientVolumeRecord,
    ) -> AdminTopClientByVolume:
        return AdminTopClientByVolume(
            client_id=record.client_id,
            client_name=record.client_name,
            client_email=record.client_email,
            emails_sent=record.emails_sent,
        )

    def _build_clients_near_limit(
        self,
        *,
        clients: list[ClientRecord],
        campaigns: list[AdminCampaignRecord],
        campaign_email_volumes: list[AdminCampaignEmailVolumeRecord],
    ) -> list[AdminClientNearLimit]:
        campaigns_in_use_by_client_id: dict[str, int] = {}
        for campaign in campaigns:
            if campaign.status not in LIMITED_CAMPAIGN_STATUSES:
                continue

            campaigns_in_use_by_client_id[campaign.client_id] = (
                campaigns_in_use_by_client_id.get(campaign.client_id, 0) + 1
            )

        near_limit_clients: list[AdminClientNearLimit] = []
        for client in clients:
            campaigns_in_use = campaigns_in_use_by_client_id.get(client.id, 0)
            max_campaigns_ratio = self._compute_ratio(
                campaigns_in_use,
                client.max_campaigns,
            )
            usage_ratio = max_campaigns_ratio or 0.0

            if usage_ratio < NEAR_LIMIT_THRESHOLD:
                continue

            near_limit_clients.append(
                AdminClientNearLimit(
                    client_id=client.id,
                    client_name=_build_client_name(client),
                    client_email=client.email,
                    usage_ratio=usage_ratio,
                    limiting_factor="campaign_slots",
                    campaigns_in_use=campaigns_in_use,
                    max_campaigns=client.max_campaigns,
                    max_campaigns_ratio=max_campaigns_ratio,
                )
            )

        near_limit_clients.sort(
            key=lambda item: (item.usage_ratio, item.campaigns_in_use, item.client_name),
            reverse=True,
        )
        return near_limit_clients[:CLIENTS_NEAR_LIMIT_LIMIT]

    def _compute_ratio(
        self,
        used_value: int,
        configured_limit: Optional[int],
    ) -> Optional[float]:
        if configured_limit is None or configured_limit <= 0:
            return None

        return min(used_value / configured_limit, 1.0)


def get_clients_service(
    repository: ClientRepository = Depends(get_client_repository),
    client_access_repository: ClientAccessRepository = Depends(get_client_access_repository),
    settings: Settings = Depends(get_settings),
) -> ClientsService:
    return ClientsService(
        repository,
        settings=settings,
        client_access_repository=client_access_repository,
        clerk_access_gateway=get_clerk_access_gateway(settings),
        client_access_email_service=get_client_access_email_service(settings),
        campaign_repository=get_campaign_repository(),
        campaign_slot_repository=get_campaign_slot_repository(),
        contact_repository=PostgresContactRepository(settings),
        suppression_list_repository=get_suppression_list_repository(),
        blocked_send_repository=get_blocked_send_repository(),
        email_log_repository=get_email_log_repository(),
        provider_event_repository=get_provider_event_repository(),
    )


def get_clerk_access_gateway(settings: Settings) -> ClerkAccessGateway:
    return HttpClerkAccessGateway(settings)


def get_client_access_email_service(settings: Settings) -> ClientAccessEmailService:
    return ClientAccessEmailService(settings)
