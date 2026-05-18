from datetime import datetime

from typing import Optional

from pydantic import BaseModel

from app.schemas.common import SendDecision


class BlockedSend(BaseModel):
    id: str
    client_id: str
    campaign_id: Optional[str] = None
    campaign_name: Optional[str] = None
    contact_id: Optional[str] = None
    reason: str
    decision: SendDecision
    created_at: datetime
