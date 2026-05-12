from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.repositories.clients import postgres_connection


class SuppressionRecord(BaseModel):
    id: str
    client_id: Optional[str] = None
    email: str
    reason: str
    created_at: datetime


class SuppressionListRepository:
    def list_suppressed_emails_for_campaign(
        self,
        *,
        client_id: str,
        emails: list[str],
    ) -> set[str]:
        raise NotImplementedError


class PostgresSuppressionListRepository(SuppressionListRepository):
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def list_suppressed_emails_for_campaign(
        self,
        *,
        client_id: str,
        emails: list[str],
    ) -> set[str]:
        normalized_emails = sorted(
            {email.strip().lower() for email in emails if email.strip()}
        )
        if not normalized_emails:
            return set()

        query = """
            SELECT DISTINCT lower(email) AS email
            FROM suppression_list
            WHERE lower(email) = ANY(%s)
                AND (client_id::text = %s OR client_id IS NULL)
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (normalized_emails, client_id))
                rows = cursor.fetchall()

        return {str(row["email"]) for row in rows}


class InMemorySuppressionListRepository(SuppressionListRepository):
    def __init__(self, records: list[SuppressionRecord] | None = None) -> None:
        self._records = records or []

    def list_suppressed_emails_for_campaign(
        self,
        *,
        client_id: str,
        emails: list[str],
    ) -> set[str]:
        candidates = {email.strip().lower() for email in emails if email.strip()}
        return {
            record.email.strip().lower()
            for record in self._records
            if record.email.strip().lower() in candidates
            and (record.client_id is None or record.client_id == client_id)
        }

    def add_suppression(
        self,
        *,
        email: str,
        client_id: str | None = None,
        reason: str = "manual",
    ) -> SuppressionRecord:
        record = SuppressionRecord(
            id=str(uuid4()),
            client_id=client_id,
            email=email,
            reason=reason,
            created_at=datetime.now(timezone.utc),
        )
        self._records.append(record)
        return record


def get_suppression_list_repository() -> SuppressionListRepository:
    return PostgresSuppressionListRepository(get_settings())
