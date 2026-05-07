from fastapi import APIRouter, Depends, status

from app.core.auth import AuthenticatedUser, require_authenticated_user

router = APIRouter(
    prefix="/campaigns",
    tags=["campaigns"],
)


def stub_response(endpoint: str) -> dict[str, str]:
    return {"status": "stub", "endpoint": endpoint}


@router.post("", status_code=status.HTTP_202_ACCEPTED)
def create_campaign(
    _current_user: AuthenticatedUser = Depends(require_authenticated_user),
) -> dict[str, str]:
    return stub_response("POST /campaigns")


@router.post("/{campaign_id}/authorize")
def authorize_campaign(
    campaign_id: str,
    _current_user: AuthenticatedUser = Depends(require_authenticated_user),
) -> dict[str, str]:
    return stub_response(f"POST /campaigns/{campaign_id}/authorize")


@router.post("/{campaign_id}/send")
def send_campaign(
    campaign_id: str,
    _current_user: AuthenticatedUser = Depends(require_authenticated_user),
) -> dict[str, str]:
    return stub_response(f"POST /campaigns/{campaign_id}/send")
