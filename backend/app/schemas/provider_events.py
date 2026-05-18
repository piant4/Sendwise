from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ProviderEventIngestResponse(BaseModel):
    status: str
    provider: str
    event_type: str
    event_id: str
    created: bool
    processed: bool
    correlated: bool
    suppressed: bool
    campaign_id: str | None = None
    contact_id: str | None = None
    email_log_id: str | None = None
    occurred_at: datetime


class ProviderEventPayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    provider: str | None = None
    source: str | None = None
    provider_event_id: str | None = None
    event_type: str | None = None
    occurred_at: datetime | None = None
    client_id: str | None = None
    campaign_id: str | None = None
    contact_id: str | None = None
    email_log_id: str | None = None
    provider_message_id: str | None = None
    email: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
