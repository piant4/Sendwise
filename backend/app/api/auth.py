from fastapi import APIRouter, Depends

from app.core.auth import AuthenticatedUser, require_active_user
from app.schemas.auth import AuthMeResponse

router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


@router.get("/me", response_model=AuthMeResponse)
def get_me(
    current_user: AuthenticatedUser = Depends(require_active_user),
) -> AuthMeResponse:
    return AuthMeResponse(
        access_type=current_user.access_type,
        client_id=current_user.client_id,
        email=current_user.email,
        status=current_user.status,
    )
