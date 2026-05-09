from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime
from typing import Any, Iterator, Optional

from fastapi import Depends
from pydantic import BaseModel

from app.core.config import Settings, get_settings


class ClientRecord(BaseModel):
    id: str
    email: str
    personal_name: Optional[str] = None
    status: str
    email_limit_per_campaign: Optional[int] = None
    max_campaigns: Optional[int] = None
    monthly_email_limit: Optional[int] = None
    daily_email_limit: Optional[int] = None
    created_at: datetime
    updated_at: datetime


class AdminCampaignRecord(BaseModel):
    id: str
    client_id: str
    client_name: str
    client_email: str
    name: str
    status: str
    subject: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    blocked_sends_count: int = 0


class AdminBlockedSendRecord(BaseModel):
    id: str
    client_id: str
    client_name: str
    campaign_id: Optional[str] = None
    campaign_name: str
    reason: str
    decision: str
    created_at: datetime


def require_psycopg() -> Any:
    try:
        import psycopg  # type: ignore[import-not-found]
    except ModuleNotFoundError as error:
        raise RuntimeError(
            "psycopg is required for PostgreSQL-backed client persistence."
        ) from error

    return psycopg


@contextmanager
def postgres_connection(settings: Settings) -> Iterator[Any]:
    psycopg = require_psycopg()
    connection = psycopg.connect(
        settings.postgres_dsn,
        row_factory=psycopg.rows.dict_row,
    )

    try:
        yield connection
    finally:
        connection.close()


def _map_client_row(row: Optional[dict[str, Any]]) -> Optional[ClientRecord]:
    if row is None:
        return None

    return ClientRecord.model_validate(row)


class ClientRepository:
    def list_clients(self) -> list[ClientRecord]:
        raise NotImplementedError

    def get_by_id(self, client_id: str) -> Optional[ClientRecord]:
        raise NotImplementedError

    def get_by_email(self, email: str) -> Optional[ClientRecord]:
        raise NotImplementedError

    def create_client(
        self,
        *,
        email: str,
        personal_name: Optional[str],
        status: str,
    ) -> ClientRecord:
        raise NotImplementedError

    def update_client(
        self,
        *,
        client_id: str,
        email: str,
        personal_name: Optional[str],
        status: Optional[str] = None,
        email_limit_per_campaign: Optional[int] = None,
        max_campaigns: Optional[int] = None,
        monthly_email_limit: Optional[int] = None,
        daily_email_limit: Optional[int] = None,
    ) -> ClientRecord:
        raise NotImplementedError

    def list_admin_campaigns(self) -> list[AdminCampaignRecord]:
        raise NotImplementedError

    def list_recent_admin_blocked_sends(
        self,
        *,
        limit: int,
    ) -> list[AdminBlockedSendRecord]:
        raise NotImplementedError

    def count_admin_blocked_sends_since(self, started_at: datetime) -> int:
        raise NotImplementedError

    def delete_client_account(self, client_id: str) -> bool:
        raise NotImplementedError


class PostgresClientRepository(ClientRepository):
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def list_clients(self) -> list[ClientRecord]:
        query = """
            SELECT
                id::text AS id,
                email,
                personal_name,
                status,
                email_limit_per_campaign,
                max_campaigns,
                monthly_email_limit,
                daily_email_limit,
                created_at,
                updated_at
            FROM clients
            ORDER BY created_at DESC, id DESC
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query)
                rows = cursor.fetchall()

        return [ClientRecord.model_validate(row) for row in rows]

    def get_by_id(self, client_id: str) -> Optional[ClientRecord]:
        query = """
            SELECT
                id::text AS id,
                email,
                personal_name,
                status,
                email_limit_per_campaign,
                max_campaigns,
                monthly_email_limit,
                daily_email_limit,
                created_at,
                updated_at
            FROM clients
            WHERE id::text = %s
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (client_id,))
                row = cursor.fetchone()

        return _map_client_row(row)

    def get_by_email(self, email: str) -> Optional[ClientRecord]:
        query = """
            SELECT
                id::text AS id,
                email,
                personal_name,
                status,
                email_limit_per_campaign,
                max_campaigns,
                monthly_email_limit,
                daily_email_limit,
                created_at,
                updated_at
            FROM clients
            WHERE lower(email) = lower(%s)
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (email,))
                row = cursor.fetchone()

        return _map_client_row(row)

    def create_client(
        self,
        *,
        email: str,
        personal_name: Optional[str],
        status: str,
    ) -> ClientRecord:
        query = """
            INSERT INTO clients (
                email,
                personal_name,
                status
            )
            VALUES (%s, %s, %s)
            RETURNING
                id::text AS id,
                email,
                personal_name,
                status,
                email_limit_per_campaign,
                max_campaigns,
                monthly_email_limit,
                daily_email_limit,
                created_at,
                updated_at
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (email, personal_name, status))
                row = cursor.fetchone()
            connection.commit()

        return ClientRecord.model_validate(row)

    def update_client(
        self,
        *,
        client_id: str,
        email: str,
        personal_name: Optional[str],
        status: Optional[str] = None,
        email_limit_per_campaign: Optional[int] = None,
        max_campaigns: Optional[int] = None,
        monthly_email_limit: Optional[int] = None,
        daily_email_limit: Optional[int] = None,
    ) -> ClientRecord:
        query = """
            UPDATE clients
            SET
                email = %s,
                personal_name = %s,
                status = COALESCE(%s, status),
                email_limit_per_campaign = %s,
                max_campaigns = %s,
                monthly_email_limit = %s,
                daily_email_limit = %s,
                updated_at = NOW()
            WHERE id::text = %s
            RETURNING
                id::text AS id,
                email,
                personal_name,
                status,
                email_limit_per_campaign,
                max_campaigns,
                monthly_email_limit,
                daily_email_limit,
                created_at,
                updated_at
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    query,
                    (
                        email,
                        personal_name,
                        status,
                        email_limit_per_campaign,
                        max_campaigns,
                        monthly_email_limit,
                        daily_email_limit,
                        client_id,
                    ),
                )
                row = cursor.fetchone()
            connection.commit()

        return ClientRecord.model_validate(row)

    def list_admin_campaigns(self) -> list[AdminCampaignRecord]:
        query = """
            SELECT
                campaigns.id::text AS id,
                campaigns.client_id::text AS client_id,
                COALESCE(NULLIF(clients.personal_name, ''), clients.email) AS client_name,
                clients.email AS client_email,
                campaigns.name,
                campaigns.status,
                campaigns.subject,
                campaigns.created_at,
                campaigns.updated_at,
                COALESCE(blocked_campaigns.blocked_sends_count, 0) AS blocked_sends_count
            FROM campaigns
            INNER JOIN clients
                ON clients.id = campaigns.client_id
            LEFT JOIN (
                SELECT
                    campaign_id,
                    COUNT(*)::int AS blocked_sends_count
                FROM blocked_sends
                WHERE campaign_id IS NOT NULL
                GROUP BY campaign_id
            ) AS blocked_campaigns
                ON blocked_campaigns.campaign_id = campaigns.id
            ORDER BY campaigns.updated_at DESC, campaigns.id DESC
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query)
                rows = cursor.fetchall()

        return [AdminCampaignRecord.model_validate(row) for row in rows]

    def list_recent_admin_blocked_sends(
        self,
        *,
        limit: int,
    ) -> list[AdminBlockedSendRecord]:
        query = """
            SELECT
                blocked_sends.id::text AS id,
                blocked_sends.client_id::text AS client_id,
                COALESCE(NULLIF(clients.personal_name, ''), clients.email) AS client_name,
                blocked_sends.campaign_id::text AS campaign_id,
                COALESCE(campaigns.name, 'Campagna non disponibile') AS campaign_name,
                blocked_sends.reason,
                blocked_sends.decision,
                blocked_sends.created_at
            FROM blocked_sends
            INNER JOIN clients
                ON clients.id = blocked_sends.client_id
            LEFT JOIN campaigns
                ON campaigns.id = blocked_sends.campaign_id
            ORDER BY blocked_sends.created_at DESC, blocked_sends.id DESC
            LIMIT %s
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (limit,))
                rows = cursor.fetchall()

        return [AdminBlockedSendRecord.model_validate(row) for row in rows]

    def count_admin_blocked_sends_since(self, started_at: datetime) -> int:
        query = """
            SELECT COUNT(*)::int AS total
            FROM blocked_sends
            WHERE created_at >= %s
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (started_at,))
                row = cursor.fetchone()

        return int((row or {}).get("total", 0))

    def delete_client_account(self, client_id: str) -> bool:
        delete_queries = (
            "DELETE FROM campaign_contacts WHERE client_id::text = %s",
            "DELETE FROM email_logs WHERE client_id::text = %s",
            "DELETE FROM provider_events WHERE client_id::text = %s",
            "DELETE FROM blocked_sends WHERE client_id::text = %s",
            "DELETE FROM api_usage WHERE client_id::text = %s",
            "DELETE FROM suppression_list WHERE client_id::text = %s",
            "DELETE FROM listmonk_mappings WHERE client_id::text = %s",
            "DELETE FROM campaigns WHERE client_id::text = %s",
            "DELETE FROM contacts WHERE client_id::text = %s",
        )
        delete_client_query = """
            DELETE FROM clients
            WHERE id::text = %s
            RETURNING id::text AS id
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                for query in delete_queries:
                    cursor.execute(query, (client_id,))

                cursor.execute(delete_client_query, (client_id,))
                deleted_row = cursor.fetchone()
            connection.commit()

        return deleted_row is not None


def get_client_repository(
    settings: Settings = Depends(get_settings),
) -> ClientRepository:
    return PostgresClientRepository(settings)
