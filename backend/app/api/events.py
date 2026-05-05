from fastapi import APIRouter, Depends, status

from app.core.security import require_api_key

router = APIRouter(
    prefix="/events",
    tags=["events"],
    dependencies=[Depends(require_api_key)],
)


def stub_response(endpoint: str) -> dict[str, str]:
    return {"status": "stub", "endpoint": endpoint}


@router.post("/listmonk", status_code=status.HTTP_202_ACCEPTED)
def receive_listmonk_event() -> dict[str, str]:
    return stub_response("POST /events/listmonk")


@router.post("/provider", status_code=status.HTTP_202_ACCEPTED)
def receive_provider_event() -> dict[str, str]:
    return stub_response("POST /events/provider")
