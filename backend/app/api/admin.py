from fastapi import APIRouter, Depends, status

from app.core.auth import AuthenticatedUser, require_admin
from app.schemas.campaigns import Campaign
from app.schemas.clients import Client
from app.schemas.common import CampaignStatus, ClientStatus

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
)


def stub_response(endpoint: str) -> dict[str, str]:
    return {"status": "stub", "endpoint": endpoint}


# Milestone 0.5 stubs: stable mock payloads only. No auth, DB, service,
# deliverability, or listmonk logic belongs in this router milestone.
ADMIN_CLIENTS: list[Client] = [
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

ADMIN_CAMPAIGNS: list[Campaign] = [
    Campaign(
        id="campaign_acme_welcome",
        client_id="client_acme",
        name="Welcome Series",
        status=CampaignStatus.ready,
        subject="Welcome to Acme Studio",
        created_at="2026-05-03T08:00:00Z",
        updated_at="2026-05-05T08:00:00Z",
    ),
    Campaign(
        id="campaign_nova_launch",
        client_id="client_nova",
        name="Spring Launch",
        status=CampaignStatus.draft,
        subject="Spring preview",
        created_at="2026-05-04T11:00:00Z",
        updated_at="2026-05-05T11:00:00Z",
    ),
]


@router.get("/clients", response_model=list[Client])
def list_clients(_current_user: AuthenticatedUser = Depends(require_admin)) -> list[Client]:
    return ADMIN_CLIENTS


@router.post("/clients", status_code=status.HTTP_202_ACCEPTED)
def create_client(
    _current_user: AuthenticatedUser = Depends(require_admin),
) -> dict[str, str]:
    return stub_response("POST /admin/clients")


@router.get("/clients/{client_id}")
def get_client(
    client_id: str, _current_user: AuthenticatedUser = Depends(require_admin)
) -> dict[str, str]:
    return stub_response(f"GET /admin/clients/{client_id}")


@router.patch("/clients/{client_id}")
def update_client(
    client_id: str, _current_user: AuthenticatedUser = Depends(require_admin)
) -> dict[str, str]:
    return stub_response(f"PATCH /admin/clients/{client_id}")


@router.post("/clients/{client_id}/pause")
def pause_client(
    client_id: str, _current_user: AuthenticatedUser = Depends(require_admin)
) -> dict[str, str]:
    return stub_response(f"POST /admin/clients/{client_id}/pause")


@router.post("/clients/{client_id}/resume")
def resume_client(
    client_id: str, _current_user: AuthenticatedUser = Depends(require_admin)
) -> dict[str, str]:
    return stub_response(f"POST /admin/clients/{client_id}/resume")


@router.post("/clients/{client_id}/block")
def block_client(
    client_id: str, _current_user: AuthenticatedUser = Depends(require_admin)
) -> dict[str, str]:
    return stub_response(f"POST /admin/clients/{client_id}/block")


@router.post("/clients/{client_id}/archive")
def archive_client(
    client_id: str, _current_user: AuthenticatedUser = Depends(require_admin)
) -> dict[str, str]:
    return stub_response(f"POST /admin/clients/{client_id}/archive")


@router.get("/clients/{client_id}/campaigns")
def list_client_campaigns(
    client_id: str, _current_user: AuthenticatedUser = Depends(require_admin)
) -> dict[str, str]:
    return stub_response(f"GET /admin/clients/{client_id}/campaigns")


@router.get("/clients/{client_id}/usage")
def get_client_usage(
    client_id: str, _current_user: AuthenticatedUser = Depends(require_admin)
) -> dict[str, str]:
    return stub_response(f"GET /admin/clients/{client_id}/usage")


@router.get("/clients/{client_id}/blocked-sends")
def list_client_blocked_sends(
    client_id: str, _current_user: AuthenticatedUser = Depends(require_admin)
) -> dict[str, str]:
    return stub_response(f"GET /admin/clients/{client_id}/blocked-sends")


@router.get("/campaigns", response_model=list[Campaign])
def list_campaigns(
    _current_user: AuthenticatedUser = Depends(require_admin),
) -> list[Campaign]:
    return ADMIN_CAMPAIGNS


@router.get("/campaigns/{campaign_id}")
def get_campaign(
    campaign_id: str, _current_user: AuthenticatedUser = Depends(require_admin)
) -> dict[str, str]:
    return stub_response(f"GET /admin/campaigns/{campaign_id}")


@router.post("/campaigns/{campaign_id}/pause")
def pause_campaign(
    campaign_id: str, _current_user: AuthenticatedUser = Depends(require_admin)
) -> dict[str, str]:
    return stub_response(f"POST /admin/campaigns/{campaign_id}/pause")


@router.post("/campaigns/{campaign_id}/resume")
def resume_campaign(
    campaign_id: str, _current_user: AuthenticatedUser = Depends(require_admin)
) -> dict[str, str]:
    return stub_response(f"POST /admin/campaigns/{campaign_id}/resume")


@router.get("/blocked-sends")
def list_blocked_sends(
    _current_user: AuthenticatedUser = Depends(require_admin),
) -> dict[str, str]:
    return stub_response("GET /admin/blocked-sends")


@router.get("/api-usage")
def list_api_usage(
    _current_user: AuthenticatedUser = Depends(require_admin),
) -> dict[str, str]:
    return stub_response("GET /admin/api-usage")
