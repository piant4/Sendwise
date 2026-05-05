from fastapi import APIRouter, Depends

from app.core.security import require_api_key
from app.schemas.blocked_sends import BlockedSend
from app.schemas.campaigns import Campaign
from app.schemas.clients import Client, ClientContext, ClientUser
from app.schemas.common import CampaignStatus, ClientStatus, SendDecision
from app.schemas.usage import ApiUsage

router = APIRouter(
    prefix="/client",
    tags=["client"],
    dependencies=[Depends(require_api_key)],
)


def stub_response(endpoint: str) -> dict[str, str]:
    return {"status": "stub", "endpoint": endpoint}


# Milestone 0.5 stubs: all client endpoint payloads are fixed to one
# mock client scope. No auth, DB, service, deliverability, or listmonk logic.
MOCK_CLIENT_ID = "client_acme"

CLIENT_CONTEXT = ClientContext(
    client=Client(
        id=MOCK_CLIENT_ID,
        name="Acme Studio",
        status=ClientStatus.active,
        created_at="2026-05-01T09:00:00Z",
        updated_at="2026-05-05T09:00:00Z",
    ),
    user=ClientUser(
        id="user_acme_manager",
        client_id=MOCK_CLIENT_ID,
        email="manager@example.test",
        role="client_manager",
        created_at="2026-05-01T09:05:00Z",
        updated_at="2026-05-05T09:05:00Z",
    ),
)

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


@router.get("/me", response_model=ClientContext)
def get_me() -> ClientContext:
    return CLIENT_CONTEXT


@router.get("/campaigns", response_model=list[Campaign])
def list_campaigns() -> list[Campaign]:
    return CLIENT_CAMPAIGNS


@router.get("/campaigns/{campaign_id}")
def get_campaign(campaign_id: str) -> dict[str, str]:
    return stub_response(f"GET /client/campaigns/{campaign_id}")


@router.get("/campaigns/{campaign_id}/stats")
def get_campaign_stats(campaign_id: str) -> dict[str, str]:
    return stub_response(f"GET /client/campaigns/{campaign_id}/stats")


@router.get("/usage", response_model=list[ApiUsage])
def get_usage() -> list[ApiUsage]:
    return CLIENT_USAGE


@router.get("/blocked-sends", response_model=list[BlockedSend])
def get_blocked_sends() -> list[BlockedSend]:
    return CLIENT_BLOCKED_SENDS
