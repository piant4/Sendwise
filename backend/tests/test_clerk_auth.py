import json
import time
from datetime import datetime, timezone
from typing import Any, Optional

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app.core.auth import get_jwks_client
from app.core.config import get_settings
from app.main import app
from app.repositories.auth_users import _build_auth_user_repository
from app.repositories.client_access import ClientAccessRecord, ClientAccessRepository
from app.repositories.clients import ClientRecord, ClientRepository
from app.services.client_access import (
    ClerkInvitationGateway,
    ClerkInvitationResult,
    ClientAccessService,
    get_client_access_service,
)
from app.services.clients import ClientsService, get_clients_service

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


class FakeClientRepository(ClientRepository):
    def __init__(self, records: Optional[list[ClientRecord]] = None) -> None:
        self._records = {record.id: record for record in records or []}
        self._counter = len(self._records)

    def list_clients(self) -> list[ClientRecord]:
        return sorted(
            self._records.values(),
            key=lambda item: (item.created_at, item.id),
            reverse=True,
        )

    def get_by_id(self, client_id: str) -> Optional[ClientRecord]:
        return self._records.get(client_id)

    def get_by_email(self, email: str) -> Optional[ClientRecord]:
        normalized_email = email.lower()
        return next(
            (
                record
                for record in self._records.values()
                if record.email.lower() == normalized_email
            ),
            None,
        )

    def create_client(
        self,
        *,
        email: str,
        personal_name: Optional[str],
        status: str,
    ) -> ClientRecord:
        self._counter += 1
        timestamp = datetime.now(timezone.utc)
        record = ClientRecord(
            id=f"client_{self._counter}",
            email=email,
            personal_name=personal_name,
            status=status,
            email_limit_per_campaign=None,
            max_campaigns=None,
            monthly_email_limit=None,
            daily_email_limit=None,
            created_at=timestamp,
            updated_at=timestamp,
        )
        self._records[record.id] = record
        return record

    def update_client(
        self,
        *,
        client_id: str,
        email: str,
        personal_name: Optional[str],
        status: Optional[str] = None,
        email_limit_per_campaign: Optional[int] = None,
        max_campaigns: Optional[int] = None,
        monthly_email_limit: Optional[int] = None,
        daily_email_limit: Optional[int] = None,
    ) -> ClientRecord:
        existing = self._records[client_id]
        updated = existing.model_copy(
            update={
                "email": email,
                "personal_name": personal_name,
                "status": status or existing.status,
                "email_limit_per_campaign": email_limit_per_campaign,
                "max_campaigns": max_campaigns,
                "monthly_email_limit": monthly_email_limit,
                "daily_email_limit": daily_email_limit,
                "updated_at": datetime.now(timezone.utc),
            }
        )
        self._records[client_id] = updated
        return updated


class FakeClientAccessRepository(ClientAccessRepository):
    def __init__(self, records: Optional[list[ClientAccessRecord]] = None) -> None:
        self._records = {record.id: record for record in records or []}
        self._counter = len(self._records)

    def get_by_clerk_user_id(self, clerk_user_id: str) -> Optional[ClientAccessRecord]:
        return next(
            (
                record
                for record in self._records.values()
                if record.clerk_user_id == clerk_user_id
            ),
            None,
        )

    def get_by_client_id(self, client_id: str) -> Optional[ClientAccessRecord]:
        return next(
            (
                record
                for record in self._records.values()
                if record.client_id == client_id
            ),
            None,
        )

    def get_by_email(self, email: str) -> Optional[ClientAccessRecord]:
        normalized_email = email.lower()
        return next(
            (
                record
                for record in sorted(
                    self._records.values(),
                    key=lambda item: (item.created_at, item.id),
                    reverse=True,
                )
                if record.email.lower() == normalized_email
            ),
            None,
        )

    def get_by_portal_slug(self, portal_slug: str) -> Optional[ClientAccessRecord]:
        return next(
            (
                record
                for record in self._records.values()
                if record.portal_slug == portal_slug
            ),
            None,
        )

    def claim_invited_access(
        self,
        *,
        clerk_user_id: str,
        email: str,
    ) -> Optional[ClientAccessRecord]:
        existing = self.get_by_email(email)

        if (
            existing is None
            or existing.clerk_user_id is not None
            or existing.status not in {"invited", "active"}
            or (existing.invitation_status or "pending") not in {"pending", "accepted"}
        ):
            return None

        claimed = existing.model_copy(
            update={
                "clerk_user_id": clerk_user_id,
                "invitation_status": "accepted",
                "accepted_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        )
        self._records[claimed.id] = claimed
        return claimed

    def update_access(
        self,
        *,
        access_id: str,
        status: str,
        invitation_status: Optional[str],
        accepted_at: Optional[datetime],
    ) -> ClientAccessRecord:
        existing = self._records[access_id]
        updated = existing.model_copy(
            update={
                "status": status,
                "invitation_status": invitation_status,
                "accepted_at": accepted_at,
                "updated_at": datetime.now(timezone.utc),
            }
        )
        self._records[access_id] = updated
        return updated

    def upsert_invited_access(
        self,
        *,
        client_id: str,
        email: str,
        clerk_invitation_id: str,
        portal_slug: str,
        invited_at: datetime,
    ) -> ClientAccessRecord:
        existing = self.get_by_client_id(client_id)
        timestamp = datetime.now(timezone.utc)

        if existing is None:
            self._counter += 1
            record = ClientAccessRecord(
                id=f"access_{self._counter}",
                client_id=client_id,
                email=email,
                clerk_user_id=None,
                clerk_invitation_id=clerk_invitation_id,
                portal_slug=portal_slug,
                status="invited",
                invitation_status="pending",
                invited_at=invited_at,
                accepted_at=None,
                created_at=timestamp,
                updated_at=timestamp,
            )
        else:
            record = existing.model_copy(
                update={
                    "email": email,
                    "clerk_user_id": None,
                    "clerk_invitation_id": clerk_invitation_id,
                    "portal_slug": portal_slug,
                    "status": "invited",
                    "invitation_status": "pending",
                    "invited_at": invited_at,
                    "accepted_at": None,
                    "updated_at": timestamp,
                }
            )

        self._records[record.id] = record
        return record


class FakeClerkInvitationGateway(ClerkInvitationGateway):
    def __init__(self) -> None:
        self.calls: list[dict[str, str]] = []
        self._counter = 0

    def create_invitation(
        self,
        *,
        email: str,
        redirect_url: str,
    ) -> ClerkInvitationResult:
        self._counter += 1
        self.calls.append({"email": email, "redirect_url": redirect_url})
        return ClerkInvitationResult(id=f"inv_{self._counter}", status="pending")


@pytest.fixture(autouse=True)
def auth_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CLERK_JWKS_URL", TEST_JWKS_URL)
    monkeypatch.setenv("CLERK_ISSUER", TEST_ISSUER)
    monkeypatch.setenv("FRONTEND_URL", "http://localhost:3000")
    monkeypatch.delenv("CLERK_AUDIENCE", raising=False)
    monkeypatch.setenv("AUTH_USER_MAPPINGS_JSON", "{}")
    app.dependency_overrides.clear()
    get_settings.cache_clear()
    _build_auth_user_repository.cache_clear()
    get_jwks_client.cache_clear()
    yield
    app.dependency_overrides.clear()
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
    email: Optional[str] = "user@example.test",
    issuer: str = TEST_ISSUER,
    expires_in_seconds: int = 300,
    extra_claims: Optional[dict[str, Any]] = None,
) -> str:
    now = int(time.time())
    payload = {
        "sub": clerk_user_id,
        "iss": issuer,
        "iat": now,
        "nbf": now,
        "exp": now + expires_in_seconds,
    }

    if email is not None:
        payload["email"] = email

    if extra_claims:
        payload.update(extra_claims)

    return jwt.encode(payload, private_key, algorithm="RS256", headers={"kid": "test-key"})


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def build_client_record(
    *,
    client_id: str = "client_demo",
    email: str = "client@example.test",
    personal_name: Optional[str] = "Mario",
    status: str = "active",
    email_limit_per_campaign: Optional[int] = None,
    max_campaigns: Optional[int] = None,
    monthly_email_limit: Optional[int] = None,
    daily_email_limit: Optional[int] = None,
) -> ClientRecord:
    timestamp = datetime(2026, 5, 8, 9, 0, tzinfo=timezone.utc)
    return ClientRecord(
        id=client_id,
        email=email,
        personal_name=personal_name,
        status=status,
        email_limit_per_campaign=email_limit_per_campaign,
        max_campaigns=max_campaigns,
        monthly_email_limit=monthly_email_limit,
        daily_email_limit=daily_email_limit,
        created_at=timestamp,
        updated_at=timestamp,
    )


def build_access_record(
    *,
    access_id: str = "access_demo",
    client_id: str = "client_demo",
    email: str = "client@example.test",
    clerk_user_id: Optional[str] = "user_client",
    portal_slug: str = "a" * 32,
    status: str = "active",
    invitation_status: Optional[str] = "accepted",
) -> ClientAccessRecord:
    timestamp = datetime(2026, 5, 8, 9, 5, tzinfo=timezone.utc)
    invited_at = None if invitation_status is None else timestamp
    accepted_at = timestamp if invitation_status == "accepted" else None
    return ClientAccessRecord(
        id=access_id,
        client_id=client_id,
        email=email,
        clerk_user_id=clerk_user_id,
        clerk_invitation_id="inv_existing",
        portal_slug=portal_slug,
        status=status,
        invitation_status=invitation_status,
        invited_at=invited_at,
        accepted_at=accepted_at,
        created_at=timestamp,
        updated_at=timestamp,
    )


def install_test_dependencies(
    *,
    client_records: Optional[list[ClientRecord]] = None,
    access_records: Optional[list[ClientAccessRecord]] = None,
    invitation_gateway: Optional[FakeClerkInvitationGateway] = None,
) -> tuple[FakeClientRepository, FakeClientAccessRepository, FakeClerkInvitationGateway]:
    client_repository = FakeClientRepository(client_records)
    client_access_repository = FakeClientAccessRepository(access_records)
    gateway = invitation_gateway or FakeClerkInvitationGateway()
    settings = get_settings()
    clients_service = ClientsService(client_repository)
    client_access_service = ClientAccessService(
        repository=client_access_repository,
        client_repository=client_repository,
        invitation_gateway=gateway,
        settings=settings,
    )

    app.dependency_overrides[get_clients_service] = lambda: clients_service
    app.dependency_overrides[get_client_access_service] = lambda: client_access_service
    return client_repository, client_access_repository, gateway


def test_health_is_public(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "email-ai-platform",
        "version": "v1-skeleton",
    }


def test_auth_me_unauthenticated_returns_401(client: TestClient) -> None:
    response = client.get("/auth/me")

    assert response.status_code == 401


def test_platform_admin_from_env_mapping_works(
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
    install_test_dependencies()
    token = make_token(signing_keypair, clerk_user_id="user_admin", email="admin@sendwise.test")

    auth_me_response = client.get("/auth/me", headers=auth_header(token))
    admin_response = client.get("/admin/clients", headers=auth_header(token))

    assert auth_me_response.status_code == 200
    assert auth_me_response.json() == {
        "access_type": "platform_admin",
        "client_id": None,
        "portal_slug": None,
        "email": "admin@sendwise.test",
        "status": "active",
        "invitation_status": None,
        "onboarding_required": False,
    }
    assert admin_response.status_code == 200
    assert admin_response.json() == []


def test_active_client_from_db_client_access_works(
    client: TestClient,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    install_test_dependencies(
        client_records=[build_client_record()],
        access_records=[build_access_record()],
    )
    token = make_token(
        signing_keypair,
        clerk_user_id="user_client",
        email="client@example.test",
    )

    auth_me_response = client.get("/auth/me", headers=auth_header(token))
    client_me_response = client.get("/client/me", headers=auth_header(token))

    assert auth_me_response.status_code == 200
    assert auth_me_response.json() == {
        "access_type": "client",
        "client_id": "client_demo",
        "portal_slug": "a" * 32,
        "email": "client@example.test",
        "status": "active",
        "invitation_status": "accepted",
        "onboarding_required": False,
    }

    assert client_me_response.status_code == 200
    data = client_me_response.json()
    assert data["client"]["id"] == "client_demo"
    assert data["client"]["email"] == "client@example.test"
    assert data["user"]["portal_slug"] == "a" * 32
    assert data["user"]["status"] == "active"
    assert "role" not in data["user"]


def test_pending_invited_client_claims_access_on_first_valid_login(
    client: TestClient,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    client_record = build_client_record(
        personal_name=None,
    )
    access_record = build_access_record(
        email=client_record.email,
        clerk_user_id=None,
        status="invited",
        invitation_status="pending",
    )
    _, access_repository, _ = install_test_dependencies(
        client_records=[client_record],
        access_records=[access_record],
    )
    token = make_token(
        signing_keypair,
        clerk_user_id="user_claimed",
        email=client_record.email,
    )

    response = client.get("/auth/me", headers=auth_header(token))
    blocked_client_response = client.get("/client/me", headers=auth_header(token))

    assert response.status_code == 200
    assert blocked_client_response.status_code == 403
    assert response.json() == {
        "access_type": "client",
        "client_id": "client_demo",
        "portal_slug": "a" * 32,
        "email": "client@example.test",
        "status": "invited",
        "invitation_status": "accepted",
        "onboarding_required": True,
    }
    claimed_access = access_repository.get_by_client_id(client_record.id)
    assert claimed_access is not None
    assert claimed_access.clerk_user_id == "user_claimed"
    assert claimed_access.status == "invited"
    assert claimed_access.invitation_status == "accepted"


def test_complete_onboarding_requires_personal_name_only(
    client: TestClient,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    client_record = build_client_record(personal_name=None)
    access_record = build_access_record(
        client_id=client_record.id,
        email=client_record.email,
        clerk_user_id="user_client",
        status="invited",
        invitation_status="accepted",
    )
    install_test_dependencies(
        client_records=[client_record],
        access_records=[access_record],
    )
    token = make_token(
        signing_keypair,
        clerk_user_id="user_client",
        email=client_record.email,
    )

    response = client.post(
        "/auth/onboarding",
        headers=auth_header(token),
        json={},
    )

    assert response.status_code == 422


def test_complete_onboarding_activates_client_access(
    client: TestClient,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    client_record = build_client_record(personal_name=None)
    access_record = build_access_record(
        client_id=client_record.id,
        email=client_record.email,
        clerk_user_id="user_client",
        status="invited",
        invitation_status="accepted",
    )
    client_repository, access_repository, _ = install_test_dependencies(
        client_records=[client_record],
        access_records=[access_record],
    )
    token = make_token(
        signing_keypair,
        clerk_user_id="user_client",
        email=client_record.email,
    )

    response = client.post(
        "/auth/onboarding",
        headers=auth_header(token),
        json={"personal_name": "Mario Rossi"},
    )
    auth_me_response = client.get("/auth/me", headers=auth_header(token))

    assert response.status_code == 200
    assert response.json() == {
        "access_type": "client",
        "client_id": "client_demo",
        "portal_slug": "a" * 32,
        "email": "client@example.test",
        "status": "active",
        "invitation_status": "accepted",
        "onboarding_required": False,
    }
    assert auth_me_response.status_code == 200
    assert auth_me_response.json()["portal_slug"] == "a" * 32
    updated_client = client_repository.get_by_id(client_record.id)
    assert updated_client is not None
    assert updated_client.personal_name == "Mario Rossi"
    updated_access = access_repository.get_by_client_id(client_record.id)
    assert updated_access is not None
    assert updated_access.status == "active"
    assert updated_access.invitation_status == "accepted"


def test_complete_onboarding_rejects_company_name_field(
    client: TestClient,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    client_record = build_client_record(personal_name=None)
    access_record = build_access_record(
        client_id=client_record.id,
        email=client_record.email,
        clerk_user_id="user_client",
        status="invited",
        invitation_status="accepted",
    )
    install_test_dependencies(
        client_records=[client_record],
        access_records=[access_record],
    )
    token = make_token(
        signing_keypair,
        clerk_user_id="user_client",
        email=client_record.email,
    )

    response = client.post(
        "/auth/onboarding",
        headers=auth_header(token),
        json={
            "personal_name": "Mario Rossi",
            "company_name": "Rejected Name",
        },
    )

    assert response.status_code == 422


def test_unknown_user_still_403(
    client: TestClient,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    install_test_dependencies()
    token = make_token(
        signing_keypair,
        clerk_user_id="user_unknown",
        email="unknown@example.test",
    )

    response = client.get("/auth/me", headers=auth_header(token))

    assert response.status_code == 403


def test_auth_me_can_claim_client_from_nested_clerk_email_claim(
    client: TestClient,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    client_record = build_client_record(personal_name=None)
    access_record = build_access_record(
        email=client_record.email,
        clerk_user_id=None,
        status="invited",
        invitation_status="pending",
    )
    install_test_dependencies(
        client_records=[client_record],
        access_records=[access_record],
    )
    token = make_token(
        signing_keypair,
        clerk_user_id="user_nested_claim",
        email=None,
        extra_claims={
            "primary_email_address": {
                "email_address": client_record.email,
            }
        },
    )

    response = client.get("/auth/me", headers=auth_header(token))

    assert response.status_code == 200
    assert response.json()["status"] == "invited"
    assert response.json()["onboarding_required"] is True


def test_client_without_portal_slug_fails_closed(
    client: TestClient,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    install_test_dependencies(
        client_records=[build_client_record()],
        access_records=[build_access_record(portal_slug="")],
    )
    token = make_token(signing_keypair, clerk_user_id="user_client")

    response = client.get("/auth/me", headers=auth_header(token))

    assert response.status_code == 403
    assert "portal slug" in response.text


def test_malformed_portal_slug_fails_closed(
    client: TestClient,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    install_test_dependencies(
        client_records=[build_client_record()],
        access_records=[build_access_record(portal_slug="bad-slug!")],
    )
    token = make_token(signing_keypair, clerk_user_id="user_client")

    response = client.get("/auth/me", headers=auth_header(token))

    assert response.status_code == 403
    assert "portal slug" in response.text


@pytest.mark.parametrize("status_value", ["invited", "suspended", "archived"])
def test_invited_suspended_archived_client_access_is_denied(
    client: TestClient,
    signing_keypair: rsa.RSAPrivateKey,
    status_value: str,
) -> None:
    invitation_status = "pending" if status_value == "invited" else "accepted"
    install_test_dependencies(
        client_records=[build_client_record()],
        access_records=[
            build_access_record(status=status_value, invitation_status=invitation_status)
        ],
    )
    token = make_token(signing_keypair, clerk_user_id="user_client")

    response = client.get("/client/campaigns", headers=auth_header(token))

    assert response.status_code == 403


def test_client_cannot_access_admin_endpoint(
    client: TestClient,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    install_test_dependencies(
        client_records=[build_client_record()],
        access_records=[build_access_record()],
    )
    token = make_token(signing_keypair, clerk_user_id="user_client")

    response = client.get("/admin/campaigns", headers=auth_header(token))

    assert response.status_code == 403


def test_platform_admin_can_access_admin_endpoint(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    set_auth_mappings(
        monkeypatch,
        {
            "user_admin": {
                "email": "admin@sendwise.test",
                "access_type": "platform_admin",
                "status": "active",
            }
        },
    )
    install_test_dependencies()
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.get("/admin/campaigns", headers=auth_header(token))

    assert response.status_code == 200


def test_platform_admin_can_call_invite_endpoint(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    set_auth_mappings(
        monkeypatch,
        {
            "user_admin": {
                "email": "admin@sendwise.test",
                "access_type": "platform_admin",
                "status": "active",
            }
        },
    )
    _, access_repository, gateway = install_test_dependencies()
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.post(
        "/admin/clients",
        headers=auth_header(token),
        json={
            "email": "Nuovo.Cliente@Example.Test",
            "personal_name": "Giulia",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["client"]["email"] == "nuovo.cliente@example.test"
    assert payload["client"]["personal_name"] == "Giulia"
    assert "company_name" not in payload["client"]
    assert payload["access"]["status"] == "invited"
    assert payload["access"]["invitation_status"] == "pending"
    assert payload["access"]["clerk_invitation_id"] == "inv_1"
    assert payload["access"]["portal_slug"]
    assert len(payload["access"]["portal_slug"]) >= 32
    assert payload["access"]["portal_slug"].isalnum()
    assert gateway.calls == [
        {
            "email": "nuovo.cliente@example.test",
            "redirect_url": "http://localhost:3000/auth/redirect",
        }
    ]
    stored_access = access_repository.get_by_client_id(payload["client"]["id"])
    assert stored_access is not None
    assert stored_access.portal_slug == payload["access"]["portal_slug"]


def test_admin_invite_preflight_allows_frontend_origin(client: TestClient) -> None:
    response = client.options(
        "/admin/clients",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert "POST" in response.headers["access-control-allow-methods"]
    assert "authorization" in response.headers["access-control-allow-headers"].lower()


def test_platform_admin_can_create_invite_with_email_only(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    set_auth_mappings(
        monkeypatch,
        {
            "user_admin": {
                "email": "admin@sendwise.test",
                "access_type": "platform_admin",
                "status": "active",
            }
        },
    )
    client_repository, access_repository, _ = install_test_dependencies()
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.post(
        "/admin/clients",
        headers=auth_header(token),
        json={"email": "solo.email@example.test"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["client"]["email"] == "solo.email@example.test"
    assert payload["client"]["personal_name"] is None
    assert "company_name" not in payload["client"]
    created_client = client_repository.get_by_id(payload["client"]["id"])
    created_access = access_repository.get_by_client_id(payload["client"]["id"])
    assert created_client is not None
    assert created_access is not None
    assert created_access.email == "solo.email@example.test"
    assert "password" not in created_client.model_dump()
    assert "password" not in created_access.model_dump()


def test_platform_admin_invite_rejects_company_name_field(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    set_auth_mappings(
        monkeypatch,
        {
            "user_admin": {
                "email": "admin@sendwise.test",
                "access_type": "platform_admin",
                "status": "active",
            }
        },
    )
    install_test_dependencies()
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.post(
        "/admin/clients",
        headers=auth_header(token),
        json={
            "email": "nuovo.cliente@example.test",
            "company_name": "Rejected Name",
        },
    )

    assert response.status_code == 422


def test_client_cannot_call_invite_endpoint(
    client: TestClient,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    install_test_dependencies(
        client_records=[build_client_record()],
        access_records=[build_access_record()],
    )
    token = make_token(signing_keypair, clerk_user_id="user_client")

    response = client.post(
        "/admin/clients",
        headers=auth_header(token),
        json={"email": "blocked@example.test"},
    )

    assert response.status_code == 403


def test_invite_endpoint_reuses_fixed_portal_slug_on_reinvite(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    set_auth_mappings(
        monkeypatch,
        {
            "user_admin": {
                "email": "admin@sendwise.test",
                "access_type": "platform_admin",
                "status": "active",
            }
        },
    )
    existing_client = build_client_record(email="client@example.test")
    existing_access = build_access_record(
        client_id=existing_client.id,
        email=existing_client.email,
        portal_slug="z" * 32,
        clerk_user_id=None,
        status="invited",
        invitation_status="pending",
    )
    _, access_repository, gateway = install_test_dependencies(
        client_records=[existing_client],
        access_records=[existing_access],
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    first_response = client.post(
        "/admin/clients",
        headers=auth_header(token),
        json={"email": "client@example.test"},
    )
    second_response = client.post(
        "/admin/clients",
        headers=auth_header(token),
        json={"email": "client@example.test"},
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 200
    first_slug = first_response.json()["access"]["portal_slug"]
    second_slug = second_response.json()["access"]["portal_slug"]
    assert first_slug == "z" * 32
    assert second_slug == first_slug
    assert len(gateway.calls) == 2
    updated_access = access_repository.get_by_client_id(existing_client.id)
    assert updated_access is not None
    assert updated_access.portal_slug == first_slug


def test_admin_client_detail_and_limits_update_work(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    set_auth_mappings(
        monkeypatch,
        {
            "user_admin": {
                "email": "admin@sendwise.test",
                "access_type": "platform_admin",
                "status": "active",
            }
        },
    )
    client_record = build_client_record(
        monthly_email_limit=None,
        daily_email_limit=None,
    )
    access_record = build_access_record(
        client_id=client_record.id,
        email=client_record.email,
    )
    client_repository, _, _ = install_test_dependencies(
        client_records=[client_record],
        access_records=[access_record],
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    detail_response = client.get(
        f"/admin/clients/{client_record.id}",
        headers=auth_header(token),
    )
    update_response = client.patch(
        f"/admin/clients/{client_record.id}",
        headers=auth_header(token),
        json={"email_limit_per_campaign": 1200, "max_campaigns": 9},
    )

    assert detail_response.status_code == 200
    assert detail_response.json()["access"]["portal_slug"] == "a" * 32
    assert "company_name" not in detail_response.json()
    assert update_response.status_code == 200
    assert update_response.json()["email_limit_per_campaign"] == 1200
    assert update_response.json()["max_campaigns"] == 9
    assert "company_name" not in update_response.json()
    updated_client = client_repository.get_by_id(client_record.id)
    assert updated_client is not None
    assert updated_client.email_limit_per_campaign == 1200
    assert updated_client.max_campaigns == 9


def test_platform_admin_update_rejects_company_name_field(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    set_auth_mappings(
        monkeypatch,
        {
            "user_admin": {
                "email": "admin@sendwise.test",
                "access_type": "platform_admin",
                "status": "active",
            }
        },
    )
    client_record = build_client_record()
    install_test_dependencies(
        client_records=[client_record],
        access_records=[build_access_record(client_id=client_record.id)],
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.patch(
        f"/admin/clients/{client_record.id}",
        headers=auth_header(token),
        json={"company_name": "Rejected Name"},
    )

    assert response.status_code == 422


def test_client_cannot_update_admin_client_limits(
    client: TestClient,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    client_record = build_client_record()
    install_test_dependencies(
        client_records=[client_record],
        access_records=[build_access_record(client_id=client_record.id)],
    )
    token = make_token(signing_keypair, clerk_user_id="user_client")

    response = client.patch(
        f"/admin/clients/{client_record.id}",
        headers=auth_header(token),
        json={"email_limit_per_campaign": 1},
    )

    assert response.status_code == 403


def test_platform_admin_can_revoke_client_access(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    set_auth_mappings(
        monkeypatch,
        {
            "user_admin": {
                "email": "admin@sendwise.test",
                "access_type": "platform_admin",
                "status": "active",
            }
        },
    )
    client_record = build_client_record()
    access_record = build_access_record(client_id=client_record.id, email=client_record.email)
    _, access_repository, _ = install_test_dependencies(
        client_records=[client_record],
        access_records=[access_record],
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.post(
        f"/admin/clients/{client_record.id}/revoke-access",
        headers=auth_header(token),
    )

    assert response.status_code == 200
    assert response.json()["access"]["status"] == "suspended"
    assert response.json()["access"]["invitation_status"] == "revoked"
    updated_access = access_repository.get_by_client_id(client_record.id)
    assert updated_access is not None
    assert updated_access.status == "suspended"
    assert updated_access.invitation_status == "revoked"


def test_platform_admin_can_archive_client_and_access(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    set_auth_mappings(
        monkeypatch,
        {
            "user_admin": {
                "email": "admin@sendwise.test",
                "access_type": "platform_admin",
                "status": "active",
            }
        },
    )
    client_record = build_client_record()
    access_record = build_access_record(client_id=client_record.id, email=client_record.email)
    client_repository, access_repository, _ = install_test_dependencies(
        client_records=[client_record],
        access_records=[access_record],
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.post(
        f"/admin/clients/{client_record.id}/archive",
        headers=auth_header(token),
    )

    assert response.status_code == 200
    assert response.json()["status"] == "archived"
    assert response.json()["access"]["status"] == "archived"
    updated_client = client_repository.get_by_id(client_record.id)
    updated_access = access_repository.get_by_client_id(client_record.id)
    assert updated_client is not None
    assert updated_client.status == "archived"
    assert updated_access is not None
    assert updated_access.status == "archived"


def test_reinvite_access_endpoint_preserves_portal_slug(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    set_auth_mappings(
        monkeypatch,
        {
            "user_admin": {
                "email": "admin@sendwise.test",
                "access_type": "platform_admin",
                "status": "active",
            }
        },
    )
    existing_client = build_client_record(email="client@example.test")
    existing_access = build_access_record(
        client_id=existing_client.id,
        email=existing_client.email,
        portal_slug="y" * 32,
        clerk_user_id=None,
        status="invited",
        invitation_status="pending",
    )
    _, access_repository, _ = install_test_dependencies(
        client_records=[existing_client],
        access_records=[existing_access],
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.post(
        f"/admin/clients/{existing_client.id}/invite-access",
        headers=auth_header(token),
    )

    assert response.status_code == 200
    assert response.json()["access"]["portal_slug"] == "y" * 32
    stored_access = access_repository.get_by_client_id(existing_client.id)
    assert stored_access is not None
    assert stored_access.portal_slug == "y" * 32


def test_invite_endpoint_rejects_role_and_user_type_fields(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    set_auth_mappings(
        monkeypatch,
        {
            "user_admin": {
                "email": "admin@sendwise.test",
                "access_type": "platform_admin",
                "status": "active",
            }
        },
    )
    install_test_dependencies()
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.post(
        "/admin/clients",
        headers=auth_header(token),
        json={
            "email": "client@example.test",
            "role": "disallowed_role",
            "user_type": "client",
        },
    )

    assert response.status_code == 422


def test_authorized_client_response_shapes_are_preserved(
    client: TestClient,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    install_test_dependencies(
        client_records=[build_client_record()],
        access_records=[build_access_record()],
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
