from datetime import datetime, timezone
import json
from typing import Any

from fastapi.testclient import TestClient

from app.api.campaigns import get_campaign_preparation_service
from app.core.auth import AuthenticatedUser, require_active_user
from app.core.config import Settings
from app.main import app
from app.repositories.clients import ClientCampaignRecord
from app.repositories.contacts import ContactRecord, InMemoryContactRepository
from app.repositories.listmonk_mappings import InMemoryListmonkMappingRepository
from app.repositories.campaign_sending_limits import InMemoryCampaignSendingLimitRepository
from app.services.campaign_preparation import (
    CampaignPreparationService,
    build_listmonk_campaign_payload,
)
from app.services.contact_subscriber_sync import ContactSubscriberSyncService
from app.services.listmonk_mappings import ListmonkMappingService
from app.services.template_renderer import get_default_template_renderer
from app.services.unsubscribe import UnsubscribeTokenService

LISTMONK_UNSUBSCRIBE_URL = (
    "https://app.sendwise.example.test/unsubscribe/"
    "{{ .Subscriber.Attribs.sendwise_unsubscribe_token }}"
)
class FakeListmonkPreparationClient:
    def __init__(self) -> None:
        self.created_lists: list[dict[str, Any]] = []
        self.created_subscribers: list[dict[str, Any]] = []
        self.patched_subscribers: list[tuple[str, dict[str, Any]]] = []
        self.assigned_lists: list[dict[str, Any]] = []
        self.created_campaign_payloads: list[dict[str, Any]] = []
        self.updated_campaign_payloads: list[tuple[str, dict[str, Any]]] = []
        self.existing_by_email: dict[str, dict[str, Any]] = {}

    def create_list(self, payload: dict[str, Any]) -> dict[str, Any]:
        self.created_lists.append(payload)
        return {"data": {"id": len(self.created_lists)}}

    def get_subscriber_by_email(self, email: str) -> dict[str, Any] | None:
        return self.existing_by_email.get(email)

    def create_subscriber(self, payload: dict[str, Any]) -> dict[str, Any]:
        self.created_subscribers.append(payload)
        return {"data": {"id": 100 + len(self.created_subscribers)}}

    def patch_subscriber(
        self,
        subscriber_id: int | str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        self.patched_subscribers.append((str(subscriber_id), payload))
        return {"data": {"id": subscriber_id}}

    def assign_subscriber_lists(
        self,
        *,
        subscriber_ids: list[int],
        list_ids: list[int],
        status: str = "confirmed",
    ) -> dict[str, Any]:
        self.assigned_lists.append(
            {
                "ids": subscriber_ids,
                "target_list_ids": list_ids,
                "status": status,
            }
        )
        return {"data": True}

    def create_campaign(self, payload: dict[str, Any]) -> dict[str, Any]:
        self.created_campaign_payloads.append(payload)
        return {"data": {"id": 200 + len(self.created_campaign_payloads)}}

    def update_campaign(
        self,
        campaign_id: int | str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        self.updated_campaign_payloads.append((str(campaign_id), payload))
        return {"data": {"id": campaign_id}}


class FakeCampaignRepository:
    def __init__(
        self,
        campaigns: list[ClientCampaignRecord],
        *,
        client_metadata: dict[str, Any] | None = None,
    ) -> None:
        self._campaigns = campaigns
        self._client_metadata = client_metadata or {
            "email_brand": {
                "company_name": "Acme Labs",
                "sender_name": "Team Acme",
                "website_url": "https://acme.example.test",
                "linkedin_url": "https://linkedin.com/company/acme",
                "logo_url": "/static/client-brand-logos/acme.webp",
            }
        }

    def get_by_id(self, client_id: str) -> Any | None:
        for campaign in self._campaigns:
            if campaign.client_id == client_id:
                return type(
                    "ClientStub",
                    (),
                    {
                        "id": client_id,
                        "personal_name": "Test Client",
                        "email": f"{client_id}@example.test",
                        "metadata": self._client_metadata,
                    },
                )()
        return None

    def list_client_campaigns(self, client_id: str) -> list[ClientCampaignRecord]:
        return [
            campaign for campaign in self._campaigns if campaign.client_id == client_id
        ]

    def list_admin_campaigns(self) -> list[ClientCampaignRecord]:
        return self._campaigns


def build_campaign(
    *,
    campaign_id: str = "campaign_123",
    client_id: str = "client_123",
    subject: str | None = "Launch",
    preview_text: str | None = "Preview",
    body_html: str | None = "<html><body><p>Persisted body.</p></body></html>",
    body_text: str | None = "Persisted body.",
    content_ready: bool = True,
) -> ClientCampaignRecord:
    now = datetime.now(timezone.utc)
    return ClientCampaignRecord(
        id=campaign_id,
        client_id=client_id,
        name="Launch campaign",
        status="draft",
        subject=subject,
        preview_text=preview_text,
        body_html=body_html,
        body_text=body_text,
        content_ready=content_ready,
        created_at=now,
        updated_at=now,
    )


def build_contact(
    *,
    contact_id: str,
    client_id: str = "client_123",
    email: str,
    status: str = "sendable",
    metadata: dict[str, str] | None = None,
) -> ContactRecord:
    now = datetime.now(timezone.utc)
    return ContactRecord(
        id=contact_id,
        client_id=client_id,
        email=email,
        status=status,
        metadata=metadata or {},
        created_at=now,
        updated_at=now,
    )


def build_preparation_service(
    *,
    campaign: ClientCampaignRecord | None = None,
    contacts: list[ContactRecord] | None = None,
    campaign_contacts: set[tuple[str, str, str]] | None = None,
    client_metadata: dict[str, Any] | None = None,
    mapping_repository: InMemoryListmonkMappingRepository | None = None,
    listmonk_client: FakeListmonkPreparationClient | None = None,
    settings: Settings | None = None,
) -> tuple[CampaignPreparationService, FakeListmonkPreparationClient, InMemoryListmonkMappingRepository]:
    fake_listmonk = listmonk_client or FakeListmonkPreparationClient()
    repository = mapping_repository or InMemoryListmonkMappingRepository()
    mapping_service = ListmonkMappingService(repository)
    campaign_record = campaign or build_campaign()
    contact_repository = InMemoryContactRepository(
        contacts=contacts
        if contacts is not None
        else [
            build_contact(
                contact_id="contact_1",
                email="first@example.test",
            ),
            build_contact(
                contact_id="contact_2",
                email="second@example.test",
            ),
        ],
        campaign_contacts=campaign_contacts
        if campaign_contacts is not None
        else {
            ("client_123", "campaign_123", "contact_1"),
            ("client_123", "campaign_123", "contact_2"),
        },
    )
    contact_sync_service = ContactSubscriberSyncService(
        listmonk_client=fake_listmonk,  # type: ignore[arg-type]
        mapping_service=mapping_service,
        contact_repository=contact_repository,
        unsubscribe_token_service=UnsubscribeTokenService(Settings(environment="test")),
    )
    service = CampaignPreparationService(
        settings=settings
        or Settings(
            environment="test",
            smtp_from_email="sender@example.test",
            frontend_url="https://app.sendwise.example.test",
        ),
        listmonk_client=fake_listmonk,  # type: ignore[arg-type]
        mapping_service=mapping_service,
        campaign_limit_repository=InMemoryCampaignSendingLimitRepository(),
        client_repository=FakeCampaignRepository(
            [campaign_record],
            client_metadata=client_metadata,
        ),  # type: ignore[arg-type]
        contact_sync_service=contact_sync_service,
        template_renderer=get_default_template_renderer(),
    )
    return service, fake_listmonk, repository


def test_prepare_campaign_creates_list_subscribers_campaign_and_mappings() -> None:
    service, fake_listmonk, repository = build_preparation_service()

    result = service.prepare_campaign("campaign_123")

    assert result["status"] == "synced"
    assert result["content_ready"] is True
    assert result["contact_summary"]["total_contacts"] == 2
    assert result["contact_summary"]["synced_count"] == 2
    assert result["list_mapping"]["created"] is True
    assert result["listmonk_mapping"]["created"] is True
    assert fake_listmonk.created_lists[0]["name"] == "sendwise-campaign-campaign_123"
    assert len(fake_listmonk.created_subscribers) == 2
    assert len(fake_listmonk.created_campaign_payloads) == 1
    created_payload = fake_listmonk.created_campaign_payloads[0]
    assert created_payload["name"] == "Launch campaign"
    assert created_payload["subject"] == "Launch"
    assert created_payload["lists"] == [1]
    assert created_payload["type"] == "regular"
    assert created_payload["content_type"] == "html"
    assert created_payload["messenger"] == "email"
    assert created_payload["tags"] == ["sendwise", "content_ready:true"]
    assert created_payload["from_email"] == "Team Acme <sender@example.test>"
    assert created_payload["altbody"] == "Persisted body."
    assert (
        created_payload["body"]
        == "<html><body><p>Persisted body.</p><p style=\"font-size:12px;line-height:20px;color:#52606d;\">You are receiving this email because you subscribed to updates from Sendwise. Manage preferences or <a href=\"https://app.sendwise.example.test/unsubscribe/{{ .Subscriber.Attribs.sendwise_unsubscribe_token }}\">unsubscribe</a>.</p></body></html>"
    )
    assert result["content"]["body"] == created_payload["body"]
    assert result["content"]["template_name"] == "campaign_business_db"
    assert result["content"]["preview_text"] == "Preview"
    assert (
        result["content"]["unsubscribe_url"]
        == "https://app.sendwise.example.test/unsubscribe/{{ .Subscriber.Attribs.sendwise_unsubscribe_token }}"
    )
    mapping_types = {
        (mapping.entity_type, mapping.entity_id, mapping.listmonk_type)
        for mapping in repository.list_by_client("client_123")
    }
    assert ("campaign", "campaign_123", "list") in mapping_types
    assert ("campaign", "campaign_123", "campaign") in mapping_types
    assert ("contact", "contact_1", "subscriber") in mapping_types
    assert ("contact", "contact_2", "subscriber") in mapping_types


def test_prepare_campaign_renders_subject_preview_and_bodies_before_listmonk_payload() -> None:
    service, fake_listmonk, _repository = build_preparation_service(
        campaign=build_campaign(
            subject="Aggiornamento {{campaign_name}}",
            preview_text="Preview {{campaign_name}}",
            body_html=(
                "<html><body><p>{{subject}}</p><p>{{preview_text}}</p>"
                "<p>{{campaign_name}}</p></body></html>"
            ),
            body_text="{{subject}} | {{preview_text}} | {{campaign_name}}",
        ),
    )

    result = service.prepare_campaign("campaign_123")

    assert result["status"] == "synced"
    assert result["content"]["subject"] == "Aggiornamento Launch campaign"
    assert result["content"]["preview_text"] == "Preview Launch campaign"
    assert "Aggiornamento Launch campaign" in result["content"]["body"]
    assert "Preview Launch campaign" in result["content"]["body"]
    assert result["content"]["body_text"] == (
        "Aggiornamento Launch campaign | Preview Launch campaign | Launch campaign"
    )
    assert fake_listmonk.created_campaign_payloads[0]["subject"] == (
        "Aggiornamento Launch campaign"
    )
    assert "{{campaign_name}}" not in fake_listmonk.created_campaign_payloads[0]["subject"]
    assert fake_listmonk.created_campaign_payloads[0]["body"] == result["content"]["body"]
    assert (
        fake_listmonk.created_campaign_payloads[0]["altbody"]
        == result["content"]["body_text"]
    )


def test_build_listmonk_campaign_payload_never_uses_raw_campaign_subject() -> None:
    campaign = build_campaign(
        subject="Aggiornamento {{campaign_name}}",
        body_html="<html><body><p>Raw business body</p></body></html>",
        body_text="Raw business text",
    )

    payload, content_ready = build_listmonk_campaign_payload(
        settings=Settings(
            environment="test",
            smtp_from_email="sender@example.test",
        ),
        campaign=campaign,
        list_id=7,
        content={
            "subject": "Aggiornamento Launch campaign",
            "content_ready": True,
            "body": "<html><body><p>Rendered body</p></body></html>",
            "body_text": "Rendered body text",
        },
    )

    assert content_ready is True
    assert payload["subject"] == "Aggiornamento Launch campaign"
    assert payload["subject"] != campaign.subject
    assert "{{campaign_name}}" not in payload["subject"]
    assert payload["body"] == "<html><body><p>Rendered body</p></body></html>"
    assert payload["altbody"] == "Rendered body text"


def test_build_listmonk_campaign_payload_falls_back_to_technical_subject_when_rendered_subject_empty() -> None:
    campaign = build_campaign(subject="Aggiornamento {{campaign_name}}")

    payload, content_ready = build_listmonk_campaign_payload(
        settings=Settings(
            environment="test",
            smtp_from_email="sender@example.test",
        ),
        campaign=campaign,
        list_id=7,
        content={
            "subject": "   ",
            "content_ready": False,
            "body": "<html><body><p>Rendered fallback body</p></body></html>",
            "body_text": "",
        },
    )

    assert content_ready is False
    assert payload["subject"] == f"Sendwise technical draft {campaign.id}"
    assert payload["subject"] != campaign.subject
    assert "{{campaign_name}}" not in payload["subject"]
    assert payload["body"] == "<html><body><p>Rendered fallback body</p></body></html>"
    assert "altbody" not in payload


def test_build_listmonk_campaign_payload_adds_static_mailgun_headers_when_mailgun_smtp_is_configured() -> None:
    campaign = build_campaign()

    payload, _content_ready = build_listmonk_campaign_payload(
        settings=Settings(
            environment="test",
            smtp_host="smtp.mailgun.org",
            smtp_from_email="sender@example.test",
            backend_public_url="https://api.sendwise.example.test",
        ),
        campaign=campaign,
        list_id=7,
        content={
            "subject": "Launch",
            "content_ready": True,
            "body": "<html><body><p>Rendered body</p></body></html>",
            "body_text": "Rendered body text",
            "unsubscribe_url": LISTMONK_UNSUBSCRIBE_URL,
        },
    )

    assert isinstance(payload["headers"], list)
    assert len(payload["headers"]) == 1
    assert "List-Unsubscribe" not in payload["headers"][0]
    assert "List-Unsubscribe-Post" not in payload["headers"][0]
    assert payload["headers"][0]["X-Mailgun-Variables"]
    variables = json.loads(payload["headers"][0]["X-Mailgun-Variables"])
    assert variables == {
        "sendwise_campaign_id": "campaign_123",
        "sendwise_client_id": "client_123",
        "sendwise_send_kind": "campaign",
    }
    assert "sendwise_contact_id" not in variables


def test_build_listmonk_campaign_payload_marks_followup_send_kind_in_headers() -> None:
    campaign = build_campaign()

    payload, _content_ready = build_listmonk_campaign_payload(
        settings=Settings(
            environment="test",
            smtp_host="smtp.mailgun.org",
            smtp_from_email="sender@example.test",
        ),
        campaign=campaign,
        list_id=7,
        content={
            "subject": "Follow-up",
            "content_ready": True,
            "body": "<html><body><p>Rendered body</p></body></html>",
            "body_text": "Rendered body text",
        },
        send_kind="followup",
    )

    variables = json.loads(payload["headers"][0]["X-Mailgun-Variables"])
    assert variables["sendwise_send_kind"] == "followup"


def test_build_listmonk_campaign_payload_omits_custom_unsubscribe_headers_for_non_mailgun_smtp() -> None:
    campaign = build_campaign()

    payload, _content_ready = build_listmonk_campaign_payload(
        settings=Settings(
            environment="test",
            smtp_host="smtp.example.test",
            smtp_from_email="sender@example.test",
            backend_public_url="https://api.sendwise.example.test",
        ),
        campaign=campaign,
        list_id=7,
        content={
            "subject": "Launch",
            "content_ready": True,
            "body": "<html><body><p>Rendered body</p></body></html>",
            "body_text": "Rendered body text",
            "unsubscribe_url": LISTMONK_UNSUBSCRIBE_URL,
        },
    )

    assert "headers" not in payload


def test_build_listmonk_campaign_payload_omits_custom_unsubscribe_headers_without_safe_public_backend_url() -> None:
    campaign = build_campaign()

    payload, _content_ready = build_listmonk_campaign_payload(
        settings=Settings(
            environment="test",
            smtp_host="smtp.example.test",
            smtp_from_email="sender@example.test",
            backend_public_url="http://localhost:8000",
        ),
        campaign=campaign,
        list_id=7,
        content={
            "subject": "Launch",
            "content_ready": True,
            "body": "<html><body><p>Rendered body</p></body></html>",
            "body_text": "Rendered body text",
            "unsubscribe_url": "https://app.sendwise.example.test/unsubscribe/static-token",
        },
    )

    assert "headers" not in payload


def test_build_listmonk_campaign_payload_preserves_base_fields_with_mailgun_headers() -> None:
    campaign = build_campaign()

    payload, content_ready = build_listmonk_campaign_payload(
        settings=Settings(
            environment="test",
            smtp_host="smtp.eu.mailgun.org",
            smtp_from_email="sender@example.test",
        ),
        campaign=campaign,
        list_id=7,
        content={
            "subject": "Launch",
            "content_ready": True,
            "body": "<html><body><p>Rendered body</p></body></html>",
            "body_text": "Rendered body text",
        },
    )

    assert content_ready is True
    assert payload["name"] == "Launch campaign"
    assert payload["subject"] == "Launch"
    assert payload["lists"] == [7]
    assert payload["type"] == "regular"
    assert payload["content_type"] == "html"
    assert payload["body"] == "<html><body><p>Rendered body</p></body></html>"
    assert payload["messenger"] == "email"
    assert payload["tags"] == ["sendwise", "content_ready:true"]
    assert payload["altbody"] == "Rendered body text"
    assert payload["from_email"] == "Sendwise <sender@example.test>"


def test_build_listmonk_campaign_payload_prefers_sender_name_in_from_header() -> None:
    campaign = build_campaign()

    payload, _content_ready = build_listmonk_campaign_payload(
        settings=Settings(
            environment="test",
            smtp_from_email="sender@example.test",
        ),
        campaign=campaign,
        list_id=7,
        content={
            "subject": "Launch",
            "content_ready": True,
            "body": "<html><body><p>Rendered body</p></body></html>",
            "body_text": "Rendered body text",
        },
        email_brand={
            "company_name": "Acme Labs",
            "sender_name": "Team Acme",
        },
    )

    assert payload["from_email"] == "Team Acme <sender@example.test>"


def test_build_listmonk_campaign_payload_falls_back_to_company_name_in_from_header() -> None:
    campaign = build_campaign()

    payload, _content_ready = build_listmonk_campaign_payload(
        settings=Settings(
            environment="test",
            smtp_from_email="sender@example.test",
        ),
        campaign=campaign,
        list_id=7,
        content={
            "subject": "Launch",
            "content_ready": True,
            "body": "<html><body><p>Rendered body</p></body></html>",
            "body_text": "Rendered body text",
        },
        email_brand={
            "company_name": "Acme Labs",
        },
    )

    assert payload["from_email"] == "Acme Labs <sender@example.test>"


def test_build_listmonk_campaign_payload_sanitizes_sender_name_in_from_header() -> None:
    campaign = build_campaign()

    payload, _content_ready = build_listmonk_campaign_payload(
        settings=Settings(
            environment="test",
            smtp_from_email="sender@example.test",
        ),
        campaign=campaign,
        list_id=7,
        content={
            "subject": "Launch",
            "content_ready": True,
            "body": "<html><body><p>Rendered body</p></body></html>",
            "body_text": "Rendered body text",
        },
        email_brand={
            "sender_name": "Team\r\nAcme",
        },
    )

    assert payload["from_email"] == "Team Acme <sender@example.test>"


def test_prepare_campaign_is_idempotent_and_updates_existing_campaign() -> None:
    repository = InMemoryListmonkMappingRepository()
    mapping_service = ListmonkMappingService(repository)
    mapping_service.ensure_campaign_list_mapping(
        client_id="client_123",
        campaign_id="campaign_123",
        listmonk_list_id="7",
    )
    mapping_service.ensure_campaign_mapping(
        client_id="client_123",
        campaign_id="campaign_123",
        listmonk_campaign_id="9",
    )
    mapping_service.ensure_contact_subscriber_mapping(
        client_id="client_123",
        contact_id="contact_1",
        listmonk_subscriber_id="41",
    )
    mapping_service.ensure_contact_subscriber_mapping(
        client_id="client_123",
        contact_id="contact_2",
        listmonk_subscriber_id="42",
    )
    service, fake_listmonk, _repository = build_preparation_service(
        mapping_repository=repository,
        settings=Settings(
            environment="test",
            smtp_host="smtp.mailgun.org",
            smtp_from_email="sender@example.test",
            frontend_url="https://app.sendwise.example.test",
        ),
    )

    result = service.prepare_campaign("campaign_123")

    assert result["status"] == "synced"
    assert result["list_mapping"]["created"] is False
    assert result["listmonk_mapping"]["created"] is False
    assert fake_listmonk.created_lists == []
    assert fake_listmonk.created_subscribers == []
    assert fake_listmonk.updated_campaign_payloads[0][0] == "9"
    assert fake_listmonk.assigned_lists == [
        {"ids": [41], "target_list_ids": [7], "status": "confirmed"},
        {"ids": [42], "target_list_ids": [7], "status": "confirmed"},
    ]


def test_prepare_followup_campaign_creates_distinct_mapping_and_preserves_primary_mapping() -> None:
    repository = InMemoryListmonkMappingRepository()
    mapping_service = ListmonkMappingService(repository)
    mapping_service.ensure_campaign_list_mapping(
        client_id="client_123",
        campaign_id="campaign_123",
        listmonk_list_id="7",
    )
    mapping_service.ensure_campaign_mapping(
        client_id="client_123",
        campaign_id="campaign_123",
        listmonk_campaign_id="9",
    )
    service, fake_listmonk, _repository = build_preparation_service(
        mapping_repository=repository,
        settings=Settings(
            environment="test",
            smtp_host="smtp.mailgun.org",
            smtp_from_email="sender@example.test",
            frontend_url="https://app.sendwise.example.test",
        ),
    )
    service.campaign_limit_repository.update_for_campaign(
        campaign_id="campaign_123",
        followup_enabled=True,
        followup_daily_limit=5,
        followup_monthly_limit=50,
        followup_delay_value=3,
        followup_delay_unit="days",
        followup_subject="Follow-up launch",
        followup_body_html="<html><body><p>Follow-up {{unsubscribe_url}}</p></body></html>",
        followup_body_text="Follow-up",
    )

    result = service.prepare_followup_campaign("campaign_123", ["contact_1"])

    primary_campaign_mapping = mapping_service.get_mapping(
        client_id="client_123",
        entity_type="campaign",
        entity_id="campaign_123",
        listmonk_type="campaign",
    )
    followup_campaign_mapping = mapping_service.get_mapping(
        client_id="client_123",
        entity_type="campaign_followup",
        entity_id="campaign_123",
        listmonk_type="campaign",
    )
    assert result["status"] == "synced"
    assert result["list_mapping"]["entity_type"] == "campaign_followup"
    assert result["listmonk_mapping"]["entity_type"] == "campaign_followup"
    assert fake_listmonk.created_campaign_payloads[0]["name"] == "Launch campaign followup"
    assert fake_listmonk.created_campaign_payloads[0]["subject"] == "Follow-up launch"
    followup_variables = json.loads(
        fake_listmonk.created_campaign_payloads[0]["headers"][0]["X-Mailgun-Variables"]
    )
    assert followup_variables["sendwise_send_kind"] == "followup"
    assert primary_campaign_mapping is not None
    assert primary_campaign_mapping.listmonk_id == "9"
    assert followup_campaign_mapping is not None
    assert followup_campaign_mapping.listmonk_id != primary_campaign_mapping.listmonk_id


def test_prepare_campaign_skips_error_contacts_in_batch_summary() -> None:
    service, fake_listmonk, _repository = build_preparation_service(
        contacts=[
            build_contact(
                contact_id="contact_1",
                email="first@example.test",
            ),
            build_contact(
                contact_id="contact_error",
                email="error@example.test",
                status="error",
            ),
        ],
        campaign_contacts={
            ("client_123", "campaign_123", "contact_1"),
            ("client_123", "campaign_123", "contact_error"),
        },
    )

    result = service.prepare_campaign("campaign_123")

    assert result["contact_summary"]["total_contacts"] == 2
    assert result["contact_summary"]["synced_count"] == 1
    assert result["contact_summary"]["skipped_count"] == 1
    assert result["contact_summary"]["failed_count"] == 0
    assert len(fake_listmonk.created_subscribers) == 1


def test_prepare_campaign_uses_technical_fallback_but_marks_content_not_ready() -> None:
    service, fake_listmonk, _repository = build_preparation_service(
        campaign=build_campaign(
            body_html=None,
            body_text=None,
            preview_text=None,
            content_ready=False,
        )
    )

    result = service.prepare_campaign("campaign_123")

    assert result["status"] == "synced"
    assert result["content_ready"] is False
    assert result["content"]["content_ready"] is False
    assert isinstance(result["content"]["reason"], str)
    assert result["content"]["reason"]
    assert fake_listmonk.created_campaign_payloads[0]["tags"] == [
        "sendwise",
        "content_ready:false",
    ]


def test_prepare_campaign_converts_known_recipient_placeholders_for_listmonk() -> None:
    service, fake_listmonk, _repository = build_preparation_service(
        campaign=build_campaign(
            preview_text="Anteprima per {{nome}}",
            body_html="<html><body><p>Ciao {{ nome }} {{cognome}}</p></body></html>",
            body_text="Ciao {{nome}}",
        ),
        contacts=[
            build_contact(
                contact_id="contact_1",
                email="first@example.test",
                metadata={"nome": "Mario", "cognome": "Rossi"},
            ),
        ],
        campaign_contacts={("client_123", "campaign_123", "contact_1")},
    )

    result = service.prepare_campaign("campaign_123")

    assert result["content"]["preview_text"] == "Anteprima per {{ .Subscriber.Attribs.nome }}"
    assert "{{nome}}" not in result["content"]["body"]
    assert "{{cognome}}" not in result["content"]["body"]
    assert "{{ .Subscriber.Attribs.nome }}" in result["content"]["body"]
    assert "{{ .Subscriber.Attribs.cognome }}" in result["content"]["body"]
    assert "{{ .Subscriber.Attribs.nome }}" in fake_listmonk.created_campaign_payloads[0]["body"]


def test_prepare_campaign_renders_campaign_and_brand_variables() -> None:
    service, fake_listmonk, _repository = build_preparation_service(
        campaign=build_campaign(
            preview_text="Aggiornamento {{campaign_name}}",
            body_html=(
                "<html><body>"
                "<p>{{company_name}}</p><p>{{sender_name}}</p><p>{{email}}</p>"
                "<p>{{current_year}}</p><p>{{social_icons}}</p><p>{{logo}}</p>"
                "<a href='{{unsubscribe_url}}'>unsubscribe</a></body></html>"
            ),
            body_text="Campagna {{campaign_name}} per {{email}} nel {{current_year}}",
        ),
        contacts=[
            build_contact(
                contact_id="contact_1",
                email="first@example.test",
                metadata={"nome": "Mario", "cognome": "Rossi"},
            ),
        ],
        campaign_contacts={("client_123", "campaign_123", "contact_1")},
    )

    result = service.prepare_campaign("campaign_123")

    assert result["content"]["preview_text"] == "Aggiornamento Launch campaign"
    assert "Acme Labs" in result["content"]["body"]
    assert "Team Acme" in result["content"]["body"]
    assert "{{ .Subscriber.Email }}" in result["content"]["body"]
    assert str(datetime.now(timezone.utc).year) in result["content"]["body"]
    assert "linkedin.com/company/acme" in result["content"]["body"]
    assert "/static/client-brand-logos/acme.webp" in result["content"]["body"]
    assert result["content"]["unsubscribe_url"] in result["content"]["body"]
    assert "Launch campaign" in result["content"]["body_text"]
    assert "{{ .Subscriber.Email }}" in result["content"]["body_text"]
    assert result["content"]["unsubscribe_url"] in fake_listmonk.created_campaign_payloads[0]["body"]


def test_prepare_campaign_expands_managed_logo_paths_to_absolute_public_urls() -> None:
    service, _fake_listmonk, _repository = build_preparation_service(
        campaign=build_campaign(
            body_html="<html><body><p>{{logo}}</p></body></html>",
        ),
        settings=Settings(
            environment="test",
            smtp_from_email="sender@example.test",
            frontend_url="https://app.sendwise.example.test",
            backend_public_url="https://api.sendwise.example.test",
        ),
    )

    result = service.prepare_campaign("campaign_123")

    assert (
        'src="https://api.sendwise.example.test/static/client-brand-logos/acme.webp"'
        in result["content"]["body"]
    )


def test_prepare_campaign_preserves_listmonk_native_placeholders() -> None:
    service, fake_listmonk, _repository = build_preparation_service(
        campaign=build_campaign(
            subject="Launch {{MessageURL}}",
            body_html=(
                "<html><body><p>{{MessageURL}}</p><p>{{UnsubscribeURL}}</p>"
                "<a href='{{unsubscribe_url}}'>unsubscribe</a></body></html>"
            ),
            body_text="{{MessageURL}} {{UnsubscribeURL}}",
        ),
    )

    result = service.prepare_campaign("campaign_123")

    assert result["status"] == "synced"
    assert "{{MessageURL}}" in result["content"]["subject"]
    assert "{{MessageURL}}" in result["content"]["body"]
    assert "{{UnsubscribeURL}}" in result["content"]["body"]
    assert "{{MessageURL}}" in result["content"]["body_text"]
    assert "{{UnsubscribeURL}}" in fake_listmonk.created_campaign_payloads[0]["body"]


def test_prepare_campaign_cleans_empty_brand_blocks() -> None:
    service, _fake_listmonk, _repository = build_preparation_service(
        campaign=build_campaign(
            preview_text="Preview {{campaign_name}}",
            body_html=(
                "<html><body><p>{{nome}}</p><p>{{logo}}</p><p>{{social_icons}}</p>"
                "<p>{{campaign_name}}</p></body></html>"
            ),
            body_text="Hello {{campaign_name}}",
        ),
        client_metadata={"email_brand": {}},
    )

    result = service.prepare_campaign("campaign_123")

    assert "{{logo}}" not in result["content"]["body"]
    assert "{{social_icons}}" not in result["content"]["body"]
    assert "img src=" not in result["content"]["body"]
    assert "linkedin.com/company/acme" not in result["content"]["body"]
    assert result["content"]["unsubscribe_url"] in result["content"]["body"]


def test_prepare_campaign_blocks_blank_company_name_used_in_template() -> None:
    service, fake_listmonk, _repository = build_preparation_service(
        campaign=build_campaign(
            body_html=(
                "<html><body><p>Ricevi questa email perche sei iscritto agli "
                "aggiornamenti di {{company_name}}.</p></body></html>"
            ),
            body_text="Aggiornamenti di {{company_name}}",
        ),
        client_metadata={"email_brand": {"website_url": "https://acme.example.test"}},
    )

    result = service.prepare_campaign("campaign_123")

    assert result["status"] == "blocked"
    assert result["listmonk_synced"] is False
    assert result["reason_code"] == "template_missing_company_name"
    assert result["content"]["reason_code"] == "template_missing_company_name"
    assert fake_listmonk.created_lists == []
    assert fake_listmonk.created_subscribers == []
    assert fake_listmonk.created_campaign_payloads == []


def test_prepare_campaign_blocks_blank_cta_href_from_website_url() -> None:
    service, fake_listmonk, _repository = build_preparation_service(
        campaign=build_campaign(
            body_html=(
                "<html><body><a href=\"{{website_url}}\">Scopri l'offerta</a>"
                "</body></html>"
            ),
            body_text="Scopri l'offerta",
        ),
        client_metadata={"email_brand": {"company_name": "Acme Labs"}},
    )

    result = service.prepare_campaign("campaign_123")

    assert result["status"] == "blocked"
    assert result["reason_code"] == "template_empty_cta_url"
    assert "missing or blank href" in result["reason"]
    assert fake_listmonk.created_lists == []
    assert fake_listmonk.created_subscribers == []
    assert fake_listmonk.created_campaign_payloads == []


def test_prepare_campaign_allows_missing_optional_logo_and_social_when_safely_omitted() -> None:
    service, fake_listmonk, _repository = build_preparation_service(
        campaign=build_campaign(
            body_html=(
                "<html><body><p>{{logo}}</p><p>{{social_icons}}</p>"
                "<p>{{company_name}}</p><a href=\"{{website_url}}\">Visita</a>"
                "</body></html>"
            ),
            body_text="Visita {{website_url}}",
        ),
        client_metadata={
            "email_brand": {
                "company_name": "Acme Labs",
                "website_url": "https://acme.example.test",
            }
        },
    )

    result = service.prepare_campaign("campaign_123")

    assert result["status"] == "synced"
    assert result["content_ready"] is True
    assert "img src=" not in result["content"]["body"]
    assert "linkedin.com/company/acme" not in result["content"]["body"]
    assert fake_listmonk.created_campaign_payloads


def test_prepare_campaign_allows_non_empty_company_and_cta_values() -> None:
    service, fake_listmonk, _repository = build_preparation_service(
        campaign=build_campaign(
            body_html=(
                "<html><body><p>{{company_name}}</p>"
                "<a href=\"{{website_url}}\">Visita</a></body></html>"
            ),
            body_text="{{company_name}} {{website_url}}",
        ),
        client_metadata={
            "email_brand": {
                "company_name": "Acme Labs",
                "website_url": "https://acme.example.test",
            }
        },
    )

    result = service.prepare_campaign("campaign_123")

    assert result["status"] == "synced"
    assert result["content_ready"] is True
    assert "Acme Labs" in result["content"]["body"]
    assert 'href="https://acme.example.test/"' in result["content"]["body"]
    assert len(fake_listmonk.created_campaign_payloads) == 1


def test_prepare_campaign_blocks_unknown_sendwise_placeholders_before_listmonk() -> None:
    service, fake_listmonk, _repository = build_preparation_service(
        campaign=build_campaign(
            subject="Secret {{campaign_name}} {{mystery_token}}",
            preview_text="Preview {{preview_text}}",
            body_html="<html><body><p>{{unknown_brand}}</p></body></html>",
            body_text="Body {{unknown_text}}",
        ),
    )

    result = service.prepare_campaign("campaign_123")

    assert result["status"] == "blocked"
    assert result["listmonk_synced"] is False
    assert result["content_ready"] is False
    assert "Unsupported Sendwise placeholders remain in subject" in result["reason"]
    assert "{{mystery_token}}" in result["reason"]
    assert "Secret" not in result["reason"]
    assert "first@example.test" not in result["reason"]
    assert "sender@example.test" not in result["reason"]
    assert "sendwise_unsubscribe_token" not in result["reason"]
    assert result["content"]["body"] == ""
    assert result["content"]["body_text"] == ""
    assert fake_listmonk.created_campaign_payloads == []


def test_prepare_campaign_renders_only_configured_instagram_social_link() -> None:
    service, _fake_listmonk, _repository = build_preparation_service(
        campaign=build_campaign(
            preview_text="Preview {{campaign_name}}",
            body_html=(
                "<html><body><p>{{social_icons}}</p><p>{{instagram_url}}</p>"
                "<p>{{linkedin_url}}</p><a href='{{unsubscribe_url}}'>unsubscribe</a></body></html>"
            ),
            body_text="Segui {{instagram_url}}",
        ),
        client_metadata={
            "email_brand": {
                "company_name": "Acme Labs",
                "instagram_url": "https://instagram.com/acme",
            }
        },
    )

    result = service.prepare_campaign("campaign_123")

    assert "instagram.com/acme" in result["content"]["body"]
    assert "linkedin.com/company/acme" not in result["content"]["body"]
    assert "{{linkedin_url}}" not in result["content"]["body"]
    assert "instagram.com/acme" in result["content"]["body_text"]


def test_sync_listmonk_endpoint_uses_backend_preparation_without_sending() -> None:
    fake_user = AuthenticatedUser(
        id="user_1",
        clerk_user_id="clerk_1",
        email="admin@sendwise.test",
        access_type="platform_admin",
        status="active",
    )
    service, fake_listmonk, _repository = build_preparation_service()

    app.dependency_overrides[require_active_user] = lambda: fake_user
    app.dependency_overrides[get_campaign_preparation_service] = lambda: service

    try:
        response = TestClient(app).post("/campaigns/campaign_123/sync-listmonk")
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status"] == "synced"
    assert not hasattr(fake_listmonk, "sent_campaign_ids")
