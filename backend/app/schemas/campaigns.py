from datetime import datetime

from typing import Optional

from pydantic import BaseModel

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
