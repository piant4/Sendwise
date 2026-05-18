from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.repositories.clients import postgres_connection


class ListmonkMappingRecord(BaseModel):
    id: str
    client_id: str
    entity_type: str
    entity_id: str
    listmonk_type: str
    listmonk_id: str
    created_at: datetime
    updated_at: datetime


def _map_mapping_row(row: Optional[dict[str, Any]]) -> Optional[ListmonkMappingRecord]:
    if row is None:
        return None

    return ListmonkMappingRecord.model_validate(row)


class ListmonkMappingRepository:
    def create_mapping(
        self,
        *,
        client_id: str,
        entity_type: str,
        entity_id: str,
        listmonk_type: str,
        listmonk_id: str,
    ) -> ListmonkMappingRecord:
        raise NotImplementedError

    def get_mapping(
        self,
        *,
        client_id: str,
        entity_type: str,
        entity_id: str,
        listmonk_type: str,
    ) -> Optional[ListmonkMappingRecord]:
        raise NotImplementedError

    def upsert_mapping(
        self,
        *,
        client_id: str,
        entity_type: str,
        entity_id: str,
        listmonk_type: str,
        listmonk_id: str,
    ) -> ListmonkMappingRecord:
        raise NotImplementedError

    def delete_by_business_entity(
        self,
        *,
        client_id: str,
        entity_type: str,
        entity_id: str,
    ) -> bool:
        raise NotImplementedError

    def list_by_client(self, client_id: str) -> list[ListmonkMappingRecord]:
        raise NotImplementedError


class PostgresListmonkMappingRepository(ListmonkMappingRepository):
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def create_mapping(
        self,
        *,
        client_id: str,
        entity_type: str,
        entity_id: str,
        listmonk_type: str,
        listmonk_id: str,
    ) -> ListmonkMappingRecord:
        query = """
            INSERT INTO listmonk_mappings (
                client_id,
                entity_type,
                entity_id,
                listmonk_type,
                listmonk_id
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING
                id::text AS id,
                client_id::text AS client_id,
                entity_type,
                entity_id::text AS entity_id,
                listmonk_type,
                listmonk_id,
                created_at,
                updated_at
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    query,
                    (client_id, entity_type, entity_id, listmonk_type, listmonk_id),
                )
                row = cursor.fetchone()
            connection.commit()

        return ListmonkMappingRecord.model_validate(row)

    def get_mapping(
        self,
        *,
        client_id: str,
        entity_type: str,
        entity_id: str,
        listmonk_type: str,
    ) -> Optional[ListmonkMappingRecord]:
        query = """
            SELECT
                id::text AS id,
                client_id::text AS client_id,
                entity_type,
                entity_id::text AS entity_id,
                listmonk_type,
                listmonk_id,
                created_at,
                updated_at
            FROM listmonk_mappings
            WHERE client_id::text = %s
                AND entity_type = %s
                AND entity_id::text = %s
                AND listmonk_type = %s
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (client_id, entity_type, entity_id, listmonk_type))
                row = cursor.fetchone()

        return _map_mapping_row(row)

    def upsert_mapping(
        self,
        *,
        client_id: str,
        entity_type: str,
        entity_id: str,
        listmonk_type: str,
        listmonk_id: str,
    ) -> ListmonkMappingRecord:
        query = """
            INSERT INTO listmonk_mappings (
                client_id,
                entity_type,
                entity_id,
                listmonk_type,
                listmonk_id
            )
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (client_id, entity_type, entity_id, listmonk_type)
            DO UPDATE SET
                listmonk_id = EXCLUDED.listmonk_id,
                updated_at = NOW()
            RETURNING
                id::text AS id,
                client_id::text AS client_id,
                entity_type,
                entity_id::text AS entity_id,
                listmonk_type,
                listmonk_id,
                created_at,
                updated_at
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    query,
                    (client_id, entity_type, entity_id, listmonk_type, listmonk_id),
                )
                row = cursor.fetchone()
            connection.commit()

        return ListmonkMappingRecord.model_validate(row)

    def delete_by_business_entity(
        self,
        *,
        client_id: str,
        entity_type: str,
        entity_id: str,
    ) -> bool:
        query = """
            DELETE FROM listmonk_mappings
            WHERE client_id::text = %s
                AND entity_type = %s
                AND entity_id::text = %s
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (client_id, entity_type, entity_id))
                deleted = cursor.rowcount > 0
            connection.commit()

        return deleted

    def list_by_client(self, client_id: str) -> list[ListmonkMappingRecord]:
        query = """
            SELECT
                id::text AS id,
                client_id::text AS client_id,
                entity_type,
                entity_id::text AS entity_id,
                listmonk_type,
                listmonk_id,
                created_at,
                updated_at
            FROM listmonk_mappings
            WHERE client_id::text = %s
            ORDER BY updated_at DESC, id DESC
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (client_id,))
                rows = cursor.fetchall()

        return [ListmonkMappingRecord.model_validate(row) for row in rows]


class InMemoryListmonkMappingRepository(ListmonkMappingRepository):
    def __init__(self) -> None:
        self._records: dict[tuple[str, str, str, str], ListmonkMappingRecord] = {}

    def create_mapping(
        self,
        *,
        client_id: str,
        entity_type: str,
        entity_id: str,
        listmonk_type: str,
        listmonk_id: str,
    ) -> ListmonkMappingRecord:
        key = (client_id, entity_type, entity_id, listmonk_type)
        if key in self._records:
            raise ValueError("listmonk mapping already exists")

        record = self._build_record(
            client_id=client_id,
            entity_type=entity_type,
            entity_id=entity_id,
            listmonk_type=listmonk_type,
            listmonk_id=listmonk_id,
        )
        self._records[key] = record
        return record

    def get_mapping(
        self,
        *,
        client_id: str,
        entity_type: str,
        entity_id: str,
        listmonk_type: str,
    ) -> Optional[ListmonkMappingRecord]:
        return self._records.get((client_id, entity_type, entity_id, listmonk_type))

    def upsert_mapping(
        self,
        *,
        client_id: str,
        entity_type: str,
        entity_id: str,
        listmonk_type: str,
        listmonk_id: str,
    ) -> ListmonkMappingRecord:
        key = (client_id, entity_type, entity_id, listmonk_type)
        existing = self._records.get(key)
        if existing is None:
            return self.create_mapping(
                client_id=client_id,
                entity_type=entity_type,
                entity_id=entity_id,
                listmonk_type=listmonk_type,
                listmonk_id=listmonk_id,
            )

        updated = existing.model_copy(
            update={
                "listmonk_id": listmonk_id,
                "updated_at": datetime.now(timezone.utc),
            }
        )
        self._records[key] = updated
        return updated

    def delete_by_business_entity(
        self,
        *,
        client_id: str,
        entity_type: str,
        entity_id: str,
    ) -> bool:
        keys = [
            key
            for key in self._records
            if key[0] == client_id and key[1] == entity_type and key[2] == entity_id
        ]
        for key in keys:
            del self._records[key]
        return bool(keys)

    def list_by_client(self, client_id: str) -> list[ListmonkMappingRecord]:
        return [
            record
            for record in self._records.values()
            if record.client_id == client_id
        ]

    def _build_record(
        self,
        *,
        client_id: str,
        entity_type: str,
        entity_id: str,
        listmonk_type: str,
        listmonk_id: str,
    ) -> ListmonkMappingRecord:
        now = datetime.now(timezone.utc)
        return ListmonkMappingRecord(
            id=str(uuid4()),
            client_id=client_id,
            entity_type=entity_type,
            entity_id=entity_id,
            listmonk_type=listmonk_type,
            listmonk_id=listmonk_id,
            created_at=now,
            updated_at=now,
        )


def get_listmonk_mapping_repository() -> ListmonkMappingRepository:
    return PostgresListmonkMappingRepository(get_settings())
