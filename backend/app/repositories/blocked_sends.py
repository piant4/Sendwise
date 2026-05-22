from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.repositories.clients import postgres_connection


class BlockedSendRecord(BaseModel):
    id: str
    client_id: str
    campaign_id: Optional[str] = None
    contact_id: Optional[str] = None
    sending_domain: Optional[str] = None
    reason: str
    decision: str
    created_at: datetime


class BlockedSendRepository:
    def create_blocked_send(
        self,
        *,
        client_id: str,
        campaign_id: str,
        reason: str,
        decision: str,
        contact_id: Optional[str] = None,
        sending_domain: Optional[str] = None,
    ) -> BlockedSendRecord:
        raise NotImplementedError

    def list_by_campaign(self, campaign_id: str) -> list[BlockedSendRecord]:
        raise NotImplementedError

    def list_by_client(self, client_id: str) -> list[BlockedSendRecord]:
        raise NotImplementedError

    def count_by_campaign(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> int:
        raise NotImplementedError

    def list_recent_by_campaign(
        self,
        *,
        client_id: str,
        campaign_id: str,
        limit: int,
    ) -> list[BlockedSendRecord]:
        raise NotImplementedError

    def count_by_client(
        self,
        *,
        client_id: str,
        started_at: datetime | None = None,
        ended_at: datetime | None = None,
    ) -> int:
        raise NotImplementedError


class PostgresBlockedSendRepository(BlockedSendRepository):
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def create_blocked_send(
        self,
        *,
        client_id: str,
        campaign_id: str,
        reason: str,
        decision: str,
        contact_id: Optional[str] = None,
        sending_domain: Optional[str] = None,
    ) -> BlockedSendRecord:
        query = """
            INSERT INTO blocked_sends (
                client_id,
                campaign_id,
                contact_id,
                sending_domain,
                reason,
                decision
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING
                id::text AS id,
                client_id::text AS client_id,
                campaign_id::text AS campaign_id,
                contact_id::text AS contact_id,
                sending_domain,
                reason,
                decision,
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
                        sending_domain,
                        reason,
                        decision,
                    ),
                )
                row = cursor.fetchone()
            connection.commit()

        return BlockedSendRecord.model_validate(row)

    def list_by_campaign(self, campaign_id: str) -> list[BlockedSendRecord]:
        query = """
            SELECT
                id::text AS id,
                client_id::text AS client_id,
                campaign_id::text AS campaign_id,
                contact_id::text AS contact_id,
                sending_domain,
                reason,
                decision,
                created_at
            FROM blocked_sends
            WHERE campaign_id::text = %s
            ORDER BY created_at DESC, id DESC
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (campaign_id,))
                rows = cursor.fetchall()

        return [BlockedSendRecord.model_validate(row) for row in rows]

    def list_by_client(self, client_id: str) -> list[BlockedSendRecord]:
        query = """
            SELECT
                id::text AS id,
                client_id::text AS client_id,
                campaign_id::text AS campaign_id,
                contact_id::text AS contact_id,
                sending_domain,
                reason,
                decision,
                created_at
            FROM blocked_sends
            WHERE client_id::text = %s
            ORDER BY created_at DESC, id DESC
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (client_id,))
                rows = cursor.fetchall()

        return [BlockedSendRecord.model_validate(row) for row in rows]

    def count_by_campaign(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> int:
        query = """
            SELECT COUNT(*)::int AS total
            FROM blocked_sends
            WHERE client_id::text = %s
                AND campaign_id::text = %s
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (client_id, campaign_id))
                row = cursor.fetchone()

        return int(row["total"]) if row is not None else 0

    def list_recent_by_campaign(
        self,
        *,
        client_id: str,
        campaign_id: str,
        limit: int,
    ) -> list[BlockedSendRecord]:
        query = """
            SELECT
                id::text AS id,
                client_id::text AS client_id,
                campaign_id::text AS campaign_id,
                contact_id::text AS contact_id,
                sending_domain,
                reason,
                decision,
                created_at
            FROM blocked_sends
            WHERE client_id::text = %s
                AND campaign_id::text = %s
            ORDER BY created_at DESC, id DESC
            LIMIT %s
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (client_id, campaign_id, limit))
                rows = cursor.fetchall()

        return [BlockedSendRecord.model_validate(row) for row in rows]

    def count_by_client(
        self,
        *,
        client_id: str,
        started_at: datetime | None = None,
        ended_at: datetime | None = None,
    ) -> int:
        query = """
            SELECT COUNT(*)::int AS total
            FROM blocked_sends
            WHERE client_id::text = %s
        """
        parameters: list[object] = [client_id]

        if started_at is not None:
            query = f"{query}\n                AND created_at >= %s"
            parameters.append(started_at)

        if ended_at is not None:
            query = f"{query}\n                AND created_at < %s"
            parameters.append(ended_at)

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                row = cursor.fetchone()

        if row is None:
            return 0
        return int(row["total"])


class InMemoryBlockedSendRepository(BlockedSendRepository):
    def __init__(self) -> None:
        self._records: list[BlockedSendRecord] = []

    def create_blocked_send(
        self,
        *,
        client_id: str,
        campaign_id: str,
        reason: str,
        decision: str,
        contact_id: Optional[str] = None,
        sending_domain: Optional[str] = None,
    ) -> BlockedSendRecord:
        record = BlockedSendRecord(
            id=str(uuid4()),
            client_id=client_id,
            campaign_id=campaign_id,
            contact_id=contact_id,
            sending_domain=sending_domain,
            reason=reason,
            decision=decision,
            created_at=datetime.now(timezone.utc),
        )
        self._records.append(record)
        return record

    def list_by_campaign(self, campaign_id: str) -> list[BlockedSendRecord]:
        return [
            record
            for record in self._records
            if record.campaign_id == campaign_id
        ]

    def list_by_client(self, client_id: str) -> list[BlockedSendRecord]:
        return [
            record
            for record in self._records
            if record.client_id == client_id
        ]

    def count_by_campaign(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> int:
        return sum(
            1
            for record in self._records
            if record.client_id == client_id and record.campaign_id == campaign_id
        )

    def list_recent_by_campaign(
        self,
        *,
        client_id: str,
        campaign_id: str,
        limit: int,
    ) -> list[BlockedSendRecord]:
        rows = [
            record
            for record in self._records
            if record.client_id == client_id and record.campaign_id == campaign_id
        ]
        rows.sort(key=lambda item: (item.created_at, item.id), reverse=True)
        return rows[:limit]

    def count_by_client(
        self,
        *,
        client_id: str,
        started_at: datetime | None = None,
        ended_at: datetime | None = None,
    ) -> int:
        return sum(
            1
            for record in self._records
            if record.client_id == client_id
            and (started_at is None or record.created_at >= started_at)
            and (ended_at is None or record.created_at < ended_at)
        )


def get_blocked_send_repository() -> BlockedSendRepository:
    return PostgresBlockedSendRepository(get_settings())
