from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import ContactStatus


class Contact(BaseModel):
    id: str
    client_id: str
    email: str
    status: ContactStatus
    created_at: datetime
    updated_at: datetime
