from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import threading
from typing import Optional
from uuid import uuid4

from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.repositories.clients import postgres_connection


class EmailLogRecord(BaseModel):
    id: str
    client_id: str
    campaign_id: Optional[str] = None
    contact_id: Optional[str] = None
    send_kind: str = "campaign"
    status: str
    provider_message_id: Optional[str] = None
    sending_domain: Optional[str] = None
    body: Optional[str] = None
    created_at: datetime


class EmailLogRepository:
    @contextmanager
    def campaign_dispatch_lock(
        self,
        *,
        campaign_id: str,
    ):
        raise NotImplementedError

    def get_by_id(self, email_log_id: str) -> Optional[EmailLogRecord]:
        raise NotImplementedError

    def create_email_log(
        self,
        *,
        client_id: str,
        campaign_id: str,
        contact_id: str,
        send_kind: str = "campaign",
        status: str,
        provider_message_id: Optional[str] = None,
        sending_domain: Optional[str] = None,
        body: Optional[str] = None,
        created_at: Optional[datetime] = None,
    ) -> EmailLogRecord:
        raise NotImplementedError

    def create_campaign_logs(
        self,
        *,
        client_id: str,
        campaign_id: str,
        contact_ids: list[str],
        send_kind: str = "campaign",
        status: str,
        provider_message_id: Optional[str] = None,
        sending_domain: Optional[str] = None,
        body: Optional[str] = None,
        created_at: Optional[datetime] = None,
    ) -> list[EmailLogRecord]:
        return [
            self.create_email_log(
                client_id=client_id,
                campaign_id=campaign_id,
                contact_id=contact_id,
                send_kind=send_kind,
                status=status,
                provider_message_id=provider_message_id,
                sending_domain=sending_domain,
                body=body,
                created_at=created_at,
            )
            for contact_id in contact_ids
        ]

    def create_simulated_campaign_logs(
        self,
        *,
        client_id: str,
        campaign_id: str,
        contact_ids: list[str],
        body: str,
    ) -> list[EmailLogRecord]:
        return self.create_campaign_logs(
            client_id=client_id,
            campaign_id=campaign_id,
            contact_ids=contact_ids,
            status="simulated",
            provider_message_id=None,
            body=body,
        )

    def create_dispatched_campaign_logs(
        self,
        *,
        client_id: str,
        campaign_id: str,
        contact_ids: list[str],
        sending_domain: Optional[str] = None,
        body: Optional[str] = None,
    ) -> list[EmailLogRecord]:
        return self.create_campaign_logs(
            client_id=client_id,
            campaign_id=campaign_id,
            contact_ids=contact_ids,
            status="queued",
            provider_message_id=None,
            sending_domain=sending_domain,
            body=body,
        )

    def get_campaign_status_counts(
        self,
        *,
        client_id: str,
        campaign_id: str,
        send_kind: str = "campaign",
    ) -> dict[str, int]:
        raise NotImplementedError

    def count_real_campaign_logs_since(
        self,
        *,
        client_id: str,
        campaign_id: str,
        send_kind: str = "campaign",
        started_at: datetime,
        ended_at: Optional[datetime] = None,
    ) -> int:
        raise NotImplementedError

    def get_first_real_campaign_log_at(
        self,
        *,
        client_id: str,
        campaign_id: str,
        send_kind: str = "campaign",
    ) -> Optional[datetime]:
        raise NotImplementedError

    def get_first_contact_log_at(
        self,
        *,
        client_id: str,
        campaign_id: str,
        contact_id: str,
        send_kind: str = "campaign",
    ) -> Optional[datetime]:
        raise NotImplementedError

    def count_client_real_logs(
        self,
        *,
        client_id: str,
        started_at: Optional[datetime] = None,
        ended_at: Optional[datetime] = None,
        statuses: Optional[tuple[str, ...]] = None,
    ) -> int:
        raise NotImplementedError

    def count_logs_by_status_since(
        self,
        *,
        statuses: tuple[str, ...],
        started_at: datetime,
        sending_domain: Optional[str] = None,
        ended_at: Optional[datetime] = None,
    ) -> int:
        raise NotImplementedError

    def find_by_provider_message_id(
        self,
        *,
        provider_message_id: str,
    ) -> Optional[EmailLogRecord]:
        raise NotImplementedError

    def find_latest_for_contact(
        self,
        *,
        client_id: str,
        campaign_id: str,
        contact_id: str,
        send_kind: str = "campaign",
    ) -> Optional[EmailLogRecord]:
        raise NotImplementedError

    def list_latest_for_campaign(
        self,
        *,
        client_id: str,
        campaign_id: str,
        send_kind: str = "campaign",
    ) -> list[EmailLogRecord]:
        raise NotImplementedError

    def update_status(
        self,
        *,
        email_log_id: str,
        status: str,
    ) -> Optional[EmailLogRecord]:
        raise NotImplementedError


class PostgresEmailLogRepository(EmailLogRepository):
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @contextmanager
    def campaign_dispatch_lock(
        self,
        *,
        campaign_id: str,
    ):
        lock_key = int.from_bytes(
            hashlib.sha256(campaign_id.encode("utf-8")).digest()[:8],
            byteorder="big",
            signed=True,
        )
        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_lock(%s)", (lock_key,))
            try:
                yield
            finally:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT pg_advisory_unlock(%s)", (lock_key,))

    def get_by_id(self, email_log_id: str) -> Optional[EmailLogRecord]:
        query = """
            SELECT
                id::text AS id,
                client_id::text AS client_id,
                campaign_id::text AS campaign_id,
                contact_id::text AS contact_id,
                send_kind,
                status,
                provider_message_id,
                sending_domain,
                body,
                created_at
            FROM email_logs
            WHERE id::text = %s
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (email_log_id,))
                row = cursor.fetchone()

        return EmailLogRecord.model_validate(row) if row is not None else None

    def create_email_log(
        self,
        *,
        client_id: str,
        campaign_id: str,
        contact_id: str,
        send_kind: str = "campaign",
        status: str,
        provider_message_id: Optional[str] = None,
        sending_domain: Optional[str] = None,
        body: Optional[str] = None,
        created_at: Optional[datetime] = None,
    ) -> EmailLogRecord:
        columns = [
            "client_id",
            "campaign_id",
            "contact_id",
            "send_kind",
            "status",
            "provider_message_id",
            "sending_domain",
            "body",
        ]
        parameters: list[object] = [
            client_id,
            campaign_id,
            contact_id,
            send_kind,
            status,
            provider_message_id,
            sending_domain,
            body,
        ]
        if created_at is not None:
            columns.append("created_at")
            parameters.append(created_at)
        placeholders = ", ".join(["%s"] * len(columns))
        query = f"""
            INSERT INTO email_logs (
                {", ".join(columns)}
            )
            VALUES ({placeholders})
            RETURNING
                id::text AS id,
                client_id::text AS client_id,
                campaign_id::text AS campaign_id,
                contact_id::text AS contact_id,
                send_kind,
                status,
                provider_message_id,
                sending_domain,
                body,
                created_at
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, tuple(parameters))
                row = cursor.fetchone()
            connection.commit()

        return EmailLogRecord.model_validate(row)

    def get_campaign_status_counts(
        self,
        *,
        client_id: str,
        campaign_id: str,
        send_kind: str = "campaign",
    ) -> dict[str, int]:
        query = """
            SELECT
                status,
                COUNT(*)::int AS total
            FROM email_logs
            WHERE client_id::text = %s
                AND campaign_id::text = %s
                AND send_kind = %s
            GROUP BY status
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (client_id, campaign_id, send_kind))
                rows = cursor.fetchall()

        return {str(row["status"]): int(row["total"]) for row in rows}

    def count_real_campaign_logs_since(
        self,
        *,
        client_id: str,
        campaign_id: str,
        send_kind: str = "campaign",
        started_at: datetime,
        ended_at: Optional[datetime] = None,
    ) -> int:
        query = """
            SELECT COUNT(*)::int AS total
            FROM email_logs
            WHERE client_id::text = %s
                AND campaign_id::text = %s
                AND send_kind = %s
                AND status <> 'simulated'
                AND created_at >= %s
        """
        parameters: list[object] = [client_id, campaign_id, send_kind, started_at]
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

    def get_first_real_campaign_log_at(
        self,
        *,
        client_id: str,
        campaign_id: str,
        send_kind: str = "campaign",
    ) -> Optional[datetime]:
        query = """
            SELECT MIN(created_at) AS first_created_at
            FROM email_logs
            WHERE client_id::text = %s
                AND campaign_id::text = %s
                AND send_kind = %s
                AND status <> 'simulated'
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (client_id, campaign_id, send_kind))
                row = cursor.fetchone()

        if row is None:
            return None
        return row["first_created_at"]

    def get_first_contact_log_at(
        self,
        *,
        client_id: str,
        campaign_id: str,
        contact_id: str,
        send_kind: str = "campaign",
    ) -> Optional[datetime]:
        query = """
            SELECT MIN(created_at) AS first_created_at
            FROM email_logs
            WHERE client_id::text = %s
                AND campaign_id::text = %s
                AND contact_id::text = %s
                AND send_kind = %s
                AND status <> 'simulated'
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (client_id, campaign_id, contact_id, send_kind))
                row = cursor.fetchone()

        if row is None:
            return None
        return row["first_created_at"]

    def count_client_real_logs(
        self,
        *,
        client_id: str,
        started_at: Optional[datetime] = None,
        ended_at: Optional[datetime] = None,
        statuses: Optional[tuple[str, ...]] = None,
    ) -> int:
        query = """
            SELECT COUNT(*)::int AS total
            FROM email_logs
            WHERE client_id::text = %s
                AND status <> 'simulated'
        """
        parameters: list[object] = [client_id]

        if statuses:
            query = f"{query}\n                AND status = ANY(%s)"
            parameters.append(list(statuses))

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

    def count_logs_by_status_since(
        self,
        *,
        statuses: tuple[str, ...],
        started_at: datetime,
        sending_domain: Optional[str] = None,
        ended_at: Optional[datetime] = None,
    ) -> int:
        query = """
            SELECT COUNT(*)::int AS total
            FROM email_logs
            WHERE status = ANY(%s)
                AND created_at >= %s
        """
        parameters: list[object] = [list(statuses), started_at]
        if sending_domain is not None:
            query = f"{query}\n                AND sending_domain = %s"
            parameters.append(sending_domain)
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

    def find_by_provider_message_id(
        self,
        *,
        provider_message_id: str,
    ) -> Optional[EmailLogRecord]:
        query = """
            SELECT
                id::text AS id,
                client_id::text AS client_id,
                campaign_id::text AS campaign_id,
                contact_id::text AS contact_id,
                send_kind,
                status,
                provider_message_id,
                sending_domain,
                body,
                created_at
            FROM email_logs
            WHERE provider_message_id = %s
            ORDER BY created_at DESC, id DESC
            LIMIT 1
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (provider_message_id,))
                row = cursor.fetchone()

        return EmailLogRecord.model_validate(row) if row is not None else None

    def find_latest_for_contact(
        self,
        *,
        client_id: str,
        campaign_id: str,
        contact_id: str,
        send_kind: str = "campaign",
    ) -> Optional[EmailLogRecord]:
        query = """
            SELECT
                id::text AS id,
                client_id::text AS client_id,
                campaign_id::text AS campaign_id,
                contact_id::text AS contact_id,
                send_kind,
                status,
                provider_message_id,
                sending_domain,
                body,
                created_at
            FROM email_logs
            WHERE client_id::text = %s
                AND campaign_id::text = %s
                AND contact_id::text = %s
                AND send_kind = %s
                AND status <> 'simulated'
            ORDER BY created_at DESC, id DESC
            LIMIT 1
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (client_id, campaign_id, contact_id, send_kind))
                row = cursor.fetchone()

        return EmailLogRecord.model_validate(row) if row is not None else None

    def list_latest_for_campaign(
        self,
        *,
        client_id: str,
        campaign_id: str,
        send_kind: str = "campaign",
    ) -> list[EmailLogRecord]:
        query = """
            SELECT DISTINCT ON (contact_id)
                id::text AS id,
                client_id::text AS client_id,
                campaign_id::text AS campaign_id,
                contact_id::text AS contact_id,
                send_kind,
                status,
                provider_message_id,
                sending_domain,
                body,
                created_at
            FROM email_logs
            WHERE client_id::text = %s
                AND campaign_id::text = %s
                AND send_kind = %s
                AND status <> 'simulated'
                AND contact_id IS NOT NULL
            ORDER BY contact_id, created_at DESC, id DESC
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (client_id, campaign_id, send_kind))
                rows = cursor.fetchall()

        return [EmailLogRecord.model_validate(row) for row in rows]

    def update_status(
        self,
        *,
        email_log_id: str,
        status: str,
    ) -> Optional[EmailLogRecord]:
        query = """
            UPDATE email_logs
            SET status = %s
            WHERE id::text = %s
            RETURNING
                id::text AS id,
                client_id::text AS client_id,
                campaign_id::text AS campaign_id,
                contact_id::text AS contact_id,
                send_kind,
                status,
                provider_message_id,
                sending_domain,
                body,
                created_at
        """

        with postgres_connection(self._settings) as connection:
            with connection.cursor() as cursor:
                cursor.execute(query, (status, email_log_id))
                row = cursor.fetchone()
            connection.commit()

        return EmailLogRecord.model_validate(row) if row is not None else None


class InMemoryEmailLogRepository(EmailLogRepository):
    def __init__(self) -> None:
        self._records: list[EmailLogRecord] = []
        self._campaign_locks: dict[str, threading.Lock] = {}

    @contextmanager
    def campaign_dispatch_lock(
        self,
        *,
        campaign_id: str,
    ):
        lock = self._campaign_locks.setdefault(campaign_id, threading.Lock())
        lock.acquire()
        try:
            yield
        finally:
            lock.release()

    def get_by_id(self, email_log_id: str) -> Optional[EmailLogRecord]:
        for record in self._records:
            if record.id == email_log_id:
                return record
        return None

    def create_email_log(
        self,
        *,
        client_id: str,
        campaign_id: str,
        contact_id: str,
        send_kind: str = "campaign",
        status: str,
        provider_message_id: Optional[str] = None,
        sending_domain: Optional[str] = None,
        body: Optional[str] = None,
        created_at: Optional[datetime] = None,
    ) -> EmailLogRecord:
        record = EmailLogRecord(
            id=str(uuid4()),
            client_id=client_id,
            campaign_id=campaign_id,
            contact_id=contact_id,
            send_kind=send_kind,
            status=status,
            provider_message_id=provider_message_id,
            sending_domain=sending_domain,
            body=body,
            created_at=created_at or datetime.now(timezone.utc),
        )
        self._records.append(record)
        return record

    def list_by_campaign(self, campaign_id: str) -> list[EmailLogRecord]:
        return [
            record
            for record in self._records
            if record.campaign_id == campaign_id
        ]

    def get_campaign_status_counts(
        self,
        *,
        client_id: str,
        campaign_id: str,
        send_kind: str = "campaign",
    ) -> dict[str, int]:
        counts: dict[str, int] = {}
        for record in self._records:
            if (
                record.client_id != client_id
                or record.campaign_id != campaign_id
                or record.send_kind != send_kind
            ):
                continue
            counts[record.status] = counts.get(record.status, 0) + 1
        return counts

    def count_real_campaign_logs_since(
        self,
        *,
        client_id: str,
        campaign_id: str,
        send_kind: str = "campaign",
        started_at: datetime,
        ended_at: Optional[datetime] = None,
    ) -> int:
        total = 0
        for record in self._records:
            if (
                record.client_id != client_id
                or record.campaign_id != campaign_id
                or record.send_kind != send_kind
            ):
                continue
            if record.status == "simulated":
                continue
            if record.created_at < started_at:
                continue
            if ended_at is not None and record.created_at >= ended_at:
                continue
            total += 1
        return total

    def get_first_real_campaign_log_at(
        self,
        *,
        client_id: str,
        campaign_id: str,
        send_kind: str = "campaign",
    ) -> Optional[datetime]:
        matching = [
            record.created_at
            for record in self._records
            if record.client_id == client_id
            and record.campaign_id == campaign_id
            and record.send_kind == send_kind
            and record.status != "simulated"
        ]
        if not matching:
            return None
        return min(matching)

    def get_first_contact_log_at(
        self,
        *,
        client_id: str,
        campaign_id: str,
        contact_id: str,
        send_kind: str = "campaign",
    ) -> Optional[datetime]:
        matching = [
            record.created_at
            for record in self._records
            if record.client_id == client_id
            and record.campaign_id == campaign_id
            and record.contact_id == contact_id
            and record.send_kind == send_kind
            and record.status != "simulated"
        ]
        if not matching:
            return None
        return min(matching)

    def count_client_real_logs(
        self,
        *,
        client_id: str,
        started_at: Optional[datetime] = None,
        ended_at: Optional[datetime] = None,
        statuses: Optional[tuple[str, ...]] = None,
    ) -> int:
        total = 0
        for record in self._records:
            if record.client_id != client_id or record.status == "simulated":
                continue
            if statuses and record.status not in statuses:
                continue
            if started_at is not None and record.created_at < started_at:
                continue
            if ended_at is not None and record.created_at >= ended_at:
                continue
            total += 1
        return total

    def count_logs_by_status_since(
        self,
        *,
        statuses: tuple[str, ...],
        started_at: datetime,
        sending_domain: Optional[str] = None,
        ended_at: Optional[datetime] = None,
    ) -> int:
        total = 0
        for record in self._records:
            if record.status not in statuses:
                continue
            if sending_domain is not None and record.sending_domain != sending_domain:
                continue
            if record.created_at < started_at:
                continue
            if ended_at is not None and record.created_at >= ended_at:
                continue
            total += 1
        return total

    def find_by_provider_message_id(
        self,
        *,
        provider_message_id: str,
    ) -> Optional[EmailLogRecord]:
        for record in reversed(self._records):
            if record.provider_message_id == provider_message_id:
                return record
        return None

    def find_latest_for_contact(
        self,
        *,
        client_id: str,
        campaign_id: str,
        contact_id: str,
        send_kind: str = "campaign",
    ) -> Optional[EmailLogRecord]:
        for record in reversed(self._records):
            if (
                record.client_id == client_id
                and record.campaign_id == campaign_id
                and record.contact_id == contact_id
                and record.send_kind == send_kind
                and record.status != "simulated"
            ):
                return record
        return None

    def list_latest_for_campaign(
        self,
        *,
        client_id: str,
        campaign_id: str,
        send_kind: str = "campaign",
    ) -> list[EmailLogRecord]:
        latest_by_contact: dict[str, EmailLogRecord] = {}
        for record in reversed(self._records):
            if (
                record.client_id != client_id
                or record.campaign_id != campaign_id
                or record.send_kind != send_kind
                or record.status == "simulated"
                or record.contact_id is None
                or record.contact_id in latest_by_contact
            ):
                continue
            latest_by_contact[record.contact_id] = record
        return list(latest_by_contact.values())

    def update_status(
        self,
        *,
        email_log_id: str,
        status: str,
    ) -> Optional[EmailLogRecord]:
        for index, record in enumerate(self._records):
            if record.id != email_log_id:
                continue
            updated = record.model_copy(update={"status": status})
            self._records[index] = updated
            return updated
        return None


def get_email_log_repository() -> EmailLogRepository:
    return PostgresEmailLogRepository(get_settings())
