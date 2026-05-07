import json
import time
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app.core.auth import get_jwks_client
from app.core.config import get_settings
from app.main import app
from app.repositories.auth_users import _build_auth_user_repository

TEST_ISSUER = "https://clerk.sendwise.test"
TEST_JWKS_URL = f"{TEST_ISSUER}/.well-known/jwks.json"


class FakeSigningKey:
    def __init__(self, public_key: rsa.RSAPublicKey) -> None:
        self.key = public_key


class FakeJwksClient:
    def __init__(self, public_key: rsa.RSAPublicKey) -> None:
        self._public_key = public_key

    def get_signing_key_from_jwt(self, token: str) -> FakeSigningKey:
        return FakeSigningKey(self._public_key)


@pytest.fixture(autouse=True)
def auth_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CLERK_JWKS_URL", TEST_JWKS_URL)
    monkeypatch.setenv("CLERK_ISSUER", TEST_ISSUER)
    monkeypatch.delenv("CLERK_AUDIENCE", raising=False)
    monkeypatch.setenv("AUTH_USER_MAPPINGS_JSON", "[]")
    get_settings.cache_clear()
    _build_auth_user_repository.cache_clear()
    get_jwks_client.cache_clear()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def signing_keypair(monkeypatch: pytest.MonkeyPatch) -> rsa.RSAPrivateKey:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()

    def fake_get_jwks_client(jwks_url: str) -> FakeJwksClient:
        return FakeJwksClient(public_key)

    monkeypatch.setattr("app.core.auth.get_jwks_client", fake_get_jwks_client)
    return private_key


def set_auth_mappings(
    monkeypatch: pytest.MonkeyPatch, mappings: dict[str, dict[str, Any]]
) -> None:
    monkeypatch.setenv("AUTH_USER_MAPPINGS_JSON", json.dumps(mappings))
    get_settings.cache_clear()
    _build_auth_user_repository.cache_clear()


def make_token(
    private_key: rsa.RSAPrivateKey,
    *,
    clerk_user_id: str,
    email: str = "user@example.test",
    issuer: str = TEST_ISSUER,
    expires_in_seconds: int = 300,
) -> str:
    now = int(time.time())
    payload = {
        "sub": clerk_user_id,
        "iss": issuer,
        "iat": now,
        "nbf": now,
        "exp": now + expires_in_seconds,
        "email": email,
    }

    return jwt.encode(payload, private_key, algorithm="RS256", headers={"kid": "test-key"})


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_health_is_public(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "email-ai-platform",
        "version": "v1-skeleton",
    }


def test_admin_endpoint_rejects_missing_token(client: TestClient) -> None:
    response = client.get("/admin/clients")

    assert response.status_code == 401


def test_client_endpoint_rejects_missing_token(client: TestClient) -> None:
    response = client.get("/client/me")

    assert response.status_code == 401


def test_invalid_token_is_rejected(
    client: TestClient,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    wrong_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    token = make_token(wrong_key, clerk_user_id="user_invalid")

    response = client.get("/admin/clients", headers=auth_header(token))

    assert response.status_code == 401


def test_admin_mapping_can_access_admin_endpoints(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    set_auth_mappings(
        monkeypatch,
        {
            "user_admin": {
                "id": "user_admin",
                "email": "admin@sendwise.test",
                "access_type": "platform_admin",
                "status": "active",
            }
        },
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin", email="admin@sendwise.test")

    response = client.get("/admin/clients", headers=auth_header(token))

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert {"id", "name", "status", "created_at", "updated_at"} <= data[0].keys()


def test_active_admin_can_read_auth_me(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    set_auth_mappings(
        monkeypatch,
        {
            "user_admin": {
                "id": "user_admin",
                "email": "admin@sendwise.test",
                "access_type": "platform_admin",
                "status": "active",
            }
        },
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin", email="admin@sendwise.test")

    response = client.get("/auth/me", headers=auth_header(token))

    assert response.status_code == 200
    assert response.json() == {
        "access_type": "platform_admin",
        "client_id": None,
        "email": "admin@sendwise.test",
        "status": "active",
    }


def test_client_mapping_can_access_client_endpoints(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    set_auth_mappings(
        monkeypatch,
        {
            "user_client": {
                "id": "user_client",
                "email": "client@acme.test",
                "access_type": "client",
                "client_id": "client_acme",
                "status": "active",
            }
        },
    )
    token = make_token(signing_keypair, clerk_user_id="user_client", email="client@acme.test")

    response = client.get("/client/me", headers=auth_header(token))

    assert response.status_code == 200
    data = response.json()
    assert {"client", "user"} <= data.keys()
    assert data["client"]["id"] == "client_acme"
    assert data["user"]["client_id"] == "client_acme"
    assert data["user"]["role"] == "client"


def test_active_client_can_read_auth_me(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    set_auth_mappings(
        monkeypatch,
        {
            "user_client": {
                "id": "user_client",
                "email": "client@acme.test",
                "access_type": "client",
                "client_id": "client_acme",
                "status": "active",
            }
        },
    )
    token = make_token(signing_keypair, clerk_user_id="user_client", email="client@acme.test")

    response = client.get("/auth/me", headers=auth_header(token))

    assert response.status_code == 200
    assert response.json() == {
        "access_type": "client",
        "client_id": "client_acme",
        "email": "client@acme.test",
        "status": "active",
    }


def test_client_role_cannot_access_admin_endpoints(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    set_auth_mappings(
        monkeypatch,
        {
            "user_client": {
                "id": "user_client",
                "email": "client@acme.test",
                "access_type": "client",
                "client_id": "client_acme",
                "status": "active",
            }
        },
    )
    token = make_token(signing_keypair, clerk_user_id="user_client")

    response = client.get("/admin/campaigns", headers=auth_header(token))

    assert response.status_code == 403


def test_platform_admin_cannot_access_client_endpoints(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    set_auth_mappings(
        monkeypatch,
        {
            "user_admin": {
                "id": "user_admin",
                "email": "admin@sendwise.test",
                "access_type": "platform_admin",
                "status": "active",
            }
        },
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.get("/client/me", headers=auth_header(token))

    assert response.status_code == 403


@pytest.mark.parametrize("status_value", ["invited", "suspended", "archived"])
def test_non_active_user_cannot_access_protected_endpoint(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
    status_value: str,
) -> None:
    set_auth_mappings(
        monkeypatch,
        {
            "user_client_status": {
                "id": "user_client_status",
                "email": "client@acme.test",
                "access_type": "client",
                "client_id": "client_acme",
                "status": status_value,
            }
        },
    )
    token = make_token(signing_keypair, clerk_user_id="user_client_status")

    response = client.get("/client/campaigns", headers=auth_header(token))

    assert response.status_code == 403


def test_client_mapping_without_client_id_fails_closed(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    set_auth_mappings(
        monkeypatch,
        {
            "user_client_invalid": {
                "id": "user_client_invalid",
                "email": "client@acme.test",
                "access_type": "client",
                "status": "active",
            }
        },
    )
    token = make_token(signing_keypair, clerk_user_id="user_client_invalid")

    response = client.get("/client/usage", headers=auth_header(token))

    assert response.status_code == 500
    assert "Invalid AUTH_USER_MAPPINGS_JSON backend configuration" in response.text


def test_unknown_access_type_fails_closed(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    set_auth_mappings(
        monkeypatch,
        {
            "user_unknown_access": {
                "id": "user_unknown_access",
                "email": "client@acme.test",
                "access_type": "client_viewer",
                "client_id": "client_acme",
                "status": "active",
            }
        },
    )
    token = make_token(signing_keypair, clerk_user_id="user_unknown_access")

    response = client.get("/client/me", headers=auth_header(token))

    assert response.status_code == 500
    assert "Invalid AUTH_USER_MAPPINGS_JSON backend configuration" in response.text


def test_old_unsupported_role_values_fail_closed(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    set_auth_mappings(
        monkeypatch,
        {
            "user_legacy_role": {
                "id": "user_legacy_role",
                "email": "client@acme.test",
                "role": "client_viewer",
                "client_id": "client_acme",
                "status": "active",
            }
        },
    )
    token = make_token(signing_keypair, clerk_user_id="user_legacy_role")

    response = client.get("/client/me", headers=auth_header(token))

    assert response.status_code == 500
    assert "Invalid AUTH_USER_MAPPINGS_JSON backend configuration" in response.text


def test_authorized_client_response_shapes_are_preserved(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    set_auth_mappings(
        monkeypatch,
        {
            "user_client": {
                "id": "user_client",
                "email": "client@acme.test",
                "access_type": "client",
                "client_id": "client_acme",
                "status": "active",
            }
        },
    )
    token = make_token(signing_keypair, clerk_user_id="user_client")

    campaigns_response = client.get("/client/campaigns", headers=auth_header(token))
    usage_response = client.get("/client/usage", headers=auth_header(token))
    blocked_sends_response = client.get(
        "/client/blocked-sends", headers=auth_header(token)
    )

    assert campaigns_response.status_code == 200
    campaigns = campaigns_response.json()
    assert campaigns
    assert {
        "id",
        "client_id",
        "name",
        "status",
        "subject",
        "created_at",
        "updated_at",
    } <= campaigns[0].keys()

    assert usage_response.status_code == 200
    usage = usage_response.json()
    assert usage
    assert {"id", "client_id", "usage_type", "quantity", "metadata", "created_at"} <= usage[0].keys()

    assert blocked_sends_response.status_code == 200
    blocked_sends = blocked_sends_response.json()
    assert blocked_sends
    assert {"id", "client_id", "reason", "decision", "created_at"} <= blocked_sends[0].keys()
