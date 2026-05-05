from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import SendDecision


class BlockedSend(BaseModel):
    id: str
    client_id: str
    campaign_id: str | None = None
    contact_id: str | None = None
    reason: str
    decision: SendDecision
    created_at: datetime
