from fastapi import APIRouter, Depends

from app.core.auth import (
    AuthenticatedUser,
    get_current_user,
    require_auth_me_user,
    require_client_onboarding_user,
)
from app.schemas.auth import (
    AuthMeResponse,
    CompleteClientOnboardingRequest,
    DeleteAccountRequest,
    DeleteAccountResponse,
)
from app.services.auth import (
    AccountDeletionService,
    get_account_deletion_service,
)
from app.services.client_access import ClientAccessService, get_client_access_service

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


@router.get("/me", response_model=AuthMeResponse)
def get_me(
    current_user: AuthenticatedUser = Depends(require_auth_me_user),
) -> AuthMeResponse:
    return AuthMeResponse(
        access_type=current_user.access_type,
        client_id=current_user.client_id,
        portal_slug=current_user.portal_slug,
        email=current_user.email,
        status=current_user.status,
        invitation_status=current_user.invitation_status,
        onboarding_required=current_user.onboarding_required,
    )


@router.post("/onboarding", response_model=AuthMeResponse)
def complete_client_onboarding(
    payload: CompleteClientOnboardingRequest,
    current_user: AuthenticatedUser = Depends(require_client_onboarding_user),
    client_access_service: ClientAccessService = Depends(get_client_access_service),
) -> AuthMeResponse:
    resolved_access = client_access_service.complete_onboarding(
        clerk_user_id=current_user.clerk_user_id,
        emails=[current_user.email] if current_user.email else [],
        personal_name=payload.personal_name,
    )
    return AuthMeResponse(
        access_type="client",
        client_id=resolved_access.access.client_id,
        portal_slug=resolved_access.access.portal_slug,
        email=resolved_access.access.email,
        status=resolved_access.access.status,
        invitation_status=resolved_access.access.invitation_status,
        onboarding_required=resolved_access.onboarding_required,
    )


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
