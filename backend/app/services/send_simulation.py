from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.core.auth import AuthenticatedUser
from app.core.config import get_settings
from app.guard.deliverability_guard import DeliverabilityGuard, SendDecision
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
from app.repositories.contacts import (
    ContactRecord,
    ContactRepository,
    PostgresContactRepository,
)
from app.repositories.email_logs import EmailLogRepository, get_email_log_repository
from app.repositories.suppression_list import (
    SuppressionListRepository,
    get_suppression_list_repository,
)


@dataclass(frozen=True)
class SendSimulationService:
    guard: DeliverabilityGuard
    client_repository: ClientRepository
    contact_repository: ContactRepository
    suppression_list_repository: SuppressionListRepository
    blocked_send_repository: BlockedSendRepository
    email_log_repository: EmailLogRepository
    campaign_preparation_service: Any | None = None

    def simulate_campaign_send(
        self,
        campaign_id: str,
        current_user: AuthenticatedUser | None = None,
    ) -> dict[str, Any]:
        campaign = self._get_campaign(
            campaign_id=campaign_id,
            current_user=current_user,
        )
        client = self._get_client(campaign=campaign)
        contacts: list[ContactRecord] = []
        suppressed_emails: set[str] = set()
        active_campaign_count: int | None = None
        if client is not None and campaign is not None:
            contacts = self.contact_repository.list_campaign_contacts(
                client_id=client.id,
                campaign_id=campaign.id,
            )
            suppressed_emails = (
                self.suppression_list_repository.list_suppressed_emails_for_campaign(
                    client_id=client.id,
                    emails=[contact.email for contact in contacts],
                )
            )
            active_campaign_count = self._count_active_campaigns(client_id=client.id)

        guard_result = self.guard.authorize_campaign_dispatch(
            email_sending_enabled=True,
            client=client,
            campaign=campaign,
            contacts=contacts,
            suppressed_emails=suppressed_emails,
            active_campaign_count=active_campaign_count,
        )
        if guard_result.decision != SendDecision.AUTHORIZED:
            return self._blocked_response(
                requested_campaign_id=campaign_id,
                guard_result=guard_result,
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
                    client_id=campaign.client_id,
                    reason=str(
                        preparation.get(
                            "reason",
                            "Campaign listmonk preparation failed.",
                        )
                    ),
                    guard_result=guard_result,
                    preparation=preparation,
                )
            content = preparation.get("content")
            if not isinstance(content, dict) or not content.get("content_ready"):
                return self._diagnostic_response(
                    campaign_id=campaign_id,
                    client_id=campaign.client_id,
                    reason=str(
                        (content or {}).get(
                            "reason",
                            "Campaign HTML template is not ready for simulation.",
                        )
                    ),
                    guard_result=guard_result,
                    preparation=preparation,
                )
        else:
            return self._diagnostic_response(
                campaign_id=campaign_id,
                client_id=campaign.client_id,
                reason="Campaign preparation service is not configured.",
                guard_result=guard_result,
                preparation={},
            )

        logs = self.email_log_repository.create_simulated_campaign_logs(
            client_id=campaign.client_id,
            campaign_id=campaign.id,
            contact_ids=[contact.id for contact in contacts],
            body=str(preparation["content"]["body"]),
        )
        response: dict[str, Any] = {
            "status": "simulated",
            "mode": "simulation",
            "campaign_id": campaign.id,
            "client_id": campaign.client_id,
            "decision": guard_result.decision,
            "reason": "Campaign dispatch simulated; no real email was sent.",
            "guard": guard_result.to_dict(),
            "listmonk_prepared": preparation is not None,
            "listmonk_dispatched": False,
            "real_send_attempted": False,
            "email_logs_created": len(logs),
            "simulated_contact_count": len(logs),
            "email_logs": [
                {
                    "id": log.id,
                    "contact_id": log.contact_id,
                    "status": log.status,
                    "provider_message_id": log.provider_message_id,
                    "body": log.body,
                    "created_at": log.created_at,
                }
                for log in logs
            ],
            "content": {
                "subject": preparation["content"]["subject"],
                "preview_text": preparation["content"]["preview_text"],
                "body": preparation["content"]["body"],
                "template_name": preparation["content"]["template_name"],
                "content_ready": preparation["content"]["content_ready"],
            },
        }
        if preparation is not None:
            response["preparation"] = preparation
        return response

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

    def _get_client(self, *, campaign: ClientCampaignRecord | None) -> ClientRecord | None:
        if campaign is None:
            return None
        return self.client_repository.get_by_id(campaign.client_id)

    def _count_active_campaigns(self, *, client_id: str) -> int:
        return sum(
            1
            for campaign in self.client_repository.list_client_campaigns(client_id)
            if campaign.status.lower() in self.guard.SENDABLE_CAMPAIGN_STATUSES
        )

    def _blocked_response(
        self,
        *,
        requested_campaign_id: str,
        guard_result: Any,
    ) -> dict[str, Any]:
        blocked_send_id: str | None = None
        if guard_result.client_id is not None and guard_result.campaign_id is not None:
            blocked_send = self.blocked_send_repository.create_blocked_send(
                client_id=guard_result.client_id,
                campaign_id=guard_result.campaign_id,
                reason=f"{guard_result.code}: {guard_result.reason}",
                decision=guard_result.decision,
            )
            blocked_send_id = blocked_send.id

        response: dict[str, Any] = {
            "status": "blocked",
            "mode": "simulation",
            "campaign_id": requested_campaign_id,
            "decision": guard_result.decision,
            "reason": guard_result.reason,
            "code": guard_result.code,
            "severity": guard_result.severity,
            "eligible_contact_count": guard_result.eligible_contact_count,
            "blocked_contact_count": guard_result.blocked_contact_count,
            "blocked_reasons": dict(guard_result.blocked_reasons or {}),
            "diagnostic": guard_result.diagnostic,
            "guard": guard_result.to_dict(),
            "listmonk_prepared": False,
            "listmonk_dispatched": False,
            "real_send_attempted": False,
            "email_logs_created": 0,
        }
        if guard_result.client_id is not None:
            response["client_id"] = guard_result.client_id
        if blocked_send_id is not None:
            response["blocked_send_id"] = blocked_send_id
        return response

    def _diagnostic_response(
        self,
        *,
        campaign_id: str,
        client_id: str,
        reason: str,
        guard_result: Any,
        preparation: dict[str, Any],
    ) -> dict[str, Any]:
        return {
            "status": "simulation_failed",
            "mode": "simulation",
            "campaign_id": campaign_id,
            "client_id": client_id,
            "decision": guard_result.decision,
            "reason": reason,
            "guard": guard_result.to_dict(),
            "preparation": preparation,
            "listmonk_prepared": False,
            "listmonk_dispatched": False,
            "real_send_attempted": False,
            "email_logs_created": 0,
        }


def get_send_simulation_service() -> SendSimulationService:
    from app.services.campaign_preparation import get_campaign_preparation_service

    settings = get_settings()
    return SendSimulationService(
        guard=DeliverabilityGuard(),
        client_repository=PostgresClientRepository(settings),
        contact_repository=PostgresContactRepository(settings),
        suppression_list_repository=get_suppression_list_repository(),
        blocked_send_repository=get_blocked_send_repository(),
        email_log_repository=get_email_log_repository(),
        campaign_preparation_service=get_campaign_preparation_service(),
    )
