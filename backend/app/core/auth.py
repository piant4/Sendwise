from functools import lru_cache
from typing import Any, Literal, Optional

import httpx
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
    invitation_status: Optional[
        Literal["pending", "accepted", "revoked", "expired"]
    ] = None
    onboarding_required: bool = False


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
    resolved_claim_emails = _resolve_clerk_emails_from_claims(claims)
    return record.email or (resolved_claim_emails[0] if resolved_claim_emails else None)


def _maybe_collect_email(candidate: Any) -> Optional[str]:
    if not isinstance(candidate, str):
        return None

    normalized_candidate = candidate.strip().lower()
    return normalized_candidate if "@" in normalized_candidate else None


def _resolve_emails_from_collection(collection: Any) -> list[str]:
    if not isinstance(collection, list):
        return []

    primary_id = None
    return _resolve_emails_from_clerk_email_objects(collection, primary_id=primary_id)


def _resolve_emails_from_clerk_email_objects(
    email_objects: list[Any],
    *,
    primary_id: Optional[str],
) -> list[str]:
    primary_emails: list[str] = []
    verified_emails: list[str] = []
    fallback_emails: list[str] = []

    for item in email_objects:
        if isinstance(item, str):
            email = _maybe_collect_email(item)
            if email:
                fallback_emails.append(email)
            continue

        if not isinstance(item, dict):
            continue

        email = _maybe_collect_email(item.get("email_address") or item.get("email"))
        if not email:
            continue

        verification = item.get("verification")
        is_verified = (
            isinstance(verification, dict)
            and verification.get("status") == "verified"
        ) or item.get("verified") is True
        is_primary = primary_id is not None and item.get("id") == primary_id

        if is_primary:
            primary_emails.append(email)
        elif is_verified:
            verified_emails.append(email)
        else:
            fallback_emails.append(email)

    ordered_emails = primary_emails + verified_emails + fallback_emails
    seen: set[str] = set()
    deduped_emails: list[str] = []

    for email in ordered_emails:
        if email in seen:
            continue
        seen.add(email)
        deduped_emails.append(email)

    return deduped_emails


def _resolve_clerk_emails_from_claims(claims: dict[str, Any]) -> list[str]:
    direct_candidates = [
        claims.get("email"),
        claims.get("email_address"),
        claims.get("primary_email_address"),
    ]
    resolved_direct_candidates = [
        email
        for email in (_maybe_collect_email(candidate) for candidate in direct_candidates)
        if email
    ]

    primary_email_address = claims.get("primary_email_address")
    nested_primary_email = None
    if isinstance(primary_email_address, dict):
        nested_primary_email = _maybe_collect_email(
            primary_email_address.get("email_address") or primary_email_address.get("email")
        )

    if nested_primary_email:
        resolved_direct_candidates.insert(0, nested_primary_email)

    email_addresses = claims.get("email_addresses")
    resolved_from_collection = _resolve_emails_from_collection(email_addresses)
    seen: set[str] = set()
    resolved_emails: list[str] = []

    for email in resolved_direct_candidates + resolved_from_collection:
        if email in seen:
            continue
        seen.add(email)
        resolved_emails.append(email)

    return resolved_emails


def _resolve_clerk_emails_from_backend(
    *,
    clerk_user_id: str,
    settings: Settings,
) -> list[str]:
    if not settings.clerk_secret_key.strip():
        return []

    response = httpx.get(
        f"{settings.clerk_api_base_url.rstrip('/')}/users/{clerk_user_id}",
        headers={"Authorization": f"Bearer {settings.clerk_secret_key}"},
        timeout=10.0,
    )

    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to resolve the authenticated Clerk email.",
        )

    payload = response.json()
    primary_email_id = payload.get("primary_email_address_id")
    return _resolve_emails_from_clerk_email_objects(
        payload.get("email_addresses") or [],
        primary_id=primary_email_id if isinstance(primary_email_id, str) else None,
    )


def resolve_verified_clerk_emails(
    *,
    claims: dict[str, Any],
    settings: Settings,
) -> list[str]:
    clerk_user_id = claims.get("sub")
    emails = _resolve_clerk_emails_from_claims(claims)

    if emails or not isinstance(clerk_user_id, str) or not clerk_user_id:
        return emails

    return _resolve_clerk_emails_from_backend(
        clerk_user_id=clerk_user_id,
        settings=settings,
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
    settings: Settings = Depends(get_settings),
    auth_user_repository: AuthUserRepository = Depends(get_auth_user_repository),
    client_access_service: ClientAccessService = Depends(get_client_access_service),
) -> AuthenticatedUser:
    clerk_user_id = claims.get("sub")
    resolved_emails = resolve_verified_clerk_emails(claims=claims, settings=settings)
    primary_email = resolved_emails[0] if resolved_emails else None

    if not isinstance(clerk_user_id, str) or not clerk_user_id:
        _raise_unauthorized("Clerk token is missing a subject claim.")

    mapped_user = auth_user_repository.get_by_clerk_user_id(clerk_user_id)

    if mapped_user is None:
        resolved_client_access = client_access_service.resolve_client_access(
            clerk_user_id,
            emails=resolved_emails,
        )

        if resolved_client_access is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Authenticated Clerk user is not mapped to a Sendwise user.",
            )

        return AuthenticatedUser(
            id=resolved_client_access.access.id,
            clerk_user_id=clerk_user_id,
            email=resolved_client_access.access.email or primary_email,
            access_type=CLIENT_ACCESS,
            client_id=resolved_client_access.access.client_id,
            portal_slug=resolved_client_access.access.portal_slug,
            status=resolved_client_access.access.status,
            invitation_status=resolved_client_access.access.invitation_status,
            onboarding_required=resolved_client_access.onboarding_required,
        )

    return AuthenticatedUser(
        id=mapped_user.resolved_user_id,
        clerk_user_id=clerk_user_id,
        email=_extract_email(claims, mapped_user),
        access_type=mapped_user.access_type,
        client_id=None,
        portal_slug=None,
        status=mapped_user.status,
        invitation_status=None,
        onboarding_required=False,
    )


def require_auth_me_user(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    if current_user.access_type == CLIENT_ACCESS and current_user.status == "invited":
        return current_user

    if current_user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authenticated Sendwise user is not active.",
        )

    return current_user


def require_active_user(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    if current_user.status != "active" or current_user.onboarding_required:
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


def require_client_onboarding_user(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    if current_user.access_type != CLIENT_ACCESS or not current_user.client_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Client access is required for this endpoint.",
        )

    if current_user.status in {"suspended", "archived"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Client access is not available for this Sendwise account.",
        )

    return current_user
