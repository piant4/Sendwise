from fastapi import APIRouter, Depends, status

from app.core.auth import AuthenticatedUser, require_active_user
from app.integrations.listmonk.client import ListmonkError
from app.services.campaign_preparation import (
    CampaignPreparationService,
    get_campaign_preparation_service,
)
from app.services.campaigns import CampaignDispatchService, get_campaign_dispatch_service
from app.services.send_simulation import (
    SendSimulationService,
    get_send_simulation_service,
)

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
            "mode": "controlled_dev",
            "campaign_id": campaign_id,
            "allowed": False,
            "decision": "authorized",
            "reason": str(error),
            "code": "listmonk_dispatch_failed",
            "severity": "error",
            "dispatch_attempted": False,
            "real_send_attempted": False,
            "listmonk_prepared": False,
            "listmonk_dispatched": False,
            "content_ready": False,
            "email_logs_created": 0,
            "email_logs_updated": 0,
        }


@router.post("/{campaign_id}/simulate-send")
def simulate_send_campaign(
    campaign_id: str,
    current_user: AuthenticatedUser = Depends(require_active_user),
    send_simulation_service: SendSimulationService = Depends(
        get_send_simulation_service
    ),
) -> dict[str, object]:
    try:
        return send_simulation_service.simulate_campaign_send(campaign_id, current_user)
    except ListmonkError as error:
        return {
            "status": "simulation_failed",
            "mode": "simulation",
            "campaign_id": campaign_id,
            "decision": "authorized",
            "reason": str(error),
            "listmonk_dispatched": False,
            "real_send_attempted": False,
            "email_logs_created": 0,
        }
