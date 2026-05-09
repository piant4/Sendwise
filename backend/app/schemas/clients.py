from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import CampaignStatus, ClientStatus, SendDecision


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


class AdminEmailLimitOverview(BaseModel):
    configured_clients: int = 0
    unconfigured_clients: int = 0
    total_email_limit_per_campaign: int = 0
    total_max_campaigns: int = 0


class AdminRecentCampaign(BaseModel):
    id: str
    client_id: str
    client_name: str
    campaign_name: str
    subject: Optional[str] = None
    status: CampaignStatus
    created_at: datetime
    updated_at: datetime


class AdminRecentBlockedSend(BaseModel):
    id: str
    client_id: str
    client_name: str
    campaign_id: Optional[str] = None
    campaign_name: str
    reason: str
    decision: SendDecision
    created_at: datetime


class AdminSystemStatus(BaseModel):
    api: Literal["ok", "warning"] = "ok"
    mock_data: Literal["disabled"] = "disabled"
    sending: Literal["disabled"] = "disabled"
    mailpit: Literal["dev_only"] = "dev_only"


class AdminOverviewSummary(BaseModel):
    total_clients: int
    active_campaigns: int
    blocked_sends_today: int
    monthly_ai_calls_used: int = 0
    campaign_status_counts: AdminCampaignStatusCounts
    client_status_counts: AdminClientStatusCounts
    email_limit_overview: AdminEmailLimitOverview
    recent_campaigns: list[AdminRecentCampaign]
    recent_blocked_sends: list[AdminRecentBlockedSend]
    system_status: AdminSystemStatus = Field(default_factory=AdminSystemStatus)


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
