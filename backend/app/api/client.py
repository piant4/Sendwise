from fastapi import APIRouter, Depends

from app.core.security import require_api_key
from app.schemas.blocked_sends import BlockedSend
from app.schemas.campaigns import Campaign
from app.schemas.clients import ClientContext
from app.schemas.usage import ApiUsage
from app.services.clients import ClientsService

router = APIRouter(
    prefix="/client",
    tags=["client"],
    dependencies=[Depends(require_api_key)],
)


clients_service = ClientsService()


@router.get("/me", response_model=ClientContext)
def get_me() -> ClientContext:
    return clients_service.get_current_client_context()


@router.get("/campaigns", response_model=list[Campaign])
def list_campaigns() -> list[Campaign]:
    return clients_service.list_current_client_campaigns()


@router.get("/campaigns/{campaign_id}")
def get_campaign(campaign_id: str) -> dict[str, str]:
    return clients_service.planned_client_stub(f"GET /client/campaigns/{campaign_id}")


@router.get("/campaigns/{campaign_id}/stats")
def get_campaign_stats(campaign_id: str) -> dict[str, str]:
    return clients_service.planned_client_stub(f"GET /client/campaigns/{campaign_id}/stats")


@router.get("/usage", response_model=list[ApiUsage])
def get_usage() -> list[ApiUsage]:
    return clients_service.list_current_client_usage()


@router.get("/blocked-sends", response_model=list[BlockedSend])
def get_blocked_sends() -> list[BlockedSend]:
    return clients_service.list_current_client_blocked_sends()
