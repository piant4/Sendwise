from fastapi import APIRouter, Depends, status

from app.core.security import require_api_key

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


@router.post("/{contact_id}/suppress")
def suppress_contact(contact_id: str) -> dict[str, str]:
    return stub_response(f"POST /contacts/{contact_id}/suppress")
