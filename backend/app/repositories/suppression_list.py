from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.repositories.clients import postgres_connection, require_psycopg


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

    def add_suppression(
        self,
        *,
        email: str,
        client_id: str | None = None,
        reason: str = "manual",
    ) -> SuppressionRecord:
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

    def add_suppression(
        self,
        *,
        email: str,
        client_id: str | None = None,
        reason: str = "manual",
    ) -> SuppressionRecord:
        psycopg = require_psycopg()
        normalized_email = email.strip().lower()
        insert_query = """
            INSERT INTO suppression_list (
                client_id,
                email,
                reason
            )
            SELECT %s, %s, %s
            WHERE NOT EXISTS (
                SELECT 1
                FROM suppression_list
                WHERE lower(email) = lower(%s)
                    AND reason = %s
                    AND COALESCE(client_id::text, '') = COALESCE(%s, '')
            )
            RETURNING
                id::text AS id,
                client_id::text AS client_id,
                email,
                reason,
                created_at
        """
        select_query = """
            SELECT
                id::text AS id,
                client_id::text AS client_id,
                email,
                reason,
                created_at
            FROM suppression_list
            WHERE lower(email) = lower(%s)
                AND reason = %s
                AND COALESCE(client_id::text, '') = COALESCE(%s, '')
            ORDER BY created_at ASC, id ASC
            LIMIT 1
        """

        with postgres_connection(self._settings) as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        insert_query,
                        (
                            client_id,
                            normalized_email,
                            reason,
                            normalized_email,
                            reason,
                            client_id,
                        ),
                    )
                    row = cursor.fetchone()
                    if row is None:
                        cursor.execute(select_query, (normalized_email, reason, client_id))
                        row = cursor.fetchone()
                connection.commit()
            except psycopg.errors.UniqueViolation:
                connection.rollback()
                with connection.cursor() as cursor:
                    cursor.execute(select_query, (normalized_email, reason, client_id))
                    row = cursor.fetchone()

        if row is None:
            raise ValueError("suppression record could not be created or loaded")

        return SuppressionRecord.model_validate(row)


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
        normalized_email = email.strip().lower()
        for record in self._records:
            if (
                record.client_id == client_id
                and record.reason == reason
                and record.email.strip().lower() == normalized_email
            ):
                return record
        record = SuppressionRecord(
            id=str(uuid4()),
            client_id=client_id,
            email=normalized_email,
            reason=reason,
            created_at=datetime.now(timezone.utc),
        )
        self._records.append(record)
        return record


def get_suppression_list_repository() -> SuppressionListRepository:
    return PostgresSuppressionListRepository(get_settings())
