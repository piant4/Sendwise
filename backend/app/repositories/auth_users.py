import json
from functools import lru_cache
from typing import Literal, Optional

from fastapi import Depends
from pydantic import BaseModel, ValidationError, model_validator

from app.core.config import Settings, get_settings

AuthRole = Literal["admin_owner", "admin_operator", "client_owner", "client_viewer"]
AuthStatus = Literal["invited", "active", "suspended", "archived"]


class AuthUserRecord(BaseModel):
    id: Optional[str] = None
    clerk_user_id: str
    email: Optional[str] = None
    role: AuthRole
    client_id: Optional[str] = None
    status: AuthStatus = "active"

    @model_validator(mode="after")
    def validate_client_scope(self) -> "AuthUserRecord":
        if self.role.startswith("client_") and not self.client_id:
            raise ValueError("Client roles require client_id in auth mapping.")
        return self

    @property
    def resolved_user_id(self) -> str:
        return self.id or self.clerk_user_id


class AuthUserRepository:
    def __init__(self, records: dict[str, AuthUserRecord]) -> None:
        self._records = records

    def get_by_clerk_user_id(self, clerk_user_id: str) -> Optional[AuthUserRecord]:
        return self._records.get(clerk_user_id)


def _load_records(raw_json: str) -> dict[str, AuthUserRecord]:
    if not raw_json.strip():
        return {}

    try:
        payload = json.loads(raw_json)
    except json.JSONDecodeError as error:
        raise ValueError("AUTH_USER_MAPPINGS_JSON must be valid JSON.") from error

    if not isinstance(payload, list):
        raise ValueError("AUTH_USER_MAPPINGS_JSON must decode to a list.")

    records: dict[str, AuthUserRecord] = {}

    try:
        for item in payload:
            record = AuthUserRecord.model_validate(item)
            records[record.clerk_user_id] = record
    except ValidationError as error:
        raise ValueError("AUTH_USER_MAPPINGS_JSON contains invalid auth records.") from error

    return records


@lru_cache
def _build_auth_user_repository(raw_json: str) -> AuthUserRepository:
    return AuthUserRepository(_load_records(raw_json))


def get_auth_user_repository(
    settings: Settings = Depends(get_settings),
) -> AuthUserRepository:
    return _build_auth_user_repository(settings.auth_user_mappings_json)
