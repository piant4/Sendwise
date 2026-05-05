from importlib import reload


def test_usage_repository_filters_out_non_current_client() -> None:
    from app.core.current_client import get_current_client_id
    from app.repositories.usage import UsageRepository

    current_client_id = get_current_client_id()
    other_client_id = "client_nova"

    assert other_client_id != current_client_id

    records = UsageRepository().list_api_usage(client_id=other_client_id)

    assert records == []
    assert all(record.client_id != current_client_id for record in records)


def test_blocked_sends_repository_filters_out_non_current_client() -> None:
    from app.core.current_client import get_current_client_id
    from app.repositories.blocked_sends import BlockedSendsRepository

    current_client_id = get_current_client_id()
    other_client_id = "client_nova"

    assert other_client_id != current_client_id

    records = BlockedSendsRepository().list_blocked_sends(client_id=other_client_id)

    assert records == []
    assert all(record.client_id != current_client_id for record in records)


def test_clients_repository_uses_centralized_current_client(monkeypatch) -> None:
    import app.core.current_client as current_client
    import app.repositories.clients as clients_module

    expected_client_id = "client_test_scope"

    monkeypatch.setattr(
        current_client,
        "get_current_client_id",
        lambda: expected_client_id,
    )
    reloaded_clients_module = reload(clients_module)

    try:
        context = reloaded_clients_module.ClientsRepository().get_current_client_context()

        assert reloaded_clients_module.MOCK_CLIENT_ID == expected_client_id
        assert context.client.id == expected_client_id
        assert context.user.client_id == expected_client_id
    finally:
        monkeypatch.undo()
        reload(clients_module)
