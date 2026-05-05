from app.core.current_client import get_current_client_id
from app.repositories.contacts import ContactsRepository
from app.schemas.contacts import Contact


class ContactsService:
    def __init__(self, repository: ContactsRepository | None = None) -> None:
        self.repository = repository or ContactsRepository()

    def import_contacts(self) -> dict[str, str]:
        self.repository.list_contacts(client_id=get_current_client_id())
        return {"status": "stub", "endpoint": "POST /contacts/import"}

    def list_contacts(self, client_id: str | None = None) -> list[Contact]:
        return self.repository.list_contacts(client_id=client_id)

    def list_contacts_stub(self) -> dict[str, str]:
        self.repository.list_contacts(client_id=get_current_client_id())
        return {"status": "stub", "endpoint": "GET /contacts"}

    def suppress_contact(self, contact_id: str) -> dict[str, str]:
        self.repository.get_contact(contact_id)
        return {"status": "stub", "endpoint": f"POST /contacts/{contact_id}/suppress"}
