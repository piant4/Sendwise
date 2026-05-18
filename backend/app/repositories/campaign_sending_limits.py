from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.repositories.clients import postgres_connection

_UNSET = object()


class CampaignSendingLimitRecord(BaseModel):
    campaign_id: str
    period_email_limit: int
    daily_email_limit: int
    period_started_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


def _map_limit_row(row: Optional[dict[str, Any]]) -> Optional[CampaignSendingLimitRecord]:
    if row is None:
        return None
    return CampaignSendingLimitRecord.model_validate(row)


class CampaignSendingLimitRepository:
    def get_by_campaign_id(
        self,
        *,
        campaign_id: str,
    ) -> Optional[CampaignSendingLimitRecord]:
        raise NotImplementedError

    def ensure_for_campaign(
        self,
        *,
        campaign_id: str,
        period_email_limit: int = 1000,
        daily_email_limit: int = 50,
    ) -> CampaignSendingLimitRecord:
        raise NotImplementedError

    def update_for_campaign(
        self,
        *,
        campaign_id: str,
        period_email_limit: object = _UNSET,
        daily_email_limit: object = _UNSET,
        period_started_at: object = _UNSET,
    ) -> CampaignSendingLimitRecord:
        raise NotImplementedError


class PostgresCampaignSendingLimitRepository(CampaignSendingLimitRepository):
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def get_by_campaign_id(
        self,
        *,
        campaign_id: str,
    ) -> Optional[CampaignSendingLimitRecord]:
        query = """
            SELECT
                campaign_id::text AS campaign_id,
                period_email_limit,
                daily_email_limit,
                period_started_at,
                created_at,
                updated_at
            FROM campaign_sending_limits
            WHERE campaign_id::text = %s
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (campaign_id,))
                row = cursor.fetchone()

        return _map_limit_row(row)

    def ensure_for_campaign(
        self,
        *,
        campaign_id: str,
        period_email_limit: int = 1000,
        daily_email_limit: int = 50,
    ) -> CampaignSendingLimitRecord:
        insert_query = """
            INSERT INTO campaign_sending_limits (
                campaign_id,
                period_email_limit,
                daily_email_limit
            )
            VALUES (%s, %s, %s)
            ON CONFLICT (campaign_id) DO NOTHING
            RETURNING
                campaign_id::text AS campaign_id,
                period_email_limit,
                daily_email_limit,
                period_started_at,
                created_at,
                updated_at
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    insert_query,
                    (campaign_id, period_email_limit, daily_email_limit),
                )
                row = cursor.fetchone()
            connection.commit()

        if row is not None:
            return CampaignSendingLimitRecord.model_validate(row)

        existing = self.get_by_campaign_id(campaign_id=campaign_id)
        if existing is None:
            raise ValueError("campaign sending limits not found")
        return existing

    def update_for_campaign(
        self,
        *,
        campaign_id: str,
        period_email_limit: object = _UNSET,
        daily_email_limit: object = _UNSET,
        period_started_at: object = _UNSET,
    ) -> CampaignSendingLimitRecord:
        assignments: list[str] = []
        parameters: list[Any] = []
        for column, value in (
            ("period_email_limit", period_email_limit),
            ("daily_email_limit", daily_email_limit),
            ("period_started_at", period_started_at),
        ):
            if value is _UNSET:
                continue
            assignments.append(f"{column} = %s")
            parameters.append(value)

        if not assignments:
            existing = self.get_by_campaign_id(campaign_id=campaign_id)
            if existing is None:
                raise ValueError("campaign sending limits not found")
            return existing

        assignments.append("updated_at = NOW()")
        query = f"""
            UPDATE campaign_sending_limits
            SET
                {", ".join(assignments)}
            WHERE campaign_id::text = %s
            RETURNING
                campaign_id::text AS campaign_id,
                period_email_limit,
                daily_email_limit,
                period_started_at,
                created_at,
                updated_at
        """
        parameters.append(campaign_id)

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                row = cursor.fetchone()
            connection.commit()

        if row is None:
            raise ValueError("campaign sending limits not found")
        return CampaignSendingLimitRecord.model_validate(row)


class InMemoryCampaignSendingLimitRepository(CampaignSendingLimitRepository):
    def __init__(
        self,
        records: list[CampaignSendingLimitRecord] | None = None,
    ) -> None:
        self._records = {
            record.campaign_id: record for record in (records or [])
        }

    def get_by_campaign_id(
        self,
        *,
        campaign_id: str,
    ) -> Optional[CampaignSendingLimitRecord]:
        return self._records.get(campaign_id)

    def ensure_for_campaign(
        self,
        *,
        campaign_id: str,
        period_email_limit: int = 1000,
        daily_email_limit: int = 50,
    ) -> CampaignSendingLimitRecord:
        existing = self.get_by_campaign_id(campaign_id=campaign_id)
        if existing is not None:
            return existing

        now = datetime.now(timezone.utc)
        record = CampaignSendingLimitRecord(
            campaign_id=campaign_id,
            period_email_limit=period_email_limit,
            daily_email_limit=daily_email_limit,
            period_started_at=None,
            created_at=now,
            updated_at=now,
        )
        self._records[campaign_id] = record
        return record

    def update_for_campaign(
        self,
        *,
        campaign_id: str,
        period_email_limit: object = _UNSET,
        daily_email_limit: object = _UNSET,
        period_started_at: object = _UNSET,
    ) -> CampaignSendingLimitRecord:
        existing = self.get_by_campaign_id(campaign_id=campaign_id)
        if existing is None:
            raise ValueError("campaign sending limits not found")

        updates: dict[str, Any] = {
            "updated_at": datetime.now(timezone.utc),
        }
        for field_name, value in (
            ("period_email_limit", period_email_limit),
            ("daily_email_limit", daily_email_limit),
            ("period_started_at", period_started_at),
        ):
            if value is not _UNSET:
                updates[field_name] = value

        updated = existing.model_copy(update=updates)
        self._records[campaign_id] = updated
        return updated


def get_campaign_sending_limit_repository() -> CampaignSendingLimitRepository:
    return PostgresCampaignSendingLimitRepository(get_settings())
