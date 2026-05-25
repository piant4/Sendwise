from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import json
from typing import Any

from app.core.auth import AuthenticatedUser
from app.core.config import Settings, get_settings
from app.integrations.listmonk.client import ListmonkClient, extract_listmonk_id
from app.repositories.clients import (
    ClientCampaignRecord,
    ClientRepository,
    PostgresClientRepository,
)
from app.repositories.contacts import ContactRepository, PostgresContactRepository
from app.repositories.listmonk_mappings import get_listmonk_mapping_repository
from app.services.contact_subscriber_sync import ContactSubscriberSyncService
from app.services.clients import build_client_email_brand
from app.services.listmonk_mappings import (
    ENTITY_TYPE_CAMPAIGN,
    LISTMONK_TYPE_CAMPAIGN,
    ListmonkMappingService,
)
from app.services.provider_runtime import build_listmonk_client
from app.services.template_renderer import (
    CompiledTemplateNotFoundError,
    TemplateRenderError,
    TemplateRenderer,
    build_brand_template_variables,
    build_unsubscribe_url,
    build_template_variable_values,
    ensure_unsubscribe_link,
    get_default_template_renderer,
    render_sendwise_template_string,
    validate_rendered_template_content_ready,
)
from app.services.unsubscribe import (
    UnsubscribeTokenService,
)

RECIPIENT_TEMPLATE_VARIABLES = {
    "nome": "{{ .Subscriber.Attribs.nome }}",
    "cognome": "{{ .Subscriber.Attribs.cognome }}",
    "email": "{{ .Subscriber.Email }}",
}


def build_listmonk_campaign_payload(
    *,
    settings: Settings,
    campaign: ClientCampaignRecord,
    list_id: int,
    content: dict[str, Any],
) -> tuple[dict[str, Any], bool]:
    subject = str(content.get("subject") or "").strip()
    content_ready = bool(content["content_ready"])
    body = str(content.get("body") or "")
    altbody = str(content.get("body_text") or "")

    payload: dict[str, Any] = {
        "name": campaign.name,
        "subject": subject or f"Sendwise technical draft {campaign.id}",
        "lists": [list_id],
        "type": "regular",
        "content_type": "html",
        "body": body,
        "messenger": "email",
        "tags": ["sendwise", f"content_ready:{str(content_ready).lower()}"],
    }
    if altbody:
        payload["altbody"] = altbody
    if settings.smtp_from_email.strip():
        payload["from_email"] = settings.smtp_from_email.strip()
    headers = _build_listmonk_campaign_headers(
        settings=settings,
        campaign=campaign,
        content=content,
    )
    if headers:
        payload["headers"] = headers

    return payload, content_ready


def _build_listmonk_campaign_headers(
    *,
    settings: Settings,
    campaign: ClientCampaignRecord,
    content: dict[str, Any],
) -> list[dict[str, str]]:
    headers: list[dict[str, str]] = []
    if settings.smtp_host_is_mailgun:
        headers.append(
            {
                "X-Mailgun-Variables": json.dumps(
                    {
                        "sendwise_client_id": campaign.client_id,
                        "sendwise_campaign_id": campaign.id,
                    },
                    sort_keys=True,
                    separators=(",", ":"),
                )
            }
        )
    return headers


@dataclass(frozen=True)
class CampaignPreparationService:
    settings: Settings
    listmonk_client: ListmonkClient
    mapping_service: ListmonkMappingService
    client_repository: ClientRepository
    contact_sync_service: ContactSubscriberSyncService
    template_renderer: TemplateRenderer

    def prepare_campaign(
        self,
        campaign_id: str,
        current_user: AuthenticatedUser | None = None,
    ) -> dict[str, Any]:
        campaign = self._get_campaign(
            campaign_id=campaign_id,
            current_user=current_user,
        )
        if campaign is None:
            return {
                "status": "not_found",
                "campaign_id": campaign_id,
                "listmonk_synced": False,
                "reason": "Campaign was not found in Business DB for this caller.",
            }

        client = self.client_repository.get_by_id(campaign.client_id)
        content = self._render_campaign_content(campaign=campaign, client=client)
        if not content.get("allow_listmonk_sync", True):
            return {
                "status": "blocked",
                "campaign_id": campaign.id,
                "client_id": campaign.client_id,
                "listmonk_synced": False,
                "content_ready": False,
                "reason": str(
                    content.get(
                        "reason",
                        "Campaign content contains unsupported Sendwise placeholders.",
                    )
                ),
                "reason_code": str(
                    content.get("reason_code") or "template_content_not_ready"
                ),
                "content": content,
            }

        list_mapping, list_created = self.contact_sync_service.ensure_campaign_list(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
        )
        contact_summary = self.contact_sync_service.sync_campaign_contacts(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
        )
        if not content.get("allow_listmonk_sync", True):
            return {
                "status": "blocked",
                "campaign_id": campaign.id,
                "client_id": campaign.client_id,
                "listmonk_synced": False,
                "content_ready": False,
                "reason": str(
                    content.get(
                        "reason",
                        "Campaign content contains unsupported Sendwise placeholders.",
                    )
                ),
                "reason_code": str(
                    content.get("reason_code") or "template_content_not_ready"
                ),
                "contact_summary": contact_summary,
                "content": content,
                "list_mapping": {
                    "entity_type": list_mapping.entity_type,
                    "entity_id": list_mapping.entity_id,
                    "listmonk_type": list_mapping.listmonk_type,
                    "listmonk_id": list_mapping.listmonk_id,
                    "created": list_created,
                },
            }
        campaign_mapping, campaign_created, content_ready = (
            self._ensure_listmonk_campaign(
                campaign=campaign,
                list_id=self._coerce_listmonk_int(list_mapping.listmonk_id, "list"),
                content=content,
            )
        )

        return {
            "status": "synced",
            "campaign_id": campaign.id,
            "client_id": campaign.client_id,
            "listmonk_synced": True,
            "content_ready": content_ready,
            "contact_summary": contact_summary,
            "content": content,
            "list_mapping": {
                "entity_type": list_mapping.entity_type,
                "entity_id": list_mapping.entity_id,
                "listmonk_type": list_mapping.listmonk_type,
                "listmonk_id": list_mapping.listmonk_id,
                "created": list_created,
            },
            "listmonk_mapping": {
                "entity_type": campaign_mapping.entity_type,
                "entity_id": campaign_mapping.entity_id,
                "listmonk_type": campaign_mapping.listmonk_type,
                "listmonk_id": campaign_mapping.listmonk_id,
                "created": campaign_created,
            },
        }

    def _ensure_listmonk_campaign(
        self,
        *,
        campaign: ClientCampaignRecord,
        list_id: int,
        content: dict[str, Any],
    ) -> tuple[Any, bool, bool]:
        payload, content_ready = self._build_listmonk_campaign_payload(
            campaign=campaign,
            list_id=list_id,
            content=content,
        )
        mapping = self.mapping_service.get_mapping(
            client_id=campaign.client_id,
            entity_type=ENTITY_TYPE_CAMPAIGN,
            entity_id=campaign.id,
            listmonk_type=LISTMONK_TYPE_CAMPAIGN,
        )
        if mapping is not None:
            self.listmonk_client.update_campaign(mapping.listmonk_id, payload)
            return mapping, False, content_ready

        listmonk_campaign = self.listmonk_client.create_campaign(payload)
        listmonk_campaign_id = extract_listmonk_id(listmonk_campaign)
        mapping = self.mapping_service.ensure_campaign_mapping(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
            listmonk_campaign_id=listmonk_campaign_id,
        )

        return mapping, True, content_ready

    def _build_listmonk_campaign_payload(
        self,
        *,
        campaign: ClientCampaignRecord,
        list_id: int,
        content: dict[str, Any],
    ) -> tuple[dict[str, Any], bool]:
        return build_listmonk_campaign_payload(
            settings=self.settings,
            campaign=campaign,
            list_id=list_id,
            content=content,
        )

    def _render_campaign_content(
        self,
        *,
        campaign: ClientCampaignRecord,
        client: Any | None,
    ) -> dict[str, Any]:
        subject = (campaign.subject or "").strip() or f"Sendwise draft {campaign.id}"
        preview_text_value = (campaign.preview_text or "").strip()
        client_name = self._resolve_client_name(client)
        email_brand = self._resolve_email_brand(client)
        unsubscribe_url = build_unsubscribe_url(
            settings=self.settings,
            campaign_id=campaign.id,
        )
        template_variables = self._build_template_variables(
            campaign=campaign,
            client_name=client_name,
            unsubscribe_url=unsubscribe_url,
            email_brand=email_brand,
        )
        if campaign.content_ready and (campaign.body_html or "").strip():
            try:
                rendered_preview_text, rendered_subject = self._render_business_db_metadata(
                    subject=subject,
                    preview_text=preview_text_value,
                    template_variables=template_variables,
                )
                content_variables = dict(template_variables)
                content_variables["preview_text"] = rendered_preview_text
                content_variables["subject"] = rendered_subject
                rendered_body = render_sendwise_template_string(
                    str(campaign.body_html),
                    content_variables,
                    field_name="body_html",
                )
                rendered_body_text = render_sendwise_template_string(
                    str(campaign.body_text or ""),
                    content_variables,
                    field_name="body_text",
                )
                rendered_body = ensure_unsubscribe_link(rendered_body, unsubscribe_url)
                validate_rendered_template_content_ready(
                    source_fields={
                        "subject": subject,
                        "preview_text": preview_text_value,
                        "body_html": str(campaign.body_html or ""),
                        "body_text": str(campaign.body_text or ""),
                    },
                    rendered_body_html=rendered_body,
                    resolved_variables=content_variables,
                )
            except TemplateRenderError as error:
                return {
                    "template_name": "campaign_business_db",
                    "content_ready": False,
                    "allow_listmonk_sync": False,
                    "reason_code": getattr(
                        error,
                        "code",
                        "template_content_not_ready",
                    ),
                    "reason": str(error),
                    "subject": "",
                    "preview_text": "",
                    "body": "",
                    "body_text": "",
                    "unsubscribe_url": unsubscribe_url,
                    "client_name": client_name,
                }
            return {
                "template_name": "campaign_business_db",
                "content_ready": True,
                "allow_listmonk_sync": True,
                "reason_code": None,
                "reason": None,
                "subject": rendered_subject,
                "preview_text": rendered_preview_text,
                "body": rendered_body,
                "body_text": rendered_body_text,
                "unsubscribe_url": unsubscribe_url,
                "client_name": client_name,
            }

        preview_text = preview_text_value or (
            f"Technical preview for campaign {campaign.name}."
        )
        body = (
            f"<p>This is the Sendwise technical preview for <strong>{campaign.name}</strong>.</p>"
            f"<p>Subject: {subject}</p>"
            "<p>No real email was sent. This HTML exists for campaign preparation "
            "and simulation only.</p>"
        )
        try:
            rendered = self.template_renderer.render(
                template_name="campaign",
                subject=subject,
                preview_text=preview_text,
                body=body,
                unsubscribe_url=unsubscribe_url,
                client_name=client_name,
                campaign_name=campaign.name,
                current_year=datetime.now(timezone.utc).year,
                email_brand=email_brand,
            )
        except (CompiledTemplateNotFoundError, TemplateRenderError) as error:
            return {
                "template_name": "campaign",
                "content_ready": False,
                "allow_listmonk_sync": True,
                "reason": str(error),
                "subject": subject,
                "preview_text": preview_text,
                "body": "",
                "body_text": campaign.body_text,
                "unsubscribe_url": unsubscribe_url,
                "client_name": client_name,
            }

        return {
            "template_name": rendered.template_name,
            "content_ready": False,
            "allow_listmonk_sync": True,
            "reason": "Campaign content is not ready in Business DB.",
            "subject": rendered.subject,
            "preview_text": rendered.preview_text,
            "body": rendered.body,
            "body_text": campaign.body_text,
            "unsubscribe_url": rendered.unsubscribe_url,
            "client_name": rendered.client_name,
        }

    def _build_template_variables(
        self,
        *,
        campaign: ClientCampaignRecord,
        client_name: str,
        unsubscribe_url: str,
        email_brand: dict[str, str],
    ) -> dict[str, str]:
        variables = build_template_variable_values(
            subject=(campaign.subject or "").strip(),
            preview_text=(campaign.preview_text or "").strip(),
            unsubscribe_url=unsubscribe_url,
            client_name=client_name,
            campaign_name=campaign.name,
            current_year=datetime.now(timezone.utc).year,
        )
        variables.update(RECIPIENT_TEMPLATE_VARIABLES)
        variables.update(email_brand)
        return variables

    def _resolve_email_brand(self, client: Any | None) -> dict[str, str]:
        metadata = getattr(client, "metadata", None)
        if not isinstance(metadata, dict):
            return build_brand_template_variables(None)

        brand = build_client_email_brand(metadata)
        if brand is None:
            return build_brand_template_variables(None)
        return build_brand_template_variables(brand.model_dump(exclude_none=True))

    def _resolve_client_name(self, client: Any | None) -> str:
        if client is None:
            return "Sendwise client"
        if getattr(client, "personal_name", None):
            return str(client.personal_name)
        if getattr(client, "email", None):
            return str(client.email).split("@")[0]
        return "Sendwise client"

    def _render_business_db_metadata(
        self,
        *,
        subject: str,
        preview_text: str,
        template_variables: dict[str, str],
    ) -> tuple[str, str]:
        preview_replacements = dict(template_variables)
        preview_replacements["preview_text"] = ""
        rendered_preview_text = render_sendwise_template_string(
            preview_text,
            preview_replacements,
            field_name="preview_text",
        )

        subject_replacements = dict(template_variables)
        subject_replacements["preview_text"] = rendered_preview_text
        subject_replacements["subject"] = ""
        rendered_subject = render_sendwise_template_string(
            subject,
            subject_replacements,
            field_name="subject",
        )
        return rendered_preview_text, rendered_subject

    def _get_campaign(
        self,
        *,
        campaign_id: str,
        current_user: AuthenticatedUser | None,
    ) -> ClientCampaignRecord | None:
        if current_user is not None and current_user.access_type == "client":
            if not current_user.client_id:
                return None
            for campaign in self.client_repository.list_client_campaigns(
                current_user.client_id
            ):
                if campaign.id == campaign_id:
                    return campaign
            return None

        for campaign in self.client_repository.list_admin_campaigns():
            if campaign.id == campaign_id:
                return ClientCampaignRecord(
                    id=campaign.id,
                    client_id=campaign.client_id,
                    name=campaign.name,
                    status=campaign.status,
                    subject=campaign.subject,
                    campaign_slot_id=campaign.campaign_slot_id,
                    preview_text=campaign.preview_text,
                    body_html=campaign.body_html,
                    body_text=campaign.body_text,
                    content_ready=campaign.content_ready,
                    contacts_ready=campaign.contacts_ready,
                    review_ready=campaign.review_ready,
                    current_step=campaign.current_step,
                    created_at=campaign.created_at,
                    updated_at=campaign.updated_at,
                )

        return None

    def _coerce_listmonk_int(self, value: str, label: str) -> int:
        try:
            return int(value)
        except ValueError as error:
            from app.integrations.listmonk.client import ListmonkError

            raise ListmonkError(f"listmonk {label} id is not numeric") from error


def get_campaign_preparation_service() -> CampaignPreparationService:
    settings = get_settings()
    listmonk_client = build_listmonk_client(settings)
    mapping_repository = get_listmonk_mapping_repository()
    mapping_service = ListmonkMappingService(mapping_repository)
    contact_repository: ContactRepository = PostgresContactRepository(settings)
    contact_sync_service = ContactSubscriberSyncService(
        listmonk_client=listmonk_client,
        mapping_service=mapping_service,
        contact_repository=contact_repository,
        unsubscribe_token_service=UnsubscribeTokenService(settings),
    )
    return CampaignPreparationService(
        settings=settings,
        listmonk_client=listmonk_client,
        mapping_service=mapping_service,
        client_repository=PostgresClientRepository(settings),
        contact_sync_service=contact_sync_service,
        template_renderer=get_default_template_renderer(),
    )
