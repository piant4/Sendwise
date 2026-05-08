from __future__ import annotations

import secrets
import string
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import Depends, HTTPException, status
from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.repositories.client_access import (
    ClientAccessRecord,
    ClientAccessRepository,
    get_client_access_repository,
)
from app.repositories.clients import ClientRecord, ClientRepository, get_client_repository

PORTAL_SLUG_ALPHABET = string.ascii_lowercase + string.digits
PORTAL_SLUG_LENGTH = 32
ACTIVE_CLIENT_ACCESS_STATUSES = {"active", "invited"}


class ClerkInvitationResult(BaseModel):
    id: str
    status: str


class ClerkInvitationGateway:
    def create_invitation(
        self,
        *,
        email: str,
        redirect_url: str,
    ) -> ClerkInvitationResult:
        raise NotImplementedError


class HttpClerkInvitationGateway(ClerkInvitationGateway):
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def create_invitation(
        self,
        *,
        email: str,
        redirect_url: str,
    ) -> ClerkInvitationResult:
        if not self._settings.clerk_secret_key.strip():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="CLERK_SECRET_KEY is required for client invitations.",
            )

        response = httpx.post(
            f"{self._settings.clerk_api_base_url.rstrip('/')}/invitations",
            headers={
                "Authorization": f"Bearer {self._settings.clerk_secret_key}",
                "Content-Type": "application/json",
            },
            json={
                "email_address": email,
                "redirect_url": redirect_url,
                "notify": True,
                "ignore_existing": True,
            },
            timeout=10.0,
        )

        if response.status_code >= 400:
            detail = response.text.strip() or "Unknown Clerk invitation error."
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Clerk invitation request failed: {detail}",
            )

        payload = response.json()
        return ClerkInvitationResult(
            id=str(payload["id"]),
            status=str(payload.get("status") or "pending"),
        )


@dataclass
class InviteClientAccessResult:
    client: ClientRecord
    access: ClientAccessRecord


def normalize_email(email: str) -> str:
    normalized_email = email.strip().lower()

    if not normalized_email:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Client email is required.",
        )

    return normalized_email


def is_valid_portal_slug(portal_slug: Optional[str]) -> bool:
    if portal_slug is None:
        return False

    return (
        len(portal_slug) >= PORTAL_SLUG_LENGTH
        and portal_slug.isalnum()
        and portal_slug == portal_slug.strip()
    )


class ClientAccessService:
    def __init__(
        self,
        repository: ClientAccessRepository,
        client_repository: ClientRepository,
        invitation_gateway: ClerkInvitationGateway,
        settings: Settings,
    ) -> None:
        self._repository = repository
        self._client_repository = client_repository
        self._invitation_gateway = invitation_gateway
        self._settings = settings

    def resolve_client_access(
        self,
        clerk_user_id: str,
        email: Optional[str] = None,
    ) -> Optional[ClientAccessRecord]:
        record = self._repository.get_by_clerk_user_id(clerk_user_id)

        if record is None and email:
            record = self._repository.claim_invited_access(
                clerk_user_id=clerk_user_id,
                email=email,
            )

        if record is None:
            return None

        if not is_valid_portal_slug(record.portal_slug):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Client access is missing a valid portal slug.",
            )

        return record

    def get_access_by_client_id(self, client_id: str) -> Optional[ClientAccessRecord]:
        return self._repository.get_by_client_id(client_id)

    def invite_client_access(
        self,
        *,
        email: str,
        personal_name: Optional[str],
        company_name: Optional[str],
    ) -> InviteClientAccessResult:
        normalized_email = normalize_email(email)
        client = self._upsert_client_profile(
            email=normalized_email,
            personal_name=personal_name,
            company_name=company_name,
        )
        existing_access = self._repository.get_by_client_id(client.id)
        conflicting_access = self._repository.get_by_email(normalized_email)

        if (
            conflicting_access is not None
            and conflicting_access.client_id != client.id
            and conflicting_access.status in ACTIVE_CLIENT_ACCESS_STATUSES
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email is already assigned to another active client access.",
            )

        portal_slug = self._resolve_portal_slug(existing_access)
        invitation = self._invitation_gateway.create_invitation(
            email=normalized_email,
            redirect_url=self._build_invitation_redirect_url(),
        )
        invited_at = datetime.now(timezone.utc)
        access = self._repository.upsert_invited_access(
            client_id=client.id,
            email=normalized_email,
            clerk_invitation_id=invitation.id,
            portal_slug=portal_slug,
            invited_at=invited_at,
        )

        return InviteClientAccessResult(client=client, access=access)

    def _build_invitation_redirect_url(self) -> str:
        return f"{self._settings.frontend_url.rstrip('/')}/auth/redirect"

    def _upsert_client_profile(
        self,
        *,
        email: str,
        personal_name: Optional[str],
        company_name: Optional[str],
    ) -> ClientRecord:
        existing = self._client_repository.get_by_email(email)

        if existing is None:
            return self._client_repository.create_client(
                email=email,
                personal_name=personal_name,
                company_name=company_name,
                status="active",
            )

        return self._client_repository.update_client(
            client_id=existing.id,
            email=email,
            personal_name=personal_name,
            company_name=company_name,
        )

    def _resolve_portal_slug(self, existing_access: Optional[ClientAccessRecord]) -> str:
        if existing_access is not None:
            if not is_valid_portal_slug(existing_access.portal_slug):
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Existing client access has an invalid portal slug.",
                )

            return existing_access.portal_slug

        for _ in range(10):
            portal_slug = "".join(
                secrets.choice(PORTAL_SLUG_ALPHABET) for _ in range(PORTAL_SLUG_LENGTH)
            )

            if self._repository.get_by_portal_slug(portal_slug) is None:
                return portal_slug

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to allocate a unique portal slug.",
        )


def get_clerk_invitation_gateway(
    settings: Settings = Depends(get_settings),
) -> ClerkInvitationGateway:
    return HttpClerkInvitationGateway(settings)


def get_client_access_service(
    repository: ClientAccessRepository = Depends(get_client_access_repository),
    client_repository: ClientRepository = Depends(get_client_repository),
    invitation_gateway: ClerkInvitationGateway = Depends(get_clerk_invitation_gateway),
    settings: Settings = Depends(get_settings),
) -> ClientAccessService:
    return ClientAccessService(
        repository=repository,
        client_repository=client_repository,
        invitation_gateway=invitation_gateway,
        settings=settings,
    )
