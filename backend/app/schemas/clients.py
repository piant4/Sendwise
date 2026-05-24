from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter, field_validator
from pydantic.networks import AnyHttpUrl

from app.schemas.common import CampaignStatus, ClientStatus, SendDecision
from app.schemas.usage import ApiUsage
from app.schemas.campaigns import Campaign, ProviderRuntimeSummary
from app.schemas.blocked_sends import BlockedSend


ClientAccessStatus = Literal["invited", "active", "suspended", "archived"]
InvitationStatus = Literal["pending", "accepted", "revoked", "expired"]
AdminClientAccessErrorCode = Literal[
    "client_access_clerk_config_missing",
    "client_access_clerk_link_failed",
    "client_access_clerk_email_failed",
    "client_access_email_config_missing",
    "client_access_email_send_failed",
    "client_access_email_invalid",
    "client_access_existing_user_conflict",
    "client_access_existing_user_resend_unsupported",
]

_OPTIONAL_HTTP_URL = TypeAdapter(AnyHttpUrl)
CLIENT_ACCESS_ERROR_MESSAGES: dict[AdminClientAccessErrorCode, str] = {
    "client_access_clerk_config_missing": (
        "La configurazione Clerk necessaria per preparare l'accesso cliente non e disponibile."
    ),
    "client_access_clerk_link_failed": (
        "Sendwise non e riuscito a preparare il link sicuro di accesso cliente."
    ),
    "client_access_clerk_email_failed": (
        "Clerk non e riuscito a inviare l'email di accesso. Controlla inviti e template Clerk."
    ),
    "client_access_email_config_missing": (
        "La configurazione email transazionale necessaria per inviare l'accesso cliente e incompleta."
    ),
    "client_access_email_send_failed": (
        "Il link di accesso cliente e stato preparato, ma l'email di accesso non e stata inviata."
    ),
    "client_access_email_invalid": "L'indirizzo email cliente non e valido.",
    "client_access_existing_user_conflict": (
        "Questa email e gia associata a un altro accesso cliente attivo o in attivazione."
    ),
    "client_access_existing_user_resend_unsupported": (
        "Questo accesso e gia collegato a un utente Clerk esistente e Clerk non puo inviare nativamente il resend da questo flusso."
    ),
}


def _normalize_optional_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None

    normalized_value = value.strip()
    return normalized_value or None


def _normalize_optional_http_url(value: Optional[str]) -> Optional[str]:
    normalized_value = _normalize_optional_text(value)
    if normalized_value is None:
        return None

    return str(_OPTIONAL_HTTP_URL.validate_python(normalized_value))


class ClientEmailBrand(BaseModel):
    model_config = ConfigDict(extra="forbid")

    company_name: Optional[str] = None
    sender_name: Optional[str] = None
    website_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    instagram_url: Optional[str] = None
    facebook_url: Optional[str] = None
    x_url: Optional[str] = None
    logo_url: Optional[str] = None

    @field_validator("company_name", "sender_name", mode="before")
    @classmethod
    def _validate_optional_text(cls, value: object) -> Optional[str]:
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError("Expected a string value.")
        return _normalize_optional_text(value)

    @field_validator(
        "website_url",
        "linkedin_url",
        "instagram_url",
        "facebook_url",
        "x_url",
        mode="before",
    )
    @classmethod
    def _validate_optional_http_url(cls, value: object) -> Optional[str]:
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError("Expected a string value.")
        return _normalize_optional_http_url(value)

    @field_validator("logo_url", mode="before")
    @classmethod
    def _validate_logo_url(cls, value: object) -> Optional[str]:
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError("Expected a string value.")

        normalized_value = _normalize_optional_text(value)
        if normalized_value is None:
            return None
        if ".." in normalized_value:
            raise ValueError("logo_url must not contain path traversal.")
        if not normalized_value.startswith("/static/client-brand-logos/"):
            raise ValueError(
                "logo_url must point to the managed client brand logo path."
            )
        if not normalized_value.lower().endswith(".webp"):
            raise ValueError("logo_url must reference a .webp asset.")
        return normalized_value

    def has_any_value(self) -> bool:
        return any(
            getattr(self, field_name) is not None
            for field_name in self.__class__.model_fields
        )


class ClientAccessSummary(BaseModel):
    id: str
    client_id: str
    email: str
    clerk_user_id: Optional[str] = None
    clerk_invitation_id: Optional[str] = None
    portal_slug: Optional[str] = None
    status: ClientAccessStatus
    invitation_status: Optional[InvitationStatus] = None
    invited_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class ClientAccessErrorDetail(BaseModel):
    code: AdminClientAccessErrorCode
    message: str


def build_client_access_error_detail(
    code: AdminClientAccessErrorCode,
) -> dict[str, str]:
    return ClientAccessErrorDetail(
        code=code,
        message=CLIENT_ACCESS_ERROR_MESSAGES[code],
    ).model_dump()


class Client(BaseModel):
    id: str
    email: str
    personal_name: Optional[str] = None
    name: str
    status: ClientStatus
    email_limit_per_campaign: Optional[int] = None
    max_campaigns: Optional[int] = None
    monthly_email_limit: Optional[int] = None
    daily_email_limit: Optional[int] = None
    email_brand: Optional[ClientEmailBrand] = None
    created_at: datetime
    updated_at: datetime
    access: Optional[ClientAccessSummary] = None


class ClientUser(BaseModel):
    id: str
    client_id: str
    email: str
    portal_slug: str
    status: ClientAccessStatus
    created_at: datetime
    updated_at: datetime


class ClientContext(BaseModel):
    client: Client
    user: ClientUser


class ClientOverviewIdentity(BaseModel):
    id: str
    name: str
    email: str
    portal_slug: str
    client_status: ClientStatus
    access_status: ClientAccessStatus
    invitation_status: Optional[InvitationStatus] = None


class ClientCampaignStatusCounts(BaseModel):
    draft: int = 0
    ready: int = 0
    running: int = 0
    paused: int = 0
    blocked: int = 0
    completed: int = 0
    failed: int = 0


class ClientUsageSummaryItem(BaseModel):
    usage_type: str
    total_quantity: int


class ClientOverviewCampaigns(BaseModel):
    total_campaigns: int
    active_campaigns: int
    running_campaigns: int
    status_counts: ClientCampaignStatusCounts
    recent_campaigns: list[Campaign]


class ClientOverviewUsage(BaseModel):
    has_data: bool
    total_records: int
    current_period_started_at: datetime
    current_period_totals: list[ClientUsageSummaryItem]
    recent_usage: list[ApiUsage]


class ClientOverviewBlockedSends(BaseModel):
    current_period_started_at: datetime
    current_period_count: int
    recent_blocked_sends: list[BlockedSend]


class ClientOverviewLimits(BaseModel):
    email_limit_per_campaign: Optional[int] = None
    max_campaigns: Optional[int] = None


ClientDashboardWindowKey = Literal["24h", "7d", "14d", "30d", "allTime"]
ClientDashboardActionSeverity = Literal["neutral", "warning", "danger"]


class ClientDashboardCta(BaseModel):
    campaigns_href: str


class ClientDashboardKpiValue(BaseModel):
    value: Optional[int] = None
    limit: Optional[int] = None
    available: bool


class ClientDashboardKpis(BaseModel):
    active_campaigns: ClientDashboardKpiValue
    sent_last_7d: ClientDashboardKpiValue
    delivered_last_7d: ClientDashboardKpiValue
    opened_last_7d: ClientDashboardKpiValue
    clicked_last_7d: ClientDashboardKpiValue
    delivery_rate_last_7d: Optional[float] = None
    open_rate_last_7d: Optional[float] = None
    click_rate_last_7d: Optional[float] = None
    delivery_rate_available: bool = False
    open_rate_available: bool = False
    click_rate_available: bool = False


class ClientDashboardWindowMetrics(BaseModel):
    sent: Optional[int] = None
    failed: Optional[int] = None
    delivered: Optional[int] = None
    opened: Optional[int] = None
    clicked: Optional[int] = None
    sent_available: bool = False
    failed_available: bool = False
    delivered_available: bool = False
    opened_available: bool = False
    clicked_available: bool = False
    delivery_rate: Optional[float] = None
    open_rate: Optional[float] = None
    click_rate: Optional[float] = None
    delivery_rate_available: bool = False
    open_rate_available: bool = False
    click_rate_available: bool = False
    window_started_at: Optional[datetime] = None
    window_ended_at: datetime


class ClientDashboardPerformanceAnalytics(BaseModel):
    default_window: ClientDashboardWindowKey = "7d"
    windows: dict[ClientDashboardWindowKey, ClientDashboardWindowMetrics]


class ClientDashboardActionItem(BaseModel):
    label: str
    count: int
    severity: ClientDashboardActionSeverity


class ClientDashboardActionsRequired(BaseModel):
    campaigns_to_complete: int
    blocked_sends_to_review: int
    provider_events_issues: Optional[int] = None
    items: list[ClientDashboardActionItem]


class ClientDashboardStatusSummary(BaseModel):
    total_campaigns: int
    running: int
    ready: int
    to_complete: int
    blocked: int
    completed: int


class ClientDashboardPeriodUsage(BaseModel):
    has_real_usage: bool
    sent: Optional[int] = None
    failed: Optional[int] = None
    delivered: Optional[int] = None
    opened: Optional[int] = None
    clicked: Optional[int] = None


class ClientDashboardScoreAvailability(BaseModel):
    score_products_available: bool = False
    domain_health_score_available: bool = False
    contact_quality_score_available: bool = False
    campaign_risk_score_available: bool = False


class ClientDashboardSummary(BaseModel):
    greeting_name: str
    cta: ClientDashboardCta
    kpis: ClientDashboardKpis
    performance_analytics: ClientDashboardPerformanceAnalytics
    actions_required: ClientDashboardActionsRequired
    status_summary: ClientDashboardStatusSummary
    period_usage: ClientDashboardPeriodUsage
    score_availability: ClientDashboardScoreAvailability = Field(
        default_factory=ClientDashboardScoreAvailability
    )


class ClientOverviewSummary(BaseModel):
    client: ClientOverviewIdentity
    campaigns: ClientOverviewCampaigns
    usage: ClientOverviewUsage
    blocked_sends: ClientOverviewBlockedSends
    limits: ClientOverviewLimits
    client_dashboard: Optional[ClientDashboardSummary] = None


class AdminClientAccessProvisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class AdminClientAccessResponse(BaseModel):
    client: Client
    access: ClientAccessSummary


class AdminClientUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    personal_name: Optional[str] = None
    email_limit_per_campaign: Optional[int] = None
    max_campaigns: Optional[int] = None
    monthly_email_limit: Optional[int] = None
    daily_email_limit: Optional[int] = None
    email_brand: Optional[ClientEmailBrand] = None


class AdminCampaignStatusCounts(BaseModel):
    active: int = 0
    paused: int = 0
    blocked: int = 0
    draft: int = 0
    completed: int = 0
    failed: int = 0


class AdminClientStatusCounts(BaseModel):
    trial: int = 0
    active: int = 0
    paused: int = 0
    blocked: int = 0
    archived: int = 0


class AdminRecentCampaign(BaseModel):
    id: str
    client_id: str
    client_name: str
    client_email: str
    campaign_name: str
    subject: Optional[str] = None
    status: CampaignStatus
    created_at: datetime
    updated_at: datetime


class AdminCriticalEvent(BaseModel):
    id: str
    event_type: Literal["blocked_send"] = "blocked_send"
    client_id: str
    client_name: str
    client_email: str
    campaign_id: Optional[str] = None
    campaign_name: Optional[str] = None
    reason: str
    decision: SendDecision
    created_at: datetime


class AdminBlockedSendItem(BaseModel):
    id: str
    client_id: str
    client_name: str
    client_email: str
    campaign_id: Optional[str] = None
    campaign_name: Optional[str] = None
    reason: str
    decision: SendDecision
    created_at: datetime


class AdminSystemStatus(BaseModel):
    api_status: Literal["ok"] = "ok"
    db_status: Literal["ok", "degraded"] = "ok"
    email_sending_enabled: bool
    email_provider: str
    provider_mode_label: str
    real_send_available: bool = False
    ses_live_validation_status: Optional[str] = None
    provider_events_available: bool = False
    mailpit_dev_mode: bool = False
    runtime: ProviderRuntimeSummary
    environment: str
    auth_provider_configured: bool
    clerk_management_api_configured: bool
    frontend_origin_configured: bool
    delivery_engine_configured: bool
    generated_at: datetime


class AdminOverviewClientsSummary(BaseModel):
    total_clients: int
    active_clients: int
    invited_or_pending_clients: int = 0
    archived_or_blocked_clients: int = 0
    status_counts: AdminClientStatusCounts


class AdminOverviewCampaignsSummary(BaseModel):
    total_campaigns: int
    running_campaigns: int
    paused_campaigns: int
    blocked_campaigns: int
    status_counts: AdminCampaignStatusCounts
    recent_campaigns: list[AdminRecentCampaign]


class AdminTopClientByVolume(BaseModel):
    client_id: str
    client_name: str
    client_email: str
    emails_sent: int


class AdminOverviewSendingSummary(BaseModel):
    emails_sent_today: int
    emails_sent_this_month: int
    top_clients_by_volume: list[AdminTopClientByVolume]


class AdminOverviewBlocksSummary(BaseModel):
    blocked_sends_today: int
    recent_critical_events: list[AdminCriticalEvent]


class AdminClientNearLimit(BaseModel):
    client_id: str
    client_name: str
    client_email: str
    usage_ratio: float
    limiting_factor: Literal["campaign_slots"]
    campaigns_in_use: int
    max_campaigns: Optional[int] = None
    max_campaigns_ratio: Optional[float] = None


class AdminOverviewLimitsSummary(BaseModel):
    clients_near_limit: list[AdminClientNearLimit]
    configured_limits_count: int
    unconfigured_limits_count: int


class AdminOverviewSummary(BaseModel):
    clients: AdminOverviewClientsSummary
    campaigns: AdminOverviewCampaignsSummary
    sending: AdminOverviewSendingSummary
    blocks: AdminOverviewBlocksSummary
    limits: AdminOverviewLimitsSummary
    system: AdminSystemStatus


class AdminCampaignSummary(BaseModel):
    id: str
    client_id: str
    client_name: str
    client_email: str
    name: str
    status: CampaignStatus
    subject: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    blocked_sends_count: int = 0


class AdminEmailLimitsSummary(BaseModel):
    total_clients: int
    configured_clients: int
    unconfigured_clients: int


class AdminEmailLimitRow(BaseModel):
    client_id: str
    client_name: str
    client_email: str
    client_status: ClientStatus
    access_status: Optional[ClientAccessStatus] = None
    invitation_status: Optional[InvitationStatus] = None
    email_limit_per_campaign: Optional[int] = None
    max_campaigns: Optional[int] = None
    updated_at: datetime


class AdminEmailLimitsResponse(BaseModel):
    summary: AdminEmailLimitsSummary
    rows: list[AdminEmailLimitRow]
