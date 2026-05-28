from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse, JSONResponse
from urllib.parse import parse_qsl

from app.core.config import Settings, get_settings
from app.integrations.mailgun import (
    InvalidMailgunWebhookError,
    MailgunWebhookVerifier,
    parse_mailgun_webhook_payload,
)
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


def _render_unsubscribe_page(
    *,
    title: str,
    message: str,
    status_code: int,
) -> HTMLResponse:
    return HTMLResponse(
        content=(
            "<!doctype html>"
            "<html lang=\"it\">"
            "<head>"
            "<meta charset=\"utf-8\" />"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />"
            "<title>Sendwise</title>"
            "<style>"
            ":root{color-scheme:light;}"
            "*{box-sizing:border-box;}"
            "body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;"
            "padding:24px;background:linear-gradient(180deg,#f8fbff 0%,#eef6ff 100%);"
            "font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"
            "'Segoe UI',sans-serif;color:#0f172a;}"
            ".card{width:min(100%,520px);padding:32px 28px;border:1px solid rgba(37,99,235,.12);"
            "border-radius:24px;background:rgba(255,255,255,.98);"
            "box-shadow:0 24px 60px rgba(37,99,235,.12);text-align:center;}"
            ".eyebrow{margin:0 0 12px;font-size:12px;font-weight:700;letter-spacing:.08em;"
            "text-transform:uppercase;color:#2563eb;}"
            "h1{margin:0;font-size:30px;line-height:1.05;letter-spacing:-.04em;}"
            "p{margin:12px 0 0;font-size:15px;line-height:1.6;color:#526075;}"
            "</style>"
            "</head>"
            "<body>"
            "<main class=\"card\">"
            "<p class=\"eyebrow\">Sendwise</p>"
            f"<h1>{title}</h1>"
            f"<p>{message}</p>"
            "</main>"
            "</body>"
            "</html>"
        ),
        status_code=status_code,
    )


def _build_unsubscribe_json_response(
    *,
    status_value: str,
    message: str,
    status_code: int,
    already_unsubscribed: bool = False,
) -> JSONResponse:
    return JSONResponse(
        content={
            "status": status_value,
            "message": message,
            "already_unsubscribed": already_unsubscribed,
        },
        status_code=status_code,
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
    send_kind: str = Query(default="campaign"),
    unsubscribe_service: UnsubscribeService = Depends(get_unsubscribe_service),
) -> HTMLResponse:
    try:
        result = unsubscribe_service.unsubscribe(
            token=token,
            campaign_id=campaign_id,
            send_kind=send_kind,
        )
    except InvalidUnsubscribeTokenError:
        return _render_unsubscribe_page(
            title="Link non valido",
            message="Questo link di disiscrizione non e valido o non e piu disponibile.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    except Exception:
        return _render_unsubscribe_page(
            title="Servizio non disponibile",
            message="La richiesta non puo essere completata ora. Riprova tra poco o contatta il supporto.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    if bool(result.get("already_unsubscribed")):
        return _render_unsubscribe_page(
            title="Sei gia disiscritto",
            message="La tua scelta era gia stata registrata e non riceverai altre email da questo mittente.",
            status_code=status.HTTP_200_OK,
        )

    return _render_unsubscribe_page(
        title="Disiscrizione completata",
        message="Non riceverai piu email da questo mittente.",
        status_code=status.HTTP_200_OK,
    )


@router.post("/unsubscribe/{token}")
def unsubscribe_json(
    token: str,
    campaign_id: str | None = Query(default=None),
    send_kind: str = Query(default="campaign"),
    unsubscribe_service: UnsubscribeService = Depends(get_unsubscribe_service),
) -> JSONResponse:
    try:
        result = unsubscribe_service.unsubscribe(
            token=token,
            campaign_id=campaign_id,
            send_kind=send_kind,
        )
    except InvalidUnsubscribeTokenError:
        return _build_unsubscribe_json_response(
            status_value="invalid",
            message="Questo link di disiscrizione non e valido o non e piu disponibile.",
            status_code=status.HTTP_400_BAD_REQUEST,
        )
    except Exception:
        return _build_unsubscribe_json_response(
            status_value="unavailable",
            message="La richiesta non puo essere completata ora. Riprova tra poco o contatta il supporto.",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    if bool(result.get("already_unsubscribed")):
        return _build_unsubscribe_json_response(
            status_value="already_unsubscribed",
            message="La tua scelta era gia stata registrata.",
            status_code=status.HTTP_200_OK,
            already_unsubscribed=True,
        )

    return _build_unsubscribe_json_response(
        status_value="unsubscribed",
        message="Disiscrizione completata con successo.",
        status_code=status.HTTP_200_OK,
    )


@router.post(
    "/events/listmonk",
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_events_api_key)],
)
def receive_listmonk_event(
    payload: dict[str, object],
    provider_event_service: ProviderEventIngestionService = Depends(
        get_provider_event_ingestion_service
    ),
) -> ProviderEventIngestResponse | dict[str, str]:
    event_type = str(payload.get("event_type") or "").strip().lower()
    if event_type in {"unsubscribe", "sendwise_unsubscribe", "listmonk_unsubscribe"}:
        normalized_payload = dict(payload)
        normalized_payload.setdefault("provider", "listmonk")
        normalized_payload["event_type"] = event_type
        return provider_event_service.ingest_payload(normalized_payload)

    return {
        "status": "ignored",
        "endpoint": "POST /events/listmonk",
        "reason": "unsupported listmonk event payload for this milestone.",
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


@router.post(
    "/events/provider/mailgun",
    response_model=ProviderEventIngestResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def receive_mailgun_provider_event(
    request: Request,
    settings: Settings = Depends(get_settings),
    provider_event_service: ProviderEventIngestionService = Depends(
        get_provider_event_ingestion_service
    ),
) -> ProviderEventIngestResponse:
    signing_key = settings.mailgun_webhook_signing_key.strip()
    if not signing_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Mailgun webhook signing is not configured.",
        )

    payload = await _read_mailgun_request_payload(request)
    try:
        envelope = parse_mailgun_webhook_payload(payload)
    except InvalidMailgunWebhookError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error

    verifier = MailgunWebhookVerifier(signing_key=signing_key)
    if not verifier.verify(
        timestamp=envelope.timestamp,
        token=envelope.token,
        signature=envelope.signature,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Mailgun webhook signature.",
        )

    normalized_payload: dict[str, object] = {
        "provider": "mailgun",
        "source": "mailgun_webhook",
        "payload": envelope.event_data,
    }
    return provider_event_service.ingest_payload(normalized_payload)


async def _read_mailgun_request_payload(request: Request) -> dict[str, object]:
    content_type = request.headers.get("content-type", "").lower()
    if "application/json" in content_type:
        payload = await request.json()
        if isinstance(payload, dict):
            return dict(payload)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mailgun webhook payload must be a JSON object.",
        )

    if "application/x-www-form-urlencoded" in content_type:
        body = (await request.body()).decode("utf-8")
        return {key: value for key, value in parse_qsl(body, keep_blank_values=True)}

    if "multipart/form-data" in content_type:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Multipart Mailgun webhooks require python-multipart support.",
        )

    raise HTTPException(
        status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        detail="Unsupported Mailgun webhook content type.",
    )
