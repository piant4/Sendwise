from fastapi import APIRouter, Depends

from app.core.auth import AuthenticatedUser, require_platform_admin
from app.schemas.campaigns import Campaign
from app.schemas.clients import (
    AdminClientInviteRequest,
    AdminClientInviteResponse,
    AdminClientUpdateRequest,
    Client,
    ClientAccessSummary,
)
from app.schemas.common import CampaignStatus
from app.services.client_access import ClientAccessService, get_client_access_service
from app.services.clients import ClientsService, build_client_schema, get_clients_service

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
)


def stub_response(endpoint: str) -> dict[str, str]:
    return {"status": "stub", "endpoint": endpoint}


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
def list_clients(
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
    clients_service: ClientsService = Depends(get_clients_service),
    client_access_service: ClientAccessService = Depends(get_client_access_service),
) -> list[Client]:
    return [
        build_client_schema(
            client,
            access=client_access_service.get_access_by_client_id(client.id),
        )
        for client in clients_service.list_clients()
    ]


@router.post("/clients", response_model=AdminClientInviteResponse)
def create_client(
    payload: AdminClientInviteRequest,
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
    client_access_service: ClientAccessService = Depends(get_client_access_service),
) -> AdminClientInviteResponse:
    result = client_access_service.invite_client_access(
        email=payload.email,
        personal_name=payload.personal_name,
        company_name=payload.company_name,
    )
    return AdminClientInviteResponse(
        client=build_client_schema(result.client, access=result.access),
        access=ClientAccessSummary.model_validate(result.access.model_dump()),
    )


@router.get("/clients/{client_id}")
def get_client(
    client_id: str,
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
    clients_service: ClientsService = Depends(get_clients_service),
    client_access_service: ClientAccessService = Depends(get_client_access_service),
) -> Client:
    client = clients_service.get_client_by_id(client_id)
    return build_client_schema(
        client,
        access=client_access_service.get_access_by_client_id(client.id),
    )


@router.patch("/clients/{client_id}")
def update_client(
    client_id: str,
    payload: AdminClientUpdateRequest,
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
    clients_service: ClientsService = Depends(get_clients_service),
    client_access_service: ClientAccessService = Depends(get_client_access_service),
) -> Client:
    existing_client = clients_service.get_client_by_id(client_id)
    payload_values = payload.model_dump(exclude_unset=True)
    updated_client = clients_service.update_client(
        client_id=existing_client.id,
        email=existing_client.email,
        personal_name=payload_values.get("personal_name", existing_client.personal_name),
        company_name=payload_values.get("company_name", existing_client.company_name),
        status=existing_client.status,
        monthly_email_limit=payload_values.get(
            "monthly_email_limit",
            existing_client.monthly_email_limit,
        ),
        daily_email_limit=payload_values.get(
            "daily_email_limit",
            existing_client.daily_email_limit,
        ),
    )
    return build_client_schema(
        updated_client,
        access=client_access_service.get_access_by_client_id(updated_client.id),
    )


@router.post(
    "/clients/{client_id}/invite-access",
    response_model=AdminClientInviteResponse,
)
def reinvite_client_access(
    client_id: str,
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
    clients_service: ClientsService = Depends(get_clients_service),
    client_access_service: ClientAccessService = Depends(get_client_access_service),
) -> AdminClientInviteResponse:
    client = clients_service.get_client_by_id(client_id)
    result = client_access_service.invite_client_access(
        email=client.email,
        personal_name=client.personal_name,
        company_name=client.company_name,
    )
    return AdminClientInviteResponse(
        client=build_client_schema(result.client, access=result.access),
        access=ClientAccessSummary.model_validate(result.access.model_dump()),
    )


@router.post("/clients/{client_id}/pause")
def pause_client(
    client_id: str,
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
) -> dict[str, str]:
    return stub_response(f"POST /admin/clients/{client_id}/pause")


@router.post("/clients/{client_id}/resume")
def resume_client(
    client_id: str,
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
) -> dict[str, str]:
    return stub_response(f"POST /admin/clients/{client_id}/resume")


@router.post("/clients/{client_id}/block")
def block_client(
    client_id: str,
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
) -> dict[str, str]:
    return stub_response(f"POST /admin/clients/{client_id}/block")


@router.post("/clients/{client_id}/archive")
def archive_client(
    client_id: str,
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
) -> dict[str, str]:
    return stub_response(f"POST /admin/clients/{client_id}/archive")


@router.get("/clients/{client_id}/campaigns")
def list_client_campaigns(
    client_id: str,
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
) -> dict[str, str]:
    return stub_response(f"GET /admin/clients/{client_id}/campaigns")


@router.get("/clients/{client_id}/usage")
def get_client_usage(
    client_id: str,
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
) -> dict[str, str]:
    return stub_response(f"GET /admin/clients/{client_id}/usage")


@router.get("/clients/{client_id}/blocked-sends")
def list_client_blocked_sends(
    client_id: str,
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
) -> dict[str, str]:
    return stub_response(f"GET /admin/clients/{client_id}/blocked-sends")


@router.get("/campaigns", response_model=list[Campaign])
def list_campaigns(
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
) -> list[Campaign]:
    return ADMIN_CAMPAIGNS


@router.get("/campaigns/{campaign_id}")
def get_campaign(
    campaign_id: str,
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
) -> dict[str, str]:
    return stub_response(f"GET /admin/campaigns/{campaign_id}")


@router.post("/campaigns/{campaign_id}/pause")
def pause_campaign(
    campaign_id: str,
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
) -> dict[str, str]:
    return stub_response(f"POST /admin/campaigns/{campaign_id}/pause")


@router.post("/campaigns/{campaign_id}/resume")
def resume_campaign(
    campaign_id: str,
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
) -> dict[str, str]:
    return stub_response(f"POST /admin/campaigns/{campaign_id}/resume")


@router.get("/blocked-sends")
def list_blocked_sends(
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
) -> dict[str, str]:
    return stub_response("GET /admin/blocked-sends")


@router.get("/api-usage")
def list_api_usage(
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
) -> dict[str, str]:
    return stub_response("GET /admin/api-usage")
