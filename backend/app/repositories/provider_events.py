from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.repositories.clients import postgres_connection, require_psycopg


class ProviderEventRecord(BaseModel):
    id: str
    client_id: Optional[str] = None
    campaign_id: Optional[str] = None
    contact_id: Optional[str] = None
    email_log_id: Optional[str] = None
    provider: str
    source: str
    provider_event_id: Optional[str] = None
    event_key: str
    event_type: str
    payload: dict[str, Any]
    occurred_at: datetime
    processed_at: Optional[datetime] = None
    created_at: datetime


class ProviderEventRepository:
    def create_or_get_event(
        self,
        *,
        client_id: str | None,
        campaign_id: str | None,
        contact_id: str | None,
        email_log_id: str | None,
        provider: str,
        source: str,
        provider_event_id: str | None,
        event_key: str,
        event_type: str,
        payload: dict[str, Any],
        occurred_at: datetime,
    ) -> tuple[ProviderEventRecord, bool]:
        raise NotImplementedError

    def mark_processed(
        self,
        *,
        event_id: str,
        processed_at: datetime | None = None,
    ) -> ProviderEventRecord:
        raise NotImplementedError

    def get_campaign_event_counts(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> dict[str, int]:
        raise NotImplementedError

    def has_events_for_campaign(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> bool:
        raise NotImplementedError

    def list_by_campaign(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> list[ProviderEventRecord]:
        raise NotImplementedError


class PostgresProviderEventRepository(ProviderEventRepository):
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def create_or_get_event(
        self,
        *,
        client_id: str | None,
        campaign_id: str | None,
        contact_id: str | None,
        email_log_id: str | None,
        provider: str,
        source: str,
        provider_event_id: str | None,
        event_key: str,
        event_type: str,
        payload: dict[str, Any],
        occurred_at: datetime,
    ) -> tuple[ProviderEventRecord, bool]:
        psycopg = require_psycopg()
        insert_query = """
            INSERT INTO provider_events (
                client_id,
                campaign_id,
                contact_id,
                email_log_id,
                provider,
                source,
                provider_event_id,
                event_key,
                event_type,
                payload,
                occurred_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s)
            ON CONFLICT (event_key) DO NOTHING
            RETURNING
                id::text AS id,
                client_id::text AS client_id,
                campaign_id::text AS campaign_id,
                contact_id::text AS contact_id,
                email_log_id::text AS email_log_id,
                provider,
                source,
                provider_event_id,
                event_key,
                event_type,
                payload,
                occurred_at,
                processed_at,
                created_at
        """
        select_query = """
            SELECT
                id::text AS id,
                client_id::text AS client_id,
                campaign_id::text AS campaign_id,
                contact_id::text AS contact_id,
                email_log_id::text AS email_log_id,
                provider,
                source,
                provider_event_id,
                event_key,
                event_type,
                payload,
                occurred_at,
                processed_at,
                created_at
            FROM provider_events
            WHERE event_key = %s
        """
        select_by_provider_event_id_query = """
            SELECT
                id::text AS id,
                client_id::text AS client_id,
                campaign_id::text AS campaign_id,
                contact_id::text AS contact_id,
                email_log_id::text AS email_log_id,
                provider,
                source,
                provider_event_id,
                event_key,
                event_type,
                payload,
                occurred_at,
                processed_at,
                created_at
            FROM provider_events
            WHERE provider = %s
                AND provider_event_id = %s
            LIMIT 1
        """

        with postgres_connection(self._settings) as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(
                        insert_query,
                        (
                            client_id,
                            campaign_id,
                            contact_id,
                            email_log_id,
                            provider,
                            source,
                            provider_event_id,
                            event_key,
                            event_type,
                            _json_payload(payload),
                            occurred_at,
                        ),
                    )
                    row = cursor.fetchone()
                    created = row is not None
                    if row is None:
                        cursor.execute(select_query, (event_key,))
                        row = cursor.fetchone()
                connection.commit()
            except psycopg.errors.UniqueViolation:
                connection.rollback()
                created = False
                row = None
                with connection.cursor() as cursor:
                    if provider_event_id is not None:
                        cursor.execute(
                            select_by_provider_event_id_query,
                            (provider, provider_event_id),
                        )
                        row = cursor.fetchone()
                    if row is None:
                        cursor.execute(select_query, (event_key,))
                        row = cursor.fetchone()
            connection.commit()

        if row is None:
            raise ValueError("provider event could not be created or loaded")

        return ProviderEventRecord.model_validate(row), created

    def mark_processed(
        self,
        *,
        event_id: str,
        processed_at: datetime | None = None,
    ) -> ProviderEventRecord:
        query = """
            UPDATE provider_events
            SET processed_at = %s
            WHERE id::text = %s
            RETURNING
                id::text AS id,
                client_id::text AS client_id,
                campaign_id::text AS campaign_id,
                contact_id::text AS contact_id,
                email_log_id::text AS email_log_id,
                provider,
                source,
                provider_event_id,
                event_key,
                event_type,
                payload,
                occurred_at,
                processed_at,
                created_at
        """
        processed_value = processed_at or datetime.now(timezone.utc)

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (processed_value, event_id))
                row = cursor.fetchone()
            connection.commit()

        if row is None:
            raise ValueError("provider event not found")

        return ProviderEventRecord.model_validate(row)

    def get_campaign_event_counts(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> dict[str, int]:
        query = """
            SELECT
                event_type,
                COUNT(
                    DISTINCT COALESCE(
                        contact_id::text,
                        email_log_id::text,
                        event_key
                    )
                )::int AS total
            FROM provider_events
            WHERE client_id::text = %s
                AND campaign_id::text = %s
                AND processed_at IS NOT NULL
            GROUP BY event_type
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (client_id, campaign_id))
                rows = cursor.fetchall()

        return {str(row["event_type"]): int(row["total"]) for row in rows}

    def has_events_for_campaign(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> bool:
        query = """
            SELECT 1 AS exists
            FROM provider_events
            WHERE client_id::text = %s
                AND campaign_id::text = %s
                AND processed_at IS NOT NULL
            LIMIT 1
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (client_id, campaign_id))
                row = cursor.fetchone()

        return row is not None

    def list_by_campaign(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> list[ProviderEventRecord]:
        query = """
            SELECT
                id::text AS id,
                client_id::text AS client_id,
                campaign_id::text AS campaign_id,
                contact_id::text AS contact_id,
                email_log_id::text AS email_log_id,
                provider,
                source,
                provider_event_id,
                event_key,
                event_type,
                payload,
                occurred_at,
                processed_at,
                created_at
            FROM provider_events
            WHERE client_id::text = %s
                AND campaign_id::text = %s
            ORDER BY occurred_at ASC, created_at ASC
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (client_id, campaign_id))
                rows = cursor.fetchall()

        return [ProviderEventRecord.model_validate(row) for row in rows]


class InMemoryProviderEventRepository(ProviderEventRepository):
    def __init__(self) -> None:
        self._records: dict[str, ProviderEventRecord] = {}

    def create_or_get_event(
        self,
        *,
        client_id: str | None,
        campaign_id: str | None,
        contact_id: str | None,
        email_log_id: str | None,
        provider: str,
        source: str,
        provider_event_id: str | None,
        event_key: str,
        event_type: str,
        payload: dict[str, Any],
        occurred_at: datetime,
    ) -> tuple[ProviderEventRecord, bool]:
        existing = self._records.get(event_key)
        if existing is not None:
            return existing, False

        record = ProviderEventRecord(
            id=str(uuid4()),
            client_id=client_id,
            campaign_id=campaign_id,
            contact_id=contact_id,
            email_log_id=email_log_id,
            provider=provider,
            source=source,
            provider_event_id=provider_event_id,
            event_key=event_key,
            event_type=event_type,
            payload=payload,
            occurred_at=occurred_at,
            processed_at=None,
            created_at=datetime.now(timezone.utc),
        )
        self._records[event_key] = record
        return record, True

    def mark_processed(
        self,
        *,
        event_id: str,
        processed_at: datetime | None = None,
    ) -> ProviderEventRecord:
        for event_key, record in self._records.items():
            if record.id != event_id:
                continue
            updated = record.model_copy(
                update={"processed_at": processed_at or datetime.now(timezone.utc)}
            )
            self._records[event_key] = updated
            return updated
        raise ValueError("provider event not found")

    def get_campaign_event_counts(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> dict[str, int]:
        counts: dict[str, set[str]] = {}
        for record in self._records.values():
            if (
                record.client_id != client_id
                or record.campaign_id != campaign_id
                or record.processed_at is None
            ):
                continue
            key = record.contact_id or record.email_log_id or record.event_key
            counts.setdefault(record.event_type, set()).add(key)
        return {event_type: len(keys) for event_type, keys in counts.items()}

    def has_events_for_campaign(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> bool:
        return any(
            record.client_id == client_id
            and record.campaign_id == campaign_id
            and record.processed_at is not None
            for record in self._records.values()
        )

    def list_by_campaign(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> list[ProviderEventRecord]:
        return sorted(
            [
                record
                for record in self._records.values()
                if record.client_id == client_id and record.campaign_id == campaign_id
            ],
            key=lambda record: (record.occurred_at, record.created_at),
        )


def _json_payload(payload: dict[str, Any]) -> str:
    import json

    return json.dumps(payload, sort_keys=True, separators=(",", ":"))


def get_provider_event_repository() -> ProviderEventRepository:
    return PostgresProviderEventRepository(get_settings())
