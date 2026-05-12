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


class PostgresEmailLogRepository(EmailLogRepository):
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

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


class InMemoryEmailLogRepository(EmailLogRepository):
    def __init__(self) -> None:
        self._records: list[EmailLogRecord] = []

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


def get_email_log_repository() -> EmailLogRepository:
    return PostgresEmailLogRepository(get_settings())
