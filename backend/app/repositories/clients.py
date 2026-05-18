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
    campaign_slot_id: Optional[str] = None
    preview_text: Optional[str] = None
    body_html: Optional[str] = None
    body_text: Optional[str] = None
    content_ready: bool = False
    contacts_ready: bool = False
    review_ready: bool = False
    current_step: str = "setup"
    created_at: datetime
    updated_at: datetime
    blocked_sends_count: int = 0


class ClientCampaignRecord(BaseModel):
    id: str
    client_id: str
    name: str
    status: str
    subject: Optional[str] = None
    campaign_slot_id: Optional[str] = None
    preview_text: Optional[str] = None
    body_html: Optional[str] = None
    body_text: Optional[str] = None
    content_ready: bool = False
    contacts_ready: bool = False
    review_ready: bool = False
    current_step: str = "setup"
    created_at: datetime
    updated_at: datetime


class ClientUsageRecord(BaseModel):
    id: str
    client_id: str
    usage_type: str
    quantity: int
    metadata: dict[str, Any]
    created_at: datetime


class ClientBlockedSendRecord(BaseModel):
    id: str
    client_id: str
    campaign_id: Optional[str] = None
    campaign_name: Optional[str] = None
    contact_id: Optional[str] = None
    reason: str
    decision: str
    created_at: datetime


class AdminBlockedSendRecord(BaseModel):
    id: str
    client_id: str
    client_name: str
    client_email: str
    campaign_id: Optional[str] = None
    campaign_name: str
    reason: str
    decision: str
    created_at: datetime


class AdminTopClientVolumeRecord(BaseModel):
    client_id: str
    client_name: str
    client_email: str
    emails_sent: int


class AdminCampaignEmailVolumeRecord(BaseModel):
    client_id: str
    campaign_id: Optional[str] = None
    campaign_name: Optional[str] = None
    emails_sent: int


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

    def list_client_campaigns(self, client_id: str) -> list[ClientCampaignRecord]:
        raise NotImplementedError

    def update_campaign_status(
        self,
        *,
        client_id: str,
        campaign_id: str,
        status: str,
    ) -> Optional[ClientCampaignRecord]:
        raise NotImplementedError

    def list_client_usage(self, client_id: str) -> list[ClientUsageRecord]:
        raise NotImplementedError

    def list_client_blocked_sends(self, client_id: str) -> list[ClientBlockedSendRecord]:
        raise NotImplementedError

    def list_recent_admin_blocked_sends(
        self,
        *,
        limit: int,
    ) -> list[AdminBlockedSendRecord]:
        raise NotImplementedError

    def list_admin_blocked_sends(
        self,
        *,
        limit: Optional[int] = None,
    ) -> list[AdminBlockedSendRecord]:
        raise NotImplementedError

    def count_admin_blocked_sends_since(self, started_at: datetime) -> int:
        raise NotImplementedError

    def count_admin_email_logs_since(self, started_at: datetime) -> int:
        raise NotImplementedError

    def list_admin_top_sending_clients_since(
        self,
        *,
        started_at: datetime,
        limit: int,
    ) -> list[AdminTopClientVolumeRecord]:
        raise NotImplementedError

    def list_admin_campaign_email_volumes(self) -> list[AdminCampaignEmailVolumeRecord]:
        raise NotImplementedError

    def is_database_available(self) -> bool:
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
        has_legacy_name_query = """
            SELECT EXISTS (
                SELECT 1
                FROM pg_attribute
                WHERE attrelid = 'clients'::regclass
                    AND attname = 'name'
                    AND NOT attisdropped
            ) AS has_legacy_name
        """
        base_returning_clause = """
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
                cursor.execute(has_legacy_name_query)
                schema_row = cursor.fetchone() or {}
                has_legacy_name = bool(schema_row.get("has_legacy_name"))

                if has_legacy_name:
                    query = f"""
                        INSERT INTO clients (
                            email,
                            personal_name,
                            name,
                            status
                        )
                        VALUES (%s, %s, %s, %s)
                        {base_returning_clause}
                    """
                    cursor.execute(
                        query,
                        (
                            email,
                            personal_name,
                            personal_name or email,
                            status,
                        ),
                    )
                else:
                    query = f"""
                        INSERT INTO clients (
                            email,
                            personal_name,
                            status
                        )
                        VALUES (%s, %s, %s)
                        {base_returning_clause}
                    """
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
                campaigns.campaign_slot_id::text AS campaign_slot_id,
                campaigns.preview_text,
                campaigns.body_html,
                campaigns.body_text,
                campaigns.content_ready,
                campaigns.contacts_ready,
                campaigns.review_ready,
                campaigns.current_step,
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

    def list_client_campaigns(self, client_id: str) -> list[ClientCampaignRecord]:
        query = """
            SELECT
                id::text AS id,
                client_id::text AS client_id,
                name,
                status,
                subject,
                campaign_slot_id::text AS campaign_slot_id,
                preview_text,
                body_html,
                body_text,
                content_ready,
                contacts_ready,
                review_ready,
                current_step,
                created_at,
                updated_at
            FROM campaigns
            WHERE client_id::text = %s
            ORDER BY updated_at DESC, id DESC
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (client_id,))
                rows = cursor.fetchall()

        return [ClientCampaignRecord.model_validate(row) for row in rows]

    def update_campaign_status(
        self,
        *,
        client_id: str,
        campaign_id: str,
        status: str,
    ) -> Optional[ClientCampaignRecord]:
        query = """
            UPDATE campaigns
            SET
                status = %s,
                updated_at = NOW()
            WHERE client_id::text = %s
                AND id::text = %s
            RETURNING
                id::text AS id,
                client_id::text AS client_id,
                name,
                status,
                subject,
                campaign_slot_id::text AS campaign_slot_id,
                preview_text,
                body_html,
                body_text,
                content_ready,
                contacts_ready,
                review_ready,
                current_step,
                created_at,
                updated_at
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (status, client_id, campaign_id))
                row = cursor.fetchone()
            connection.commit()

        return ClientCampaignRecord.model_validate(row) if row is not None else None

    def list_client_usage(self, client_id: str) -> list[ClientUsageRecord]:
        query = """
            SELECT
                id::text AS id,
                client_id::text AS client_id,
                usage_type,
                quantity,
                metadata,
                created_at
            FROM api_usage
            WHERE client_id::text = %s
            ORDER BY created_at DESC, id DESC
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (client_id,))
                rows = cursor.fetchall()

        return [ClientUsageRecord.model_validate(row) for row in rows]

    def list_client_blocked_sends(self, client_id: str) -> list[ClientBlockedSendRecord]:
        query = """
            SELECT
                blocked_sends.id::text AS id,
                blocked_sends.client_id::text AS client_id,
                blocked_sends.campaign_id::text AS campaign_id,
                campaigns.name AS campaign_name,
                blocked_sends.contact_id::text AS contact_id,
                blocked_sends.reason,
                blocked_sends.decision,
                blocked_sends.created_at
            FROM blocked_sends
            LEFT JOIN campaigns
                ON campaigns.id = blocked_sends.campaign_id
            WHERE blocked_sends.client_id::text = %s
            ORDER BY blocked_sends.created_at DESC, blocked_sends.id DESC
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (client_id,))
                rows = cursor.fetchall()

        return [ClientBlockedSendRecord.model_validate(row) for row in rows]

    def list_recent_admin_blocked_sends(
        self,
        *,
        limit: int,
    ) -> list[AdminBlockedSendRecord]:
        return self.list_admin_blocked_sends(limit=limit)

    def list_admin_blocked_sends(
        self,
        *,
        limit: Optional[int] = None,
    ) -> list[AdminBlockedSendRecord]:
        query = """
            SELECT
                blocked_sends.id::text AS id,
                blocked_sends.client_id::text AS client_id,
                COALESCE(NULLIF(clients.personal_name, ''), clients.email) AS client_name,
                clients.email AS client_email,
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
        """
        parameters: tuple[Any, ...] = ()
        if limit is not None:
            query = f"{query}\n            LIMIT %s"
            parameters = (limit,)

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, parameters)
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

    def count_admin_email_logs_since(self, started_at: datetime) -> int:
        query = """
            SELECT COUNT(*)::int AS total
            FROM email_logs
            WHERE created_at >= %s
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (started_at,))
                row = cursor.fetchone()

        return int((row or {}).get("total", 0))

    def list_admin_top_sending_clients_since(
        self,
        *,
        started_at: datetime,
        limit: int,
    ) -> list[AdminTopClientVolumeRecord]:
        query = """
            SELECT
                email_logs.client_id::text AS client_id,
                COALESCE(NULLIF(clients.personal_name, ''), clients.email) AS client_name,
                clients.email AS client_email,
                COUNT(*)::int AS emails_sent
            FROM email_logs
            INNER JOIN clients
                ON clients.id = email_logs.client_id
            WHERE email_logs.created_at >= %s
            GROUP BY
                email_logs.client_id,
                clients.personal_name,
                clients.email
            ORDER BY
                emails_sent DESC,
                client_name ASC,
                client_email ASC
            LIMIT %s
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (started_at, limit))
                rows = cursor.fetchall()

        return [AdminTopClientVolumeRecord.model_validate(row) for row in rows]

    def list_admin_campaign_email_volumes(self) -> list[AdminCampaignEmailVolumeRecord]:
        query = """
            SELECT
                email_logs.client_id::text AS client_id,
                email_logs.campaign_id::text AS campaign_id,
                campaigns.name AS campaign_name,
                COUNT(*)::int AS emails_sent
            FROM email_logs
            LEFT JOIN campaigns
                ON campaigns.id = email_logs.campaign_id
            GROUP BY
                email_logs.client_id,
                email_logs.campaign_id,
                campaigns.name
            ORDER BY
                emails_sent DESC,
                campaign_name ASC NULLS LAST
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query)
                rows = cursor.fetchall()

        return [AdminCampaignEmailVolumeRecord.model_validate(row) for row in rows]

    def is_database_available(self) -> bool:
        query = "SELECT 1 AS ok"

        try:
            with postgres_connection(self._settings) as connection:
                with connection.cursor() as cursor:
                    cursor.execute(query)
                    cursor.fetchone()
        except Exception:
            return False

        return True

    def delete_client_account(self, client_id: str) -> bool:
        delete_queries = (
            "DELETE FROM campaign_contacts WHERE client_id::text = %s",
            "DELETE FROM email_logs WHERE client_id::text = %s",
            "DELETE FROM provider_events WHERE client_id::text = %s",
            "DELETE FROM blocked_sends WHERE client_id::text = %s",
            "DELETE FROM api_usage WHERE client_id::text = %s",
            "DELETE FROM suppression_list WHERE client_id::text = %s",
            "DELETE FROM listmonk_mappings WHERE client_id::text = %s",
            "UPDATE campaign_slots SET assigned_campaign_id = NULL, updated_at = NOW() WHERE client_id::text = %s",
            "UPDATE campaigns SET campaign_slot_id = NULL, updated_at = NOW() WHERE client_id::text = %s",
            "DELETE FROM campaign_slots WHERE client_id::text = %s",
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
