from functools import lru_cache
from os import getenv
from typing import List, Optional, Union

from pydantic import BaseModel, Field


class Settings(BaseModel):
    project_name: str = Field(
        default_factory=lambda: getenv("PROJECT_NAME", "email_ai_platform")
    )
    environment: str = Field(default_factory=lambda: getenv("ENVIRONMENT", "development"))
    backend_api_key: str = Field(default_factory=lambda: getenv("BACKEND_API_KEY", "change_me"))
    clerk_jwks_url: str = Field(default_factory=lambda: getenv("CLERK_JWKS_URL", ""))
    clerk_issuer: str = Field(default_factory=lambda: getenv("CLERK_ISSUER", ""))
    clerk_audience_raw: str = Field(default_factory=lambda: getenv("CLERK_AUDIENCE", ""))
    auth_user_mappings_json: str = Field(
        default_factory=lambda: getenv("AUTH_USER_MAPPINGS_JSON", "[]")
    )
    email_sending_enabled_raw: str = Field(
        default_factory=lambda: getenv("EMAIL_SENDING_ENABLED", "false")
    )
    listmonk_url: str = Field(
        default_factory=lambda: getenv("LISTMONK_URL", "http://listmonk:9000")
    )
    frontend_url: str = Field(
        default_factory=lambda: getenv("FRONTEND_URL", "http://localhost:3000")
    )

    @property
    def email_sending_enabled(self) -> bool:
        return self.email_sending_enabled_raw == "true"

    @property
    def clerk_audience(self) -> Optional[Union[str, List[str]]]:
        audiences = [
            audience.strip()
            for audience in self.clerk_audience_raw.split(",")
            if audience.strip()
        ]

        if not audiences:
            return None

        if len(audiences) == 1:
            return audiences[0]

        return audiences


@lru_cache
def get_settings() -> Settings:
    return Settings()
