from fastapi import APIRouter, Depends, status
from pydantic import BaseModel

from app.integrations.listmonk.client import ListmonkError
from app.core.security import require_api_key
from app.services.contact_subscriber_sync import (
    ContactSubscriberSyncService,
    get_contact_subscriber_sync_service,
)

router = APIRouter(
    prefix="/contacts",
    tags=["contacts"],
    dependencies=[Depends(require_api_key)],
)


def stub_response(endpoint: str) -> dict[str, str]:
    return {"status": "stub", "endpoint": endpoint}


@router.post("/import", status_code=status.HTTP_202_ACCEPTED)
def import_contacts() -> dict[str, str]:
    return stub_response("POST /contacts/import")


@router.get("")
def list_contacts() -> dict[str, str]:
    return stub_response("GET /contacts")


class ContactSyncRequest(BaseModel):
    campaign_id: str | None = None


@router.post("/{contact_id}/sync")
def sync_contact(
    contact_id: str,
    request: ContactSyncRequest,
    sync_service: ContactSubscriberSyncService = Depends(
        get_contact_subscriber_sync_service
    ),
) -> dict[str, object]:
    try:
        return sync_service.sync_contact(
            contact_id=contact_id,
            campaign_id=request.campaign_id,
        )
    except ListmonkError as error:
        return {
            "status": "sync_failed",
            "contact_id": contact_id,
            "listmonk_synced": False,
            "reason": str(error),
        }


@router.post("/{contact_id}/suppress")
def suppress_contact(contact_id: str) -> dict[str, str]:
    return stub_response(f"POST /contacts/{contact_id}/suppress")
