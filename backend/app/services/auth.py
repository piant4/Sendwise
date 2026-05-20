from __future__ import annotations

import secrets
from dataclasses import dataclass
from urllib.parse import parse_qs, urlsplit

import httpx
from fastapi import Depends, HTTPException, status

from app.core.auth import AuthenticatedUser
from app.core.config import Settings, get_settings
from app.repositories.client_access import (
    ClientAccessRepository,
    get_client_access_repository,
)
from app.repositories.clients import ClientRepository, get_client_repository

DELETE_ACCOUNT_CONFIRMATION = "ELIMINA"


class ClerkUserDeletionGateway:
    def delete_user(self, clerk_user_id: str) -> None:
        raise NotImplementedError


class HttpClerkUserDeletionGateway(ClerkUserDeletionGateway):
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def delete_user(self, clerk_user_id: str) -> None:
        if not self._settings.clerk_secret_key.strip():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="CLERK_SECRET_KEY is required for permanent account deletion.",
            )

        try:
            response = httpx.delete(
                f"{self._settings.clerk_api_base_url.rstrip('/')}/users/{clerk_user_id}",
                headers={"Authorization": f"Bearer {self._settings.clerk_secret_key}"},
                timeout=10.0,
            )
        except httpx.RequestError as error:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Unable to reach Clerk while deleting the account.",
            ) from error

        if response.status_code < 400:
            return

        detail = "Clerk refused the permanent account deletion request."
        try:
            payload = response.json()
        except ValueError:
            payload = None

        errors = payload.get("errors") if isinstance(payload, dict) else None
        first_error = errors[0] if isinstance(errors, list) and errors else None

        if isinstance(first_error, dict):
            detail = (
                first_error.get("long_message")
                or first_error.get("message")
                or detail
            )

        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=detail,
        )


@dataclass
class DeleteAccountResult:
    redirect_to: str


@dataclass
class InviteActivationContext:
    first_name: str | None
    last_name: str | None


class InviteActivationService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def get_invite_context(self, *, ticket: str) -> InviteActivationContext:
        normalized_ticket = ticket.strip()
        if not normalized_ticket:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invite ticket is required.",
            )

        invitation = self._find_invitation_by_ticket(ticket=normalized_ticket)
        if invitation is None:
            return InviteActivationContext(first_name=None, last_name=None)

        metadata = invitation.get("public_metadata", invitation.get("publicMetadata"))
        if not isinstance(metadata, dict):
            return InviteActivationContext(first_name=None, last_name=None)

        return InviteActivationContext(
            first_name=self._normalize_optional_text(
                metadata.get("sendwise_first_name")
            ),
            last_name=self._normalize_optional_text(
                metadata.get("sendwise_last_name")
            ),
        )

    def _find_invitation_by_ticket(self, *, ticket: str) -> dict[str, object] | None:
        offset = 0
        limit = 100
        total_count = 1

        while offset < total_count and offset < 500:
            page = self._list_pending_invitations(limit=limit, offset=offset)
            items = page.get("data")
            if not isinstance(items, list):
                break

            for item in items:
                if not isinstance(item, dict):
                    continue

                invitation_url = item.get("url")
                if not isinstance(invitation_url, str) or not invitation_url:
                    continue

                invitation_ticket = parse_qs(urlsplit(invitation_url).query).get(
                    "__clerk_ticket",
                    [None],
                )[0]
                if isinstance(invitation_ticket, str) and secrets.compare_digest(
                    invitation_ticket,
                    ticket,
                ):
                    return item

            total_count = self._coerce_total_count(
                page.get("total_count", page.get("totalCount"))
            )
            offset += limit

        return None

    def _list_pending_invitations(
        self,
        *,
        limit: int,
        offset: int,
    ) -> dict[str, object]:
        if not self._settings.clerk_secret_key.strip():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="CLERK_SECRET_KEY is required for invite activation lookup.",
            )

        try:
            response = httpx.get(
                f"{self._settings.clerk_api_base_url.rstrip('/')}/invitations",
                headers={"Authorization": f"Bearer {self._settings.clerk_secret_key}"},
                params={"status": "pending", "limit": limit, "offset": offset},
                timeout=10.0,
            )
        except httpx.RequestError as error:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Unable to reach Clerk while loading the invite context.",
            ) from error

        if response.status_code >= 400:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Clerk invite lookup failed.",
            )

        payload = response.json()
        if not isinstance(payload, dict):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Clerk invite lookup returned an invalid payload.",
            )

        return payload

    def _coerce_total_count(self, value: object) -> int:
        if isinstance(value, int) and value >= 0:
            return value

        return 0

    def _normalize_optional_text(self, value: object) -> str | None:
        if not isinstance(value, str):
            return None

        normalized_value = value.strip()
        return normalized_value or None


class AccountDeletionService:
    def __init__(
        self,
        *,
        client_repository: ClientRepository,
        client_access_repository: ClientAccessRepository,
        clerk_user_gateway: ClerkUserDeletionGateway,
    ) -> None:
        self._client_repository = client_repository
        self._client_access_repository = client_access_repository
        self._clerk_user_gateway = clerk_user_gateway

    def delete_current_account(
        self,
        *,
        current_user: AuthenticatedUser,
        confirmation_text: str,
    ) -> DeleteAccountResult:
        if current_user.access_type != "client" or not current_user.client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Platform admins cannot delete their own account from Sendwise settings.",
            )

        if confirmation_text.strip().upper() != DELETE_ACCOUNT_CONFIRMATION:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Type ELIMINA to confirm the permanent account deletion.",
            )

        access = self._client_access_repository.get_by_client_id(current_user.client_id)

        if access is None or access.clerk_user_id != current_user.clerk_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Authenticated Clerk user is not mapped to a deletable Sendwise client account.",
            )

        if self._client_repository.get_by_id(current_user.client_id) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client account not found for permanent deletion.",
            )

        self._clerk_user_gateway.delete_user(current_user.clerk_user_id)

        self._client_access_repository.delete_by_client_id(current_user.client_id)

        if not self._client_repository.delete_client_account(current_user.client_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client account not found for permanent deletion.",
            )

        return DeleteAccountResult(redirect_to="/")


def get_clerk_user_deletion_gateway(
    settings: Settings = Depends(get_settings),
) -> ClerkUserDeletionGateway:
    return HttpClerkUserDeletionGateway(settings)


def get_invite_activation_service(
    settings: Settings = Depends(get_settings),
) -> InviteActivationService:
    return InviteActivationService(settings)


def get_account_deletion_service(
    client_repository: ClientRepository = Depends(get_client_repository),
    client_access_repository: ClientAccessRepository = Depends(
        get_client_access_repository
    ),
    clerk_user_gateway: ClerkUserDeletionGateway = Depends(
        get_clerk_user_deletion_gateway
    ),
) -> AccountDeletionService:
    return AccountDeletionService(
        client_repository=client_repository,
        client_access_repository=client_access_repository,
        clerk_user_gateway=clerk_user_gateway,
    )
