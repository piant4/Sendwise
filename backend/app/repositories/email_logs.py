from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.repositories.clients import postgres_connection


class EmailLogRecord(BaseModel):
    id: str
    client_id: str
    campaign_id: Optional[str] = None
    contact_id: Optional[str] = None
    status: str
    provider_message_id: Optional[str] = None
    body: Optional[str] = None
    created_at: datetime


class EmailLogRepository:
    def get_by_id(self, email_log_id: str) -> Optional[EmailLogRecord]:
        raise NotImplementedError

    def create_email_log(
        self,
        *,
        client_id: str,
        campaign_id: str,
        contact_id: str,
        status: str,
        provider_message_id: Optional[str] = None,
        body: Optional[str] = None,
    ) -> EmailLogRecord:
        raise NotImplementedError

    def create_campaign_logs(
        self,
        *,
        client_id: str,
        campaign_id: str,
        contact_ids: list[str],
        status: str,
        provider_message_id: Optional[str] = None,
        body: Optional[str] = None,
    ) -> list[EmailLogRecord]:
        return [
            self.create_email_log(
                client_id=client_id,
                campaign_id=campaign_id,
                contact_id=contact_id,
                status=status,
                provider_message_id=provider_message_id,
                body=body,
            )
            for contact_id in contact_ids
        ]

    def create_simulated_campaign_logs(
        self,
        *,
        client_id: str,
        campaign_id: str,
        contact_ids: list[str],
        body: str,
    ) -> list[EmailLogRecord]:
        return self.create_campaign_logs(
            client_id=client_id,
            campaign_id=campaign_id,
            contact_ids=contact_ids,
            status="simulated",
            provider_message_id=None,
            body=body,
        )

    def create_dispatched_campaign_logs(
        self,
        *,
        client_id: str,
        campaign_id: str,
        contact_ids: list[str],
        body: Optional[str] = None,
    ) -> list[EmailLogRecord]:
        return self.create_campaign_logs(
            client_id=client_id,
            campaign_id=campaign_id,
            contact_ids=contact_ids,
            status="queued",
            provider_message_id=None,
            body=body,
        )

    def get_campaign_status_counts(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> dict[str, int]:
        raise NotImplementedError

    def find_by_provider_message_id(
        self,
        *,
        provider_message_id: str,
    ) -> Optional[EmailLogRecord]:
        raise NotImplementedError

    def find_latest_for_contact(
        self,
        *,
        client_id: str,
        campaign_id: str,
        contact_id: str,
    ) -> Optional[EmailLogRecord]:
        raise NotImplementedError

    def update_status(
        self,
        *,
        email_log_id: str,
        status: str,
    ) -> Optional[EmailLogRecord]:
        raise NotImplementedError


class PostgresEmailLogRepository(EmailLogRepository):
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def get_by_id(self, email_log_id: str) -> Optional[EmailLogRecord]:
        query = """
            SELECT
                id::text AS id,
                client_id::text AS client_id,
                campaign_id::text AS campaign_id,
                contact_id::text AS contact_id,
                status,
                provider_message_id,
                body,
                created_at
            FROM email_logs
            WHERE id::text = %s
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (email_log_id,))
                row = cursor.fetchone()

        return EmailLogRecord.model_validate(row) if row is not None else None

    def create_email_log(
        self,
        *,
        client_id: str,
        campaign_id: str,
        contact_id: str,
        status: str,
        provider_message_id: Optional[str] = None,
        body: Optional[str] = None,
    ) -> EmailLogRecord:
        query = """
            INSERT INTO email_logs (
                client_id,
                campaign_id,
                contact_id,
                status,
                provider_message_id,
                body
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING
                id::text AS id,
                client_id::text AS client_id,
                campaign_id::text AS campaign_id,
                contact_id::text AS contact_id,
                status,
                provider_message_id,
                body,
                created_at
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    query,
                    (
                        client_id,
                        campaign_id,
                        contact_id,
                        status,
                        provider_message_id,
                        body,
                    ),
                )
                row = cursor.fetchone()
            connection.commit()

        return EmailLogRecord.model_validate(row)

    def get_campaign_status_counts(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> dict[str, int]:
        query = """
            SELECT
                status,
                COUNT(*)::int AS total
            FROM email_logs
            WHERE client_id::text = %s
                AND campaign_id::text = %s
            GROUP BY status
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (client_id, campaign_id))
                rows = cursor.fetchall()

        return {str(row["status"]): int(row["total"]) for row in rows}

    def find_by_provider_message_id(
        self,
        *,
        provider_message_id: str,
    ) -> Optional[EmailLogRecord]:
        query = """
            SELECT
                id::text AS id,
                client_id::text AS client_id,
                campaign_id::text AS campaign_id,
                contact_id::text AS contact_id,
                status,
                provider_message_id,
                body,
                created_at
            FROM email_logs
            WHERE provider_message_id = %s
            ORDER BY created_at DESC, id DESC
            LIMIT 1
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (provider_message_id,))
                row = cursor.fetchone()

        return EmailLogRecord.model_validate(row) if row is not None else None

    def find_latest_for_contact(
        self,
        *,
        client_id: str,
        campaign_id: str,
        contact_id: str,
    ) -> Optional[EmailLogRecord]:
        query = """
            SELECT
                id::text AS id,
                client_id::text AS client_id,
                campaign_id::text AS campaign_id,
                contact_id::text AS contact_id,
                status,
                provider_message_id,
                body,
                created_at
            FROM email_logs
            WHERE client_id::text = %s
                AND campaign_id::text = %s
                AND contact_id::text = %s
            ORDER BY created_at DESC, id DESC
            LIMIT 1
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (client_id, campaign_id, contact_id))
                row = cursor.fetchone()

        return EmailLogRecord.model_validate(row) if row is not None else None

    def update_status(
        self,
        *,
        email_log_id: str,
        status: str,
    ) -> Optional[EmailLogRecord]:
        query = """
            UPDATE email_logs
            SET status = %s
            WHERE id::text = %s
            RETURNING
                id::text AS id,
                client_id::text AS client_id,
                campaign_id::text AS campaign_id,
                contact_id::text AS contact_id,
                status,
                provider_message_id,
                body,
                created_at
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (status, email_log_id))
                row = cursor.fetchone()
            connection.commit()

        return EmailLogRecord.model_validate(row) if row is not None else None


class InMemoryEmailLogRepository(EmailLogRepository):
    def __init__(self) -> None:
        self._records: list[EmailLogRecord] = []

    def get_by_id(self, email_log_id: str) -> Optional[EmailLogRecord]:
        for record in self._records:
            if record.id == email_log_id:
                return record
        return None

    def create_email_log(
        self,
        *,
        client_id: str,
        campaign_id: str,
        contact_id: str,
        status: str,
        provider_message_id: Optional[str] = None,
        body: Optional[str] = None,
    ) -> EmailLogRecord:
        record = EmailLogRecord(
            id=str(uuid4()),
            client_id=client_id,
            campaign_id=campaign_id,
            contact_id=contact_id,
            status=status,
            provider_message_id=provider_message_id,
            body=body,
            created_at=datetime.now(timezone.utc),
        )
        self._records.append(record)
        return record

    def list_by_campaign(self, campaign_id: str) -> list[EmailLogRecord]:
        return [
            record
            for record in self._records
            if record.campaign_id == campaign_id
        ]

    def get_campaign_status_counts(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> dict[str, int]:
        counts: dict[str, int] = {}
        for record in self._records:
            if record.client_id != client_id or record.campaign_id != campaign_id:
                continue
            counts[record.status] = counts.get(record.status, 0) + 1
        return counts

    def find_by_provider_message_id(
        self,
        *,
        provider_message_id: str,
    ) -> Optional[EmailLogRecord]:
        for record in reversed(self._records):
            if record.provider_message_id == provider_message_id:
                return record
        return None

    def find_latest_for_contact(
        self,
        *,
        client_id: str,
        campaign_id: str,
        contact_id: str,
    ) -> Optional[EmailLogRecord]:
        for record in reversed(self._records):
            if (
                record.client_id == client_id
                and record.campaign_id == campaign_id
                and record.contact_id == contact_id
            ):
                return record
        return None

    def update_status(
        self,
        *,
        email_log_id: str,
        status: str,
    ) -> Optional[EmailLogRecord]:
        for index, record in enumerate(self._records):
            if record.id != email_log_id:
                continue
            updated = record.model_copy(update={"status": status})
            self._records[index] = updated
            return updated
        return None


def get_email_log_repository() -> EmailLogRepository:
    return PostgresEmailLogRepository(get_settings())
