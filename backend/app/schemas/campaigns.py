from datetime import datetime

from typing import Optional

from pydantic import BaseModel, ConfigDict

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
    warnings: list[str]
    blocking_errors: list[str]
    eligible_contact_count: int
    blocked_contact_count: int
    slot_limit: Optional[int] = None
    limit_source: Optional[str] = None
    content_ready: bool
    contacts_ready: bool
    review_ready: bool
