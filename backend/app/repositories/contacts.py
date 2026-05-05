from copy import deepcopy

from app.core.current_client import get_current_client_id
from app.schemas.common import ContactStatus
from app.schemas.contacts import Contact


MOCK_CLIENT_ID = get_current_client_id()

_CONTACTS: list[Contact] = [
    Contact(
        id="contact_acme_sendable",
        client_id=MOCK_CLIENT_ID,
        email="sendable@example.test",
        status=ContactStatus.sendable,
        created_at="2026-05-05T09:00:00Z",
        updated_at="2026-05-05T09:00:00Z",
    ),
    Contact(
        id="contact_acme_suppressed",
        client_id=MOCK_CLIENT_ID,
        email="suppressed@example.test",
        status=ContactStatus.suppressed,
        created_at="2026-05-05T09:05:00Z",
        updated_at="2026-05-05T09:05:00Z",
    ),
    Contact(
        id="contact_acme_bounced",
        client_id=MOCK_CLIENT_ID,
        email="bounced@example.test",
        status=ContactStatus.bounced,
        created_at="2026-05-05T09:10:00Z",
        updated_at="2026-05-05T09:10:00Z",
    ),
    Contact(
        id="contact_acme_unsubscribed",
        client_id=MOCK_CLIENT_ID,
        email="unsubscribed@example.test",
        status=ContactStatus.unsubscribed,
        created_at="2026-05-05T09:15:00Z",
        updated_at="2026-05-05T09:15:00Z",
    ),
    Contact(
        id="contact_acme_blacklisted",
        client_id=MOCK_CLIENT_ID,
        email="blacklisted@example.test",
        status=ContactStatus.blacklisted,
        created_at="2026-05-05T09:20:00Z",
        updated_at="2026-05-05T09:20:00Z",
    ),
    Contact(
        id="contact_acme_pending",
        client_id=MOCK_CLIENT_ID,
        email="pending@example.test",
        status=ContactStatus.pending,
        created_at="2026-05-05T09:25:00Z",
        updated_at="2026-05-05T09:25:00Z",
    ),
    Contact(
        id="contact_acme_error",
        client_id=MOCK_CLIENT_ID,
        email="error@example.test",
        status=ContactStatus.error,
        created_at="2026-05-05T09:30:00Z",
        updated_at="2026-05-05T09:30:00Z",
    ),
    Contact(
        id="contact_nova_sendable",
        client_id="client_nova",
        email="sendable@nova.example.test",
        status=ContactStatus.sendable,
        created_at="2026-05-05T10:00:00Z",
        updated_at="2026-05-05T10:00:00Z",
    ),
]


class ContactsRepository:
    """In-memory contacts data boundary for backend-core stubs."""

    def list_contacts(self, client_id: str | None = None) -> list[Contact]:
        contacts = _CONTACTS
        if client_id is not None:
            contacts = [
                contact for contact in contacts if contact.client_id == client_id
            ]
        return deepcopy(contacts)

    def get_contact(self, contact_id: str) -> Contact | None:
        for contact in _CONTACTS:
            if contact.id == contact_id:
                return deepcopy(contact)
        return None
