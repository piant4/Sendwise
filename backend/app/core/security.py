from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader

from app.core.config import Settings, get_settings

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def require_api_key(
    api_key: str | None = Depends(api_key_header),
    settings: Settings = Depends(get_settings),
) -> None:
    """Placeholder API key dependency.

    Real auth, sessions, roles, and multi-tenant permissions come in later
    milestones. This keeps protected route shape visible without implementing a
    complex auth system in Milestone 0.
    """
    if settings.environment == "development" and settings.backend_api_key == "change_me":
        return
    if not api_key or api_key != settings.backend_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
        )
