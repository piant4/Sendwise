from functools import lru_cache
from os import getenv
from typing import List, Optional, Union
from urllib.parse import quote, urlsplit

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
    clerk_secret_key: str = Field(default_factory=lambda: getenv("CLERK_SECRET_KEY", ""))
    clerk_api_base_url: str = Field(
        default_factory=lambda: getenv("CLERK_API_BASE_URL", "https://api.clerk.com/v1")
    )
    auth_user_mappings_json: str = Field(
        default_factory=lambda: getenv("AUTH_USER_MAPPINGS_JSON", "[]")
    )
    database_url: str = Field(default_factory=lambda: getenv("DATABASE_URL", ""))
    postgres_host: str = Field(default_factory=lambda: getenv("POSTGRES_HOST", "postgres"))
    postgres_port: int = Field(default_factory=lambda: int(getenv("POSTGRES_PORT", "5432")))
    postgres_db: str = Field(default_factory=lambda: getenv("POSTGRES_DB", "email_ai"))
    postgres_user: str = Field(
        default_factory=lambda: getenv("POSTGRES_USER", "email_ai_user")
    )
    postgres_password: str = Field(
        default_factory=lambda: getenv("POSTGRES_PASSWORD", "change_me")
    )
    email_sending_enabled_raw: str = Field(
        default_factory=lambda: getenv("EMAIL_SENDING_ENABLED", "false")
    )
    email_provider: str = Field(default_factory=lambda: getenv("EMAIL_PROVIDER", "mailpit"))
    listmonk_url: str = Field(
        default_factory=lambda: getenv("LISTMONK_URL", "http://listmonk:9000")
    )
    listmonk_username: str = Field(default_factory=lambda: getenv("LISTMONK_USERNAME", "admin"))
    listmonk_password: str = Field(default_factory=lambda: getenv("LISTMONK_PASSWORD", ""))
    listmonk_timeout_seconds: float = Field(
        default_factory=lambda: float(getenv("LISTMONK_TIMEOUT_SECONDS", "5"))
    )
    smtp_host: str = Field(default_factory=lambda: getenv("SMTP_HOST", "mailpit"))
    smtp_port: int = Field(default_factory=lambda: int(getenv("SMTP_PORT", "1025")))
    smtp_username: str = Field(default_factory=lambda: getenv("SMTP_USERNAME", ""))
    smtp_password: str = Field(default_factory=lambda: getenv("SMTP_PASSWORD", ""))
    smtp_tls_raw: str = Field(default_factory=lambda: getenv("SMTP_TLS", "false"))
    smtp_from_email: str = Field(default_factory=lambda: getenv("SMTP_FROM_EMAIL", ""))
    frontend_url: str = Field(
        default_factory=lambda: getenv("FRONTEND_URL", "http://localhost:3000")
    )

    @property
    def email_sending_enabled(self) -> bool:
        return self.email_sending_enabled_raw == "true"

    @property
    def smtp_tls(self) -> bool:
        return self.smtp_tls_raw == "true"

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

    @property
    def postgres_dsn(self) -> str:
        if self.database_url.strip():
            return self.database_url.strip()

        quoted_user = quote(self.postgres_user, safe="")
        quoted_password = quote(self.postgres_password, safe="")
        quoted_db = quote(self.postgres_db, safe="")
        return (
            f"postgresql://{quoted_user}:{quoted_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{quoted_db}"
        )

    @property
    def frontend_origin(self) -> str:
        frontend_url = self.frontend_url.strip()

        if not frontend_url:
            return ""

        parsed_url = urlsplit(frontend_url)

        if not parsed_url.scheme or not parsed_url.netloc:
            return ""

        return f"{parsed_url.scheme}://{parsed_url.netloc}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
