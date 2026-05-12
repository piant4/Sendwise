from dataclasses import dataclass
from typing import Any

from app.core.config import Settings, get_settings
from app.guard.deliverability_guard import DeliverabilityGuard, SendDecision
from app.integrations.listmonk.client import ListmonkClient


@dataclass(frozen=True)
class CampaignDispatchService:
    settings: Settings
    guard: DeliverabilityGuard
    listmonk_client: ListmonkClient

    def send_campaign(self, campaign_id: str) -> dict[str, Any]:
        guard_result = self.guard.authorize_campaign_send(
            self.settings.email_sending_enabled
        )

        if guard_result.decision != SendDecision.AUTHORIZED:
            return {
                "status": "blocked",
                "campaign_id": campaign_id,
                "decision": guard_result.decision,
                "reason": guard_result.reason,
                "listmonk_dispatched": False,
            }

        listmonk_result = self.listmonk_client.trigger_campaign_send(campaign_id)
        return {
            "status": "queued",
            "campaign_id": campaign_id,
            "decision": guard_result.decision,
            "reason": guard_result.reason,
            "listmonk_dispatched": True,
            "listmonk": listmonk_result,
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
    return CampaignDispatchService(
        settings=settings,
        guard=DeliverabilityGuard(),
        listmonk_client=build_listmonk_client(settings),
    )
