from datetime import datetime, timezone

from app.repositories.blocked_sends import BlockedSendsRepository, MOCK_CLIENT_ID
from app.schemas.blocked_sends import BlockedSend
from app.schemas.common import SendDecision


class BlockedSendsService:
    def __init__(self, repository: BlockedSendsRepository | None = None) -> None:
        self.repository = repository or BlockedSendsRepository()

    def list_current_client_blocked_sends(self) -> list[BlockedSend]:
        return self.repository.list_blocked_sends(client_id=MOCK_CLIENT_ID)

    def log_blocked_authorization(
        self,
        *,
        client_id: str,
        campaign_id: str,
        reason: str,
        decision: str,
        contact_id: str | None = None,
    ) -> BlockedSend:
        record = BlockedSend(
            id=f"blocked_{client_id}_{campaign_id}_authorization",
            client_id=client_id,
            campaign_id=campaign_id,
            contact_id=contact_id,
            reason=reason,
            decision=SendDecision(decision),
            created_at=datetime.now(timezone.utc),
        )
        return self.repository.append_blocked_send(record)

    def planned_admin_client_blocked_sends_stub(self, client_id: str) -> dict[str, str]:
        return {
            "status": "stub",
            "endpoint": f"GET /admin/clients/{client_id}/blocked-sends",
        }

    def planned_admin_blocked_sends_stub(self) -> dict[str, str]:
        return {"status": "stub", "endpoint": "GET /admin/blocked-sends"}
