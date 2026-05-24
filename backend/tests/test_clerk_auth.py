import json
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional
from zoneinfo import ZoneInfo

import jwt
import pytest
import httpx
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core.auth import get_jwks_client
from app.core.config import get_settings
from app.main import app
from app.repositories.blocked_sends import InMemoryBlockedSendRepository
from app.repositories.campaign_slots import InMemoryCampaignSlotRepository
from app.repositories.campaigns import InMemoryCampaignRepository
from app.repositories.auth_users import _build_auth_user_repository
from app.repositories.client_access import ClientAccessRecord, ClientAccessRepository
from app.repositories.clients import (
    AdminCampaignEmailVolumeRecord,
    AdminTopClientVolumeRecord,
    ClientRecord,
    ClientRepository,
)
from app.repositories.contacts import InMemoryContactRepository
from app.repositories.email_logs import InMemoryEmailLogRepository
from app.repositories.provider_events import InMemoryProviderEventRepository
from app.repositories.suppression_list import InMemorySuppressionListRepository
from app.services.auth import AccountDeletionService, ClerkUserDeletionGateway, get_account_deletion_service
from app.services.client_access import (
    ClerkInvitationGateway,
    ClerkInvitationResult,
    ClientAccessService,
    HttpClerkInvitationGateway,
    get_client_access_service,
)
from app.services.clients import (
    CLIENT_BRAND_LOGO_PUBLIC_PREFIX,
    ClerkAccessGateway,
    ClerkAccessLinkResult,
    ClientsService,
    HttpClerkAccessGateway,
    build_client_brand_logo_filename,
    get_clients_service,
)
from app.services.emails import ClientAccessEmailPayload, ClientAccessEmailService
from app.schemas.clients import build_client_access_error_detail

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


@dataclass
class FakeAdminCampaignRecord:
    id: str
    client_id: str
    client_name: str
    client_email: str
    name: str
    status: str
    subject: Optional[str]
    created_at: datetime
    updated_at: datetime
    blocked_sends_count: int = 0


@dataclass
class FakeAdminBlockedSendRecord:
    id: str
    client_id: str
    client_name: str
    client_email: str
    campaign_id: Optional[str]
    campaign_name: str
    reason: str
    decision: str
    created_at: datetime


@dataclass
class FakeAdminEmailLogRecord:
    id: str
    client_id: str
    campaign_id: Optional[str]
    created_at: datetime


@dataclass
class FakeClientCampaignRecord:
    id: str
    client_id: str
    name: str
    status: str
    subject: Optional[str]
    created_at: datetime
    updated_at: datetime
    campaign_slot_id: Optional[str] = None
    preview_text: Optional[str] = None
    body_html: Optional[str] = None
    body_text: Optional[str] = None
    content_ready: bool = False
    contacts_ready: bool = False
    review_ready: bool = False
    current_step: str = "setup"


@dataclass
class FakeClientUsageRecord:
    id: str
    client_id: str
    usage_type: str
    quantity: int
    metadata: dict[str, Any]
    created_at: datetime


@dataclass
class FakeClientBlockedSendRecord:
    id: str
    client_id: str
    campaign_id: Optional[str]
    campaign_name: Optional[str]
    contact_id: Optional[str]
    reason: str
    decision: str
    created_at: datetime


class FakeClientRepository(ClientRepository):
    def __init__(
        self,
        records: Optional[list[ClientRecord]] = None,
        *,
        admin_campaign_records: Optional[list[FakeAdminCampaignRecord]] = None,
        admin_blocked_send_records: Optional[list[FakeAdminBlockedSendRecord]] = None,
        admin_email_log_records: Optional[list[FakeAdminEmailLogRecord]] = None,
        client_campaign_records: Optional[list[FakeClientCampaignRecord]] = None,
        client_usage_records: Optional[list[FakeClientUsageRecord]] = None,
        client_blocked_send_records: Optional[list[FakeClientBlockedSendRecord]] = None,
        database_available: bool = True,
    ) -> None:
        self._records = {record.id: record for record in records or []}
        self._admin_campaign_records = admin_campaign_records or []
        self._admin_blocked_send_records = admin_blocked_send_records or []
        self._admin_email_log_records = admin_email_log_records or []
        self._client_campaign_records = client_campaign_records or []
        self._client_usage_records = client_usage_records or []
        self._client_blocked_send_records = client_blocked_send_records or []
        self._database_available = database_available
        self._counter = len(self._records)
        self.deleted_client_ids: list[str] = []

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
        metadata: Optional[dict[str, Any]] = None,
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
            metadata=metadata or {},
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
        metadata: Optional[dict[str, Any]] = None,
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
                "metadata": existing.metadata if metadata is None else metadata,
                "updated_at": datetime.now(timezone.utc),
            }
        )
        self._records[client_id] = updated
        return updated

    def list_admin_campaigns(self) -> list[FakeAdminCampaignRecord]:
        return sorted(
            self._admin_campaign_records,
            key=lambda item: (item.updated_at, item.id),
            reverse=True,
        )

    def list_recent_admin_blocked_sends(
        self,
        *,
        limit: int,
    ) -> list[FakeAdminBlockedSendRecord]:
        return self.list_admin_blocked_sends(limit=limit)

    def list_admin_blocked_sends(
        self,
        *,
        limit: Optional[int] = None,
    ) -> list[FakeAdminBlockedSendRecord]:
        rows = sorted(
            self._admin_blocked_send_records,
            key=lambda item: (item.created_at, item.id),
            reverse=True,
        )
        if limit is None:
            return rows

        return rows[:limit]

    def count_admin_blocked_sends_since(self, started_at: datetime) -> int:
        return sum(
            1
            for record in self._admin_blocked_send_records
            if record.created_at >= started_at
        )

    def count_admin_email_logs_since(self, started_at: datetime) -> int:
        return sum(
            1
            for record in self._admin_email_log_records
            if record.created_at >= started_at
        )

    def list_admin_top_sending_clients_since(
        self,
        *,
        started_at: datetime,
        limit: int,
    ) -> list[AdminTopClientVolumeRecord]:
        totals_by_client_id: dict[str, int] = {}
        for record in self._admin_email_log_records:
            if record.created_at < started_at:
                continue
            totals_by_client_id[record.client_id] = (
                totals_by_client_id.get(record.client_id, 0) + 1
            )

        sorted_client_ids = sorted(
            totals_by_client_id,
            key=lambda client_id: (
                totals_by_client_id[client_id],
                self._records[client_id].email,
            ),
            reverse=True,
        )
        rows: list[AdminTopClientVolumeRecord] = []
        for client_id in sorted_client_ids[:limit]:
            client = self._records[client_id]
            rows.append(
                AdminTopClientVolumeRecord(
                    client_id=client_id,
                    client_name=client.personal_name or client.email,
                    client_email=client.email,
                    emails_sent=totals_by_client_id[client_id],
                )
            )

        return rows

    def list_admin_campaign_email_volumes(self) -> list[AdminCampaignEmailVolumeRecord]:
        totals_by_campaign: dict[tuple[str, Optional[str]], int] = {}
        for record in self._admin_email_log_records:
            key = (record.client_id, record.campaign_id)
            totals_by_campaign[key] = totals_by_campaign.get(key, 0) + 1

        campaign_names = {
            campaign.id: campaign.name for campaign in self._admin_campaign_records
        }
        rows = [
            AdminCampaignEmailVolumeRecord(
                client_id=client_id,
                campaign_id=campaign_id,
                campaign_name=(
                    campaign_names.get(campaign_id) if campaign_id is not None else None
                ),
                emails_sent=emails_sent,
            )
            for (client_id, campaign_id), emails_sent in totals_by_campaign.items()
        ]
        rows.sort(
            key=lambda row: (
                row.emails_sent,
                row.campaign_name or "",
            ),
            reverse=True,
        )
        return rows

    def list_client_campaigns(self, client_id: str) -> list[FakeClientCampaignRecord]:
        return sorted(
            (
                record
                for record in self._client_campaign_records
                if record.client_id == client_id
            ),
            key=lambda item: (item.updated_at, item.id),
            reverse=True,
        )

    def list_client_usage(self, client_id: str) -> list[FakeClientUsageRecord]:
        return sorted(
            (
                record for record in self._client_usage_records if record.client_id == client_id
            ),
            key=lambda item: (item.created_at, item.id),
            reverse=True,
        )

    def list_client_blocked_sends(
        self,
        client_id: str,
    ) -> list[FakeClientBlockedSendRecord]:
        return sorted(
            (
                record
                for record in self._client_blocked_send_records
                if record.client_id == client_id
            ),
            key=lambda item: (item.created_at, item.id),
            reverse=True,
        )

    def is_database_available(self) -> bool:
        return self._database_available

    def delete_client_account(self, client_id: str) -> bool:
        existing = self._records.pop(client_id, None)

        if existing is None:
            return False

        self.deleted_client_ids.append(client_id)
        return True


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

    def delete_by_client_id(self, client_id: str) -> bool:
        existing = self.get_by_client_id(client_id)

        if existing is None:
            return False

        del self._records[existing.id]
        return True


class FakeClientAccessService:
    def __init__(self, records: list[ClientAccessRecord]) -> None:
        self._records = {record.client_id: record for record in records}

    def get_access_by_client_id(self, client_id: str) -> Optional[ClientAccessRecord]:
        return self._records.get(client_id)


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


class FakeClerkAccessGateway(ClerkAccessGateway):
    def __init__(self) -> None:
        self.invitation_calls: list[dict[str, object]] = []
        self.sign_in_token_calls: list[str] = []
        self._counter = 0

    def create_invitation(
        self,
        *,
        email: str,
        redirect_url: str,
        public_metadata: Optional[dict[str, object]] = None,
    ) -> ClerkAccessLinkResult:
        self._counter += 1
        self.invitation_calls.append(
            {
                "email": email,
                "redirect_url": redirect_url,
                "public_metadata": public_metadata,
            }
        )
        return ClerkAccessLinkResult(
            reference_id=f"inv_access_{self._counter}",
            url=None,
            kind="invitation",
        )

    def create_sign_in_token(
        self,
        *,
        clerk_user_id: str,
    ) -> ClerkAccessLinkResult:
        self._counter += 1
        self.sign_in_token_calls.append(clerk_user_id)
        return ClerkAccessLinkResult(
            reference_id=f"sit_{self._counter}",
            url=f"https://clerk.example.test/sign-in/{self._counter}",
            kind="sign_in_token",
        )


class FakeClientAccessEmailService(ClientAccessEmailService):
    def __init__(self) -> None:
        self.messages: list[ClientAccessEmailPayload] = []

    def send_client_access_email(self, payload: ClientAccessEmailPayload) -> None:
        self.messages.append(payload)


class FailingClerkAccessGateway(FakeClerkAccessGateway):
    def create_invitation(
        self,
        *,
        email: str,
        redirect_url: str,
        public_metadata: Optional[dict[str, object]] = None,
    ) -> ClerkAccessLinkResult:
        raise HTTPException(
            status_code=502,
            detail=build_client_access_error_detail("client_access_clerk_email_failed"),
        )


class FailingClientAccessEmailService(FakeClientAccessEmailService):
    def send_client_access_email(self, payload: ClientAccessEmailPayload) -> None:
        self.messages.append(payload)
        raise HTTPException(
            status_code=502,
            detail=build_client_access_error_detail("client_access_email_send_failed"),
        )


class FakeClerkUserDeletionGateway(ClerkUserDeletionGateway):
    def __init__(self) -> None:
        self.deleted_user_ids: list[str] = []

    def delete_user(self, clerk_user_id: str) -> None:
        self.deleted_user_ids.append(clerk_user_id)


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
    metadata: Optional[dict[str, Any]] = None,
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
        metadata=metadata or {},
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


def build_admin_campaign_record(
    *,
    campaign_id: str,
    client_id: str,
    client_name: str,
    client_email: str,
    name: str,
    status: str,
    subject: Optional[str],
    created_at: Optional[datetime] = None,
    updated_at: Optional[datetime] = None,
    blocked_sends_count: int = 0,
) -> FakeAdminCampaignRecord:
    created = created_at or datetime(2026, 5, 8, 9, 0, tzinfo=timezone.utc)
    updated = updated_at or created
    return FakeAdminCampaignRecord(
        id=campaign_id,
        client_id=client_id,
        client_name=client_name,
        client_email=client_email,
        name=name,
        status=status,
        subject=subject,
        created_at=created,
        updated_at=updated,
        blocked_sends_count=blocked_sends_count,
    )


def build_admin_blocked_send_record(
    *,
    blocked_send_id: str,
    client_id: str,
    client_name: str,
    client_email: str = "client@example.test",
    campaign_id: Optional[str],
    campaign_name: str,
    reason: str,
    decision: str = "blocked",
    created_at: Optional[datetime] = None,
) -> FakeAdminBlockedSendRecord:
    return FakeAdminBlockedSendRecord(
        id=blocked_send_id,
        client_id=client_id,
        client_name=client_name,
        client_email=client_email,
        campaign_id=campaign_id,
        campaign_name=campaign_name,
        reason=reason,
        decision=decision,
        created_at=created_at or datetime.now(timezone.utc),
    )


def build_admin_email_log_record(
    *,
    log_id: str,
    client_id: str,
    campaign_id: Optional[str],
    created_at: datetime,
) -> FakeAdminEmailLogRecord:
    return FakeAdminEmailLogRecord(
        id=log_id,
        client_id=client_id,
        campaign_id=campaign_id,
        created_at=created_at,
    )


def build_client_campaign_record(
    *,
    campaign_id: str,
    client_id: str,
    name: str,
    status: str,
    subject: Optional[str],
    campaign_slot_id: Optional[str] = None,
    preview_text: Optional[str] = None,
    body_html: Optional[str] = None,
    body_text: Optional[str] = None,
    content_ready: bool = False,
    contacts_ready: bool = False,
    review_ready: bool = False,
    current_step: str = "setup",
    created_at: Optional[datetime] = None,
    updated_at: Optional[datetime] = None,
) -> FakeClientCampaignRecord:
    created = created_at or datetime(2026, 5, 8, 9, 0, tzinfo=timezone.utc)
    updated = updated_at or created
    return FakeClientCampaignRecord(
        id=campaign_id,
        client_id=client_id,
        name=name,
        status=status,
        subject=subject,
        campaign_slot_id=campaign_slot_id,
        preview_text=preview_text,
        body_html=body_html,
        body_text=body_text,
        content_ready=content_ready,
        contacts_ready=contacts_ready,
        review_ready=review_ready,
        current_step=current_step,
        created_at=created,
        updated_at=updated,
    )


def build_client_usage_record(
    *,
    usage_id: str,
    client_id: str,
    usage_type: str,
    quantity: int,
    metadata: Optional[dict[str, Any]] = None,
    created_at: Optional[datetime] = None,
) -> FakeClientUsageRecord:
    return FakeClientUsageRecord(
        id=usage_id,
        client_id=client_id,
        usage_type=usage_type,
        quantity=quantity,
        metadata=metadata or {},
        created_at=created_at or datetime(2026, 5, 8, 9, 0, tzinfo=timezone.utc),
    )


def build_client_blocked_send_record(
    *,
    blocked_send_id: str,
    client_id: str,
    campaign_id: Optional[str],
    campaign_name: Optional[str],
    contact_id: Optional[str] = None,
    reason: str,
    decision: str = "blocked",
    created_at: Optional[datetime] = None,
) -> FakeClientBlockedSendRecord:
    return FakeClientBlockedSendRecord(
        id=blocked_send_id,
        client_id=client_id,
        campaign_id=campaign_id,
        campaign_name=campaign_name,
        contact_id=contact_id,
        reason=reason,
        decision=decision,
        created_at=created_at or datetime(2026, 5, 8, 9, 0, tzinfo=timezone.utc),
    )


def build_webp_bytes(payload: bytes = b"sendwise") -> bytes:
    return b"RIFF" + (len(payload) + 4).to_bytes(4, "little") + b"WEBP" + payload


def install_test_dependencies(
    *,
    client_records: Optional[list[ClientRecord]] = None,
    access_records: Optional[list[ClientAccessRecord]] = None,
    admin_campaign_records: Optional[list[FakeAdminCampaignRecord]] = None,
    admin_blocked_send_records: Optional[list[FakeAdminBlockedSendRecord]] = None,
    admin_email_log_records: Optional[list[FakeAdminEmailLogRecord]] = None,
    client_campaign_records: Optional[list[FakeClientCampaignRecord]] = None,
    client_usage_records: Optional[list[FakeClientUsageRecord]] = None,
    client_blocked_send_records: Optional[list[FakeClientBlockedSendRecord]] = None,
    campaign_repository: InMemoryCampaignRepository | None = None,
    campaign_slot_repository: InMemoryCampaignSlotRepository | None = None,
    contact_repository: InMemoryContactRepository | None = None,
    suppression_list_repository: InMemorySuppressionListRepository | None = None,
    blocked_send_repository: InMemoryBlockedSendRepository | None = None,
    email_log_repository: InMemoryEmailLogRepository | None = None,
    provider_event_repository: InMemoryProviderEventRepository | None = None,
    include_provider_event_repository: bool = True,
    database_available: bool = True,
    invitation_gateway: Optional[FakeClerkInvitationGateway] = None,
    clerk_access_gateway: Optional[FakeClerkAccessGateway] = None,
    client_access_email_service: Optional[FakeClientAccessEmailService] = None,
    deletion_gateway: Optional[FakeClerkUserDeletionGateway] = None,
) -> tuple[
    FakeClientRepository,
    FakeClientAccessRepository,
    FakeClerkInvitationGateway,
    FakeClerkUserDeletionGateway,
]:
    client_repository = FakeClientRepository(
        client_records,
        admin_campaign_records=admin_campaign_records,
        admin_blocked_send_records=admin_blocked_send_records,
        admin_email_log_records=admin_email_log_records,
        client_campaign_records=client_campaign_records,
        client_usage_records=client_usage_records,
        client_blocked_send_records=client_blocked_send_records,
        database_available=database_available,
    )
    client_access_repository = FakeClientAccessRepository(access_records)
    gateway = invitation_gateway or FakeClerkInvitationGateway()
    access_gateway = clerk_access_gateway or FakeClerkAccessGateway()
    email_service = client_access_email_service or FakeClientAccessEmailService()
    clerk_user_deletion_gateway = deletion_gateway or FakeClerkUserDeletionGateway()
    settings = get_settings()
    clients_service = ClientsService(
        client_repository,
        settings=settings,
        client_access_repository=client_access_repository,
        clerk_access_gateway=access_gateway,
        client_access_email_service=email_service,
        campaign_repository=campaign_repository,
        campaign_slot_repository=campaign_slot_repository,
        contact_repository=contact_repository,
        suppression_list_repository=suppression_list_repository,
        blocked_send_repository=blocked_send_repository,
        email_log_repository=email_log_repository,
        provider_event_repository=(
            provider_event_repository or InMemoryProviderEventRepository()
            if include_provider_event_repository
            else None
        ),
    )
    client_access_service = ClientAccessService(
        repository=client_access_repository,
        client_repository=client_repository,
        invitation_gateway=gateway,
        settings=settings,
    )
    account_deletion_service = AccountDeletionService(
        client_repository=client_repository,
        client_access_repository=client_access_repository,
        clerk_user_gateway=clerk_user_deletion_gateway,
    )

    app.dependency_overrides[get_clients_service] = lambda: clients_service
    app.dependency_overrides[get_client_access_service] = lambda: client_access_service
    app.dependency_overrides[get_account_deletion_service] = (
        lambda: account_deletion_service
    )
    return (
        client_repository,
        client_access_repository,
        gateway,
        clerk_user_deletion_gateway,
    )


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
    _, access_repository, _, _ = install_test_dependencies(
        client_records=[client_record],
        access_records=[access_record],
    )
    token = make_token(
        signing_keypair,
        clerk_user_id="user_claimed",
        email=client_record.email,
    )

    response = client.get("/auth/me", headers=auth_header(token))
    client_me_response = client.get("/client/me", headers=auth_header(token))

    assert response.status_code == 200
    assert client_me_response.status_code == 200
    assert response.json() == {
        "access_type": "client",
        "client_id": "client_demo",
        "portal_slug": "a" * 32,
        "email": "client@example.test",
        "status": "active",
        "invitation_status": "accepted",
        "onboarding_required": False,
    }
    claimed_access = access_repository.get_by_client_id(client_record.id)
    assert claimed_access is not None
    assert claimed_access.clerk_user_id == "user_claimed"
    assert claimed_access.status == "active"
    assert claimed_access.invitation_status == "accepted"


def test_onboarding_endpoint_returns_gone_for_legacy_flow(
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

    assert response.status_code == 410
    assert (
        response.json()["detail"]
        == "Questo flusso non e piu attivo. Accedi dal pannello o richiedi una nuova email di accesso."
    )


def test_existing_linked_user_resend_access_email_returns_controlled_unsupported_code(
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
    client_record = build_client_record(personal_name="Mario Rossi")
    access_record = build_access_record(
        client_id=client_record.id,
        email=client_record.email,
        clerk_user_id="user_client",
        status="active",
        invitation_status="accepted",
    )
    access_gateway = FakeClerkAccessGateway()
    _, access_repository, _, _ = install_test_dependencies(
        client_records=[client_record],
        access_records=[access_record],
        clerk_access_gateway=access_gateway,
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.post(
        f"/admin/clients/{client_record.id}/send-access-email",
        headers=auth_header(token),
    )

    assert response.status_code == 409
    assert response.json()["detail"] == build_client_access_error_detail(
        "client_access_existing_user_resend_unsupported"
    )
    updated_access = access_repository.get_by_client_id(client_record.id)
    assert updated_access is not None
    assert updated_access.status == "active"
    assert updated_access.invitation_status == "accepted"
    assert access_gateway.sign_in_token_calls == []
    assert access_gateway.invitation_calls == []
    assert "https://clerk.example.test" not in response.text


def test_onboarding_endpoint_rejects_legacy_payload_shape(
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

    assert response.status_code == 410


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
    assert response.json()["status"] == "active"
    assert response.json()["onboarding_required"] is False


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


def test_platform_admin_receives_backend_owned_overview_payload(
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
    first_client = build_client_record(
        client_id="client_alpha",
        email="alpha@example.test",
        personal_name="Alpha",
        status="active",
        email_limit_per_campaign=2000,
        max_campaigns=4,
    )
    second_client = build_client_record(
        client_id="client_beta",
        email="beta@example.test",
        personal_name="Beta",
        status="trial",
    )
    install_test_dependencies(
        client_records=[first_client, second_client],
        access_records=[
            build_access_record(client_id=first_client.id, email=first_client.email),
            build_access_record(
                access_id="access_beta",
                client_id=second_client.id,
                email=second_client.email,
                clerk_user_id=None,
                status="invited",
                invitation_status="pending",
            ),
        ],
        admin_campaign_records=[
            build_admin_campaign_record(
                campaign_id="campaign_alpha_ready",
                client_id=first_client.id,
                client_name="Alpha",
                client_email=first_client.email,
                name="Alpha Ready",
                status="ready",
                subject="Alpha launch",
                updated_at=datetime(2026, 5, 9, 10, 0, tzinfo=timezone.utc),
            ),
            build_admin_campaign_record(
                campaign_id="campaign_beta_paused",
                client_id=second_client.id,
                client_name="Beta",
                client_email=second_client.email,
                name="Beta Paused",
                status="paused",
                subject=None,
                updated_at=datetime(2026, 5, 8, 10, 0, tzinfo=timezone.utc),
                blocked_sends_count=1,
            ),
        ],
        admin_blocked_send_records=[
            build_admin_blocked_send_record(
                blocked_send_id="blocked_today",
                client_id=second_client.id,
                client_name="Beta",
                client_email=second_client.email,
                campaign_id="campaign_beta_paused",
                campaign_name="Beta Paused",
                reason="Guard prevented send.",
                created_at=datetime.now(timezone.utc),
            )
        ],
        admin_email_log_records=[
            build_admin_email_log_record(
                log_id="email_today_alpha_1",
                client_id=first_client.id,
                campaign_id="campaign_alpha_ready",
                created_at=datetime.now(timezone.utc),
            ),
            build_admin_email_log_record(
                log_id="email_today_alpha_2",
                client_id=first_client.id,
                campaign_id="campaign_alpha_ready",
                created_at=datetime.now(timezone.utc),
            ),
            build_admin_email_log_record(
                log_id="email_month_beta_1",
                client_id=second_client.id,
                campaign_id="campaign_beta_paused",
                created_at=datetime(2026, 5, 2, 8, 0, tzinfo=timezone.utc),
            ),
        ],
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.get("/admin/overview", headers=auth_header(token))

    assert response.status_code == 200
    payload = response.json()
    assert payload["clients"] == {
        "total_clients": 2,
        "active_clients": 1,
        "invited_or_pending_clients": 1,
        "archived_or_blocked_clients": 0,
        "status_counts": {
            "trial": 1,
            "active": 1,
            "paused": 0,
            "blocked": 0,
            "archived": 0,
        },
    }
    assert payload["campaigns"]["total_campaigns"] == 2
    assert payload["campaigns"]["running_campaigns"] == 0
    assert payload["campaigns"]["paused_campaigns"] == 1
    assert payload["campaigns"]["blocked_campaigns"] == 0
    assert payload["campaigns"]["status_counts"] == {
        "active": 1,
        "paused": 1,
        "blocked": 0,
        "draft": 0,
        "completed": 0,
        "failed": 0,
    }
    assert payload["campaigns"]["recent_campaigns"][0]["client_name"] == "Alpha"
    assert payload["sending"] == {
        "emails_sent_today": 2,
        "emails_sent_this_month": 3,
        "top_clients_by_volume": [
            {
                "client_id": first_client.id,
                "client_name": "Alpha",
                "client_email": first_client.email,
                "emails_sent": 2,
            },
            {
                "client_id": second_client.id,
                "client_name": "Beta",
                "client_email": second_client.email,
                "emails_sent": 1,
            },
        ],
    }
    assert payload["blocks"]["blocked_sends_today"] == 1
    assert (
        payload["blocks"]["recent_critical_events"][0]["campaign_name"]
        == "Beta Paused"
    )
    assert payload["limits"]["configured_limits_count"] == 1
    assert payload["limits"]["unconfigured_limits_count"] == 1
    assert payload["limits"]["clients_near_limit"] == []
    assert payload["system"]["api_status"] == "ok"
    assert payload["system"]["db_status"] == "ok"
    assert (
        payload["system"]["email_sending_enabled"]
        == get_settings().email_sending_enabled
    )
    assert payload["system"]["environment"] == get_settings().environment
    assert payload["system"]["auth_provider_configured"] is True
    assert payload["system"]["frontend_origin_configured"] is True
    assert payload["system"]["delivery_engine_configured"] is True
    assert payload["system"]["clerk_management_api_configured"] is False
    assert payload["system"]["provider_events_available"] is False


def test_platform_admin_overview_reports_provider_events_available_for_correlated_mailgun_events(
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
    provider_event_repository = InMemoryProviderEventRepository()
    event, _ = provider_event_repository.create_or_get_event(
        client_id="client_alpha",
        campaign_id="campaign_alpha",
        contact_id="contact_alpha",
        email_log_id="email_log_alpha",
        provider="mailgun",
        source="mailgun_webhook",
        provider_event_id="mailgun-delivered-1",
        event_key="mailgun-delivered-1",
        event_type="delivered",
        payload={"event": "delivered"},
        occurred_at=datetime.now(timezone.utc),
    )
    provider_event_repository.mark_processed(event_id=event.id)
    install_test_dependencies(
        client_records=[build_client_record(client_id="client_alpha")],
        provider_event_repository=provider_event_repository,
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.get("/admin/overview", headers=auth_header(token))

    assert response.status_code == 200
    payload = response.json()
    assert payload["system"]["provider_events_available"] is True
    assert payload["system"]["runtime"]["provider_events_available"] is True


def test_platform_admin_overview_excludes_unmatched_mailgun_test_events(
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
    provider_event_repository = InMemoryProviderEventRepository()
    event, _ = provider_event_repository.create_or_get_event(
        client_id=None,
        campaign_id=None,
        contact_id=None,
        email_log_id=None,
        provider="mailgun",
        source="mailgun_webhook",
        provider_event_id="mailgun-test-1",
        event_key="mailgun-test-1",
        event_type="delivered",
        payload={"event": "delivered"},
        occurred_at=datetime.now(timezone.utc),
    )
    provider_event_repository.mark_processed(event_id=event.id)
    install_test_dependencies(provider_event_repository=provider_event_repository)
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.get("/admin/overview", headers=auth_header(token))

    assert response.status_code == 200
    payload = response.json()
    assert payload["system"]["provider_events_available"] is False
    assert payload["system"]["runtime"]["provider_events_available"] is False


def test_platform_admin_overview_keeps_provider_events_unavailable_without_events(
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
    install_test_dependencies(provider_event_repository=InMemoryProviderEventRepository())
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.get("/admin/overview", headers=auth_header(token))

    assert response.status_code == 200
    payload = response.json()
    assert payload["system"]["provider_events_available"] is False
    assert payload["system"]["runtime"]["provider_events_available"] is False


def test_platform_admin_overview_reports_clients_near_limit_from_real_usage(
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
    limited_client = build_client_record(
        client_id="client_limit",
        email="limit@example.test",
        personal_name="Limit Client",
        status="active",
        email_limit_per_campaign=500,
        max_campaigns=5,
    )
    install_test_dependencies(
        client_records=[limited_client],
        access_records=[
            build_access_record(client_id=limited_client.id, email=limited_client.email)
        ],
        admin_campaign_records=[
            build_admin_campaign_record(
                campaign_id="campaign_limit_running",
                client_id=limited_client.id,
                client_name="Limit Client",
                client_email=limited_client.email,
                name="Limit Running",
                status="running",
                subject="Ops burst",
            ),
            build_admin_campaign_record(
                campaign_id="campaign_limit_ready",
                client_id=limited_client.id,
                client_name="Limit Client",
                client_email=limited_client.email,
                name="Limit Ready",
                status="ready",
                subject="Ops ready",
            ),
            build_admin_campaign_record(
                campaign_id="campaign_limit_paused",
                client_id=limited_client.id,
                client_name="Limit Client",
                client_email=limited_client.email,
                name="Limit Paused",
                status="paused",
                subject="Ops paused",
            ),
            build_admin_campaign_record(
                campaign_id="campaign_limit_draft",
                client_id=limited_client.id,
                client_name="Limit Client",
                client_email=limited_client.email,
                name="Limit Draft",
                status="draft",
                subject="Ops draft",
            ),
        ],
        admin_email_log_records=[
            *[
                build_admin_email_log_record(
                    log_id=f"limit_log_{index}",
                    client_id=limited_client.id,
                    campaign_id="campaign_limit_running",
                    created_at=datetime(2026, 5, 9, 9, 0, tzinfo=timezone.utc),
                )
                for index in range(450)
            ]
        ],
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.get("/admin/overview", headers=auth_header(token))

    assert response.status_code == 200
    payload = response.json()
    near_limit_clients = payload["limits"]["clients_near_limit"]
    assert len(near_limit_clients) == 1
    assert near_limit_clients[0]["client_id"] == limited_client.id
    assert near_limit_clients[0]["limiting_factor"] == "campaign_slots"
    assert near_limit_clients[0]["campaigns_in_use"] == 4
    assert near_limit_clients[0]["max_campaigns"] == 5


def test_platform_admin_can_list_cross_client_blocked_sends(
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
    first_client = build_client_record(
        client_id="client_alpha",
        email="alpha@example.test",
        personal_name="Alpha",
    )
    second_client = build_client_record(
        client_id="client_beta",
        email="beta@example.test",
        personal_name="Beta",
    )
    install_test_dependencies(
        client_records=[first_client, second_client],
        admin_blocked_send_records=[
            build_admin_blocked_send_record(
                blocked_send_id="blocked_newest",
                client_id=second_client.id,
                client_name="Beta",
                client_email=second_client.email,
                campaign_id="campaign_beta",
                campaign_name="Beta Recovery",
                reason="Campaign is paused.",
                created_at=datetime(2026, 5, 10, 12, 15, tzinfo=timezone.utc),
            ),
            build_admin_blocked_send_record(
                blocked_send_id="blocked_older",
                client_id=first_client.id,
                client_name="Alpha",
                client_email=first_client.email,
                campaign_id=None,
                campaign_name="Campagna non disponibile",
                reason="Client is blocked.",
                created_at=datetime(2026, 5, 9, 8, 0, tzinfo=timezone.utc),
            ),
        ],
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.get("/admin/blocked-sends", headers=auth_header(token))

    assert response.status_code == 200
    payload = response.json()
    assert [item["id"] for item in payload] == ["blocked_newest", "blocked_older"]
    assert payload[0]["client_name"] == "Beta"
    assert payload[0]["campaign_name"] == "Beta Recovery"
    assert payload[0]["reason"] == "Campaign is paused."
    assert payload[0]["decision"] == "blocked"
    assert payload[1]["campaign_id"] is None


def test_platform_admin_can_read_safe_system_status_without_secret_values(
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
    monkeypatch.setenv("ENVIRONMENT", "staging")
    monkeypatch.setenv("EMAIL_SENDING_ENABLED", "true")
    monkeypatch.setenv("EMAIL_PROVIDER", "ses")
    monkeypatch.setenv("CLERK_SECRET_KEY", "super-secret-clerk-value")
    monkeypatch.setenv("SMTP_HOST", "smtp.secret.example")
    monkeypatch.setenv("SMTP_USERNAME", "smtp-user-secret")
    monkeypatch.setenv("SMTP_PASSWORD", "smtp-password-secret")
    monkeypatch.setenv("AWS_SES_REGION", "eu-west-1")
    get_settings.cache_clear()
    install_test_dependencies()
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.get("/admin/system", headers=auth_header(token))

    assert response.status_code == 200
    payload = response.json()
    assert payload["api_status"] == "ok"
    assert payload["db_status"] == "ok"
    assert payload["email_sending_enabled"] is True
    assert payload["email_provider"] == "ses"
    assert (
        payload["provider_mode_label"]
        == "SES sandbox only - production blocked pending AWS approval"
    )
    assert payload["real_send_available"] is False
    assert payload["ses_live_validation_status"] == "pending"
    assert payload["provider_events_available"] is False
    assert payload["mailpit_dev_mode"] is False
    assert payload["runtime"] == {
        "email_sending_enabled": True,
        "email_provider": "ses",
        "provider_mode_label": "SES sandbox only - production blocked pending AWS approval",
        "real_send_available": False,
        "ses_live_validation_status": "pending",
        "provider_events_available": False,
        "mailpit_dev_mode": False,
    }
    assert payload["environment"] == "staging"
    assert payload["auth_provider_configured"] is True
    assert payload["clerk_management_api_configured"] is True
    assert payload["frontend_origin_configured"] is True
    assert payload["delivery_engine_configured"] is True
    assert "generated_at" in payload
    assert "super-secret-clerk-value" not in response.text
    assert "smtp.secret.example" not in response.text
    assert "smtp-user-secret" not in response.text
    assert "smtp-password-secret" not in response.text
    assert "eu-west-1" not in response.text
    assert "CLERK_SECRET_KEY" not in response.text
    assert "DATABASE_URL" not in response.text
    assert "POSTGRES_PASSWORD" not in response.text


def test_platform_admin_system_status_reports_listmonk_mailgun_fallback_safely(
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
    monkeypatch.setenv("ENVIRONMENT", "staging")
    monkeypatch.setenv("EMAIL_SENDING_ENABLED", "false")
    monkeypatch.setenv("EMAIL_PROVIDER", "listmonk")
    monkeypatch.setenv("SMTP_HOST", "smtp.mailgun.org")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USERNAME", "postmaster-secret@send.mailerpro.it")
    monkeypatch.setenv("SMTP_PASSWORD", "smtp-password-secret")
    monkeypatch.setenv("SMTP_TLS", "true")
    monkeypatch.setenv("SMTP_FROM_EMAIL", "sendwise@send.mailerpro.it")
    get_settings.cache_clear()
    install_test_dependencies()
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.get("/admin/system", headers=auth_header(token))

    assert response.status_code == 200
    payload = response.json()
    assert payload["email_provider"] == "listmonk"
    assert (
        payload["provider_mode_label"]
        == "Listmonk SMTP relay configured - Mailgun SMTP ready for production fallback"
    )
    assert payload["runtime"] == {
        "email_sending_enabled": False,
        "email_provider": "listmonk",
        "provider_mode_label": (
            "Listmonk SMTP relay configured - Mailgun SMTP ready for production fallback"
        ),
        "real_send_available": False,
        "ses_live_validation_status": None,
        "provider_events_available": False,
        "mailpit_dev_mode": False,
    }
    assert "postmaster-secret@send.mailerpro.it" not in response.text
    assert "smtp-password-secret" not in response.text
    assert "sendwise@send.mailerpro.it" not in response.text


def test_platform_admin_system_status_reports_database_issue_without_leaking_config(
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
    install_test_dependencies(database_available=False)
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.get("/admin/system", headers=auth_header(token))

    assert response.status_code == 200
    payload = response.json()
    assert payload["db_status"] == "degraded"
    assert "postgresql://" not in response.text


def test_platform_admin_campaigns_are_loaded_from_cross_client_backend_data(
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
    first_client = build_client_record(
        client_id="client_alpha",
        email="alpha@example.test",
        personal_name="Alpha",
    )
    second_client = build_client_record(
        client_id="client_beta",
        email="beta@example.test",
        personal_name="Beta",
    )
    install_test_dependencies(
        client_records=[first_client, second_client],
        admin_campaign_records=[
            build_admin_campaign_record(
                campaign_id="campaign_beta_running",
                client_id=second_client.id,
                client_name="Beta",
                client_email=second_client.email,
                name="Beta Running",
                status="running",
                subject="Operational send",
                updated_at=datetime(2026, 5, 9, 12, 0, tzinfo=timezone.utc),
                blocked_sends_count=2,
            ),
            build_admin_campaign_record(
                campaign_id="campaign_alpha_draft",
                client_id=first_client.id,
                client_name="Alpha",
                client_email=first_client.email,
                name="Alpha Draft",
                status="draft",
                subject=None,
                updated_at=datetime(2026, 5, 8, 12, 0, tzinfo=timezone.utc),
            ),
        ],
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.get("/admin/campaigns", headers=auth_header(token))

    assert response.status_code == 200
    payload = response.json()
    assert [item["id"] for item in payload] == [
        "campaign_beta_running",
        "campaign_alpha_draft",
    ]
    assert payload[0]["client_name"] == "Beta"
    assert payload[0]["client_email"] == "beta@example.test"
    assert payload[0]["blocked_sends_count"] == 2
    assert payload[1]["subject"] is None


def test_platform_admin_can_provision_client_access_with_clerk_native_email(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    monkeypatch.setenv("FRONTEND_URL", "https://app.sendwise.example.test/")
    get_settings.cache_clear()
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
    access_gateway = FakeClerkAccessGateway()
    _, access_repository, _, _ = install_test_dependencies(
        clerk_access_gateway=access_gateway,
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.post(
        "/admin/clients",
        headers=auth_header(token),
        json={
            "email": "Nuovo.Cliente@Example.Test",
            "first_name": "Giulia",
            "last_name": "Bianchi",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["client"]["email"] == "nuovo.cliente@example.test"
    assert payload["client"]["personal_name"] == "Giulia Bianchi"
    assert "company_name" not in payload["client"]
    assert payload["access"]["status"] == "active"
    assert payload["access"]["invitation_status"] == "pending"
    assert payload["access"]["clerk_invitation_id"] == "inv_access_1"
    assert payload["access"]["portal_slug"] is None
    assert access_gateway.invitation_calls == [
        {
            "email": "nuovo.cliente@example.test",
            "redirect_url": "https://app.sendwise.example.test/auth/redirect",
            "public_metadata": {
                "sendwise_first_name": "Giulia",
                "sendwise_last_name": "Bianchi",
            },
        }
    ]
    assert access_gateway.sign_in_token_calls == []
    assert "https://clerk.example.test" not in response.text
    assert "__clerk_ticket" not in response.text
    stored_access = access_repository.get_by_client_id(payload["client"]["id"])
    assert stored_access is not None
    assert len(stored_access.portal_slug) >= 32
    assert stored_access.portal_slug.isalnum()


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


def test_platform_admin_can_create_access_with_email_only(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    monkeypatch.setenv("FRONTEND_URL", "https://app.sendwise.example.test")
    get_settings.cache_clear()
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
    access_gateway = FakeClerkAccessGateway()
    client_repository, access_repository, _, _ = install_test_dependencies(
        clerk_access_gateway=access_gateway,
    )
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
    assert payload["client"]["name"] == "solo.email@example.test"
    assert "company_name" not in payload["client"]
    created_client = client_repository.get_by_id(payload["client"]["id"])
    created_access = access_repository.get_by_client_id(payload["client"]["id"])
    assert created_client is not None
    assert created_access is not None
    assert created_access.email == "solo.email@example.test"
    assert created_access.status == "active"
    assert created_access.invitation_status == "pending"
    assert access_gateway.invitation_calls == [
        {
            "email": "solo.email@example.test",
            "redirect_url": "https://app.sendwise.example.test/auth/redirect",
            "public_metadata": None,
        }
    ]
    assert "https://clerk.example.test" not in response.text
    assert "__clerk_ticket" not in response.text
    assert "password" not in created_client.model_dump()
    assert "password" not in created_access.model_dump()


def test_invite_context_returns_admin_provisioned_names_without_exposing_ticket(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CLERK_SECRET_KEY", "configured-secret")
    get_settings.cache_clear()

    def fake_get(*args: object, **kwargs: object) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "data": [
                    {
                        "id": "inv_access_1",
                        "url": "https://app.sendwise.example.test/auth/redirect?__clerk_ticket=ticket_123",
                        "public_metadata": {
                            "sendwise_first_name": "Giulia",
                            "sendwise_last_name": "Bianchi",
                        },
                    }
                ],
                "total_count": 1,
            },
        )

    monkeypatch.setattr("app.services.auth.httpx.get", fake_get)

    response = client.get("/auth/invite-context", params={"ticket": "ticket_123"})

    assert response.status_code == 200
    assert response.json() == {
        "first_name": "Giulia",
        "last_name": "Bianchi",
    }
    assert "__clerk_ticket" not in response.text


def test_invite_context_returns_null_names_when_metadata_is_missing(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CLERK_SECRET_KEY", "configured-secret")
    get_settings.cache_clear()

    def fake_get(*args: object, **kwargs: object) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "data": [
                    {
                        "id": "inv_access_1",
                        "url": "https://app.sendwise.example.test/auth/redirect?__clerk_ticket=ticket_123",
                        "public_metadata": {},
                    }
                ],
                "total_count": 1,
            },
        )

    monkeypatch.setattr("app.services.auth.httpx.get", fake_get)

    response = client.get("/auth/invite-context", params={"ticket": "ticket_123"})

    assert response.status_code == 200
    assert response.json() == {
        "first_name": None,
        "last_name": None,
    }


def test_clerk_invite_requires_configured_secret(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CLERK_SECRET_KEY", " ")
    get_settings.cache_clear()
    gateway = HttpClerkInvitationGateway(get_settings())

    with pytest.raises(HTTPException) as error:
        gateway.create_invitation(
            email="client@example.test",
            redirect_url="http://localhost:3000/auth/redirect",
        )

    assert error.value.status_code == 500
    assert error.value.detail == "CLERK_SECRET_KEY is required for client invitations."


def test_clerk_invite_failure_returns_controlled_backend_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CLERK_SECRET_KEY", "configured-secret")
    get_settings.cache_clear()

    def fake_post(*args: object, **kwargs: object) -> httpx.Response:
        return httpx.Response(401, json={"errors": [{"message": "bad secret"}]})

    monkeypatch.setattr("app.services.client_access.httpx.post", fake_post)
    gateway = HttpClerkInvitationGateway(get_settings())

    with pytest.raises(HTTPException) as error:
        gateway.create_invitation(
            email="client@example.test",
            redirect_url="http://localhost:3000/auth/redirect",
        )

    assert error.value.status_code == 502
    assert (
        error.value.detail
        == "Backend Clerk credentials are invalid for client invitations."
    )


def test_clients_service_invite_requires_absolute_frontend_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FRONTEND_URL", "/sendwise")
    get_settings.cache_clear()
    service = ClientsService(
        repository=FakeClientRepository(),
        settings=get_settings(),
        client_access_repository=FakeClientAccessRepository(),
        clerk_access_gateway=FakeClerkAccessGateway(),
    )

    with pytest.raises(HTTPException) as error:
        service.provision_client_access(
            email="client@example.test",
            first_name="Giulia",
            last_name="Bianchi",
        )

    assert error.value.status_code == 500
    assert error.value.detail == "FRONTEND_URL must be an absolute URL for client invitations."


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


def test_access_provisioning_reuses_fixed_portal_slug_on_resend(
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
    access_gateway = FakeClerkAccessGateway()
    client_repository, access_repository, _, _ = install_test_dependencies(
        client_records=[existing_client],
        access_records=[existing_access],
        clerk_access_gateway=access_gateway,
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
    first_stored_access = access_repository.get_by_client_id(existing_client.id)
    second_stored_access = access_repository.get_by_client_id(existing_client.id)
    assert first_stored_access is not None
    assert second_stored_access is not None
    first_slug = first_stored_access.portal_slug
    second_slug = second_stored_access.portal_slug
    assert first_response.json()["access"]["portal_slug"] is None
    assert second_response.json()["access"]["portal_slug"] is None
    assert first_slug == "z" * 32
    assert second_slug == first_slug
    assert len(access_gateway.invitation_calls) == 2
    updated_access = access_repository.get_by_client_id(existing_client.id)
    assert updated_access is not None
    assert updated_access.portal_slug == first_slug
    assert updated_access.status == "active"
    assert updated_access.invitation_status == "pending"
    assert [record.id for record in client_repository.list_clients()] == [
        existing_client.id
    ]


def test_platform_admin_provisioning_returns_controlled_clerk_failure_code(
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
    access_gateway = FailingClerkAccessGateway()
    install_test_dependencies(
        clerk_access_gateway=access_gateway,
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.post(
        "/admin/clients",
        headers=auth_header(token),
        json={"email": "nuovo.cliente@example.test"},
    )

    assert response.status_code == 502
    assert response.json()["detail"] == build_client_access_error_detail(
        "client_access_clerk_email_failed"
    )
    assert "https://clerk.example.test" not in response.text


def test_platform_admin_provisioning_returns_controlled_clerk_config_missing_code(
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
    monkeypatch.setenv("CLERK_SECRET_KEY", "")
    get_settings.cache_clear()
    install_test_dependencies(
        clerk_access_gateway=HttpClerkAccessGateway(get_settings()),
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.post(
        "/admin/clients",
        headers=auth_header(token),
        json={"email": "nuovo.cliente@example.test"},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == build_client_access_error_detail(
        "client_access_clerk_config_missing"
    )
    assert "invitations" not in response.text


def test_platform_admin_provisioning_returns_controlled_clerk_email_failure_code_and_keeps_access_pending(
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
    _, access_repository, _, _ = install_test_dependencies(
        clerk_access_gateway=FailingClerkAccessGateway(),
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.post(
        "/admin/clients",
        headers=auth_header(token),
        json={"email": "nuovo.cliente@example.test"},
    )

    assert response.status_code == 502
    assert response.json()["detail"] == build_client_access_error_detail(
        "client_access_clerk_email_failed"
    )
    assert "https://clerk.example.test" not in response.text
    stored_access = access_repository.get_by_email("nuovo.cliente@example.test")
    assert stored_access is None


def test_platform_admin_provisioning_rejects_invalid_email_with_controlled_code(
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
        json={"email": "not-an-email"},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == build_client_access_error_detail(
        "client_access_email_invalid"
    )


def test_platform_admin_provisioning_rejects_existing_active_access_conflict_with_controlled_code(
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
    existing_client = build_client_record(
        client_id="client_existing",
        email="shared@example.test",
    )
    other_client = build_client_record(
        client_id="client_other",
        email="other@example.test",
    )
    install_test_dependencies(
        client_records=[existing_client, other_client],
        access_records=[
            build_access_record(
                client_id=other_client.id,
                email="shared@example.test",
                status="active",
                invitation_status="accepted",
            )
        ],
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    conflict_response = client.post(
        "/admin/clients",
        headers=auth_header(token),
        json={"email": "shared@example.test"},
    )

    assert conflict_response.status_code == 409
    assert (
        conflict_response.json()["detail"]
        == build_client_access_error_detail("client_access_existing_user_conflict")
    )


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
    client_repository, _, _, _ = install_test_dependencies(
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


def test_platform_admin_email_limits_are_cross_client_and_persist_updates(
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
    first_client = build_client_record(
        client_id="client_alpha",
        email="alpha@example.test",
        personal_name="Alpha",
        email_limit_per_campaign=1500,
        max_campaigns=3,
    )
    second_client = build_client_record(
        client_id="client_beta",
        email="beta@example.test",
        personal_name="Beta",
    )
    install_test_dependencies(
        client_records=[first_client, second_client],
        access_records=[
            build_access_record(client_id=first_client.id, email=first_client.email),
            build_access_record(
                access_id="access_beta",
                client_id=second_client.id,
                email=second_client.email,
                clerk_user_id=None,
                status="invited",
                invitation_status="pending",
            ),
        ],
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    list_before_response = client.get("/admin/email-limits", headers=auth_header(token))
    update_response = client.patch(
        f"/admin/clients/{second_client.id}",
        headers=auth_header(token),
        json={"email_limit_per_campaign": 4200, "max_campaigns": 7},
    )
    list_after_response = client.get("/admin/email-limits", headers=auth_header(token))

    assert list_before_response.status_code == 200
    before_payload = list_before_response.json()
    assert before_payload["summary"] == {
        "total_clients": 2,
        "configured_clients": 1,
        "unconfigured_clients": 1,
    }
    alpha_before = next(
        row for row in before_payload["rows"] if row["client_id"] == first_client.id
    )
    beta_before = next(
        row for row in before_payload["rows"] if row["client_id"] == second_client.id
    )
    assert alpha_before["email_limit_per_campaign"] == 1500
    assert beta_before["email_limit_per_campaign"] is None

    assert update_response.status_code == 200
    assert list_after_response.status_code == 200
    after_payload = list_after_response.json()
    beta_row = next(
        row for row in after_payload["rows"] if row["client_id"] == second_client.id
    )
    assert beta_row["client_name"] == "Beta"
    assert beta_row["access_status"] == "invited"
    assert beta_row["email_limit_per_campaign"] == 4200
    assert beta_row["max_campaigns"] == 7
    assert after_payload["summary"] == {
        "total_clients": 2,
        "configured_clients": 2,
        "unconfigured_clients": 0,
    }


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


def test_platform_admin_can_read_and_update_client_email_brand(
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
        metadata={
            "email_brand": {
                "company_name": "Original Brand",
                "sender_name": "Original Team",
                "logo_url": "/static/client-brand-logos/original.webp",
            }
        }
    )
    install_test_dependencies(
        client_records=[client_record],
        access_records=[build_access_record(client_id=client_record.id)],
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    detail_response = client.get(
        f"/admin/clients/{client_record.id}",
        headers=auth_header(token),
    )
    update_response = client.patch(
        f"/admin/clients/{client_record.id}",
        headers=auth_header(token),
        json={
            "email_brand": {
                "company_name": "Updated Brand",
                "sender_name": "Team Updated",
                "website_url": "https://brand.example.test",
                "linkedin_url": "https://linkedin.com/company/brand-updated",
                "logo_url": "/static/client-brand-logos/original.webp",
            }
        },
    )

    assert detail_response.status_code == 200
    assert detail_response.json()["email_brand"]["company_name"] == "Original Brand"
    assert update_response.status_code == 200
    assert update_response.json()["email_brand"]["company_name"] == "Updated Brand"
    assert update_response.json()["email_brand"]["sender_name"] == "Team Updated"
    assert (
        update_response.json()["email_brand"]["website_url"]
        == "https://brand.example.test/"
    )
    assert (
        update_response.json()["email_brand"]["linkedin_url"]
        == "https://linkedin.com/company/brand-updated"
    )
    assert (
        update_response.json()["email_brand"]["logo_url"]
        == "/static/client-brand-logos/original.webp"
    )


def test_platform_admin_brand_update_rejects_invalid_url(
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
        json={"email_brand": {"website_url": "notaurl"}},
    )

    assert response.status_code == 422


def test_platform_admin_brand_update_allows_optional_empty_fields(
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
        metadata={
            "email_brand": {
                "company_name": "Original Brand",
                "sender_name": "Original Team",
                "logo_url": "/static/client-brand-logos/original.webp",
            }
        }
    )
    install_test_dependencies(
        client_records=[client_record],
        access_records=[build_access_record(client_id=client_record.id)],
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.patch(
        f"/admin/clients/{client_record.id}",
        headers=auth_header(token),
        json={
            "email_brand": {
                "company_name": "Updated Brand",
                "sender_name": "",
                "website_url": "",
                "logo_url": "/static/client-brand-logos/original.webp",
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["email_brand"]["company_name"] == "Updated Brand"
    assert response.json()["email_brand"]["logo_url"] == "/static/client-brand-logos/original.webp"
    assert response.json()["email_brand"]["sender_name"] is None
    assert response.json()["email_brand"]["website_url"] is None


def test_platform_admin_brand_update_rejects_absolute_logo_url_with_field_error(
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
        json={
            "email_brand": {
                "logo_url": "https://admin.sendwise.test/static/client-brand-logos/original.webp"
            }
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"] == ["body", "email_brand", "logo_url"]
    assert (
        response.json()["detail"][0]["msg"]
        == "Value error, logo_url must point to the managed client brand logo path."
    )


def test_platform_admin_can_upload_valid_client_brand_logo(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
    tmp_path: Path,
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
    monkeypatch.setattr("app.services.clients.CLIENT_BRAND_LOGO_UPLOAD_DIR", tmp_path)
    client_record = build_client_record()
    install_test_dependencies(
        client_records=[client_record],
        access_records=[build_access_record(client_id=client_record.id)],
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.post(
        f"/admin/clients/{client_record.id}/brand/logo",
        headers={
            **auth_header(token),
            "Content-Type": "application/octet-stream",
            "X-Upload-Filename": "friendly-name.webp",
        },
        content=build_webp_bytes(),
    )

    assert response.status_code == 200
    logo_url = response.json()["email_brand"]["logo_url"]
    expected_filename = build_client_brand_logo_filename(client_record.id)
    assert logo_url == f"{CLIENT_BRAND_LOGO_PUBLIC_PREFIX}/{expected_filename}"
    assert "friendly-name" not in logo_url
    assert (tmp_path / expected_filename).read_bytes().startswith(b"RIFF")


def test_platform_admin_brand_logo_rejects_non_webp_magic(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
    tmp_path: Path,
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
    monkeypatch.setattr("app.services.clients.CLIENT_BRAND_LOGO_UPLOAD_DIR", tmp_path)
    client_record = build_client_record()
    install_test_dependencies(
        client_records=[client_record],
        access_records=[build_access_record(client_id=client_record.id)],
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.post(
        f"/admin/clients/{client_record.id}/brand/logo",
        headers={
            **auth_header(token),
            "Content-Type": "application/octet-stream",
            "X-Upload-Filename": "logo.webp",
        },
        content=b"not-a-webp",
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Brand logo upload is not a valid WebP file."


def test_platform_admin_brand_logo_rejects_non_webp_extension(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
    tmp_path: Path,
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
    monkeypatch.setattr("app.services.clients.CLIENT_BRAND_LOGO_UPLOAD_DIR", tmp_path)
    client_record = build_client_record()
    install_test_dependencies(
        client_records=[client_record],
        access_records=[build_access_record(client_id=client_record.id)],
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.post(
        f"/admin/clients/{client_record.id}/brand/logo",
        headers={
            **auth_header(token),
            "Content-Type": "application/octet-stream",
            "X-Upload-Filename": "logo.png",
        },
        content=build_webp_bytes(),
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Brand logo upload accepts only .webp files."


def test_platform_admin_brand_logo_rejects_oversized_payload(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    signing_keypair: rsa.RSAPrivateKey,
    tmp_path: Path,
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
    monkeypatch.setattr("app.services.clients.CLIENT_BRAND_LOGO_UPLOAD_DIR", tmp_path)
    client_record = build_client_record()
    install_test_dependencies(
        client_records=[client_record],
        access_records=[build_access_record(client_id=client_record.id)],
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin")
    oversized_payload = build_webp_bytes(b"x" * (500 * 1024))

    response = client.post(
        f"/admin/clients/{client_record.id}/brand/logo",
        headers={
            **auth_header(token),
            "Content-Type": "application/octet-stream",
            "X-Upload-Filename": "logo.webp",
        },
        content=oversized_payload,
    )

    assert response.status_code == 413
    assert response.json()["detail"] == "Brand logo upload exceeds the 500 KB limit."


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


def test_platform_admin_limit_update_rejects_negative_values(
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
        json={"email_limit_per_campaign": -1, "max_campaigns": -2},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == (
        "email_limit_per_campaign must be greater than or equal to zero."
    )


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
    _, access_repository, _, _ = install_test_dependencies(
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
    client_repository, access_repository, _, _ = install_test_dependencies(
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


def test_resend_access_email_endpoint_preserves_portal_slug(
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
    access_gateway = FakeClerkAccessGateway()
    _, access_repository, _, _ = install_test_dependencies(
        client_records=[existing_client],
        access_records=[existing_access],
        clerk_access_gateway=access_gateway,
    )
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.post(
        f"/admin/clients/{existing_client.id}/send-access-email",
        headers=auth_header(token),
    )

    assert response.status_code == 200
    assert response.json()["access"]["portal_slug"] is None
    assert response.json()["access"]["status"] == "active"
    assert response.json()["access"]["invitation_status"] == "pending"
    stored_access = access_repository.get_by_client_id(existing_client.id)
    assert stored_access is not None
    assert stored_access.portal_slug == "y" * 32
    assert access_gateway.invitation_calls == [
        {
            "email": "client@example.test",
            "redirect_url": "http://localhost:3000/auth/redirect",
            "public_metadata": {
                "sendwise_first_name": "Mario",
            },
        }
    ]


def test_client_delete_account_requires_strong_confirmation(
    client: TestClient,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    client_record = build_client_record()
    access_record = build_access_record(client_id=client_record.id, email=client_record.email)
    client_repository, access_repository, _, deletion_gateway = install_test_dependencies(
        client_records=[client_record],
        access_records=[access_record],
    )
    token = make_token(
        signing_keypair,
        clerk_user_id="user_client",
        email=client_record.email,
    )

    response = client.post(
        "/auth/delete-account",
        headers=auth_header(token),
        json={"confirmation_text": "annulla"},
    )

    assert response.status_code == 422
    assert client_repository.get_by_id(client_record.id) is not None
    assert access_repository.get_by_client_id(client_record.id) is not None
    assert deletion_gateway.deleted_user_ids == []


def test_active_client_can_delete_account_permanently(
    client: TestClient,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    client_record = build_client_record()
    access_record = build_access_record(client_id=client_record.id, email=client_record.email)
    client_repository, access_repository, _, deletion_gateway = install_test_dependencies(
        client_records=[client_record],
        access_records=[access_record],
    )
    token = make_token(
        signing_keypair,
        clerk_user_id="user_client",
        email=client_record.email,
    )

    delete_response = client.post(
        "/auth/delete-account",
        headers=auth_header(token),
        json={"confirmation_text": "ELIMINA"},
    )
    auth_me_response = client.get("/auth/me", headers=auth_header(token))

    assert delete_response.status_code == 200
    assert delete_response.json() == {
        "deleted": True,
        "redirect_to": "/",
    }
    assert deletion_gateway.deleted_user_ids == ["user_client"]
    assert client_repository.get_by_id(client_record.id) is None
    assert access_repository.get_by_client_id(client_record.id) is None
    assert client_repository.deleted_client_ids == [client_record.id]
    assert auth_me_response.status_code == 403


def test_platform_admin_cannot_self_delete_from_account_endpoint(
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
    _, _, _, deletion_gateway = install_test_dependencies()
    token = make_token(signing_keypair, clerk_user_id="user_admin")

    response = client.post(
        "/auth/delete-account",
        headers=auth_header(token),
        json={"confirmation_text": "ELIMINA"},
    )

    assert response.status_code == 403
    assert deletion_gateway.deleted_user_ids == []


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


def test_client_dashboard_endpoints_are_backend_owned_and_client_scoped(
    client: TestClient,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    client_record = build_client_record(
        client_id="client_alpha",
        email="alpha@example.test",
        personal_name="Alpha",
        email_limit_per_campaign=1500,
        max_campaigns=4,
    )
    install_test_dependencies(
        client_records=[
            client_record,
            build_client_record(
                client_id="client_beta",
                email="beta@example.test",
                personal_name="Beta",
            ),
        ],
        access_records=[
            build_access_record(
                client_id=client_record.id,
                email=client_record.email,
                portal_slug="a" * 32,
            ),
            build_access_record(
                access_id="access_beta",
                client_id="client_beta",
                email="beta@example.test",
                clerk_user_id="user_beta",
                portal_slug="b" * 32,
            ),
        ],
        client_campaign_records=[
            build_client_campaign_record(
                campaign_id="campaign_alpha_running",
                client_id=client_record.id,
                name="Alpha Running",
                status="running",
                subject="Alpha Subject",
                updated_at=datetime(2026, 5, 9, 10, 0, tzinfo=timezone.utc),
            ),
            build_client_campaign_record(
                campaign_id="campaign_alpha_draft",
                client_id=client_record.id,
                name="Alpha Draft",
                status="draft",
                subject="Draft Subject",
                updated_at=datetime(2026, 5, 8, 10, 0, tzinfo=timezone.utc),
            ),
            build_client_campaign_record(
                campaign_id="campaign_beta_only",
                client_id="client_beta",
                name="Beta Only",
                status="ready",
                subject="Beta Subject",
                updated_at=datetime(2026, 5, 10, 10, 0, tzinfo=timezone.utc),
            ),
        ],
        client_usage_records=[
            build_client_usage_record(
                usage_id="usage_alpha_api",
                client_id=client_record.id,
                usage_type="api_requests",
                quantity=42,
                metadata={"period": "2026-05"},
                created_at=datetime(2026, 5, 10, 9, 0, tzinfo=timezone.utc),
            ),
            build_client_usage_record(
                usage_id="usage_alpha_dry_run",
                client_id=client_record.id,
                usage_type="dry_run_sends",
                quantity=3,
                metadata={"period": "2026-05"},
                created_at=datetime(2026, 5, 9, 9, 0, tzinfo=timezone.utc),
            ),
            build_client_usage_record(
                usage_id="usage_beta_only",
                client_id="client_beta",
                usage_type="api_requests",
                quantity=99,
                metadata={"period": "2026-05"},
                created_at=datetime(2026, 5, 8, 9, 0, tzinfo=timezone.utc),
            ),
        ],
        client_blocked_send_records=[
            build_client_blocked_send_record(
                blocked_send_id="blocked_alpha_recent",
                client_id=client_record.id,
                campaign_id="campaign_alpha_draft",
                campaign_name="Alpha Draft",
                reason="Campaign is still draft.",
                created_at=datetime(2026, 5, 10, 11, 0, tzinfo=timezone.utc),
            ),
            build_client_blocked_send_record(
                blocked_send_id="blocked_beta_only",
                client_id="client_beta",
                campaign_id="campaign_beta_only",
                campaign_name="Beta Only",
                reason="Other client blocked send.",
                created_at=datetime(2026, 5, 8, 11, 0, tzinfo=timezone.utc),
            ),
        ],
    )
    token = make_token(signing_keypair, clerk_user_id="user_client")

    overview_response = client.get("/client/overview", headers=auth_header(token))
    campaigns_response = client.get("/client/campaigns", headers=auth_header(token))
    usage_response = client.get("/client/usage", headers=auth_header(token))
    blocked_sends_response = client.get(
        "/client/blocked-sends", headers=auth_header(token)
    )

    assert overview_response.status_code == 200
    overview = overview_response.json()
    assert overview["client"] == {
        "id": client_record.id,
        "name": "Alpha",
        "email": "alpha@example.test",
        "portal_slug": "a" * 32,
        "client_status": "active",
        "access_status": "active",
        "invitation_status": "accepted",
    }
    assert overview["limits"] == {
        "email_limit_per_campaign": 1500,
        "max_campaigns": 4,
    }
    assert overview["campaigns"]["total_campaigns"] == 2
    assert overview["campaigns"]["active_campaigns"] == 1
    assert overview["campaigns"]["running_campaigns"] == 1
    assert overview["campaigns"]["status_counts"]["running"] == 1
    assert overview["campaigns"]["status_counts"]["draft"] == 1
    assert [campaign["id"] for campaign in overview["campaigns"]["recent_campaigns"]] == [
        "campaign_alpha_running",
        "campaign_alpha_draft",
    ]
    assert overview["usage"]["has_data"] is True
    assert overview["usage"]["total_records"] == 2
    assert overview["usage"]["current_period_totals"] == [
        {"usage_type": "api_requests", "total_quantity": 42},
        {"usage_type": "dry_run_sends", "total_quantity": 3},
    ]
    assert [entry["id"] for entry in overview["usage"]["recent_usage"]] == [
        "usage_alpha_api",
        "usage_alpha_dry_run",
    ]
    assert overview["blocked_sends"]["current_period_count"] == 1
    assert overview["blocked_sends"]["recent_blocked_sends"][0]["campaign_name"] == "Alpha Draft"

    assert campaigns_response.status_code == 200
    campaigns = campaigns_response.json()
    assert [campaign["id"] for campaign in campaigns] == [
        "campaign_alpha_running",
        "campaign_alpha_draft",
    ]
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
    assert [entry["id"] for entry in usage] == [
        "usage_alpha_api",
        "usage_alpha_dry_run",
    ]
    assert {"id", "client_id", "usage_type", "quantity", "metadata", "created_at"} <= usage[0].keys()

    assert blocked_sends_response.status_code == 200
    blocked_sends = blocked_sends_response.json()
    assert [entry["id"] for entry in blocked_sends] == ["blocked_alpha_recent"]
    assert {
        "id",
        "client_id",
        "campaign_id",
        "campaign_name",
        "reason",
        "decision",
        "created_at",
    } <= blocked_sends[0].keys()


def test_client_overview_exposes_backend_backed_dashboard_analytics(
    client: TestClient,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    now = datetime.now(timezone.utc)
    client_record = build_client_record(
        client_id="client_alpha",
        email="alpha@example.test",
        personal_name="Mario Rossi",
        max_campaigns=4,
        daily_email_limit=50,
    )
    beta_record = build_client_record(
        client_id="client_beta",
        email="beta@example.test",
        personal_name="Beta",
    )
    campaign_records = [
        build_client_campaign_record(
            campaign_id="campaign_running",
            client_id=client_record.id,
            name="Running",
            status="running",
            subject="Running",
        ),
        build_client_campaign_record(
            campaign_id="campaign_ready",
            client_id=client_record.id,
            name="Ready",
            status="ready",
            subject="Ready",
        ),
        build_client_campaign_record(
            campaign_id="campaign_paused",
            client_id=client_record.id,
            name="Paused",
            status="paused",
            subject="Paused",
        ),
        build_client_campaign_record(
            campaign_id="campaign_failed",
            client_id=client_record.id,
            name="Failed",
            status="failed",
            subject="Failed",
        ),
        build_client_campaign_record(
            campaign_id="campaign_beta",
            client_id=beta_record.id,
            name="Beta only",
            status="running",
            subject="Beta",
        ),
    ]
    email_log_repository = InMemoryEmailLogRepository()
    created_logs = [
        email_log_repository.create_email_log(
            client_id=client_record.id,
            campaign_id="campaign_running",
            contact_id="contact_a",
            status="queued",
        ),
        email_log_repository.create_email_log(
            client_id=client_record.id,
            campaign_id="campaign_ready",
            contact_id="contact_b",
            status="sent",
        ),
        email_log_repository.create_email_log(
            client_id=client_record.id,
            campaign_id="campaign_paused",
            contact_id="contact_c",
            status="simulated",
        ),
        email_log_repository.create_email_log(
            client_id=client_record.id,
            campaign_id="campaign_running",
            contact_id="contact_d",
            status="sent",
        ),
        email_log_repository.create_email_log(
            client_id=client_record.id,
            campaign_id="campaign_ready",
            contact_id="contact_e",
            status="queued",
        ),
        email_log_repository.create_email_log(
            client_id=beta_record.id,
            campaign_id="campaign_beta",
            contact_id="contact_beta",
            status="sent",
        ),
    ]
    retimed_logs = [
        created_logs[0].model_copy(update={"created_at": now - timedelta(hours=6)}),
        created_logs[1].model_copy(update={"created_at": now - timedelta(days=3)}),
        created_logs[2].model_copy(update={"created_at": now - timedelta(days=2)}),
        created_logs[3].model_copy(update={"created_at": now - timedelta(days=10)}),
        created_logs[4].model_copy(update={"created_at": now - timedelta(days=20)}),
        created_logs[5].model_copy(update={"created_at": now - timedelta(days=1)}),
    ]
    email_log_repository._records = retimed_logs

    provider_event_repository = InMemoryProviderEventRepository()
    for index, occurred_at in enumerate(
        [now - timedelta(days=2), now - timedelta(days=16), now - timedelta(days=1)],
        start=1,
    ):
        client_id = client_record.id if index < 3 else beta_record.id
        campaign_id = "campaign_running" if index == 1 else ("campaign_ready" if index == 2 else "campaign_beta")
        email_log_id = retimed_logs[index - 1].id if index < 3 else retimed_logs[5].id
        event, _ = provider_event_repository.create_or_get_event(
            client_id=client_id,
            campaign_id=campaign_id,
            contact_id=f"contact_event_{index}",
            email_log_id=email_log_id,
            provider="mailgun",
            source="webhook",
            provider_event_id=f"evt_{index}",
            event_key=f"mailgun_opened_{index}",
            event_type="opened",
            payload={"type": "open"},
            occurred_at=occurred_at,
        )
        provider_event_repository.mark_processed(
            event_id=event.id,
            processed_at=occurred_at + timedelta(minutes=5),
        )

    blocked_send_repository = InMemoryBlockedSendRepository()
    recent_block = blocked_send_repository.create_blocked_send(
        client_id=client_record.id,
        campaign_id="campaign_paused",
        contact_id="contact_blocked_1",
        reason="Blocked recently.",
        decision="blocked",
    )
    older_block = blocked_send_repository.create_blocked_send(
        client_id=client_record.id,
        campaign_id="campaign_failed",
        contact_id="contact_blocked_2",
        reason="Blocked earlier.",
        decision="blocked",
    )
    beta_block = blocked_send_repository.create_blocked_send(
        client_id=beta_record.id,
        campaign_id="campaign_beta",
        contact_id="contact_blocked_beta",
        reason="Other client blocked.",
        decision="blocked",
    )
    blocked_send_repository._records = [
        recent_block.model_copy(update={"created_at": now - timedelta(hours=12)}),
        older_block.model_copy(update={"created_at": now - timedelta(days=9)}),
        beta_block.model_copy(update={"created_at": now - timedelta(days=1)}),
    ]

    install_test_dependencies(
        client_records=[client_record, beta_record],
        access_records=[
            build_access_record(
                client_id=client_record.id,
                email=client_record.email,
                portal_slug="a" * 32,
            ),
            build_access_record(
                access_id="access_beta",
                client_id=beta_record.id,
                email=beta_record.email,
                clerk_user_id="user_beta",
                portal_slug="b" * 32,
            ),
        ],
        client_campaign_records=campaign_records,
        blocked_send_repository=blocked_send_repository,
        email_log_repository=email_log_repository,
        provider_event_repository=provider_event_repository,
    )
    token = make_token(signing_keypair, clerk_user_id="user_client")

    response = client.get("/client/overview", headers=auth_header(token))

    assert response.status_code == 200
    payload = response.json()
    dashboard = payload["client_dashboard"]
    assert payload["campaigns"]["active_campaigns"] == 1
    assert dashboard["greeting_name"] == "Mario"
    assert dashboard["cta"] == {"campaigns_href": f"/c/{'a' * 32}/campaigns"}
    assert dashboard["kpis"]["active_campaigns"] == {
        "value": 1,
        "limit": 4,
        "available": True,
    }
    assert dashboard["kpis"]["sent_last_7d"] == {
        "value": 1,
        "limit": None,
        "available": True,
    }
    assert dashboard["kpis"]["delivered_last_7d"] == {
        "value": 0,
        "limit": None,
        "available": True,
    }
    assert dashboard["kpis"]["opened_last_7d"] == {
        "value": 1,
        "limit": None,
        "available": True,
    }
    assert dashboard["kpis"]["clicked_last_7d"] == {
        "value": 0,
        "limit": None,
        "available": True,
    }
    assert dashboard["performance_analytics"]["default_window"] == "7d"
    assert dashboard["performance_analytics"]["windows"]["24h"]["sent"] == 0
    assert dashboard["performance_analytics"]["windows"]["24h"]["failed"] == 0
    assert dashboard["performance_analytics"]["windows"]["24h"]["opened"] is None
    assert dashboard["performance_analytics"]["windows"]["24h"]["opened_available"] is False
    assert dashboard["performance_analytics"]["windows"]["7d"]["sent"] == 1
    assert dashboard["performance_analytics"]["windows"]["7d"]["failed"] == 0
    assert dashboard["performance_analytics"]["windows"]["7d"]["delivered"] == 0
    assert dashboard["performance_analytics"]["windows"]["7d"]["opened"] == 1
    assert dashboard["performance_analytics"]["windows"]["7d"]["clicked"] == 0
    assert dashboard["performance_analytics"]["windows"]["14d"]["sent"] == 2
    assert dashboard["performance_analytics"]["windows"]["14d"]["failed"] == 0
    assert dashboard["performance_analytics"]["windows"]["30d"]["sent"] == 2
    assert dashboard["performance_analytics"]["windows"]["30d"]["failed"] == 0
    assert dashboard["performance_analytics"]["windows"]["30d"]["opened"] == 2
    assert dashboard["performance_analytics"]["windows"]["allTime"]["sent"] == 2
    assert dashboard["performance_analytics"]["windows"]["allTime"]["failed"] == 0
    assert dashboard["actions_required"]["campaigns_to_complete"] == 1
    assert dashboard["actions_required"]["blocked_sends_to_review"] == 1
    assert dashboard["actions_required"]["provider_events_issues"] is None
    assert dashboard["actions_required"]["items"] == [
        {"label": "Campagne da completare", "count": 1, "severity": "warning"},
        {"label": "Blocchi da verificare", "count": 1, "severity": "danger"},
    ]
    assert dashboard["status_summary"] == {
        "total_campaigns": 4,
        "running": 1,
        "ready": 1,
        "to_complete": 1,
        "blocked": 1,
        "completed": 0,
    }
    assert dashboard["period_usage"] == {
        "has_real_usage": True,
        "sent": 1,
        "failed": 0,
        "delivered": 0,
        "opened": 1,
        "clicked": 0,
    }
    assert "daily_email_limit" not in dashboard


def test_client_overview_marks_missing_metric_sources_as_unavailable(
    client: TestClient,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    client_record = build_client_record(
        client_id="client_alpha",
        email="alpha@example.test",
        personal_name="Alpha",
    )
    install_test_dependencies(
        client_records=[client_record],
        access_records=[
            build_access_record(
                client_id=client_record.id,
                email=client_record.email,
                portal_slug="a" * 32,
            )
        ],
        client_campaign_records=[
            build_client_campaign_record(
                campaign_id="campaign_ready",
                client_id=client_record.id,
                name="Ready",
                status="ready",
                subject="Ready",
            )
        ],
        blocked_send_repository=None,
        email_log_repository=None,
        include_provider_event_repository=False,
    )
    token = make_token(signing_keypair, clerk_user_id="user_client")

    response = client.get("/client/overview", headers=auth_header(token))

    assert response.status_code == 200
    dashboard = response.json()["client_dashboard"]
    assert dashboard["kpis"]["sent_last_7d"] == {
        "value": None,
        "limit": None,
        "available": False,
    }
    assert dashboard["kpis"]["opened_last_7d"] == {
        "value": None,
        "limit": None,
        "available": False,
    }
    assert dashboard["kpis"]["delivered_last_7d"] == {
        "value": None,
        "limit": None,
        "available": False,
    }
    assert dashboard["kpis"]["clicked_last_7d"] == {
        "value": None,
        "limit": None,
        "available": False,
    }
    assert dashboard["performance_analytics"]["windows"]["7d"] == {
        "sent": None,
        "failed": None,
        "delivered": None,
        "opened": None,
        "clicked": None,
        "sent_available": False,
        "failed_available": False,
        "delivered_available": False,
        "opened_available": False,
        "clicked_available": False,
        "delivery_rate": None,
        "open_rate": None,
        "click_rate": None,
        "delivery_rate_available": False,
        "open_rate_available": False,
        "click_rate_available": False,
        "window_started_at": dashboard["performance_analytics"]["windows"]["7d"]["window_started_at"],
        "window_ended_at": dashboard["performance_analytics"]["windows"]["7d"]["window_ended_at"],
    }
    assert dashboard["period_usage"] == {
        "has_real_usage": False,
        "sent": None,
        "failed": None,
        "delivered": None,
        "opened": None,
        "clicked": None,
    }


def test_client_overview_keeps_zero_real_rows_available_when_sources_exist(
    client: TestClient,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    client_record = build_client_record(
        client_id="client_alpha",
        email="alpha@example.test",
        personal_name="Alpha",
    )
    install_test_dependencies(
        client_records=[client_record],
        access_records=[
            build_access_record(
                client_id=client_record.id,
                email=client_record.email,
                portal_slug="a" * 32,
            )
        ],
        client_campaign_records=[
            build_client_campaign_record(
                campaign_id="campaign_running",
                client_id=client_record.id,
                name="Running",
                status="running",
                subject="Running",
            )
        ],
        blocked_send_repository=InMemoryBlockedSendRepository(),
        email_log_repository=InMemoryEmailLogRepository(),
        provider_event_repository=InMemoryProviderEventRepository(),
    )
    token = make_token(signing_keypair, clerk_user_id="user_client")

    response = client.get("/client/overview", headers=auth_header(token))

    assert response.status_code == 200
    dashboard = response.json()["client_dashboard"]
    assert dashboard["kpis"]["sent_last_7d"] == {
        "value": 0,
        "limit": None,
        "available": True,
    }
    assert dashboard["kpis"]["opened_last_7d"] == {
        "value": None,
        "limit": None,
        "available": False,
    }
    assert dashboard["performance_analytics"]["windows"]["7d"]["failed"] == 0
    assert dashboard["performance_analytics"]["windows"]["7d"]["failed_available"] is True
    assert dashboard["performance_analytics"]["windows"]["7d"]["opened"] is None
    assert dashboard["performance_analytics"]["windows"]["7d"]["opened_available"] is False


def test_client_campaign_detail_is_scoped_to_authenticated_client(
    client: TestClient,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    client_record = build_client_record(
        client_id="client_alpha",
        email="alpha@example.test",
        personal_name="Alpha",
        email_limit_per_campaign=1500,
    )
    beta_record = build_client_record(
        client_id="client_beta",
        email="beta@example.test",
        personal_name="Beta",
    )
    campaign_repository = InMemoryCampaignRepository()
    campaign_repository.add_campaign(
        campaign_id="campaign_alpha",
        client_id=client_record.id,
        name="Alpha Campaign",
        status="ready",
        subject="Alpha Subject",
        preview_text="Alpha Preview",
        body_html="<p>Hello</p>",
        body_text="Hello",
        content_ready=True,
        contacts_ready=True,
        review_ready=False,
        current_step="review",
        campaign_slot_id="slot_alpha",
    )
    campaign_repository.add_campaign(
        campaign_id="campaign_beta",
        client_id=beta_record.id,
        name="Beta Campaign",
        status="ready",
        subject="Beta Subject",
    )
    campaign_slot_repository = InMemoryCampaignSlotRepository()
    campaign_slot_repository.add_slot(
        slot_id="slot_alpha",
        client_id=client_record.id,
        label="Starter",
        max_emails=250,
        status="assigned",
        assigned_campaign_id="campaign_alpha",
    )
    contact_repository = InMemoryContactRepository()
    contact_repository.add_contact(
        contact_id="contact_alpha_ok",
        client_id=client_record.id,
        email="one@example.test",
        status="sendable",
    )
    contact_repository.add_contact(
        contact_id="contact_alpha_invalid",
        client_id=client_record.id,
        email="invalid-email",
        status="sendable",
    )
    contact_repository.add_contact(
        contact_id="contact_beta",
        client_id=beta_record.id,
        email="beta@example.test",
        status="sendable",
    )
    contact_repository.attach_contact_to_campaign(
        client_id=client_record.id,
        campaign_id="campaign_alpha",
        contact_id="contact_alpha_ok",
    )
    contact_repository.attach_contact_to_campaign(
        client_id=client_record.id,
        campaign_id="campaign_alpha",
        contact_id="contact_alpha_invalid",
    )
    contact_repository.attach_contact_to_campaign(
        client_id=beta_record.id,
        campaign_id="campaign_beta",
        contact_id="contact_beta",
    )
    email_log_repository = InMemoryEmailLogRepository()
    email_log_repository.create_email_log(
        client_id=client_record.id,
        campaign_id="campaign_alpha",
        contact_id="contact_alpha_ok",
        status="simulated",
    )
    email_log_repository.create_email_log(
        client_id=client_record.id,
        campaign_id="campaign_alpha",
        contact_id="contact_alpha_ok",
        status="queued",
    )
    blocked_send_repository = InMemoryBlockedSendRepository()
    blocked_send_repository.create_blocked_send(
        client_id=client_record.id,
        campaign_id="campaign_alpha",
        contact_id="contact_alpha_invalid",
        reason="Campaign contains non-sendable contacts and partial dispatch is not supported.",
        decision="blocked",
    )
    install_test_dependencies(
        client_records=[client_record, beta_record],
        access_records=[
            build_access_record(
                client_id=client_record.id,
                email=client_record.email,
                portal_slug="a" * 32,
            ),
            build_access_record(
                access_id="access_beta",
                client_id=beta_record.id,
                email=beta_record.email,
                clerk_user_id="user_beta",
                portal_slug="b" * 32,
            ),
        ],
        campaign_repository=campaign_repository,
        campaign_slot_repository=campaign_slot_repository,
        contact_repository=contact_repository,
        suppression_list_repository=InMemorySuppressionListRepository(),
        blocked_send_repository=blocked_send_repository,
        email_log_repository=email_log_repository,
    )
    token = make_token(signing_keypair, clerk_user_id="user_client")

    response = client.get("/client/campaigns/campaign_alpha", headers=auth_header(token))

    assert response.status_code == 200
    payload = response.json()
    assert payload["campaign"]["id"] == "campaign_alpha"
    assert payload["campaign"]["client_id"] == client_record.id
    assert payload["campaign"]["preview_text"] == "Alpha Preview"
    assert payload["slot"] == {
        "id": "slot_alpha",
        "label": "Starter",
        "max_emails": 250,
        "status": "assigned",
        "limit_source": "campaign_slot",
    }
    assert payload["recipients"] == {
        "total": 2,
        "eligible": 1,
        "invalid": 1,
        "suppressed": 0,
        "blocked": 1,
    }
    assert payload["logs"]["simulated"] == 1
    assert payload["logs"]["queued"] == 1
    assert payload["blocked_sends"]["total"] == 1
    assert payload["blocked_sends"]["latest"][0]["campaign_name"] == "Alpha Campaign"


def test_client_cross_client_campaign_detail_is_denied(
    client: TestClient,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    client_record = build_client_record(
        client_id="client_alpha",
        email="alpha@example.test",
        personal_name="Alpha",
    )
    beta_record = build_client_record(
        client_id="client_beta",
        email="beta@example.test",
        personal_name="Beta",
    )
    campaign_repository = InMemoryCampaignRepository()
    campaign_repository.add_campaign(
        campaign_id="campaign_beta",
        client_id=beta_record.id,
        name="Beta Campaign",
        status="ready",
        subject="Beta Subject",
    )
    install_test_dependencies(
        client_records=[client_record, beta_record],
        access_records=[
            build_access_record(
                client_id=client_record.id,
                email=client_record.email,
                portal_slug="a" * 32,
            ),
            build_access_record(
                access_id="access_beta",
                client_id=beta_record.id,
                email=beta_record.email,
                clerk_user_id="user_beta",
                portal_slug="b" * 32,
            ),
        ],
        campaign_repository=campaign_repository,
        contact_repository=InMemoryContactRepository(),
        suppression_list_repository=InMemorySuppressionListRepository(),
        blocked_send_repository=InMemoryBlockedSendRepository(),
        email_log_repository=InMemoryEmailLogRepository(),
    )
    token = make_token(signing_keypair, clerk_user_id="user_client")

    response = client.get("/client/campaigns/campaign_beta", headers=auth_header(token))

    assert response.status_code == 404
    assert response.json()["detail"] == "Campaign not found."


def test_client_campaign_stats_return_only_db_backed_metrics(
    client: TestClient,
    signing_keypair: rsa.RSAPrivateKey,
) -> None:
    client_record = build_client_record(
        client_id="client_alpha",
        email="alpha@example.test",
        personal_name="Alpha",
    )
    campaign_repository = InMemoryCampaignRepository()
    campaign_repository.add_campaign(
        campaign_id="campaign_alpha",
        client_id=client_record.id,
        name="Alpha Campaign",
        status="running",
        subject="Alpha Subject",
    )
    contact_repository = InMemoryContactRepository()
    contact_repository.add_contact(
        contact_id="contact_alpha_ok",
        client_id=client_record.id,
        email="one@example.test",
        status="sendable",
    )
    contact_repository.attach_contact_to_campaign(
        client_id=client_record.id,
        campaign_id="campaign_alpha",
        contact_id="contact_alpha_ok",
    )
    email_log_repository = InMemoryEmailLogRepository()
    email_log_repository.create_email_log(
        client_id=client_record.id,
        campaign_id="campaign_alpha",
        contact_id="contact_alpha_ok",
        status="simulated",
    )
    email_log_repository.create_email_log(
        client_id=client_record.id,
        campaign_id="campaign_alpha",
        contact_id="contact_alpha_ok",
        status="queued",
    )
    blocked_send_repository = InMemoryBlockedSendRepository()
    blocked_send_repository.create_blocked_send(
        client_id=client_record.id,
        campaign_id="campaign_alpha",
        contact_id="contact_alpha_ok",
        reason="Previous dispatch blocked.",
        decision="blocked",
    )
    install_test_dependencies(
        client_records=[client_record],
        access_records=[
            build_access_record(
                client_id=client_record.id,
                email=client_record.email,
                portal_slug="a" * 32,
            )
        ],
        campaign_repository=campaign_repository,
        contact_repository=contact_repository,
        suppression_list_repository=InMemorySuppressionListRepository(),
        blocked_send_repository=blocked_send_repository,
        email_log_repository=email_log_repository,
    )
    token = make_token(signing_keypair, clerk_user_id="user_client")

    response = client.get(
        "/client/campaigns/campaign_alpha/stats",
        headers=auth_header(token),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["campaign_id"] == "campaign_alpha"
    assert payload["client_id"] == client_record.id
    assert payload["recipients"] == {
        "total": 1,
        "eligible": 1,
        "invalid": 0,
        "suppressed": 0,
        "blocked": 0,
    }
    assert payload["logs"]["simulated"] == 1
    assert payload["logs"]["queued"] == 1
    assert payload["logs"]["sent"] == 0
    assert payload["logs"]["delivered"] is None
    assert payload["logs"]["delivered_available"] is False
    assert payload["logs"]["opened"] is None
    assert payload["logs"]["opened_available"] is False
    assert payload["logs"]["clicked"] is None
    assert payload["logs"]["clicked_available"] is False
    assert payload["logs"]["complained"] is None
    assert payload["logs"]["complained_available"] is False
    assert payload["logs"]["provider_events_available"] is False
    assert payload["blocked_sends"]["total"] == 1


def test_admin_overview_uses_rome_day_boundaries() -> None:
    settings = get_settings()
    client_record = build_client_record()
    service = ClientsService(
        FakeClientRepository(
            [client_record],
            admin_email_log_records=[
                build_admin_email_log_record(
                    log_id="log_previous_local_day",
                    client_id=client_record.id,
                    campaign_id="campaign_previous",
                    created_at=datetime(2026, 5, 9, 21, 30, tzinfo=timezone.utc),
                ),
                build_admin_email_log_record(
                    log_id="log_current_local_day",
                    client_id=client_record.id,
                    campaign_id="campaign_current",
                    created_at=datetime(2026, 5, 9, 22, 15, tzinfo=timezone.utc),
                ),
            ],
        ),
        settings=settings,
    )

    overview = service.get_admin_overview(
        client_access_service=FakeClientAccessService([]),
        now=datetime(2026, 5, 9, 22, 30, tzinfo=timezone.utc),
    )

    expected_start = datetime(
        2026,
        5,
        10,
        0,
        0,
        tzinfo=ZoneInfo("Europe/Rome"),
    ).astimezone(timezone.utc)

    assert expected_start == datetime(2026, 5, 9, 22, 0, tzinfo=timezone.utc)
    assert overview.sending.emails_sent_today == 1
    assert overview.blocks.blocked_sends_today == 0


def test_client_overview_uses_rome_month_boundaries() -> None:
    settings = get_settings()
    client_record = build_client_record()
    access_record = build_access_record(
        client_id=client_record.id,
        email=client_record.email,
    )
    service = ClientsService(
        FakeClientRepository(
            [client_record],
            client_usage_records=[
                build_client_usage_record(
                    usage_id="usage_previous_local_month",
                    client_id=client_record.id,
                    usage_type="api_requests",
                    quantity=7,
                    created_at=datetime(2026, 4, 30, 21, 30, tzinfo=timezone.utc),
                ),
                build_client_usage_record(
                    usage_id="usage_current_local_month",
                    client_id=client_record.id,
                    usage_type="api_requests",
                    quantity=9,
                    created_at=datetime(2026, 4, 30, 22, 15, tzinfo=timezone.utc),
                ),
            ],
            client_blocked_send_records=[
                build_client_blocked_send_record(
                    blocked_send_id="blocked_previous_local_month",
                    client_id=client_record.id,
                    campaign_id="campaign_previous",
                    campaign_name="Previous",
                    reason="Previous local month.",
                    created_at=datetime(2026, 4, 30, 21, 30, tzinfo=timezone.utc),
                ),
                build_client_blocked_send_record(
                    blocked_send_id="blocked_current_local_month",
                    client_id=client_record.id,
                    campaign_id="campaign_current",
                    campaign_name="Current",
                    reason="Current local month.",
                    created_at=datetime(2026, 4, 30, 22, 20, tzinfo=timezone.utc),
                ),
            ],
        ),
        settings=settings,
    )

    overview = service.get_client_overview(
        client_id=client_record.id,
        portal_slug=access_record.portal_slug,
        client_access_service=FakeClientAccessService([access_record]),
        now=datetime(2026, 4, 30, 22, 30, tzinfo=timezone.utc),
    )

    assert overview.usage.current_period_started_at == datetime(
        2026,
        4,
        30,
        22,
        0,
        tzinfo=timezone.utc,
    )
    assert overview.usage.current_period_totals[0].total_quantity == 9
    assert overview.blocked_sends.current_period_count == 1
USE_DEFAULT_PROVIDER_EVENT_REPOSITORY = object()
