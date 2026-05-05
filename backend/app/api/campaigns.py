from fastapi import APIRouter, Depends, status

from app.core.security import require_api_key
from app.services.campaigns import CampaignsService

router = APIRouter(
    prefix="/campaigns",
    tags=["campaigns"],
    dependencies=[Depends(require_api_key)],
)


campaigns_service = CampaignsService()


@router.post("", status_code=status.HTTP_202_ACCEPTED)
def create_campaign() -> dict[str, str]:
    return campaigns_service.create_campaign()


@router.post("/{campaign_id}/authorize")
def authorize_campaign(campaign_id: str) -> dict[str, str]:
    return campaigns_service.authorize_campaign(campaign_id)


@router.post("/{campaign_id}/send")
def send_campaign(campaign_id: str) -> dict[str, str]:
    return campaigns_service.send_campaign(campaign_id)
