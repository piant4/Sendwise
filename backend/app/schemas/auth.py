from typing import Literal, Optional

from pydantic import BaseModel


class AuthMeResponse(BaseModel):
    access_type: Literal["platform_admin", "client"]
    client_id: Optional[str] = None
    portal_slug: Optional[str] = None
    email: Optional[str] = None
    status: Literal["invited", "active", "suspended", "archived"]
