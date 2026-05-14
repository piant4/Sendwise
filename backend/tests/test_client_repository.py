from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator, Optional

from app.core.config import Settings
from app.repositories.clients import PostgresClientRepository


class FakeCursor:
    def __init__(self, *, has_legacy_name: bool) -> None:
        self._has_legacy_name = has_legacy_name
        self.executed: list[tuple[str, tuple[Any, ...]]] = []
        self._next_row: dict[str, Any] = {"has_legacy_name": has_legacy_name}

    def __enter__(self) -> "FakeCursor":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def execute(self, query: str, parameters: Optional[tuple[Any, ...]] = None) -> None:
        self.executed.append((query, parameters or ()))

        if "INSERT INTO clients" not in query:
            return

        email = (parameters or ())[0]
        personal_name = (parameters or ())[1]
        timestamp = datetime(2026, 5, 14, 9, 0, tzinfo=timezone.utc)
        self._next_row = {
            "id": "client_created",
            "email": email,
            "personal_name": personal_name,
            "status": "active",
            "email_limit_per_campaign": None,
            "max_campaigns": None,
            "monthly_email_limit": None,
            "daily_email_limit": None,
            "created_at": timestamp,
            "updated_at": timestamp,
        }

    def fetchone(self) -> dict[str, Any]:
        return self._next_row


class FakeConnection:
    def __init__(self, *, has_legacy_name: bool) -> None:
        self.cursor_instance = FakeCursor(has_legacy_name=has_legacy_name)
        self.committed = False

    def cursor(self) -> FakeCursor:
        return self.cursor_instance

    def commit(self) -> None:
        self.committed = True


def install_fake_connection(
    monkeypatch: Any,
    *,
    has_legacy_name: bool,
) -> FakeConnection:
    connection = FakeConnection(has_legacy_name=has_legacy_name)

    @contextmanager
    def fake_postgres_connection(_settings: Settings) -> Iterator[FakeConnection]:
        yield connection

    monkeypatch.setattr(
        "app.repositories.clients.postgres_connection",
        fake_postgres_connection,
    )
    return connection


def test_create_client_populates_legacy_name_with_email_placeholder(
    monkeypatch: Any,
) -> None:
    connection = install_fake_connection(monkeypatch, has_legacy_name=True)
    repository = PostgresClientRepository(Settings())

    record = repository.create_client(
        email="solo.email@example.test",
        personal_name=None,
        status="active",
    )

    insert_query, insert_parameters = connection.cursor_instance.executed[1]
    assert "\n                            name," in insert_query
    assert insert_parameters == (
        "solo.email@example.test",
        None,
        "solo.email@example.test",
        "active",
    )
    assert record.email == "solo.email@example.test"
    assert record.personal_name is None
    assert connection.committed is True


def test_create_client_omits_legacy_name_when_column_is_absent(
    monkeypatch: Any,
) -> None:
    connection = install_fake_connection(monkeypatch, has_legacy_name=False)
    repository = PostgresClientRepository(Settings())

    repository.create_client(
        email="fresh.schema@example.test",
        personal_name=None,
        status="active",
    )

    insert_query, insert_parameters = connection.cursor_instance.executed[1]
    assert "\n                            name," not in insert_query
    assert insert_parameters == ("fresh.schema@example.test", None, "active")
