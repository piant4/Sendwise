from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.repositories.clients import postgres_connection


class CampaignSlotRecord(BaseModel):
    id: str
    client_id: str
    label: str
    max_emails: int
    status: str = "available"
    assigned_campaign_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime


def _map_slot_row(row: Optional[dict[str, Any]]) -> Optional[CampaignSlotRecord]:
    if row is None:
        return None

    return CampaignSlotRecord.model_validate(row)


class CampaignSlotRepository:
    def create_slot(
        self,
        *,
        client_id: str,
        label: str,
        max_emails: int,
    ) -> CampaignSlotRecord:
        raise NotImplementedError

    def get_by_id(
        self,
        *,
        client_id: str,
        slot_id: str,
    ) -> Optional[CampaignSlotRecord]:
        raise NotImplementedError

    def list_by_client(self, client_id: str) -> list[CampaignSlotRecord]:
        raise NotImplementedError

    def assign_to_campaign(
        self,
        *,
        client_id: str,
        slot_id: str,
        campaign_id: str,
    ) -> CampaignSlotRecord:
        raise NotImplementedError

    def mark_used(
        self,
        *,
        client_id: str,
        slot_id: str,
    ) -> CampaignSlotRecord:
        raise NotImplementedError

    def archive(
        self,
        *,
        client_id: str,
        slot_id: str,
    ) -> CampaignSlotRecord:
        raise NotImplementedError

    def get_for_campaign(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> Optional[CampaignSlotRecord]:
        raise NotImplementedError


class PostgresCampaignSlotRepository(CampaignSlotRepository):
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def create_slot(
        self,
        *,
        client_id: str,
        label: str,
        max_emails: int,
    ) -> CampaignSlotRecord:
        query = """
            INSERT INTO campaign_slots (
                client_id,
                label,
                max_emails
            )
            VALUES (%s, %s, %s)
            RETURNING
                id::text AS id,
                client_id::text AS client_id,
                label,
                max_emails,
                status,
                assigned_campaign_id::text AS assigned_campaign_id,
                created_at,
                updated_at
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (client_id, label, max_emails))
                row = cursor.fetchone()
            connection.commit()

        return CampaignSlotRecord.model_validate(row)

    def get_by_id(
        self,
        *,
        client_id: str,
        slot_id: str,
    ) -> Optional[CampaignSlotRecord]:
        query = """
            SELECT
                id::text AS id,
                client_id::text AS client_id,
                label,
                max_emails,
                status,
                assigned_campaign_id::text AS assigned_campaign_id,
                created_at,
                updated_at
            FROM campaign_slots
            WHERE client_id::text = %s
                AND id::text = %s
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (client_id, slot_id))
                row = cursor.fetchone()

        return _map_slot_row(row)

    def list_by_client(self, client_id: str) -> list[CampaignSlotRecord]:
        query = """
            SELECT
                id::text AS id,
                client_id::text AS client_id,
                label,
                max_emails,
                status,
                assigned_campaign_id::text AS assigned_campaign_id,
                created_at,
                updated_at
            FROM campaign_slots
            WHERE client_id::text = %s
            ORDER BY created_at DESC, id DESC
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (client_id,))
                rows = cursor.fetchall()

        return [CampaignSlotRecord.model_validate(row) for row in rows]

    def assign_to_campaign(
        self,
        *,
        client_id: str,
        slot_id: str,
        campaign_id: str,
    ) -> CampaignSlotRecord:
        query = """
            UPDATE campaign_slots
            SET
                assigned_campaign_id = %s,
                status = 'assigned',
                updated_at = NOW()
            WHERE client_id::text = %s
                AND id::text = %s
            RETURNING
                id::text AS id,
                client_id::text AS client_id,
                label,
                max_emails,
                status,
                assigned_campaign_id::text AS assigned_campaign_id,
                created_at,
                updated_at
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (campaign_id, client_id, slot_id))
                row = cursor.fetchone()
            connection.commit()

        if row is None:
            raise ValueError("campaign slot not found")

        return CampaignSlotRecord.model_validate(row)

    def mark_used(
        self,
        *,
        client_id: str,
        slot_id: str,
    ) -> CampaignSlotRecord:
        return self._update_status(client_id=client_id, slot_id=slot_id, status="used")

    def archive(
        self,
        *,
        client_id: str,
        slot_id: str,
    ) -> CampaignSlotRecord:
        return self._update_status(client_id=client_id, slot_id=slot_id, status="archived")

    def get_for_campaign(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> Optional[CampaignSlotRecord]:
        query = """
            SELECT
                id::text AS id,
                client_id::text AS client_id,
                label,
                max_emails,
                status,
                assigned_campaign_id::text AS assigned_campaign_id,
                created_at,
                updated_at
            FROM campaign_slots
            WHERE client_id::text = %s
                AND assigned_campaign_id::text = %s
            LIMIT 1
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (client_id, campaign_id))
                row = cursor.fetchone()

        return _map_slot_row(row)

    def _update_status(
        self,
        *,
        client_id: str,
        slot_id: str,
        status: str,
    ) -> CampaignSlotRecord:
        query = """
            UPDATE campaign_slots
            SET
                status = %s,
                updated_at = NOW()
            WHERE client_id::text = %s
                AND id::text = %s
            RETURNING
                id::text AS id,
                client_id::text AS client_id,
                label,
                max_emails,
                status,
                assigned_campaign_id::text AS assigned_campaign_id,
                created_at,
                updated_at
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (status, client_id, slot_id))
                row = cursor.fetchone()
            connection.commit()

        if row is None:
            raise ValueError("campaign slot not found")

        return CampaignSlotRecord.model_validate(row)


class InMemoryCampaignSlotRepository(CampaignSlotRepository):
    def __init__(self, slots: list[CampaignSlotRecord] | None = None) -> None:
        self._slots = {slot.id: slot for slot in slots or []}

    def create_slot(
        self,
        *,
        client_id: str,
        label: str,
        max_emails: int,
    ) -> CampaignSlotRecord:
        now = datetime.now(timezone.utc)
        record = CampaignSlotRecord(
            id=str(uuid4()),
            client_id=client_id,
            label=label,
            max_emails=max_emails,
            status="available",
            assigned_campaign_id=None,
            created_at=now,
            updated_at=now,
        )
        self._slots[record.id] = record
        return record

    def get_by_id(
        self,
        *,
        client_id: str,
        slot_id: str,
    ) -> Optional[CampaignSlotRecord]:
        slot = self._slots.get(slot_id)
        if slot is None or slot.client_id != client_id:
            return None
        return slot

    def list_by_client(self, client_id: str) -> list[CampaignSlotRecord]:
        return [slot for slot in self._slots.values() if slot.client_id == client_id]

    def assign_to_campaign(
        self,
        *,
        client_id: str,
        slot_id: str,
        campaign_id: str,
    ) -> CampaignSlotRecord:
        slot = self.get_by_id(client_id=client_id, slot_id=slot_id)
        if slot is None:
            raise ValueError("campaign slot not found")

        updated = slot.model_copy(
            update={
                "assigned_campaign_id": campaign_id,
                "status": "assigned",
                "updated_at": datetime.now(timezone.utc),
            }
        )
        self._slots[slot_id] = updated
        return updated

    def mark_used(
        self,
        *,
        client_id: str,
        slot_id: str,
    ) -> CampaignSlotRecord:
        return self._update_status(client_id=client_id, slot_id=slot_id, status="used")

    def archive(
        self,
        *,
        client_id: str,
        slot_id: str,
    ) -> CampaignSlotRecord:
        return self._update_status(client_id=client_id, slot_id=slot_id, status="archived")

    def get_for_campaign(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> Optional[CampaignSlotRecord]:
        for slot in self._slots.values():
            if slot.client_id == client_id and slot.assigned_campaign_id == campaign_id:
                return slot
        return None

    def add_slot(
        self,
        *,
        slot_id: str | None = None,
        client_id: str = "client_123",
        label: str = "Starter slot",
        max_emails: int = 100,
        status: str = "available",
        assigned_campaign_id: str | None = None,
    ) -> CampaignSlotRecord:
        now = datetime.now(timezone.utc)
        record = CampaignSlotRecord(
            id=slot_id or str(uuid4()),
            client_id=client_id,
            label=label,
            max_emails=max_emails,
            status=status,
            assigned_campaign_id=assigned_campaign_id,
            created_at=now,
            updated_at=now,
        )
        self._slots[record.id] = record
        return record

    def _update_status(
        self,
        *,
        client_id: str,
        slot_id: str,
        status: str,
    ) -> CampaignSlotRecord:
        slot = self.get_by_id(client_id=client_id, slot_id=slot_id)
        if slot is None:
            raise ValueError("campaign slot not found")

        updated = slot.model_copy(
            update={
                "status": status,
                "updated_at": datetime.now(timezone.utc),
            }
        )
        self._slots[slot_id] = updated
        return updated


def get_campaign_slot_repository() -> CampaignSlotRepository:
    return PostgresCampaignSlotRepository(get_settings())
