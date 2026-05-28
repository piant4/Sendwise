from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.repositories.clients import postgres_connection


class SendingDomainWarmupStateRecord(BaseModel):
    sending_domain: str
    current_stage: int
    stage_started_at: datetime
    advancement_mode: str
    created_at: datetime
    updated_at: datetime


class SendingDomainWarmupStateRepository:
    def get_by_sending_domain(
        self,
        *,
        sending_domain: str,
    ) -> Optional[SendingDomainWarmupStateRecord]:
        raise NotImplementedError


class PostgresSendingDomainWarmupStateRepository(SendingDomainWarmupStateRepository):
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def get_by_sending_domain(
        self,
        *,
        sending_domain: str,
    ) -> Optional[SendingDomainWarmupStateRecord]:
        query = """
            SELECT
                sending_domain,
                current_stage,
                stage_started_at,
                advancement_mode,
                created_at,
                updated_at
            FROM sending_domain_warmup_state
            WHERE sending_domain = %s
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (sending_domain,))
                row = cursor.fetchone()

        return (
            SendingDomainWarmupStateRecord.model_validate(row)
            if row is not None
            else None
        )


class InMemorySendingDomainWarmupStateRepository(SendingDomainWarmupStateRepository):
    def __init__(self) -> None:
        self._records: dict[str, SendingDomainWarmupStateRecord] = {}

    def get_by_sending_domain(
        self,
        *,
        sending_domain: str,
    ) -> Optional[SendingDomainWarmupStateRecord]:
        return self._records.get(sending_domain)

    def upsert_state(
        self,
        *,
        sending_domain: str,
        current_stage: int,
        stage_started_at: datetime | None = None,
        advancement_mode: str = "manual_review_required",
    ) -> SendingDomainWarmupStateRecord:
        existing = self._records.get(sending_domain)
        now = datetime.now(timezone.utc)
        created_at = existing.created_at if existing is not None else now
        record = SendingDomainWarmupStateRecord(
            sending_domain=sending_domain,
            current_stage=current_stage,
            stage_started_at=stage_started_at or now,
            advancement_mode=advancement_mode,
            created_at=created_at,
            updated_at=now,
        )
        self._records[sending_domain] = record
        return record


def get_sending_domain_warmup_repository() -> SendingDomainWarmupStateRepository:
    return PostgresSendingDomainWarmupStateRepository(get_settings())
