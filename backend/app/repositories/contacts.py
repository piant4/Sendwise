from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.repositories.clients import postgres_connection


class ContactRecord(BaseModel):
    id: str
    client_id: str
    email: str
    status: str
    created_at: datetime
    updated_at: datetime


def _map_contact_row(row: Optional[dict[str, Any]]) -> Optional[ContactRecord]:
    if row is None:
        return None

    return ContactRecord.model_validate(row)


class ContactRepository:
    def get_by_id(self, contact_id: str) -> Optional[ContactRecord]:
        raise NotImplementedError

    def campaign_contact_exists(
        self,
        *,
        client_id: str,
        campaign_id: str,
        contact_id: str,
    ) -> bool:
        raise NotImplementedError


class PostgresContactRepository(ContactRepository):
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def get_by_id(self, contact_id: str) -> Optional[ContactRecord]:
        query = """
            SELECT
                id::text AS id,
                client_id::text AS client_id,
                email,
                status,
                created_at,
                updated_at
            FROM contacts
            WHERE id::text = %s
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (contact_id,))
                row = cursor.fetchone()

        return _map_contact_row(row)

    def campaign_contact_exists(
        self,
        *,
        client_id: str,
        campaign_id: str,
        contact_id: str,
    ) -> bool:
        query = """
            SELECT 1 AS exists
            FROM campaign_contacts
            WHERE client_id::text = %s
                AND campaign_id::text = %s
                AND contact_id::text = %s
            LIMIT 1
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (client_id, campaign_id, contact_id))
                row = cursor.fetchone()

        return row is not None


class InMemoryContactRepository(ContactRepository):
    def __init__(
        self,
        contacts: list[ContactRecord] | None = None,
        campaign_contacts: set[tuple[str, str, str]] | None = None,
    ) -> None:
        self._contacts = {contact.id: contact for contact in contacts or []}
        self._campaign_contacts = campaign_contacts or set()

    def get_by_id(self, contact_id: str) -> Optional[ContactRecord]:
        return self._contacts.get(contact_id)

    def campaign_contact_exists(
        self,
        *,
        client_id: str,
        campaign_id: str,
        contact_id: str,
    ) -> bool:
        return (client_id, campaign_id, contact_id) in self._campaign_contacts

    def add_contact(
        self,
        *,
        contact_id: str | None = None,
        client_id: str = "client_123",
        email: str = "person@example.test",
        status: str = "sendable",
    ) -> ContactRecord:
        now = datetime.now(timezone.utc)
        contact = ContactRecord(
            id=contact_id or str(uuid4()),
            client_id=client_id,
            email=email,
            status=status,
            created_at=now,
            updated_at=now,
        )
        self._contacts[contact.id] = contact
        return contact


def get_contact_repository() -> ContactRepository:
    return PostgresContactRepository(get_settings())
