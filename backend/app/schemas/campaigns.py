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


class AdminClientCampaignCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    subject: str


class AdminCampaignUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = None
    subject: Optional[str] = None
    status: Optional[CampaignStatus] = None
    current_step: Optional[str] = None


class AdminCampaignContentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    subject: Optional[str] = None
    preview_text: Optional[str] = None
    body_html: Optional[str] = None
    body_text: Optional[str] = None
    current_step: Optional[str] = None


class AdminCampaignSelectSlotRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slot_id: str


class AdminCampaignDetail(BaseModel):
    campaign_id: str
    client_id: str
    client_name: str
    client_status: str
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
    sent: int = 0
    opened: int = 0
    clicked: int = 0
    bounced: int = 0
    complained: int = 0
    unsubscribed: int = 0
    provider_events_available: bool = False


class ProviderRuntimeSummary(BaseModel):
    email_sending_enabled: bool
    email_provider: str
    provider_mode_label: str
    real_send_available: bool = False
    ses_live_validation_status: Optional[str] = None
    provider_events_available: bool = False
    mailpit_dev_mode: bool = False


class CampaignBlockedSendsSummary(BaseModel):
    total: int
    latest: list[BlockedSend]


class CampaignReadModel(BaseModel):
    campaign: CampaignSummaryItem
    slot: CampaignSlotSummary
    recipients: CampaignRecipientsSummary
    logs: CampaignLogsSummary
    runtime: ProviderRuntimeSummary
    blocked_sends: CampaignBlockedSendsSummary


class AdminCampaignSummaryResponse(CampaignReadModel):
    client: CampaignClientSummary
    can_send: bool
    blocking_errors: list[str]
    warnings: list[str]


class ClientCampaignDetailResponse(CampaignReadModel):
    pass


class ClientCampaignStatsResponse(BaseModel):
    campaign_id: str
    client_id: str
    recipients: CampaignRecipientsSummary
    logs: CampaignLogsSummary
    blocked_sends: CampaignBlockedSendsSummary
