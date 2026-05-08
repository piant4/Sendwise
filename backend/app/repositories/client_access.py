from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

from fastapi import Depends
from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.repositories.clients import postgres_connection


class ClientAccessRecord(BaseModel):
    id: str
    client_id: str
    email: str
    clerk_user_id: Optional[str] = None
    clerk_invitation_id: Optional[str] = None
    portal_slug: str
    status: str
    invitation_status: Optional[str] = None
    invited_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


def _map_access_row(row: Optional[dict[str, Any]]) -> Optional[ClientAccessRecord]:
    if row is None:
        return None

    return ClientAccessRecord.model_validate(row)


class ClientAccessRepository:
    def get_by_clerk_user_id(self, clerk_user_id: str) -> Optional[ClientAccessRecord]:
        raise NotImplementedError

    def get_by_client_id(self, client_id: str) -> Optional[ClientAccessRecord]:
        raise NotImplementedError

    def get_by_email(self, email: str) -> Optional[ClientAccessRecord]:
        raise NotImplementedError

    def get_by_portal_slug(self, portal_slug: str) -> Optional[ClientAccessRecord]:
        raise NotImplementedError

    def claim_invited_access(
        self,
        *,
        clerk_user_id: str,
        email: str,
    ) -> Optional[ClientAccessRecord]:
        raise NotImplementedError

    def update_access(
        self,
        *,
        access_id: str,
        status: str,
        invitation_status: Optional[str],
        accepted_at: Optional[datetime],
    ) -> ClientAccessRecord:
        raise NotImplementedError

    def upsert_invited_access(
        self,
        *,
        client_id: str,
        email: str,
        clerk_invitation_id: str,
        portal_slug: str,
        invited_at: datetime,
    ) -> ClientAccessRecord:
        raise NotImplementedError


class PostgresClientAccessRepository(ClientAccessRepository):
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def get_by_clerk_user_id(self, clerk_user_id: str) -> Optional[ClientAccessRecord]:
        query = """
            SELECT
                id::text AS id,
                client_id::text AS client_id,
                email,
                clerk_user_id,
                clerk_invitation_id,
                portal_slug,
                status,
                invitation_status,
                invited_at,
                accepted_at,
                created_at,
                updated_at
            FROM client_access
            WHERE clerk_user_id = %s
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (clerk_user_id,))
                row = cursor.fetchone()

        return _map_access_row(row)

    def get_by_client_id(self, client_id: str) -> Optional[ClientAccessRecord]:
        query = """
            SELECT
                id::text AS id,
                client_id::text AS client_id,
                email,
                clerk_user_id,
                clerk_invitation_id,
                portal_slug,
                status,
                invitation_status,
                invited_at,
                accepted_at,
                created_at,
                updated_at
            FROM client_access
            WHERE client_id::text = %s
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (client_id,))
                row = cursor.fetchone()

        return _map_access_row(row)

    def get_by_email(self, email: str) -> Optional[ClientAccessRecord]:
        query = """
            SELECT
                id::text AS id,
                client_id::text AS client_id,
                email,
                clerk_user_id,
                clerk_invitation_id,
                portal_slug,
                status,
                invitation_status,
                invited_at,
                accepted_at,
                created_at,
                updated_at
            FROM client_access
            WHERE lower(email) = lower(%s)
            ORDER BY created_at DESC, id DESC
            LIMIT 1
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (email,))
                row = cursor.fetchone()

        return _map_access_row(row)

    def get_by_portal_slug(self, portal_slug: str) -> Optional[ClientAccessRecord]:
        query = """
            SELECT
                id::text AS id,
                client_id::text AS client_id,
                email,
                clerk_user_id,
                clerk_invitation_id,
                portal_slug,
                status,
                invitation_status,
                invited_at,
                accepted_at,
                created_at,
                updated_at
            FROM client_access
            WHERE portal_slug = %s
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (portal_slug,))
                row = cursor.fetchone()

        return _map_access_row(row)

    def claim_invited_access(
        self,
        *,
        clerk_user_id: str,
        email: str,
    ) -> Optional[ClientAccessRecord]:
        query = """
            UPDATE client_access
            SET
                clerk_user_id = %s,
                invitation_status = 'accepted',
                accepted_at = COALESCE(accepted_at, NOW()),
                updated_at = NOW()
            WHERE
                lower(email) = lower(%s)
                AND clerk_user_id IS NULL
                AND status IN ('invited', 'active')
                AND COALESCE(invitation_status, 'pending') IN ('pending', 'accepted')
            RETURNING
                id::text AS id,
                client_id::text AS client_id,
                email,
                clerk_user_id,
                clerk_invitation_id,
                portal_slug,
                status,
                invitation_status,
                invited_at,
                accepted_at,
                created_at,
                updated_at
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (clerk_user_id, email))
                row = cursor.fetchone()
            connection.commit()

        return _map_access_row(row)

    def update_access(
        self,
        *,
        access_id: str,
        status: str,
        invitation_status: Optional[str],
        accepted_at: Optional[datetime],
    ) -> ClientAccessRecord:
        query = """
            UPDATE client_access
            SET
                status = %s,
                invitation_status = %s,
                accepted_at = %s,
                updated_at = NOW()
            WHERE id::text = %s
            RETURNING
                id::text AS id,
                client_id::text AS client_id,
                email,
                clerk_user_id,
                clerk_invitation_id,
                portal_slug,
                status,
                invitation_status,
                invited_at,
                accepted_at,
                created_at,
                updated_at
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    query,
                    (status, invitation_status, accepted_at, access_id),
                )
                row = cursor.fetchone()
            connection.commit()

        return ClientAccessRecord.model_validate(row)

    def upsert_invited_access(
        self,
        *,
        client_id: str,
        email: str,
        clerk_invitation_id: str,
        portal_slug: str,
        invited_at: datetime,
    ) -> ClientAccessRecord:
        query = """
            INSERT INTO client_access (
                client_id,
                email,
                clerk_user_id,
                clerk_invitation_id,
                portal_slug,
                status,
                invitation_status,
                invited_at,
                accepted_at
            )
            VALUES (%s::uuid, %s, NULL, %s, %s, 'invited', 'pending', %s, NULL)
            ON CONFLICT (client_id)
            DO UPDATE SET
                email = EXCLUDED.email,
                clerk_user_id = NULL,
                clerk_invitation_id = EXCLUDED.clerk_invitation_id,
                portal_slug = EXCLUDED.portal_slug,
                status = EXCLUDED.status,
                invitation_status = EXCLUDED.invitation_status,
                invited_at = EXCLUDED.invited_at,
                accepted_at = NULL,
                updated_at = NOW()
            RETURNING
                id::text AS id,
                client_id::text AS client_id,
                email,
                clerk_user_id,
                clerk_invitation_id,
                portal_slug,
                status,
                invitation_status,
                invited_at,
                accepted_at,
                created_at,
                updated_at
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    query,
                    (
                        client_id,
                        email,
                        clerk_invitation_id,
                        portal_slug,
                        invited_at,
                    ),
                )
                row = cursor.fetchone()
            connection.commit()

        return ClientAccessRecord.model_validate(row)


def get_client_access_repository(
    settings: Settings = Depends(get_settings),
) -> ClientAccessRepository:
    return PostgresClientAccessRepository(settings)
