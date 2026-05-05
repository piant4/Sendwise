from app.schemas.common import ContactStatus


def test_contacts_service_and_repository_importable() -> None:
    from app.repositories.contacts import ContactsRepository
    from app.services.contacts import ContactsService

    repository = ContactsRepository()
    service = ContactsService(repository=repository)

    assert service.list_contacts()


def test_contacts_repository_filters_by_client_id() -> None:
    from app.repositories.contacts import ContactsRepository

    contacts = ContactsRepository().list_contacts(client_id="client_nova")

    assert contacts
    assert {contact.client_id for contact in contacts} == {"client_nova"}


def test_contacts_repository_stub_states_present() -> None:
    from app.repositories.contacts import ContactsRepository

    statuses = {contact.status for contact in ContactsRepository().list_contacts()}

    assert {
        ContactStatus.sendable,
        ContactStatus.suppressed,
        ContactStatus.bounced,
        ContactStatus.unsubscribed,
        ContactStatus.blacklisted,
        ContactStatus.pending,
        ContactStatus.error,
    }.issubset(statuses)
