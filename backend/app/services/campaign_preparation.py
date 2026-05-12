from __future__ import annotations

from dataclasses import dataclass
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
from app.services.listmonk_mappings import (
    ENTITY_TYPE_CAMPAIGN,
    LISTMONK_TYPE_CAMPAIGN,
    ListmonkMappingService,
)
from app.services.template_renderer import (
    CompiledTemplateNotFoundError,
    TemplateRenderError,
    TemplateRenderer,
    build_unsubscribe_url,
    get_default_template_renderer,
)


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

        list_mapping, list_created = self.contact_sync_service.ensure_campaign_list(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
        )
        contact_summary = self.contact_sync_service.sync_campaign_contacts(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
        )
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
        subject = (campaign.subject or "").strip()
        content_ready = bool(content["content_ready"])
        body = str(content.get("body") or "")

        payload: dict[str, Any] = {
            "name": campaign.name,
            "subject": subject or f"Sendwise technical draft {campaign.id}",
            "lists": [list_id],
            "type": "regular",
            "content_type": "html",
            "body": body,
            "tags": ["sendwise", f"content_ready:{str(content_ready).lower()}"],
        }
        if self.settings.smtp_from_email.strip():
            payload["from_email"] = self.settings.smtp_from_email.strip()

        return payload, content_ready

    def _render_campaign_content(
        self,
        *,
        campaign: ClientCampaignRecord,
        client: Any | None,
    ) -> dict[str, Any]:
        subject = (campaign.subject or "").strip() or f"Sendwise draft {campaign.id}"
        preview_text = f"Technical preview for campaign {campaign.name}."
        body = (
            f"<p>This is the Sendwise technical preview for <strong>{campaign.name}</strong>.</p>"
            f"<p>Subject: {subject}</p>"
            "<p>No real email was sent. This HTML exists for campaign preparation "
            "and simulation only.</p>"
        )
        client_name = self._resolve_client_name(client)
        unsubscribe_url = build_unsubscribe_url(
            settings=self.settings,
            campaign_id=campaign.id,
            client_id=campaign.client_id,
        )
        try:
            rendered = self.template_renderer.render(
                template_name="campaign",
                subject=subject,
                preview_text=preview_text,
                body=body,
                unsubscribe_url=unsubscribe_url,
                client_name=client_name,
            )
        except (CompiledTemplateNotFoundError, TemplateRenderError) as error:
            return {
                "template_name": "campaign",
                "content_ready": False,
                "reason": str(error),
                "subject": subject,
                "preview_text": preview_text,
                "body": "",
                "unsubscribe_url": unsubscribe_url,
                "client_name": client_name,
            }

        return {
            "template_name": rendered.template_name,
            "content_ready": True,
            "reason": None,
            "subject": rendered.subject,
            "preview_text": rendered.preview_text,
            "body": rendered.body,
            "unsubscribe_url": rendered.unsubscribe_url,
            "client_name": rendered.client_name,
        }

    def _resolve_client_name(self, client: Any | None) -> str:
        if client is None:
            return "Sendwise client"
        if getattr(client, "personal_name", None):
            return str(client.personal_name)
        if getattr(client, "email", None):
            return str(client.email).split("@")[0]
        return "Sendwise client"

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
    from app.services.campaigns import build_listmonk_client

    settings = get_settings()
    listmonk_client = build_listmonk_client(settings)
    mapping_repository = get_listmonk_mapping_repository()
    mapping_service = ListmonkMappingService(mapping_repository)
    contact_repository: ContactRepository = PostgresContactRepository(settings)
    contact_sync_service = ContactSubscriberSyncService(
        listmonk_client=listmonk_client,
        mapping_service=mapping_service,
        contact_repository=contact_repository,
    )
    return CampaignPreparationService(
        settings=settings,
        listmonk_client=listmonk_client,
        mapping_service=mapping_service,
        client_repository=PostgresClientRepository(settings),
        contact_sync_service=contact_sync_service,
        template_renderer=get_default_template_renderer(),
    )
