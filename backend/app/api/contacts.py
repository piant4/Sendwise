from fastapi import APIRouter, Depends, status

from app.core.security import require_api_key
from app.services.contacts import ContactsService

router = APIRouter(
    prefix="/contacts",
    tags=["contacts"],
    dependencies=[Depends(require_api_key)],
)


@router.post("/import", status_code=status.HTTP_202_ACCEPTED)
def import_contacts() -> dict[str, str]:
    return ContactsService().import_contacts()


@router.get("")
def list_contacts() -> dict[str, str]:
    return ContactsService().list_contacts_stub()


@router.post("/{contact_id}/suppress")
def suppress_contact(contact_id: str) -> dict[str, str]:
    return ContactsService().suppress_contact(contact_id)
