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
    company_name: Optional[str] = None
    status: str
    email_limit_per_campaign: Optional[int] = None
    max_campaigns: Optional[int] = None
    monthly_email_limit: Optional[int] = None
    daily_email_limit: Optional[int] = None
    created_at: datetime
    updated_at: datetime


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
        company_name: Optional[str],
        status: str,
    ) -> ClientRecord:
        raise NotImplementedError

    def update_client(
        self,
        *,
        client_id: str,
        email: str,
        personal_name: Optional[str],
        company_name: Optional[str],
        status: Optional[str] = None,
        email_limit_per_campaign: Optional[int] = None,
        max_campaigns: Optional[int] = None,
        monthly_email_limit: Optional[int] = None,
        daily_email_limit: Optional[int] = None,
    ) -> ClientRecord:
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
                company_name,
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
                company_name,
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
                company_name,
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
        company_name: Optional[str],
        status: str,
    ) -> ClientRecord:
        query = """
            INSERT INTO clients (
                email,
                personal_name,
                company_name,
                status
            )
            VALUES (%s, %s, %s, %s)
            RETURNING
                id::text AS id,
                email,
                personal_name,
                company_name,
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
                cursor.execute(query, (email, personal_name, company_name, status))
                row = cursor.fetchone()
            connection.commit()

        return ClientRecord.model_validate(row)

    def update_client(
        self,
        *,
        client_id: str,
        email: str,
        personal_name: Optional[str],
        company_name: Optional[str],
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
                company_name = %s,
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
                company_name,
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
                        company_name,
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


def get_client_repository(
    settings: Settings = Depends(get_settings),
) -> ClientRepository:
    return PostgresClientRepository(settings)
