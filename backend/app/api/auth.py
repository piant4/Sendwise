from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import AuthenticatedUser, get_current_user, require_auth_me_user
from app.schemas.auth import AuthMeResponse, DeleteAccountRequest, DeleteAccountResponse
from app.services.auth import (
    AccountDeletionService,
    InviteActivationService,
    get_account_deletion_service,
    get_invite_activation_service,
)
router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


def _get_exposed_portal_slug(current_user: AuthenticatedUser) -> str | None:
    if (
        current_user.status == "active"
        and (current_user.invitation_status or "pending") == "accepted"
    ):
        return current_user.portal_slug

    return None


@router.get("/me", response_model=AuthMeResponse)
def get_me(
    current_user: AuthenticatedUser = Depends(require_auth_me_user),
) -> AuthMeResponse:
    return AuthMeResponse(
        access_type=current_user.access_type,
        client_id=current_user.client_id,
        portal_slug=_get_exposed_portal_slug(current_user),
        email=current_user.email,
        status=current_user.status,
        invitation_status=current_user.invitation_status,
        onboarding_required=current_user.onboarding_required,
    )


@router.post("/onboarding", response_model=AuthMeResponse)
def complete_client_onboarding() -> AuthMeResponse:
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail=(
            "Questo flusso non e piu attivo. Accedi dal pannello o richiedi una nuova email di accesso."
        ),
    )


@router.get("/invite-context")
def get_invite_context(
    ticket: str = Query(..., min_length=1),
    invite_activation_service: InviteActivationService = Depends(
        get_invite_activation_service
    ),
) -> dict[str, str | None]:
    context = invite_activation_service.get_invite_context(ticket=ticket)
    return {
        "first_name": context.first_name,
        "last_name": context.last_name,
    }


@router.post("/delete-account", response_model=DeleteAccountResponse)
def delete_current_account(
    payload: DeleteAccountRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    account_deletion_service: AccountDeletionService = Depends(
        get_account_deletion_service
    ),
) -> DeleteAccountResponse:
    result = account_deletion_service.delete_current_account(
        current_user=current_user,
        confirmation_text=payload.confirmation_text,
    )
    return DeleteAccountResponse(
        deleted=True,
        redirect_to=result.redirect_to,
    )
