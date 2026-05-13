from fastapi import APIRouter, Depends, status

from app.core.auth import AuthenticatedUser, require_platform_admin
from app.integrations.listmonk.client import ListmonkError
from app.schemas.campaigns import (
    AdminCampaignContactsImportRequest,
    AdminCampaignContactsImportResponse,
    AdminCampaignContactsResponse,
    AdminCampaignContentRequest,
    AdminCampaignCreateRequest,
    AdminCampaignDetail,
    AdminCampaignReviewResponse,
    AdminCampaignSummaryResponse,
    AdminCampaignSelectSlotRequest,
    AdminCampaignSlotAssignmentResponse,
    AdminCampaignUpdateRequest,
    AdminClientCampaignCreateRequest,
)
from app.schemas.clients import (
    AdminBlockedSendItem,
    AdminCampaignSummary,
    AdminClientInviteRequest,
    AdminClientInviteResponse,
    AdminClientUpdateRequest,
    AdminEmailLimitsResponse,
    AdminOverviewSummary,
    AdminSystemStatus,
    Client,
    ClientAccessSummary,
)
from app.services.client_access import ClientAccessService, get_client_access_service
from app.services.clients import ClientsService, build_client_schema, get_clients_service
from app.services.campaigns import (
    AdminCampaignService,
    CampaignDispatchService,
    get_admin_campaign_service,
    get_campaign_dispatch_service,
)
from app.services.send_simulation import (
    SendSimulationService,
    get_send_simulation_service,
)

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
)


def stub_response(endpoint: str) -> dict[str, str]:
    return {"status": "stub", "endpoint": endpoint}


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
        status=existing_client.status,
        email_limit_per_campaign=payload_values.get(
            "email_limit_per_campaign",
            existing_client.email_limit_per_campaign,
        ),
        max_campaigns=payload_values.get(
            "max_campaigns",
            existing_client.max_campaigns,
        ),
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
    )
    return AdminClientInviteResponse(
        client=build_client_schema(result.client, access=result.access),
        access=ClientAccessSummary.model_validate(result.access.model_dump()),
    )


@router.post("/clients/{client_id}/revoke-access", response_model=Client)
def revoke_client_access(
    client_id: str,
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
    clients_service: ClientsService = Depends(get_clients_service),
    client_access_service: ClientAccessService = Depends(get_client_access_service),
) -> Client:
    client = clients_service.get_client_by_id(client_id)
    access = client_access_service.revoke_access(client.id)
    return build_client_schema(client, access=access)


@router.post("/clients/{client_id}/archive", response_model=Client)
def archive_client(
    client_id: str,
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
    clients_service: ClientsService = Depends(get_clients_service),
    client_access_service: ClientAccessService = Depends(get_client_access_service),
) -> Client:
    archived_client = clients_service.archive_client(client_id)
    archived_access = client_access_service.archive_access(archived_client.id)
    return build_client_schema(archived_client, access=archived_access)


@router.get("/clients/{client_id}/campaigns")
def list_client_campaigns(
    client_id: str,
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
) -> dict[str, str]:
    return stub_response(f"GET /admin/clients/{client_id}/campaigns")


@router.post(
    "/clients/{client_id}/campaigns",
    response_model=AdminCampaignDetail,
    status_code=status.HTTP_201_CREATED,
)
def create_client_campaign(
    client_id: str,
    payload: AdminClientCampaignCreateRequest,
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
    campaign_service: AdminCampaignService = Depends(get_admin_campaign_service),
) -> AdminCampaignDetail:
    return campaign_service.create_campaign(
        client_id=client_id,
        name=payload.name,
        subject=payload.subject,
    )


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


@router.get("/overview", response_model=AdminOverviewSummary)
def get_overview(
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
    clients_service: ClientsService = Depends(get_clients_service),
    client_access_service: ClientAccessService = Depends(get_client_access_service),
) -> AdminOverviewSummary:
    return clients_service.get_admin_overview(
        client_access_service=client_access_service,
    )


@router.get("/campaigns", response_model=list[AdminCampaignSummary])
def list_campaigns(
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
    clients_service: ClientsService = Depends(get_clients_service),
) -> list[AdminCampaignSummary]:
    return clients_service.list_admin_campaigns()


@router.post(
    "/campaigns",
    response_model=AdminCampaignDetail,
    status_code=status.HTTP_201_CREATED,
)
def create_campaign(
    payload: AdminCampaignCreateRequest,
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
    campaign_service: AdminCampaignService = Depends(get_admin_campaign_service),
) -> AdminCampaignDetail:
    return campaign_service.create_campaign(
        client_id=payload.client_id,
        name=payload.name,
        subject=payload.subject,
    )


@router.get("/email-limits", response_model=AdminEmailLimitsResponse)
def list_email_limits(
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
    clients_service: ClientsService = Depends(get_clients_service),
    client_access_service: ClientAccessService = Depends(get_client_access_service),
) -> AdminEmailLimitsResponse:
    return clients_service.get_admin_email_limits(
        client_access_service=client_access_service,
    )


@router.get("/campaigns/{campaign_id}", response_model=AdminCampaignDetail)
def get_campaign(
    campaign_id: str,
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
    campaign_service: AdminCampaignService = Depends(get_admin_campaign_service),
) -> AdminCampaignDetail:
    return campaign_service.get_campaign_detail(campaign_id)


@router.get("/campaigns/{campaign_id}/summary", response_model=AdminCampaignSummaryResponse)
def get_campaign_summary(
    campaign_id: str,
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
    campaign_service: AdminCampaignService = Depends(get_admin_campaign_service),
) -> AdminCampaignSummaryResponse:
    return campaign_service.get_campaign_summary(campaign_id)


@router.patch("/campaigns/{campaign_id}", response_model=AdminCampaignDetail)
def update_campaign(
    campaign_id: str,
    payload: AdminCampaignUpdateRequest,
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
    campaign_service: AdminCampaignService = Depends(get_admin_campaign_service),
) -> AdminCampaignDetail:
    return campaign_service.update_campaign(
        campaign_id=campaign_id,
        name=payload.name,
        subject=payload.subject,
        status_value=payload.status,
        current_step=payload.current_step,
    )


@router.post(
    "/campaigns/{campaign_id}/select-slot",
    response_model=AdminCampaignSlotAssignmentResponse,
)
def select_campaign_slot(
    campaign_id: str,
    payload: AdminCampaignSelectSlotRequest,
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
    campaign_service: AdminCampaignService = Depends(get_admin_campaign_service),
) -> AdminCampaignSlotAssignmentResponse:
    return campaign_service.select_slot(
        campaign_id=campaign_id,
        slot_id=payload.slot_id,
    )


@router.post("/campaigns/{campaign_id}/content", response_model=AdminCampaignDetail)
def update_campaign_content(
    campaign_id: str,
    payload: AdminCampaignContentRequest,
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
    campaign_service: AdminCampaignService = Depends(get_admin_campaign_service),
) -> AdminCampaignDetail:
    return campaign_service.update_campaign_content(
        campaign_id=campaign_id,
        subject=payload.subject,
        preview_text=payload.preview_text,
        body_html=payload.body_html,
        body_text=payload.body_text,
        current_step=payload.current_step,
    )


@router.get(
    "/campaigns/{campaign_id}/contacts",
    response_model=AdminCampaignContactsResponse,
)
def get_campaign_contacts(
    campaign_id: str,
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
    campaign_service: AdminCampaignService = Depends(get_admin_campaign_service),
) -> AdminCampaignContactsResponse:
    return campaign_service.get_campaign_contacts(campaign_id)


@router.post(
    "/campaigns/{campaign_id}/contacts",
    response_model=AdminCampaignContactsImportResponse,
)
def add_campaign_contacts(
    campaign_id: str,
    payload: AdminCampaignContactsImportRequest,
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
    campaign_service: AdminCampaignService = Depends(get_admin_campaign_service),
) -> AdminCampaignContactsImportResponse:
    return campaign_service.add_campaign_contacts(
        campaign_id=campaign_id,
        contacts=payload.contacts,
    )


@router.post("/campaigns/{campaign_id}/review", response_model=AdminCampaignReviewResponse)
def review_campaign(
    campaign_id: str,
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
    campaign_service: AdminCampaignService = Depends(get_admin_campaign_service),
) -> AdminCampaignReviewResponse:
    return campaign_service.review_campaign(campaign_id)


@router.post("/campaigns/{campaign_id}/simulate-send")
def simulate_send_campaign(
    campaign_id: str,
    current_user: AuthenticatedUser = Depends(require_platform_admin),
    campaign_service: AdminCampaignService = Depends(get_admin_campaign_service),
    send_simulation_service: SendSimulationService = Depends(
        get_send_simulation_service
    ),
) -> dict[str, object]:
    campaign_service.get_campaign_record(campaign_id)
    try:
        return send_simulation_service.simulate_campaign_send(campaign_id, current_user)
    except ListmonkError as error:
        return {
            "status": "simulation_failed",
            "mode": "simulation",
            "campaign_id": campaign_id,
            "decision": "authorized",
            "reason": str(error),
            "listmonk_dispatched": False,
            "real_send_attempted": False,
            "email_logs_created": 0,
        }


@router.post("/campaigns/{campaign_id}/send")
def send_campaign(
    campaign_id: str,
    current_user: AuthenticatedUser = Depends(require_platform_admin),
    campaign_service: AdminCampaignService = Depends(get_admin_campaign_service),
    campaign_dispatch_service: CampaignDispatchService = Depends(
        get_campaign_dispatch_service
    ),
) -> dict[str, object]:
    campaign_service.get_campaign_record(campaign_id)
    try:
        return campaign_dispatch_service.send_campaign(campaign_id, current_user)
    except ListmonkError as error:
        return {
            "status": "dispatch_failed",
            "mode": "controlled_dev",
            "campaign_id": campaign_id,
            "allowed": False,
            "decision": "authorized",
            "reason": str(error),
            "code": "listmonk_dispatch_failed",
            "severity": "error",
            "dispatch_attempted": False,
            "real_send_attempted": False,
            "listmonk_prepared": False,
            "listmonk_dispatched": False,
            "content_ready": False,
            "email_logs_created": 0,
            "email_logs_updated": 0,
        }


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


@router.get("/blocked-sends", response_model=list[AdminBlockedSendItem])
def list_blocked_sends(
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
    clients_service: ClientsService = Depends(get_clients_service),
) -> list[AdminBlockedSendItem]:
    return clients_service.get_admin_blocked_sends()


@router.get("/system", response_model=AdminSystemStatus)
def get_system_status(
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
    clients_service: ClientsService = Depends(get_clients_service),
) -> AdminSystemStatus:
    return clients_service.get_admin_system_status()


@router.get("/api-usage")
def list_api_usage(
    _current_user: AuthenticatedUser = Depends(require_platform_admin),
) -> dict[str, str]:
    return stub_response("GET /admin/api-usage")
