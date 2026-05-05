from enum import Enum

from pydantic import BaseModel


class ClientStatus(str, Enum):
    trial = "trial"
    active = "active"
    paused = "paused"
    blocked = "blocked"
    archived = "archived"


class CampaignStatus(str, Enum):
    draft = "draft"
    ready = "ready"
    running = "running"
    paused = "paused"
    blocked = "blocked"
    completed = "completed"
    failed = "failed"


class ContactStatus(str, Enum):
    pending = "pending"
    sendable = "sendable"
    suppressed = "suppressed"
    bounced = "bounced"
    unsubscribed = "unsubscribed"
    blacklisted = "blacklisted"
    error = "error"


class SendDecision(str, Enum):
    authorized = "authorized"
    blocked = "blocked"
    dry_run = "dry_run"


class CampaignStats(BaseModel):
    campaign_id: str
    client_id: str
    sent: int
    opened: int
    clicked: int
    bounced: int
    unsubscribed: int
