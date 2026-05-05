from copy import deepcopy

from app.schemas.blocked_sends import BlockedSend
from app.schemas.campaigns import Campaign
from app.schemas.clients import Client, ClientContext, ClientUser
from app.schemas.common import CampaignStatus, ClientStatus, SendDecision
from app.schemas.usage import ApiUsage


MOCK_CLIENT_ID = "client_acme"

_ADMIN_CLIENTS: list[Client] = [
    Client(
        id="client_acme",
        name="Acme Studio",
        status=ClientStatus.active,
        created_at="2026-05-01T09:00:00Z",
        updated_at="2026-05-05T09:00:00Z",
    ),
    Client(
        id="client_nova",
        name="Nova Retail",
        status=ClientStatus.trial,
        created_at="2026-05-02T10:30:00Z",
        updated_at="2026-05-05T10:30:00Z",
    ),
]

_CLIENT_CONTEXT = ClientContext(
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

_CLIENT_CAMPAIGNS: list[Campaign] = [
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

_CLIENT_USAGE: list[ApiUsage] = [
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

_CLIENT_BLOCKED_SENDS: list[BlockedSend] = [
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


class ClientsRepository:
    """In-memory clients data boundary for Milestone 0.5 stubs."""

    def list_admin_clients(self) -> list[Client]:
        return deepcopy(_ADMIN_CLIENTS)

    def get_current_client_context(self) -> ClientContext:
        return deepcopy(_CLIENT_CONTEXT)

    def list_current_client_campaigns(self, client_id: str) -> list[Campaign]:
        return deepcopy(
            [
                campaign
                for campaign in _CLIENT_CAMPAIGNS
                if campaign.client_id == client_id
            ]
        )

    def list_current_client_usage(self, client_id: str) -> list[ApiUsage]:
        return deepcopy(
            [usage for usage in _CLIENT_USAGE if usage.client_id == client_id]
        )

    def list_current_client_blocked_sends(self, client_id: str) -> list[BlockedSend]:
        return deepcopy(
            [
                blocked_send
                for blocked_send in _CLIENT_BLOCKED_SENDS
                if blocked_send.client_id == client_id
            ]
        )
