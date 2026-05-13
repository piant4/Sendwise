from fastapi import APIRouter, Depends, HTTPException, Query, Header, status
from fastapi.responses import HTMLResponse

from app.core.config import Settings, get_settings
from app.schemas.provider_events import ProviderEventIngestResponse
from app.services.provider_events import (
    ProviderEventIngestionService,
    get_provider_event_ingestion_service,
)
from app.services.unsubscribe import (
    InvalidUnsubscribeTokenError,
    UnsubscribeService,
    get_unsubscribe_service,
)

router = APIRouter(
    tags=["events"],
)


def require_events_api_key(
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
    settings: Settings = Depends(get_settings),
) -> None:
    if not x_api_key or x_api_key != settings.backend_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
        )


@router.get(
    "/unsubscribe/{token}",
    response_class=HTMLResponse,
)
def unsubscribe(
    token: str,
    campaign_id: str | None = Query(default=None),
    unsubscribe_service: UnsubscribeService = Depends(get_unsubscribe_service),
) -> HTMLResponse:
    try:
        unsubscribe_service.unsubscribe(token=token, campaign_id=campaign_id)
    except InvalidUnsubscribeTokenError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid unsubscribe link.",
        ) from error

    return HTMLResponse(
        content=(
            "<!doctype html><html><body>"
            "<h1>Unsubscribed</h1>"
            "<p>Your address has been removed from future Sendwise mailings.</p>"
            "</body></html>"
        ),
        status_code=status.HTTP_200_OK,
    )


@router.post(
    "/events/listmonk",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_events_api_key)],
)
def receive_listmonk_event(
    payload: dict[str, object],
) -> dict[str, str]:
    return {
        "status": "ignored",
        "endpoint": "POST /events/listmonk",
        "reason": "listmonk event ingestion is not implemented in this milestone.",
        "event_type": str(payload.get("event_type") or "unknown"),
    }


@router.post(
    "/events/provider",
    response_model=ProviderEventIngestResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_events_api_key)],
)
def receive_provider_event(
    payload: dict[str, object],
    provider_event_service: ProviderEventIngestionService = Depends(
        get_provider_event_ingestion_service
    ),
) -> ProviderEventIngestResponse:
    return provider_event_service.ingest_payload(dict(payload))
