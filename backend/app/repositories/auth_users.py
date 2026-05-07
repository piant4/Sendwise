import json
from functools import lru_cache
from typing import Any, Literal, Optional

from fastapi import Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, ValidationError, model_validator

from app.core.config import Settings, get_settings

AuthAccessType = Literal["platform_admin", "client"]
AuthStatus = Literal["invited", "active", "suspended", "archived"]


class AuthUserRecord(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: Optional[str] = None
    clerk_user_id: str
    email: Optional[str] = None
    access_type: AuthAccessType
    client_id: Optional[str] = None
    status: AuthStatus = "active"

    @model_validator(mode="after")
    def validate_client_scope(self) -> "AuthUserRecord":
        if self.access_type == "client" and not self.client_id:
            raise ValueError("Client access requires client_id in auth mapping.")

        if self.access_type == "platform_admin" and self.client_id is not None:
            raise ValueError("Platform admin access must not include client_id.")

        return self

    @property
    def resolved_user_id(self) -> str:
        return self.id or self.clerk_user_id

    @property
    def role(self) -> str:
        return self.access_type


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

    if isinstance(payload, list):
        if not payload:
            return {}

        raise ValueError(
            "AUTH_USER_MAPPINGS_JSON must decode to an object keyed by Clerk user id."
        )

    if not isinstance(payload, dict):
        raise ValueError(
            "AUTH_USER_MAPPINGS_JSON must decode to an object keyed by Clerk user id."
        )

    records: dict[str, AuthUserRecord] = {}

    try:
        for clerk_user_id, item in payload.items():
            if not isinstance(clerk_user_id, str) or not clerk_user_id:
                raise ValueError(
                    "AUTH_USER_MAPPINGS_JSON keys must be non-empty Clerk user ids."
                )

            if not isinstance(item, dict):
                raise ValueError(
                    "AUTH_USER_MAPPINGS_JSON values must be objects keyed by Clerk user id."
                )

            declared_clerk_user_id = item.get("clerk_user_id")

            if (
                declared_clerk_user_id is not None
                and declared_clerk_user_id != clerk_user_id
            ):
                raise ValueError(
                    "AUTH_USER_MAPPINGS_JSON clerk_user_id must match its object key."
                )

            record_payload: dict[str, Any] = dict(item)
            record_payload["clerk_user_id"] = clerk_user_id
            record = AuthUserRecord.model_validate(record_payload)
            records[clerk_user_id] = record
    except ValidationError as error:
        raise ValueError("AUTH_USER_MAPPINGS_JSON contains invalid auth records.") from error

    return records


@lru_cache
def _build_auth_user_repository(raw_json: str) -> AuthUserRepository:
    return AuthUserRepository(_load_records(raw_json))


def get_auth_user_repository(
    settings: Settings = Depends(get_settings),
) -> AuthUserRepository:
    try:
        return _build_auth_user_repository(settings.auth_user_mappings_json)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Invalid AUTH_USER_MAPPINGS_JSON backend configuration: {error}",
        ) from error
