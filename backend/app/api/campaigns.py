from fastapi import APIRouter, Depends, status

from app.core.auth import AuthenticatedUser, require_active_user
from app.integrations.listmonk.client import ListmonkError
from app.services.campaign_preparation import (
    CampaignPreparationService,
    get_campaign_preparation_service,
)
from app.services.campaigns import CampaignDispatchService, get_campaign_dispatch_service

router = APIRouter(
    prefix="/campaigns",
    tags=["campaigns"],
)


def stub_response(endpoint: str) -> dict[str, str]:
    return {"status": "stub", "endpoint": endpoint}


@router.post("", status_code=status.HTTP_202_ACCEPTED)
def create_campaign(
    _current_user: AuthenticatedUser = Depends(require_active_user),
) -> dict[str, str]:
    return stub_response("POST /campaigns")


@router.post("/{campaign_id}/authorize")
def authorize_campaign(
    campaign_id: str,
    _current_user: AuthenticatedUser = Depends(require_active_user),
) -> dict[str, str]:
    return stub_response(f"POST /campaigns/{campaign_id}/authorize")


@router.post("/{campaign_id}/sync-listmonk")
def sync_campaign_listmonk(
    campaign_id: str,
    current_user: AuthenticatedUser = Depends(require_active_user),
    campaign_preparation_service: CampaignPreparationService = Depends(
        get_campaign_preparation_service
    ),
) -> dict[str, object]:
    try:
        return campaign_preparation_service.prepare_campaign(campaign_id, current_user)
    except ListmonkError as error:
        return {
            "status": "sync_failed",
            "campaign_id": campaign_id,
            "listmonk_synced": False,
            "reason": str(error),
        }


@router.post("/{campaign_id}/send")
def send_campaign(
    campaign_id: str,
    current_user: AuthenticatedUser = Depends(require_active_user),
    campaign_dispatch_service: CampaignDispatchService = Depends(
        get_campaign_dispatch_service
    ),
) -> dict[str, object]:
    try:
        return campaign_dispatch_service.send_campaign(campaign_id, current_user)
    except ListmonkError as error:
        return {
            "status": "dispatch_failed",
            "campaign_id": campaign_id,
            "decision": "authorized",
            "reason": str(error),
            "listmonk_dispatched": False,
        }
