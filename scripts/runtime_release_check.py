from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.repositories.campaigns import PostgresCampaignRepository
from app.repositories.clients import PostgresClientRepository, postgres_connection
from app.repositories.contacts import PostgresContactRepository
from app.repositories.email_logs import PostgresEmailLogRepository
from app.schemas.campaigns import AdminCampaignContactPayload
from app.guard.deliverability_guard import DeliverabilityGuard
from app.services.campaign_preparation import CampaignPreparationService
from app.services.campaigns import (
    AdminCampaignService,
    CampaignDispatchService,
    build_listmonk_client,
    get_admin_campaign_service,
    get_campaign_dispatch_service,
)
from app.services.contact_subscriber_sync import ContactSubscriberSyncService
from app.services.listmonk_mappings import ListmonkMappingService
from app.services.template_renderer import get_default_template_renderer
from app.services.unsubscribe import UnsubscribeTokenService
from app.repositories.listmonk_mappings import get_listmonk_mapping_repository


def _now_slug() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")


def _query_scalar(settings: Any, query: str, params: tuple[Any, ...]) -> int:
    with postgres_connection(settings) as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, params)
            row = cursor.fetchone()
    if row is None:
        return 0
    return int(next(iter(row.values())))


def _find_runtime_client(
    client_repository: PostgresClientRepository,
    campaign_repository: PostgresCampaignRepository,
) -> Any:
    clients = client_repository.list_clients()
    guard = DeliverabilityGuard()

    def has_capacity(client: Any) -> bool:
        if client.status.lower() != "active":
            return False
        campaigns = campaign_repository.list_by_client(client.id)
        active_count = sum(
            1
            for campaign in campaigns
            if campaign.status.lower() in guard.SENDABLE_CAMPAIGN_STATUSES
        )
        if client.max_campaigns is None:
            return True
        return active_count < client.max_campaigns

    for preferred_email in ("qa-client@sendwise.test", "ca7rax@gmail.com"):
        for client in clients:
            if client.email.strip().lower() == preferred_email and has_capacity(client):
                return client
    for client in clients:
        if has_capacity(client):
            return client
    raise RuntimeError("No active client with campaign capacity is available for runtime release check.")


def _build_preparation_service(settings: Any) -> CampaignPreparationService:
    listmonk_client = build_listmonk_client(settings)
    mapping_service = ListmonkMappingService(get_listmonk_mapping_repository())
    contact_repository = PostgresContactRepository(settings)
    unsubscribe_token_service = UnsubscribeTokenService(settings)
    contact_sync_service = ContactSubscriberSyncService(
        listmonk_client=listmonk_client,
        mapping_service=mapping_service,
        contact_repository=contact_repository,
        unsubscribe_token_service=unsubscribe_token_service,
    )
    return CampaignPreparationService(
        settings=settings,
        listmonk_client=listmonk_client,
        mapping_service=mapping_service,
        client_repository=PostgresClientRepository(settings),
        contact_sync_service=contact_sync_service,
        template_renderer=get_default_template_renderer(),
    )


def main() -> None:
    settings = get_settings()
    campaign_service: AdminCampaignService = get_admin_campaign_service()
    dispatch_service: CampaignDispatchService = get_campaign_dispatch_service()
    client_repository = PostgresClientRepository(settings)
    contact_repository = PostgresContactRepository(settings)
    campaign_repository = PostgresCampaignRepository(settings)
    email_log_repository = PostgresEmailLogRepository(settings)
    preparation_service = _build_preparation_service(settings)

    client = _find_runtime_client(client_repository, campaign_repository)
    slug = _now_slug()

    initial_log_count = _query_scalar(
        settings,
        "SELECT COUNT(*) AS total FROM email_logs WHERE client_id::text = %s",
        (client.id,),
    )

    campaign = campaign_service.create_campaign(
        client_id=client.id,
        name=f"Milestone 17 runtime {slug}",
        subject=f"Runtime readiness {slug}",
    )
    campaign = campaign_service.update_campaign_content(
        campaign_id=campaign.campaign_id,
        subject=f"Runtime readiness {slug}",
        preview_text="Ciao {{nome}}, verifica finale locale.",
        body_html=(
            "<section><h1>Ciao {{nome}}</h1>"
            "<p>Questa campagna resta in QA locale.</p></section>"
        ),
        body_text="Ciao {{nome}}, questa campagna resta in QA locale.",
        current_step="content",
    )

    manual_result = campaign_service.add_campaign_contacts(
        campaign_id=campaign.campaign_id,
        contacts=[
            AdminCampaignContactPayload(
                email=f"manual-{slug}@example.test",
                metadata={"nome": "Mario"},
            )
        ],
    )

    reused_result = campaign_service.add_campaign_contacts(
        campaign_id=campaign.campaign_id,
        contacts=[
            AdminCampaignContactPayload(
                email=f"manual-{slug}@example.test",
                metadata={"nome": "Mario", "cognome": "Rossi"},
            )
        ],
    )

    csv_contacts = [
        AdminCampaignContactPayload(
            email=f"csv-{slug}-1@example.test",
            metadata={"nome": "Giulia", "cognome": "Bianchi"},
        ),
        AdminCampaignContactPayload(
            email=f"csv-{slug}-2@example.test",
            metadata={"nome": "Luca", "cognome": "Verdi"},
        ),
    ]
    csv_result = campaign_service.add_campaign_contacts(
        campaign_id=campaign.campaign_id,
        contacts=csv_contacts,
    )

    contacts_before_remove = campaign_service.get_campaign_contacts(campaign.campaign_id)
    removable_contact = next(
        contact
        for contact in contacts_before_remove.contacts
        if contact.email == f"csv-{slug}-2@example.test"
    )
    remove_result = campaign_service.remove_campaign_contact(
        campaign_id=campaign.campaign_id,
        contact_id=removable_contact.contact_id,
    )

    contacts_after_remove = campaign_service.get_campaign_contacts(campaign.campaign_id)
    manual_contact = contact_repository.get_by_client_email(
        client_id=client.id,
        email=f"manual-{slug}@example.test",
    )
    removed_contact = contact_repository.get_by_client_email(
        client_id=client.id,
        email=f"csv-{slug}-2@example.test",
    )

    review_result = campaign_service.review_campaign(campaign.campaign_id)
    summary_after_review = campaign_service.get_campaign_summary(campaign.campaign_id)
    campaign_after_review = campaign_repository.get_by_id(
        campaign_id=campaign.campaign_id,
        client_id=client.id,
    )

    prepared_content = preparation_service._render_campaign_content(  # noqa: SLF001
        campaign=dispatch_service._get_campaign_for_dispatch(  # noqa: SLF001
            campaign_id=campaign.campaign_id,
            current_user=None,
            client_repository=client_repository,
        ),
        client=client,
    )

    dispatch_result = dispatch_service.send_campaign(campaign.campaign_id)
    final_log_count = _query_scalar(
        settings,
        "SELECT COUNT(*) AS total FROM email_logs WHERE client_id::text = %s",
        (client.id,),
    )
    campaign_log_counts = email_log_repository.get_campaign_status_counts(
        client_id=client.id,
        campaign_id=campaign.campaign_id,
    )

    unsubscribe_request = urllib.request.Request(
        f"http://localhost:8000/unsubscribe/not-a-valid-token",
        method="GET",
    )
    try:
        urllib.request.urlopen(unsubscribe_request)
        unsubscribe_status = 200
        unsubscribe_body = ""
    except urllib.error.HTTPError as error:
        unsubscribe_status = error.code
        unsubscribe_body = error.read().decode("utf-8")

    result = {
        "client_id": client.id,
        "campaign_id": campaign.campaign_id,
        "campaign_status_after_review": campaign_after_review.status if campaign_after_review else None,
        "manual_add": {
            "attached_contacts": manual_result.attached_contacts,
            "contacts_ready": manual_result.contacts_ready,
        },
        "reused_contact_update": {
            "reused_contacts": reused_result.reused_contacts,
            "duplicate_contacts": reused_result.duplicate_contacts,
            "manual_contact_metadata": manual_contact.metadata if manual_contact else None,
        },
        "csv_import": {
            "attached_contacts": csv_result.attached_contacts,
            "created_contacts": csv_result.created_contacts,
            "contacts_ready": csv_result.contacts_ready,
        },
        "contacts_before_remove_total": contacts_before_remove.total,
        "contacts_after_remove_total": contacts_after_remove.total,
        "remove_result": {
            "removed": remove_result.removed,
            "contacts_ready": remove_result.contacts_ready,
            "removed_contact_still_exists_globally": removed_contact is not None,
            "removed_contact_still_attached": any(
                contact.contact_id == removable_contact.contact_id
                for contact in contacts_after_remove.contacts
            ),
        },
        "review": {
            "status": review_result.status,
            "allowed_to_send": review_result.allowed_to_send,
            "can_send_when_enabled": review_result.can_send_when_enabled,
            "review_ready": review_result.review_ready,
            "blocking_errors": review_result.blocking_errors,
            "warnings": review_result.warnings,
            "eligible_contact_count": review_result.eligible_contact_count,
        },
        "summary": {
            "can_send": summary_after_review.can_send,
            "can_send_when_enabled": summary_after_review.can_send_when_enabled,
            "sending_enabled": summary_after_review.sending_enabled,
            "review_ready": summary_after_review.campaign.review_ready,
            "contacts_ready": summary_after_review.campaign.contacts_ready,
            "content_ready": summary_after_review.campaign.content_ready,
        },
        "prepared_content": {
            "content_ready": prepared_content["content_ready"],
            "unsubscribe_uses_backend_public_url": str(prepared_content["unsubscribe_url"]).startswith(
                settings.backend_public_url.rstrip("/")
            ),
            "unsubscribe_present_in_body": str(prepared_content["unsubscribe_url"]) in str(
                prepared_content["body"]
            ),
        },
        "dispatch": {
            "status": dispatch_result.get("status"),
            "code": dispatch_result.get("code"),
            "reason": dispatch_result.get("reason"),
            "dispatch_attempted": dispatch_result.get("dispatch_attempted"),
            "real_send_attempted": dispatch_result.get("real_send_attempted"),
            "provider_dispatched": dispatch_result.get("listmonk_dispatched"),
            "email_logs_created": dispatch_result.get("email_logs_created"),
        },
        "email_logs": {
            "initial_client_log_count": initial_log_count,
            "final_client_log_count": final_log_count,
            "campaign_status_counts": campaign_log_counts,
        },
        "unsubscribe_invalid_token": {
            "status": unsubscribe_status,
            "safe_html": "Link non valido" in unsubscribe_body
            and "not-a-valid-token" not in unsubscribe_body,
        },
    }
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
