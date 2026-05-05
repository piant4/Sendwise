from copy import deepcopy

from app.core.current_client import get_current_client_id
from app.schemas.campaigns import Campaign
from app.schemas.clients import Client, ClientContext, ClientUser
from app.schemas.common import CampaignStatus, ClientStatus


MOCK_CLIENT_ID = get_current_client_id()
DEFAULT_CLIENT_STATUS = ClientStatus.active
CLIENT_LIFECYCLE_STATUSES = (
    ClientStatus.active,
    ClientStatus.paused,
    ClientStatus.blocked,
    ClientStatus.archived,
)

_ADMIN_CLIENTS: list[Client] = [
    Client(
        id=MOCK_CLIENT_ID,
        name="Acme Studio",
        status=DEFAULT_CLIENT_STATUS,
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
        status=DEFAULT_CLIENT_STATUS,
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


class ClientsRepository:
    """In-memory clients data boundary for Milestone 0.5 stubs."""

    def list_admin_clients(self) -> list[Client]:
        return deepcopy(_ADMIN_CLIENTS)

    def get_client(self, client_id: str) -> Client | None:
        for client in self.list_admin_clients():
            if client.id == client_id:
                return client
        return None

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
