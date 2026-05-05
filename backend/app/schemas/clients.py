from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import ClientStatus


class Client(BaseModel):
    id: str
    name: str
    status: ClientStatus
    created_at: datetime
    updated_at: datetime


class ClientUser(BaseModel):
    id: str
    client_id: str
    email: str
    role: str
    created_at: datetime
    updated_at: datetime


class ClientContext(BaseModel):
    client: Client
    user: ClientUser
