from fastapi import APIRouter, Depends

from app.core.security import require_api_key

router = APIRouter(
    prefix="/client",
    tags=["client"],
    dependencies=[Depends(require_api_key)],
)


def stub_response(endpoint: str) -> dict[str, str]:
    return {"status": "stub", "endpoint": endpoint}


@router.get("/me")
def get_me() -> dict[str, str]:
    return stub_response("GET /client/me")


@router.get("/campaigns")
def list_campaigns() -> dict[str, str]:
    return stub_response("GET /client/campaigns")


@router.get("/campaigns/{campaign_id}")
def get_campaign(campaign_id: str) -> dict[str, str]:
    return stub_response(f"GET /client/campaigns/{campaign_id}")


@router.get("/campaigns/{campaign_id}/stats")
def get_campaign_stats(campaign_id: str) -> dict[str, str]:
    return stub_response(f"GET /client/campaigns/{campaign_id}/stats")


@router.get("/usage")
def get_usage() -> dict[str, str]:
    return stub_response("GET /client/usage")


@router.get("/blocked-sends")
def get_blocked_sends() -> dict[str, str]:
    return stub_response("GET /client/blocked-sends")
