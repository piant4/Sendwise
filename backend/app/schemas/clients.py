from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict

from app.schemas.common import ClientStatus


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
    company_name: Optional[str] = None
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
    company_name: Optional[str] = None


class AdminClientInviteResponse(BaseModel):
    client: Client
    access: ClientAccessSummary


class AdminClientUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    personal_name: Optional[str] = None
    company_name: Optional[str] = None
    email_limit_per_campaign: Optional[int] = None
    max_campaigns: Optional[int] = None
    monthly_email_limit: Optional[int] = None
    daily_email_limit: Optional[int] = None
