from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.repositories.clients import postgres_connection

_UNSET = object()


class CampaignRecord(BaseModel):
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


def _map_campaign_row(row: Optional[dict[str, Any]]) -> Optional[CampaignRecord]:
    if row is None:
        return None

    return CampaignRecord.model_validate(row)


class CampaignRepository:
    def get_by_id(
        self,
        *,
        campaign_id: str,
        client_id: str | None = None,
    ) -> Optional[CampaignRecord]:
        raise NotImplementedError

    def list_by_client(self, client_id: str) -> list[CampaignRecord]:
        raise NotImplementedError

    def list_all(self) -> list[CampaignRecord]:
        raise NotImplementedError

    def assign_slot(
        self,
        *,
        client_id: str,
        campaign_id: str,
        campaign_slot_id: str,
    ) -> CampaignRecord:
        raise NotImplementedError

    def update_campaign(
        self,
        *,
        client_id: str,
        campaign_id: str,
        subject: object = _UNSET,
        preview_text: object = _UNSET,
        body_html: object = _UNSET,
        body_text: object = _UNSET,
        content_ready: object = _UNSET,
        contacts_ready: object = _UNSET,
        review_ready: object = _UNSET,
        current_step: object = _UNSET,
        campaign_slot_id: object = _UNSET,
    ) -> CampaignRecord:
        raise NotImplementedError

    def has_contacts(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> bool:
        raise NotImplementedError


class PostgresCampaignRepository(CampaignRepository):
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def get_by_id(
        self,
        *,
        campaign_id: str,
        client_id: str | None = None,
    ) -> Optional[CampaignRecord]:
        parameters: list[Any] = [campaign_id]
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
            WHERE id::text = %s
        """
        if client_id is not None:
            query = f"{query}\n                AND client_id::text = %s"
            parameters.append(client_id)

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                row = cursor.fetchone()

        return _map_campaign_row(row)

    def list_by_client(self, client_id: str) -> list[CampaignRecord]:
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

        return [CampaignRecord.model_validate(row) for row in rows]

    def list_all(self) -> list[CampaignRecord]:
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
            ORDER BY updated_at DESC, id DESC
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query)
                rows = cursor.fetchall()

        return [CampaignRecord.model_validate(row) for row in rows]

    def assign_slot(
        self,
        *,
        client_id: str,
        campaign_id: str,
        campaign_slot_id: str,
    ) -> CampaignRecord:
        query = """
            UPDATE campaigns
            SET
                campaign_slot_id = %s,
                updated_at = NOW()
            WHERE id::text = %s
                AND client_id::text = %s
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
                cursor.execute(query, (campaign_slot_id, campaign_id, client_id))
                row = cursor.fetchone()
            connection.commit()

        if row is None:
            raise ValueError("campaign not found")

        return CampaignRecord.model_validate(row)

    def update_campaign(
        self,
        *,
        client_id: str,
        campaign_id: str,
        subject: object = _UNSET,
        preview_text: object = _UNSET,
        body_html: object = _UNSET,
        body_text: object = _UNSET,
        content_ready: object = _UNSET,
        contacts_ready: object = _UNSET,
        review_ready: object = _UNSET,
        current_step: object = _UNSET,
        campaign_slot_id: object = _UNSET,
    ) -> CampaignRecord:
        assignments: list[str] = []
        parameters: list[Any] = []
        fields = (
            ("subject", subject),
            ("preview_text", preview_text),
            ("body_html", body_html),
            ("body_text", body_text),
            ("content_ready", content_ready),
            ("contacts_ready", contacts_ready),
            ("review_ready", review_ready),
            ("current_step", current_step),
            ("campaign_slot_id", campaign_slot_id),
        )
        for column, value in fields:
            if value is _UNSET:
                continue
            assignments.append(f"{column} = %s")
            parameters.append(value)

        if not assignments:
            existing = self.get_by_id(campaign_id=campaign_id, client_id=client_id)
            if existing is None:
                raise ValueError("campaign not found")
            return existing

        assignments.append("updated_at = NOW()")
        query = f"""
            UPDATE campaigns
            SET
                {", ".join(assignments)}
            WHERE id::text = %s
                AND client_id::text = %s
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
        parameters.extend((campaign_id, client_id))

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                row = cursor.fetchone()
            connection.commit()

        if row is None:
            raise ValueError("campaign not found")

        return CampaignRecord.model_validate(row)

    def has_contacts(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> bool:
        query = """
            SELECT 1 AS exists
            FROM campaign_contacts
            INNER JOIN contacts
                ON contacts.id = campaign_contacts.contact_id
            WHERE campaign_contacts.client_id::text = %s
                AND campaign_contacts.campaign_id::text = %s
                AND contacts.client_id = campaign_contacts.client_id
            LIMIT 1
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (client_id, campaign_id))
                row = cursor.fetchone()

        return row is not None


class InMemoryCampaignRepository(CampaignRepository):
    def __init__(
        self,
        campaigns: list[CampaignRecord] | None = None,
        campaign_contacts: set[tuple[str, str, str]] | None = None,
    ) -> None:
        self._campaigns = {campaign.id: campaign for campaign in campaigns or []}
        self._campaign_contacts = campaign_contacts or set()

    def get_by_id(
        self,
        *,
        campaign_id: str,
        client_id: str | None = None,
    ) -> Optional[CampaignRecord]:
        campaign = self._campaigns.get(campaign_id)
        if campaign is None:
            return None
        if client_id is not None and campaign.client_id != client_id:
            return None
        return campaign

    def list_by_client(self, client_id: str) -> list[CampaignRecord]:
        return [
            campaign
            for campaign in self._campaigns.values()
            if campaign.client_id == client_id
        ]

    def list_all(self) -> list[CampaignRecord]:
        return list(self._campaigns.values())

    def assign_slot(
        self,
        *,
        client_id: str,
        campaign_id: str,
        campaign_slot_id: str,
    ) -> CampaignRecord:
        return self.update_campaign(
            client_id=client_id,
            campaign_id=campaign_id,
            campaign_slot_id=campaign_slot_id,
        )

    def update_campaign(
        self,
        *,
        client_id: str,
        campaign_id: str,
        subject: object = _UNSET,
        preview_text: object = _UNSET,
        body_html: object = _UNSET,
        body_text: object = _UNSET,
        content_ready: object = _UNSET,
        contacts_ready: object = _UNSET,
        review_ready: object = _UNSET,
        current_step: object = _UNSET,
        campaign_slot_id: object = _UNSET,
    ) -> CampaignRecord:
        existing = self.get_by_id(campaign_id=campaign_id, client_id=client_id)
        if existing is None:
            raise ValueError("campaign not found")

        updates: dict[str, Any] = {
            "updated_at": datetime.now(timezone.utc),
        }
        for field_name, value in (
            ("subject", subject),
            ("preview_text", preview_text),
            ("body_html", body_html),
            ("body_text", body_text),
            ("content_ready", content_ready),
            ("contacts_ready", contacts_ready),
            ("review_ready", review_ready),
            ("current_step", current_step),
            ("campaign_slot_id", campaign_slot_id),
        ):
            if value is not _UNSET:
                updates[field_name] = value

        updated = existing.model_copy(update=updates)
        self._campaigns[campaign_id] = updated
        return updated

    def has_contacts(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> bool:
        return any(
            relation_client_id == client_id and relation_campaign_id == campaign_id
            for relation_client_id, relation_campaign_id, _contact_id in self._campaign_contacts
        )

    def add_campaign(
        self,
        *,
        campaign_id: str | None = None,
        client_id: str = "client_123",
        name: str = "Launch campaign",
        status: str = "draft",
        subject: str | None = "Launch",
        campaign_slot_id: str | None = None,
        preview_text: str | None = None,
        body_html: str | None = None,
        body_text: str | None = None,
        content_ready: bool = False,
        contacts_ready: bool = False,
        review_ready: bool = False,
        current_step: str = "setup",
    ) -> CampaignRecord:
        now = datetime.now(timezone.utc)
        record = CampaignRecord(
            id=campaign_id or str(uuid4()),
            client_id=client_id,
            name=name,
            status=status,
            subject=subject,
            campaign_slot_id=campaign_slot_id,
            preview_text=preview_text,
            body_html=body_html,
            body_text=body_text,
            content_ready=content_ready,
            contacts_ready=contacts_ready,
            review_ready=review_ready,
            current_step=current_step,
            created_at=now,
            updated_at=now,
        )
        self._campaigns[record.id] = record
        return record


def get_campaign_repository() -> CampaignRepository:
    return PostgresCampaignRepository(get_settings())
