from app.repositories.blocked_sends import BlockedSendsRepository, MOCK_CLIENT_ID
from app.schemas.blocked_sends import BlockedSend


class BlockedSendsService:
    def __init__(self, repository: BlockedSendsRepository | None = None) -> None:
        self.repository = repository or BlockedSendsRepository()

    def list_current_client_blocked_sends(self) -> list[BlockedSend]:
        return self.repository.list_blocked_sends(client_id=MOCK_CLIENT_ID)

    def planned_admin_client_blocked_sends_stub(self, client_id: str) -> dict[str, str]:
        return {
            "status": "stub",
            "endpoint": f"GET /admin/clients/{client_id}/blocked-sends",
        }

    def planned_admin_blocked_sends_stub(self) -> dict[str, str]:
        return {"status": "stub", "endpoint": "GET /admin/blocked-sends"}
