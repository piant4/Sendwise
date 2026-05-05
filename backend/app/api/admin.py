from fastapi import APIRouter, Depends, status

from app.core.security import require_api_key
from app.schemas.campaigns import Campaign
from app.schemas.clients import Client
from app.services.campaigns import CampaignsService
from app.services.clients import ClientsService
from app.services.usage import UsageService

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_api_key)],
)


clients_service = ClientsService()
campaigns_service = CampaignsService()
usage_service = UsageService()


def stub_response(endpoint: str) -> dict[str, str]:
    return {"status": "stub", "endpoint": endpoint}


@router.get("/clients", response_model=list[Client])
def list_clients() -> list[Client]:
    return clients_service.list_admin_clients()


@router.post("/clients", status_code=status.HTTP_202_ACCEPTED)
def create_client() -> dict[str, str]:
    return clients_service.planned_admin_client_stub("POST /admin/clients")


@router.get("/clients/{client_id}")
def get_client(client_id: str) -> dict[str, str]:
    return clients_service.planned_admin_client_stub(f"GET /admin/clients/{client_id}")


@router.patch("/clients/{client_id}")
def update_client(client_id: str) -> dict[str, str]:
    return clients_service.planned_admin_client_stub(f"PATCH /admin/clients/{client_id}")


@router.post("/clients/{client_id}/pause")
def pause_client(client_id: str) -> dict[str, str]:
    return clients_service.planned_admin_client_stub(f"POST /admin/clients/{client_id}/pause")


@router.post("/clients/{client_id}/resume")
def resume_client(client_id: str) -> dict[str, str]:
    return clients_service.planned_admin_client_stub(f"POST /admin/clients/{client_id}/resume")


@router.post("/clients/{client_id}/block")
def block_client(client_id: str) -> dict[str, str]:
    return clients_service.planned_admin_client_stub(f"POST /admin/clients/{client_id}/block")


@router.post("/clients/{client_id}/archive")
def archive_client(client_id: str) -> dict[str, str]:
    return clients_service.planned_admin_client_stub(f"POST /admin/clients/{client_id}/archive")


@router.get("/clients/{client_id}/campaigns")
def list_client_campaigns(client_id: str) -> dict[str, str]:
    return clients_service.planned_admin_client_stub(f"GET /admin/clients/{client_id}/campaigns")


@router.get("/clients/{client_id}/usage")
def get_client_usage(client_id: str) -> dict[str, str]:
    return usage_service.planned_admin_client_usage_stub(client_id)


@router.get("/clients/{client_id}/blocked-sends")
def list_client_blocked_sends(client_id: str) -> dict[str, str]:
    return clients_service.planned_admin_client_stub(
        f"GET /admin/clients/{client_id}/blocked-sends"
    )


@router.get("/campaigns", response_model=list[Campaign])
def list_campaigns() -> list[Campaign]:
    return campaigns_service.list_admin_campaigns()


@router.get("/campaigns/{campaign_id}")
def get_campaign(campaign_id: str) -> dict[str, str]:
    return campaigns_service.planned_admin_campaign_stub(
        f"GET /admin/campaigns/{campaign_id}"
    )


@router.post("/campaigns/{campaign_id}/pause")
def pause_campaign(campaign_id: str) -> dict[str, str]:
    return campaigns_service.planned_admin_campaign_stub(
        f"POST /admin/campaigns/{campaign_id}/pause"
    )


@router.post("/campaigns/{campaign_id}/resume")
def resume_campaign(campaign_id: str) -> dict[str, str]:
    return campaigns_service.planned_admin_campaign_stub(
        f"POST /admin/campaigns/{campaign_id}/resume"
    )


@router.get("/blocked-sends")
def list_blocked_sends() -> dict[str, str]:
    return stub_response("GET /admin/blocked-sends")


@router.get("/api-usage")
def list_api_usage() -> dict[str, str]:
    return usage_service.planned_admin_api_usage_stub()
