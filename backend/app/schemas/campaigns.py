from datetime import datetime

from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.blocked_sends import BlockedSend
from app.schemas.common import CampaignStats, CampaignStatus


class Campaign(BaseModel):
    id: str
    client_id: str
    name: str
    status: CampaignStatus
    subject: Optional[str] = None
    stats: Optional[CampaignStats] = None
    created_at: datetime
    updated_at: datetime


class AdminCampaignCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    client_id: str
    name: str
    subject: str
    period_email_limit: Optional[int] = None
    daily_email_limit: Optional[int] = None


class AdminClientCampaignCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    subject: str
    period_email_limit: Optional[int] = None
    daily_email_limit: Optional[int] = None


class AdminCampaignUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = None
    subject: Optional[str] = None
    status: Optional[CampaignStatus] = None
    current_step: Optional[str] = None
    period_email_limit: Optional[int] = None
    daily_email_limit: Optional[int] = None


class AdminCampaignContentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    subject: Optional[str] = None
    preview_text: Optional[str] = None
    body_html: Optional[str] = None
    body_text: Optional[str] = None
    current_step: Optional[str] = None


class AdminEmailTemplateCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    client_id: str
    name: str
    subject: str
    preview_text: Optional[str] = None
    body_html: Optional[str] = None
    body_text: Optional[str] = None


class AdminEmailTemplateResponse(BaseModel):
    id: str
    client_id: str
    name: str
    subject: str
    preview_text: Optional[str] = None
    body_html: Optional[str] = None
    body_text: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class AdminCampaignSelectSlotRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slot_id: str


class AdminCampaignDetail(BaseModel):
    campaign_id: str
    client_id: str
    client_name: str
    client_status: str
    email_brand: dict[str, str | None] | None = None
    name: str
    status: CampaignStatus
    subject: Optional[str] = None
    preview_text: Optional[str] = None
    body_html: Optional[str] = None
    body_text: Optional[str] = None
    current_step: str
    campaign_slot_id: Optional[str] = None
    content_ready: bool
    contacts_ready: bool
    review_ready: bool
    period_email_limit: int = 1000
    daily_email_limit: int = 50
    period_started_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class AdminCampaignSlotAssignmentResponse(BaseModel):
    campaign_id: str
    client_id: str
    campaign_slot_id: str
    slot_status: str
    slot_max_emails: int
    review_ready: bool


class AdminCampaignReviewResponse(BaseModel):
    campaign_id: str
    client_id: str
    status: CampaignStatus
    allowed_to_send: bool
    can_send_when_enabled: bool
    sending_enabled: bool
    warnings: list[str]
    blocking_errors: list[str]
    eligible_contact_count: int
    blocked_contact_count: int
    slot_limit: Optional[int] = None
    limit_source: Optional[str] = None
    content_ready: bool
    contacts_ready: bool
    review_ready: bool
    current_step: str
    daily_limit: Optional[int] = None
    daily_used: int = 0
    daily_remaining: Optional[int] = None
    period_limit: Optional[int] = None
    period_used: int = 0
    period_remaining: Optional[int] = None
    period_started_at: Optional[datetime] = None
    period_ends_at: Optional[datetime] = None


class AdminCampaignContactPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str
    metadata: dict[str, object] = Field(default_factory=dict)


class AdminCampaignContactsImportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    contacts: list[AdminCampaignContactPayload]


class AdminCampaignContactError(BaseModel):
    email: str
    reason: str


class AdminCampaignContactItem(BaseModel):
    contact_id: str
    email: str
    metadata: dict[str, str] = Field(default_factory=dict)
    status: str
    is_valid: bool
    is_eligible: bool
    blocked_reasons: list[str]


class AdminCampaignContactsResponse(BaseModel):
    campaign_id: str
    client_id: str
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


class AdminCampaignContactsImportResponse(BaseModel):
    campaign_id: str
    client_id: str
    received: int
    created_contacts: int
    reused_contacts: int
    attached_contacts: int
    duplicate_contacts: int
    invalid_contacts: int
    contacts_ready: bool
    errors: list[AdminCampaignContactError]


class AdminCampaignContactRemoveResponse(BaseModel):
    campaign_id: str
    client_id: str
    contact_id: str
    removed: bool
    contacts_ready: bool


class CampaignSummaryItem(BaseModel):
    id: str
    client_id: str
    name: str
    status: CampaignStatus
    subject: Optional[str] = None
    preview_text: Optional[str] = None
    current_step: str
    content_ready: bool
    contacts_ready: bool
    review_ready: bool


class CampaignClientSummary(BaseModel):
    id: str
    email: str
    personal_name: Optional[str] = None
    status: str


class CampaignSlotSummary(BaseModel):
    id: Optional[str] = None
    label: Optional[str] = None
    max_emails: Optional[int] = None
    status: Optional[str] = None
    limit_source: Optional[str] = None


class CampaignRecipientsSummary(BaseModel):
    total: int
    eligible: int
    invalid: int
    suppressed: int
    blocked: int


class CampaignLogsSummary(BaseModel):
    simulated: int = 0
    queued: int = 0
    sent: Optional[int] = None
    failed: int = 0
    delivered: Optional[int] = None
    opened: Optional[int] = None
    clicked: Optional[int] = None
    bounced: Optional[int] = None
    complained: Optional[int] = None
    unsubscribed: Optional[int] = None
    sent_available: bool = False
    failed_available: bool = False
    delivered_available: bool = False
    opened_available: bool = False
    clicked_available: bool = False
    bounced_available: bool = False
    complained_available: bool = False
    unsubscribed_available: bool = False
    delivery_rate: Optional[float] = None
    open_rate: Optional[float] = None
    click_rate: Optional[float] = None
    bounce_rate: Optional[float] = None
    complaint_rate: Optional[float] = None
    unsubscribe_rate: Optional[float] = None
    delivery_rate_available: bool = False
    open_rate_available: bool = False
    click_rate_available: bool = False
    bounce_rate_available: bool = False
    complaint_rate_available: bool = False
    unsubscribe_rate_available: bool = False
    provider_events_available: bool = False


class CampaignPeriodUsageSummary(BaseModel):
    period_email_limit: Optional[int] = None
    period_used: int = 0
    period_remaining: Optional[int] = None
    period_started_at: Optional[datetime] = None
    period_ends_at: Optional[datetime] = None
    has_real_usage: bool = False


class ProviderRuntimeSummary(BaseModel):
    email_sending_enabled: bool
    email_provider: str
    provider_mode_label: str
    real_send_available: bool = False
    ses_live_validation_status: Optional[str] = None
    provider_events_available: bool = False
    mailpit_dev_mode: bool = False


class CampaignPolicyStatusSummary(BaseModel):
    allowed: bool
    decision: str
    code: str
    severity: str
    reason: str


class CampaignPolicyStateSummary(BaseModel):
    deliverability_guard: CampaignPolicyStatusSummary
    duplicate_guard: CampaignPolicyStatusSummary
    warmup_guard: CampaignPolicyStatusSummary
    score_products_available: bool = False
    domain_health_score_available: bool = False
    contact_quality_score_available: bool = False
    campaign_risk_score_available: bool = False


class CampaignBlockedSendsSummary(BaseModel):
    total: int
    latest: list[BlockedSend]


class CampaignReadModel(BaseModel):
    campaign: CampaignSummaryItem
    slot: CampaignSlotSummary
    recipients: CampaignRecipientsSummary
    logs: CampaignLogsSummary
    period_usage: CampaignPeriodUsageSummary = Field(
        default_factory=CampaignPeriodUsageSummary
    )
    policy_state: Optional[CampaignPolicyStateSummary] = None
    runtime: ProviderRuntimeSummary
    blocked_sends: CampaignBlockedSendsSummary


class AdminCampaignSummaryResponse(CampaignReadModel):
    client: CampaignClientSummary
    can_send: bool
    can_send_when_enabled: bool
    sending_enabled: bool
    blocking_errors: list[str]
    warnings: list[str]
    daily_limit: Optional[int] = None
    daily_used: int = 0
    daily_remaining: Optional[int] = None
    period_limit: Optional[int] = None
    period_used: int = 0
    period_remaining: Optional[int] = None
    period_started_at: Optional[datetime] = None
    period_ends_at: Optional[datetime] = None


class ClientCampaignDetailResponse(CampaignReadModel):
    pass


class ClientCampaignStatsResponse(BaseModel):
    campaign_id: str
    client_id: str
    recipients: CampaignRecipientsSummary
    logs: CampaignLogsSummary
    blocked_sends: CampaignBlockedSendsSummary
