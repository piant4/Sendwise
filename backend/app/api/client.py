from fastapi import APIRouter, Depends

from app.api import auth as auth_api
from app.core.auth import AuthenticatedUser, require_client
from app.schemas.blocked_sends import BlockedSend
from app.schemas.campaigns import Campaign
from app.schemas.clients import Client, ClientContext, ClientUser
from app.schemas.common import CampaignStatus, ClientStatus, SendDecision
from app.schemas.usage import ApiUsage

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

CLIENT_DIRECTORY: dict[str, Client] = {
    MOCK_CLIENT_ID: Client(
        id=MOCK_CLIENT_ID,
        name="Acme Studio",
        status=ClientStatus.active,
        created_at=DEFAULT_CREATED_AT,
        updated_at="2026-05-05T09:00:00Z",
    )
}


def build_client_context(current_user: AuthenticatedUser) -> ClientContext:
    client = CLIENT_DIRECTORY.get(current_user.client_id or "")

    if client is None:
        client = Client(
            id=current_user.client_id or MOCK_CLIENT_ID,
            name="Client scope",
            status=ClientStatus.active,
            created_at=DEFAULT_CREATED_AT,
            updated_at=DEFAULT_UPDATED_AT,
        )

    return ClientContext(
        client=client,
        user=ClientUser(
            id=current_user.id,
            client_id=client.id,
            email=current_user.email or "unavailable@sendwise.invalid",
            role=current_user.role,
            created_at=DEFAULT_CREATED_AT,
            updated_at=DEFAULT_UPDATED_AT,
        ),
    )


@client_router.get("/me", response_model=ClientContext)
def get_me(current_user: AuthenticatedUser = Depends(require_client)) -> ClientContext:
    return build_client_context(current_user)


@client_router.get("/campaigns", response_model=list[Campaign])
def list_campaigns(
    current_user: AuthenticatedUser = Depends(require_client),
) -> list[Campaign]:
    return [
        campaign
        for campaign in CLIENT_CAMPAIGNS
        if campaign.client_id == current_user.client_id
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
    return [usage for usage in CLIENT_USAGE if usage.client_id == current_user.client_id]


@client_router.get("/blocked-sends", response_model=list[BlockedSend])
def get_blocked_sends(
    current_user: AuthenticatedUser = Depends(require_client),
) -> list[BlockedSend]:
    return [
        blocked_send
        for blocked_send in CLIENT_BLOCKED_SENDS
        if blocked_send.client_id == current_user.client_id
    ]


router.include_router(auth_api.router)
router.include_router(client_router)
