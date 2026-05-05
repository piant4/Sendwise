from importlib import reload


def test_clients_service_uses_current_client_for_context_and_campaigns(
    monkeypatch,
) -> None:
    import app.core.current_client as current_client
    import app.repositories.clients as clients_repository_module
    import app.services.clients as clients_service_module

    monkeypatch.setattr(
        current_client,
        "get_current_client_id",
        lambda: "client_nova",
    )
    reloaded_repository_module = reload(clients_repository_module)
    reloaded_service_module = reload(clients_service_module)

    try:
        service = reloaded_service_module.ClientsService()

        context = service.get_current_client_context()
        campaigns = service.list_current_client_campaigns()

        assert context.client.id == "client_nova"
        assert context.user.client_id == "client_nova"
        assert {campaign.client_id for campaign in campaigns} == {"client_nova"}
        assert all(campaign.client_id != "client_acme" for campaign in campaigns)
    finally:
        monkeypatch.undo()
        reload(reloaded_repository_module)
        reload(reloaded_service_module)


def test_usage_service_uses_current_client_usage_scope(monkeypatch) -> None:
    import app.core.current_client as current_client
    import app.repositories.usage as usage_repository_module
    import app.services.usage as usage_service_module

    monkeypatch.setattr(
        current_client,
        "get_current_client_id",
        lambda: "client_nova",
    )
    reloaded_repository_module = reload(usage_repository_module)
    reloaded_service_module = reload(usage_service_module)

    try:
        records = reloaded_service_module.UsageService().list_current_client_usage()

        assert records
        assert {record.client_id for record in records} == {"client_nova"}
        assert all(record.client_id != "client_acme" for record in records)
    finally:
        monkeypatch.undo()
        reload(reloaded_repository_module)
        reload(reloaded_service_module)


def test_blocked_sends_service_uses_current_client_blocked_sends_scope(
    monkeypatch,
) -> None:
    import app.core.current_client as current_client
    import app.repositories.blocked_sends as blocked_sends_repository_module
    import app.services.blocked_sends as blocked_sends_service_module

    monkeypatch.setattr(
        current_client,
        "get_current_client_id",
        lambda: "client_nova",
    )
    reloaded_repository_module = reload(blocked_sends_repository_module)
    reloaded_service_module = reload(blocked_sends_service_module)

    try:
        records = (
            reloaded_service_module.BlockedSendsService()
            .list_current_client_blocked_sends()
        )

        assert records
        assert {record.client_id for record in records} == {"client_nova"}
        assert all(record.client_id != "client_acme" for record in records)
    finally:
        monkeypatch.undo()
        reload(reloaded_repository_module)
        reload(reloaded_service_module)
