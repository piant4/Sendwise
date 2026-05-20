from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict

from app.schemas.common import CampaignStatus, ClientStatus, SendDecision
from app.schemas.usage import ApiUsage
from app.schemas.campaigns import Campaign, ProviderRuntimeSummary
from app.schemas.blocked_sends import BlockedSend


ClientAccessStatus = Literal["invited", "active", "suspended", "archived"]
InvitationStatus = Literal["pending", "accepted", "revoked", "expired"]


class ClientAccessSummary(BaseModel):
    id: str
    client_id: str
    email: str
    clerk_user_id: Optional[str] = None
    clerk_invitation_id: Optional[str] = None
    portal_slug: str
    status: ClientAccessStatus
    invitation_status: Optional[InvitationStatus] = None
    invited_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


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


class ClientDashboardSummary(BaseModel):
    greeting_name: str
    cta: ClientDashboardCta
    kpis: ClientDashboardKpis
    performance_analytics: ClientDashboardPerformanceAnalytics
    actions_required: ClientDashboardActionsRequired
    status_summary: ClientDashboardStatusSummary
    period_usage: ClientDashboardPeriodUsage


class ClientOverviewSummary(BaseModel):
    client: ClientOverviewIdentity
    campaigns: ClientOverviewCampaigns
    usage: ClientOverviewUsage
    blocked_sends: ClientOverviewBlockedSends
    limits: ClientOverviewLimits
    client_dashboard: Optional[ClientDashboardSummary] = None


class AdminClientInviteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str
    personal_name: Optional[str] = None


class AdminClientInviteResponse(BaseModel):
    client: Client
    access: ClientAccessSummary


class AdminClientUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    personal_name: Optional[str] = None
    email_limit_per_campaign: Optional[int] = None
    max_campaigns: Optional[int] = None
    monthly_email_limit: Optional[int] = None
    daily_email_limit: Optional[int] = None


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
