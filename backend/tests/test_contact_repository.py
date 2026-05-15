from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator

from app.core.config import Settings
from app.repositories.contacts import PostgresContactRepository


class FakeCursor:
    def __init__(self) -> None:
        self.executed: list[tuple[str, tuple[Any, ...]]] = []
        timestamp = datetime(2026, 5, 15, 12, 0, tzinfo=timezone.utc)
        self._next_row: dict[str, Any] = {
            "id": "contact_123",
            "client_id": "client_123",
            "email": "person@example.test",
            "status": "sendable",
            "metadata": {"nome": "Mario"},
            "created_at": timestamp,
            "updated_at": timestamp,
        }

    def __enter__(self) -> "FakeCursor":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def execute(self, query: str, parameters: tuple[Any, ...] | None = None) -> None:
        self.executed.append((query, parameters or ()))

    def fetchone(self) -> dict[str, Any]:
        return self._next_row


class FakeConnection:
    def __init__(self) -> None:
        self.cursor_instance = FakeCursor()
        self.committed = False

    def cursor(self) -> FakeCursor:
        return self.cursor_instance

    def commit(self) -> None:
        self.committed = True


def install_fake_connection(monkeypatch: Any) -> FakeConnection:
    connection = FakeConnection()

    @contextmanager
    def fake_postgres_connection(_settings: Settings) -> Iterator[FakeConnection]:
        yield connection

    monkeypatch.setattr(
        "app.repositories.contacts.postgres_connection",
        fake_postgres_connection,
    )
    return connection


def test_create_contact_serializes_metadata_json(monkeypatch: Any) -> None:
    connection = install_fake_connection(monkeypatch)
    repository = PostgresContactRepository(Settings())

    repository.create_contact(
        client_id="client_123",
        email="person@example.test",
        metadata={"nome": "Mario", "cognome": "Rossi"},
    )

    insert_query, insert_parameters = connection.cursor_instance.executed[0]
    assert "INSERT INTO contacts" in insert_query
    assert insert_parameters == (
        "client_123",
        "person@example.test",
        "sendable",
        '{"cognome":"Rossi","nome":"Mario"}',
    )
    assert connection.committed is True


def test_update_contact_metadata_serializes_json(monkeypatch: Any) -> None:
    connection = install_fake_connection(monkeypatch)
    repository = PostgresContactRepository(Settings())

    repository.update_metadata(
        contact_id="contact_123",
        metadata={"nome": "Mario", "cognome": "Rossi"},
    )

    update_query, update_parameters = connection.cursor_instance.executed[0]
    assert "UPDATE contacts" in update_query
    assert update_parameters == (
        '{"cognome":"Rossi","nome":"Mario"}',
        "contact_123",
    )
    assert connection.committed is True
