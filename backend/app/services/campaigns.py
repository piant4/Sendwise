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
    ClientRepository,
    PostgresClientRepository,
)
from app.repositories.listmonk_mappings import get_listmonk_mapping_repository
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
    blocked_send_repository: BlockedSendRepository | None = None
    campaign_preparation_service: Any | None = None

    def send_campaign(
        self,
        campaign_id: str,
        current_user: AuthenticatedUser | None = None,
    ) -> dict[str, Any]:
        guard_result = self.guard.authorize_campaign_send(
            self.settings.email_sending_enabled
        )

        mapping_service = self.mapping_service
        client_repository = self.client_repository
        blocked_send_repository = self.blocked_send_repository

        if guard_result.decision != SendDecision.AUTHORIZED:
            blocked_send_id: str | None = None
            campaign = None
            if client_repository is not None:
                campaign = self._get_campaign_for_dispatch(
                    campaign_id=campaign_id,
                    current_user=current_user,
                    client_repository=client_repository,
                )
            if campaign is not None and blocked_send_repository is not None:
                blocked_send = blocked_send_repository.create_blocked_send(
                    client_id=campaign.client_id,
                    campaign_id=campaign.id,
                    reason=guard_result.reason,
                    decision=guard_result.decision,
                )
                blocked_send_id = blocked_send.id

            response: dict[str, Any] = {
                "status": "blocked",
                "campaign_id": campaign_id,
                "decision": guard_result.decision,
                "reason": guard_result.reason,
                "listmonk_dispatched": False,
            }
            if campaign is not None:
                response["client_id"] = campaign.client_id
            if blocked_send_id is not None:
                response["blocked_send_id"] = blocked_send_id
            return response

        if mapping_service is None or client_repository is None:
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
        if campaign is None:
            return self._diagnostic_response(
                campaign_id=campaign_id,
                decision=guard_result.decision,
                reason="Campaign was not found in Business DB for this caller.",
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
        blocked_send_repository=get_blocked_send_repository(),
        campaign_preparation_service=get_campaign_preparation_service(),
    )
