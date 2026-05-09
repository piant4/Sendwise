from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict


class AuthMeResponse(BaseModel):
    access_type: Literal["platform_admin", "client"]
    client_id: Optional[str] = None
    portal_slug: Optional[str] = None
    email: Optional[str] = None
    status: Literal["invited", "active", "suspended", "archived"]
    invitation_status: Optional[Literal["pending", "accepted", "revoked", "expired"]] = None
    onboarding_required: bool = False


class CompleteClientOnboardingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    personal_name: str
