from fastapi import APIRouter, Depends

from app.api import auth as auth_api
from app.core.auth import AuthenticatedUser, require_client
from app.schemas.blocked_sends import BlockedSend
from app.schemas.campaigns import Campaign, ClientCampaignDetailResponse, ClientCampaignStatsResponse
from app.schemas.clients import ClientContext, ClientOverviewSummary
from app.schemas.usage import ApiUsage
from app.services.client_access import ClientAccessService, get_client_access_service
from app.services.clients import ClientsService, get_clients_service

client_router = APIRouter(
    prefix="/client",
    tags=["client"],
)

router = APIRouter()


def stub_response(endpoint: str) -> dict[str, str]:
    return {"status": "stub", "endpoint": endpoint}


@client_router.get("/me", response_model=ClientContext)
def get_me(
    current_user: AuthenticatedUser = Depends(require_client),
    clients_service: ClientsService = Depends(get_clients_service),
    client_access_service: ClientAccessService = Depends(get_client_access_service),
) -> ClientContext:
    return clients_service.get_client_context(
        client_id=current_user.client_id or "",
        portal_slug=current_user.portal_slug or "",
        client_access_service=client_access_service,
    )


@client_router.get("/overview", response_model=ClientOverviewSummary)
def get_overview(
    current_user: AuthenticatedUser = Depends(require_client),
    clients_service: ClientsService = Depends(get_clients_service),
    client_access_service: ClientAccessService = Depends(get_client_access_service),
) -> ClientOverviewSummary:
    return clients_service.get_client_overview(
        client_id=current_user.client_id or "",
        portal_slug=current_user.portal_slug or "",
        client_access_service=client_access_service,
    )


@client_router.get("/campaigns", response_model=list[Campaign])
def list_campaigns(
    current_user: AuthenticatedUser = Depends(require_client),
    clients_service: ClientsService = Depends(get_clients_service),
    client_access_service: ClientAccessService = Depends(get_client_access_service),
) -> list[Campaign]:
    return clients_service.list_client_campaigns(
        client_id=current_user.client_id or "",
        portal_slug=current_user.portal_slug or "",
        client_access_service=client_access_service,
    )


@client_router.get("/campaigns/{campaign_id}", response_model=ClientCampaignDetailResponse)
def get_campaign(
    campaign_id: str,
    current_user: AuthenticatedUser = Depends(require_client),
    clients_service: ClientsService = Depends(get_clients_service),
    client_access_service: ClientAccessService = Depends(get_client_access_service),
) -> ClientCampaignDetailResponse:
    return clients_service.get_client_campaign_detail(
        client_id=current_user.client_id or "",
        portal_slug=current_user.portal_slug or "",
        campaign_id=campaign_id,
        client_access_service=client_access_service,
    )


@client_router.get("/campaigns/{campaign_id}/stats", response_model=ClientCampaignStatsResponse)
def get_campaign_stats(
    campaign_id: str,
    current_user: AuthenticatedUser = Depends(require_client),
    clients_service: ClientsService = Depends(get_clients_service),
    client_access_service: ClientAccessService = Depends(get_client_access_service),
) -> ClientCampaignStatsResponse:
    return clients_service.get_client_campaign_stats(
        client_id=current_user.client_id or "",
        portal_slug=current_user.portal_slug or "",
        campaign_id=campaign_id,
        client_access_service=client_access_service,
    )


@client_router.get("/usage", response_model=list[ApiUsage])
def get_usage(
    current_user: AuthenticatedUser = Depends(require_client),
    clients_service: ClientsService = Depends(get_clients_service),
    client_access_service: ClientAccessService = Depends(get_client_access_service),
) -> list[ApiUsage]:
    return clients_service.list_client_usage(
        client_id=current_user.client_id or "",
        portal_slug=current_user.portal_slug or "",
        client_access_service=client_access_service,
    )


@client_router.get("/blocked-sends", response_model=list[BlockedSend])
def get_blocked_sends(
    current_user: AuthenticatedUser = Depends(require_client),
    clients_service: ClientsService = Depends(get_clients_service),
    client_access_service: ClientAccessService = Depends(get_client_access_service),
) -> list[BlockedSend]:
    return clients_service.list_client_blocked_sends(
        client_id=current_user.client_id or "",
        portal_slug=current_user.portal_slug or "",
        client_access_service=client_access_service,
    )


router.include_router(auth_api.router)
router.include_router(client_router)
