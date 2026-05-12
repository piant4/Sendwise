from dataclasses import dataclass
from typing import Any

from app.core.auth import AuthenticatedUser
from app.core.config import Settings, get_settings
from app.guard.deliverability_guard import DeliverabilityGuard, SendDecision
from app.integrations.listmonk.client import ListmonkClient, extract_listmonk_id
from app.repositories.blocked_sends import (
    BlockedSendRepository,
    get_blocked_send_repository,
)
from app.repositories.clients import (
    ClientCampaignRecord,
    ClientRecord,
    ClientRepository,
    PostgresClientRepository,
)
from app.repositories.contacts import ContactRepository, PostgresContactRepository
from app.repositories.listmonk_mappings import get_listmonk_mapping_repository
from app.repositories.suppression_list import (
    SuppressionListRepository,
    get_suppression_list_repository,
)
from app.services.listmonk_mappings import (
    ENTITY_TYPE_CAMPAIGN,
    LISTMONK_TYPE_CAMPAIGN,
    ListmonkMappingConflictError,
    ListmonkMappingService,
)


@dataclass(frozen=True)
class CampaignDispatchService:
    settings: Settings
    guard: DeliverabilityGuard
    listmonk_client: ListmonkClient
    mapping_service: ListmonkMappingService | None = None
    client_repository: ClientRepository | None = None
    contact_repository: ContactRepository | None = None
    suppression_list_repository: SuppressionListRepository | None = None
    blocked_send_repository: BlockedSendRepository | None = None
    campaign_preparation_service: Any | None = None

    def send_campaign(
        self,
        campaign_id: str,
        current_user: AuthenticatedUser | None = None,
    ) -> dict[str, Any]:
        mapping_service = self.mapping_service
        client_repository = self.client_repository
        contact_repository = self.contact_repository
        suppression_repository = self.suppression_list_repository
        blocked_send_repository = self.blocked_send_repository

        if (
            mapping_service is None
            or client_repository is None
            or contact_repository is None
            or suppression_repository is None
        ):
            guard_result = self.guard.authorize_campaign_send(
                self.settings.email_sending_enabled
            )
            return self._diagnostic_response(
                campaign_id=campaign_id,
                decision=guard_result.decision,
                reason="Campaign dispatch persistence is not configured.",
            )

        campaign = self._get_campaign_for_dispatch(
            campaign_id=campaign_id,
            current_user=current_user,
            client_repository=client_repository,
        )
        client = self._get_client_for_dispatch(
            campaign=campaign,
            client_repository=client_repository,
        )
        contacts = []
        suppressed_emails: set[str] = set()
        active_campaign_count: int | None = None
        if client is not None and campaign is not None:
            contacts = contact_repository.list_campaign_contacts(
                client_id=client.id,
                campaign_id=campaign.id,
            )
            suppressed_emails = suppression_repository.list_suppressed_emails_for_campaign(
                client_id=client.id,
                emails=[contact.email for contact in contacts],
            )
            active_campaign_count = self._count_active_campaigns_for_client(
                client_id=client.id,
                client_repository=client_repository,
            )

        guard_result = self.guard.authorize_campaign_dispatch(
            email_sending_enabled=self.settings.email_sending_enabled,
            client=client,
            campaign=campaign,
            contacts=contacts,
            suppressed_emails=suppressed_emails,
            active_campaign_count=active_campaign_count,
        )
        if guard_result.decision != SendDecision.AUTHORIZED:
            return self._blocked_response(
                campaign_id=campaign_id,
                guard_result=guard_result,
                blocked_send_repository=blocked_send_repository,
            )

        preparation = None
        if self.campaign_preparation_service is not None:
            preparation = self.campaign_preparation_service.prepare_campaign(
                campaign_id,
                current_user,
            )
            if preparation.get("status") != "synced":
                return self._diagnostic_response(
                    campaign_id=campaign_id,
                    decision=guard_result.decision,
                    reason=str(
                        preparation.get(
                            "reason",
                            "Campaign listmonk preparation failed.",
                        )
                    ),
                )

        mapping = mapping_service.get_mapping(
            client_id=campaign.client_id,
            entity_type=ENTITY_TYPE_CAMPAIGN,
            entity_id=campaign.id,
            listmonk_type=LISTMONK_TYPE_CAMPAIGN,
        )
        mapping_created = bool(
            preparation
            and isinstance(preparation.get("listmonk_mapping"), dict)
            and preparation["listmonk_mapping"].get("created")
        )

        if mapping is None:
            create_payload = self._build_listmonk_campaign_payload(campaign)
            if create_payload is None:
                return self._diagnostic_response(
                    campaign_id=campaign_id,
                    decision=guard_result.decision,
                    reason="Campaign is missing required Business DB data for listmonk mapping.",
                )

            listmonk_campaign = self.listmonk_client.create_campaign(create_payload)
            listmonk_campaign_id = extract_listmonk_id(listmonk_campaign)
            try:
                mapping = mapping_service.ensure_campaign_mapping(
                    client_id=campaign.client_id,
                    campaign_id=campaign.id,
                    listmonk_campaign_id=listmonk_campaign_id,
                )
            except ListmonkMappingConflictError as error:
                return self._diagnostic_response(
                    campaign_id=campaign_id,
                    decision=guard_result.decision,
                    reason=str(error),
                )
            mapping_created = True

        listmonk_result = self.listmonk_client.trigger_campaign_send(mapping.listmonk_id)
        response = {
            "status": "queued",
            "campaign_id": campaign_id,
            "client_id": campaign.client_id,
            "decision": guard_result.decision,
            "reason": guard_result.reason,
            "guard": guard_result.to_dict(),
            "listmonk_dispatched": True,
            "listmonk_mapping": {
                "entity_type": mapping.entity_type,
                "entity_id": mapping.entity_id,
                "listmonk_type": mapping.listmonk_type,
                "listmonk_id": mapping.listmonk_id,
                "created": mapping_created,
            },
            "listmonk": listmonk_result,
        }
        if preparation is not None:
            response["preparation"] = preparation
        return response

    def _get_campaign_for_dispatch(
        self,
        *,
        campaign_id: str,
        current_user: AuthenticatedUser | None,
        client_repository: ClientRepository,
    ) -> ClientCampaignRecord | None:
        if current_user is not None and current_user.access_type == "client":
            if not current_user.client_id:
                return None
            for campaign in client_repository.list_client_campaigns(
                current_user.client_id
            ):
                if campaign.id == campaign_id:
                    return campaign
            return None

        for campaign in client_repository.list_admin_campaigns():
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

    def _get_client_for_dispatch(
        self,
        *,
        campaign: ClientCampaignRecord | None,
        client_repository: ClientRepository,
    ) -> ClientRecord | None:
        if campaign is None:
            return None
        return client_repository.get_by_id(campaign.client_id)

    def _count_active_campaigns_for_client(
        self,
        *,
        client_id: str,
        client_repository: ClientRepository,
    ) -> int:
        return sum(
            1
            for campaign in client_repository.list_client_campaigns(client_id)
            if campaign.status.lower() in self.guard.SENDABLE_CAMPAIGN_STATUSES
        )

    def _blocked_response(
        self,
        *,
        campaign_id: str,
        guard_result: Any,
        blocked_send_repository: BlockedSendRepository | None,
    ) -> dict[str, Any]:
        blocked_send_id: str | None = None
        if (
            guard_result.client_id is not None
            and guard_result.campaign_id is not None
            and blocked_send_repository is not None
        ):
            blocked_send = blocked_send_repository.create_blocked_send(
                client_id=guard_result.client_id,
                campaign_id=guard_result.campaign_id,
                reason=f"{guard_result.code}: {guard_result.reason}",
                decision=guard_result.decision,
            )
            blocked_send_id = blocked_send.id

        response: dict[str, Any] = {
            "status": "blocked",
            "campaign_id": campaign_id,
            "decision": guard_result.decision,
            "reason": guard_result.reason,
            "code": guard_result.code,
            "severity": guard_result.severity,
            "eligible_contact_count": guard_result.eligible_contact_count,
            "blocked_contact_count": guard_result.blocked_contact_count,
            "blocked_reasons": dict(guard_result.blocked_reasons or {}),
            "diagnostic": guard_result.diagnostic,
            "guard": guard_result.to_dict(),
            "listmonk_dispatched": False,
        }
        if guard_result.client_id is not None:
            response["client_id"] = guard_result.client_id
        if blocked_send_id is not None:
            response["blocked_send_id"] = blocked_send_id
        return response

    def _build_listmonk_campaign_payload(
        self,
        campaign: ClientCampaignRecord,
    ) -> dict[str, Any] | None:
        if not campaign.name.strip() or not (campaign.subject or "").strip():
            return None

        return {
            "name": campaign.name,
            "subject": campaign.subject,
        }

    def _diagnostic_response(
        self,
        *,
        campaign_id: str,
        decision: SendDecision,
        reason: str,
    ) -> dict[str, Any]:
        return {
            "status": "dispatch_blocked",
            "campaign_id": campaign_id,
            "decision": decision,
            "reason": reason,
            "listmonk_dispatched": False,
        }


def build_listmonk_client(settings: Settings) -> ListmonkClient:
    return ListmonkClient(
        base_url=settings.listmonk_url,
        username=settings.listmonk_username,
        password=settings.listmonk_password,
        timeout_seconds=settings.listmonk_timeout_seconds,
    )


def get_campaign_dispatch_service() -> CampaignDispatchService:
    settings = get_settings()
    mapping_repository = get_listmonk_mapping_repository()
    from app.services.campaign_preparation import get_campaign_preparation_service

    return CampaignDispatchService(
        settings=settings,
        guard=DeliverabilityGuard(),
        listmonk_client=build_listmonk_client(settings),
        mapping_service=ListmonkMappingService(mapping_repository),
        client_repository=PostgresClientRepository(settings),
        contact_repository=PostgresContactRepository(settings),
        suppression_list_repository=get_suppression_list_repository(),
        blocked_send_repository=get_blocked_send_repository(),
        campaign_preparation_service=get_campaign_preparation_service(),
    )
