from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ApiUsage(BaseModel):
    id: str
    client_id: str
    usage_type: str
    quantity: int
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
