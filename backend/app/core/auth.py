from functools import lru_cache
from typing import Any, Literal, Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from jwt.exceptions import InvalidTokenError, PyJWKClientError
from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.repositories.auth_users import (
    AuthUserRecord,
    AuthUserRepository,
    get_auth_user_repository,
)
from app.services.client_access import (
    ClientAccessService,
    get_client_access_service,
)

PLATFORM_ADMIN_ACCESS = "platform_admin"
CLIENT_ACCESS = "client"
bearer_scheme = HTTPBearer(auto_error=False)


class AuthenticatedUser(BaseModel):
    id: str
    clerk_user_id: str
    email: Optional[str] = None
    access_type: Literal["platform_admin", "client"]
    client_id: Optional[str] = None
    portal_slug: Optional[str] = None
    status: Literal["invited", "active", "suspended", "archived"]


def _raise_unauthorized(detail: str) -> None:
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def _raise_for_missing_clerk_config(settings: Settings) -> None:
    if settings.clerk_jwks_url and settings.clerk_issuer:
        return

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Clerk auth is not fully configured on the backend.",
    )


def _extract_email(claims: dict[str, Any], record: AuthUserRecord) -> Optional[str]:
    return (
        record.email
        or claims.get("email")
        or claims.get("email_address")
        or claims.get("primary_email_address")
    )


@lru_cache
def get_jwks_client(jwks_url: str) -> PyJWKClient:
    return PyJWKClient(jwks_url)


def verify_clerk_token(token: str, settings: Settings) -> dict[str, Any]:
    _raise_for_missing_clerk_config(settings)

    decode_options = {
        "require": ["exp", "iss", "sub"],
        "verify_aud": settings.clerk_audience is not None,
    }

    try:
        signing_key = get_jwks_client(settings.clerk_jwks_url).get_signing_key_from_jwt(
            token
        )
        return jwt.decode(
            token,
            key=signing_key.key,
            algorithms=["RS256"],
            issuer=settings.clerk_issuer,
            audience=settings.clerk_audience,
            options=decode_options,
        )
    except (InvalidTokenError, PyJWKClientError, ValueError) as error:
        _raise_unauthorized(f"Invalid or expired Clerk token: {error}")


def get_token_claims(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        _raise_unauthorized("Missing bearer token.")

    if not credentials.credentials:
        _raise_unauthorized("Missing bearer token.")

    return verify_clerk_token(credentials.credentials, settings)


def get_current_user(
    claims: dict[str, Any] = Depends(get_token_claims),
    auth_user_repository: AuthUserRepository = Depends(get_auth_user_repository),
    client_access_service: ClientAccessService = Depends(get_client_access_service),
) -> AuthenticatedUser:
    clerk_user_id = claims.get("sub")
    email = (
        claims.get("email")
        or claims.get("email_address")
        or claims.get("primary_email_address")
    )

    if not isinstance(clerk_user_id, str) or not clerk_user_id:
        _raise_unauthorized("Clerk token is missing a subject claim.")

    mapped_user = auth_user_repository.get_by_clerk_user_id(clerk_user_id)

    if mapped_user is None:
        client_access = client_access_service.resolve_client_access(
            clerk_user_id,
            email=email if isinstance(email, str) else None,
        )

        if client_access is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Authenticated Clerk user is not mapped to a Sendwise user.",
            )

        return AuthenticatedUser(
            id=client_access.id,
            clerk_user_id=clerk_user_id,
            email=client_access.email or (email if isinstance(email, str) else None),
            access_type=CLIENT_ACCESS,
            client_id=client_access.client_id,
            portal_slug=client_access.portal_slug,
            status=client_access.status,
        )

    return AuthenticatedUser(
        id=mapped_user.resolved_user_id,
        clerk_user_id=clerk_user_id,
        email=_extract_email(claims, mapped_user),
        access_type=mapped_user.access_type,
        client_id=None,
        portal_slug=None,
        status=mapped_user.status,
    )


def require_active_user(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    if current_user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authenticated Sendwise user is not active.",
        )

    return current_user


def require_platform_admin(
    current_user: AuthenticatedUser = Depends(require_active_user),
) -> AuthenticatedUser:
    if current_user.access_type != PLATFORM_ADMIN_ACCESS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access is required for this endpoint.",
        )

    return current_user


def require_client_scope(
    current_user: AuthenticatedUser = Depends(require_active_user),
) -> AuthenticatedUser:
    if (
        current_user.access_type != CLIENT_ACCESS
        or not current_user.client_id
        or not current_user.portal_slug
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Client access is required for this endpoint.",
        )

    return current_user


def require_client(
    current_user: AuthenticatedUser = Depends(require_client_scope),
) -> AuthenticatedUser:
    return current_user
