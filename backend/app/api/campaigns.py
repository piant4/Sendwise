from fastapi import APIRouter, Depends, status

from app.core.security import require_api_key

router = APIRouter(
    prefix="/campaigns",
    tags=["campaigns"],
    dependencies=[Depends(require_api_key)],
)


def stub_response(endpoint: str) -> dict[str, str]:
    return {"status": "stub", "endpoint": endpoint}


@router.post("", status_code=status.HTTP_202_ACCEPTED)
def create_campaign() -> dict[str, str]:
    return stub_response("POST /campaigns")


@router.post("/{campaign_id}/authorize")
def authorize_campaign(campaign_id: str) -> dict[str, str]:
    return stub_response(f"POST /campaigns/{campaign_id}/authorize")


@router.post("/{campaign_id}/send")
def send_campaign(campaign_id: str) -> dict[str, str]:
    return stub_response(f"POST /campaigns/{campaign_id}/send")
