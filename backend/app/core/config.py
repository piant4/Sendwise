from functools import lru_cache
from os import getenv

from pydantic import BaseModel


class Settings(BaseModel):
    project_name: str = getenv("PROJECT_NAME", "email_ai_platform")
    environment: str = getenv("ENVIRONMENT", "development")
    backend_api_key: str = getenv("BACKEND_API_KEY", "change_me")
    email_sending_enabled_raw: str = getenv("EMAIL_SENDING_ENABLED", "false")
    listmonk_url: str = getenv("LISTMONK_URL", "http://listmonk:9000")
    frontend_url: str = getenv("FRONTEND_URL", "http://localhost:3000")

    @property
    def email_sending_enabled(self) -> bool:
        return self.email_sending_enabled_raw == "true"


@lru_cache
def get_settings() -> Settings:
    return Settings()
