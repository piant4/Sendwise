from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def _client_ids(items: list[dict]) -> set[str]:
    return {item["client_id"] for item in items}


def test_admin_clients_stub_shape() -> None:
    response = client.get("/admin/clients")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert data
    assert {"id", "name", "status", "created_at", "updated_at"} <= data[0].keys()


def test_admin_campaigns_stub_shape() -> None:
    response = client.get("/admin/campaigns")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert data
    assert {
        "id",
        "client_id",
        "name",
        "status",
        "subject",
        "created_at",
        "updated_at",
    } <= data[0].keys()


def test_client_me_stub_shape_and_scope() -> None:
    response = client.get("/client/me")

    assert response.status_code == 200
    data = response.json()
    assert {"client", "user"} <= data.keys()
    assert data["client"]["id"] == data["user"]["client_id"]
    assert data["client"]["id"] == "client_acme"


def test_client_campaigns_do_not_expose_multiple_client_ids() -> None:
    response = client.get("/client/campaigns")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert _client_ids(data) == {"client_acme"}


def test_client_usage_do_not_expose_multiple_client_ids() -> None:
    response = client.get("/client/usage")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert _client_ids(data) == {"client_acme"}
    expected_keys = {"id", "client_id", "usage_type", "quantity", "metadata", "created_at"}
    assert expected_keys <= data[0].keys()


def test_client_blocked_sends_do_not_expose_multiple_client_ids() -> None:
    response = client.get("/client/blocked-sends")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert _client_ids(data) == {"client_acme"}
    assert {"id", "client_id", "reason", "decision", "created_at"} <= data[0].keys()
