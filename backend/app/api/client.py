from fastapi import APIRouter, Depends

from app.api import auth as auth_api
from app.core.auth import AuthenticatedUser, require_client
from app.schemas.blocked_sends import BlockedSend
from app.schemas.campaigns import Campaign
from app.schemas.clients import ClientContext, ClientUser
from app.schemas.common import CampaignStatus, SendDecision
from app.schemas.usage import ApiUsage
from app.services.clients import ClientsService, build_client_schema, get_clients_service

client_router = APIRouter(
    prefix="/client",
    tags=["client"],
)

router = APIRouter()


def stub_response(endpoint: str) -> dict[str, str]:
    return {"status": "stub", "endpoint": endpoint}


# Milestone 0.5 stubs: all client endpoint payloads are fixed to one
# mock client scope. No auth, DB, service, deliverability, or listmonk logic.
MOCK_CLIENT_ID = "client_acme"

DEFAULT_CREATED_AT = "2026-05-01T09:00:00Z"
DEFAULT_UPDATED_AT = "2026-05-05T09:05:00Z"

CLIENT_CAMPAIGNS: list[Campaign] = [
    Campaign(
        id="campaign_acme_welcome",
        client_id=MOCK_CLIENT_ID,
        name="Welcome Series",
        status=CampaignStatus.ready,
        subject="Welcome to Acme Studio",
        created_at="2026-05-03T08:00:00Z",
        updated_at="2026-05-05T08:00:00Z",
    ),
    Campaign(
        id="campaign_acme_reactivation",
        client_id=MOCK_CLIENT_ID,
        name="Reactivation Draft",
        status=CampaignStatus.draft,
        subject="We saved your preferences",
        created_at="2026-05-04T14:00:00Z",
        updated_at="2026-05-05T14:00:00Z",
    ),
]

CLIENT_USAGE: list[ApiUsage] = [
    ApiUsage(
        id="usage_acme_api",
        client_id=MOCK_CLIENT_ID,
        usage_type="api_requests",
        quantity=42,
        metadata={"period": "2026-05"},
        created_at="2026-05-05T12:00:00Z",
    ),
    ApiUsage(
        id="usage_acme_dry_runs",
        client_id=MOCK_CLIENT_ID,
        usage_type="dry_run_sends",
        quantity=3,
        metadata={"period": "2026-05"},
        created_at="2026-05-05T12:05:00Z",
    ),
]

CLIENT_BLOCKED_SENDS: list[BlockedSend] = [
    BlockedSend(
        id="blocked_acme_001",
        client_id=MOCK_CLIENT_ID,
        campaign_id="campaign_acme_reactivation",
        contact_id="contact_acme_001",
        reason="Milestone 0.5 fake blocked send for UI contract testing.",
        decision=SendDecision.blocked,
        created_at="2026-05-05T12:10:00Z",
    )
]

def build_client_context(
    current_user: AuthenticatedUser,
    clients_service: ClientsService,
) -> ClientContext:
    client_record = clients_service.get_client_by_id(current_user.client_id or "")
    client = build_client_schema(client_record)
    return ClientContext(
        client=client,
        user=ClientUser(
            id=current_user.id or current_user.clerk_user_id,
            client_id=client.id,
            email=current_user.email or "unavailable@sendwise.invalid",
            portal_slug=current_user.portal_slug or "",
            status=current_user.status,
            created_at=DEFAULT_CREATED_AT,
            updated_at=DEFAULT_UPDATED_AT,
        ),
    )


@client_router.get("/me", response_model=ClientContext)
def get_me(
    current_user: AuthenticatedUser = Depends(require_client),
    clients_service: ClientsService = Depends(get_clients_service),
) -> ClientContext:
    return build_client_context(current_user, clients_service)


def _clone_campaign_for_client(campaign: Campaign, client_id: str) -> Campaign:
    return campaign.model_copy(update={"client_id": client_id})


def _clone_usage_for_client(usage: ApiUsage, client_id: str) -> ApiUsage:
    return usage.model_copy(update={"client_id": client_id})


def _clone_blocked_send_for_client(
    blocked_send: BlockedSend,
    client_id: str,
) -> BlockedSend:
    return blocked_send.model_copy(update={"client_id": client_id})


@client_router.get("/campaigns", response_model=list[Campaign])
def list_campaigns(
    current_user: AuthenticatedUser = Depends(require_client),
) -> list[Campaign]:
    campaigns = [
        campaign
        for campaign in CLIENT_CAMPAIGNS
        if campaign.client_id == current_user.client_id
    ]

    if campaigns:
        return campaigns

    return [
        _clone_campaign_for_client(campaign, current_user.client_id or MOCK_CLIENT_ID)
        for campaign in CLIENT_CAMPAIGNS
    ]


@client_router.get("/campaigns/{campaign_id}")
def get_campaign(
    campaign_id: str, _current_user: AuthenticatedUser = Depends(require_client)
) -> dict[str, str]:
    return stub_response(f"GET /client/campaigns/{campaign_id}")


@client_router.get("/campaigns/{campaign_id}/stats")
def get_campaign_stats(
    campaign_id: str, _current_user: AuthenticatedUser = Depends(require_client)
) -> dict[str, str]:
    return stub_response(f"GET /client/campaigns/{campaign_id}/stats")


@client_router.get("/usage", response_model=list[ApiUsage])
def get_usage(current_user: AuthenticatedUser = Depends(require_client)) -> list[ApiUsage]:
    usage = [entry for entry in CLIENT_USAGE if entry.client_id == current_user.client_id]

    if usage:
        return usage

    return [
        _clone_usage_for_client(entry, current_user.client_id or MOCK_CLIENT_ID)
        for entry in CLIENT_USAGE
    ]


@client_router.get("/blocked-sends", response_model=list[BlockedSend])
def get_blocked_sends(
    current_user: AuthenticatedUser = Depends(require_client),
) -> list[BlockedSend]:
    blocked_sends = [
        blocked_send
        for blocked_send in CLIENT_BLOCKED_SENDS
        if blocked_send.client_id == current_user.client_id
    ]

    if blocked_sends:
        return blocked_sends

    return [
        _clone_blocked_send_for_client(
            blocked_send,
            current_user.client_id or MOCK_CLIENT_ID,
        )
        for blocked_send in CLIENT_BLOCKED_SENDS
    ]


router.include_router(auth_api.router)
router.include_router(client_router)
