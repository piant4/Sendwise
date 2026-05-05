from app.repositories.clients import ClientsRepository
from app.schemas.blocked_sends import BlockedSend
from app.schemas.campaigns import Campaign
from app.schemas.clients import Client, ClientContext
from app.schemas.usage import ApiUsage


class ClientsService:
    def __init__(self, repository: ClientsRepository | None = None) -> None:
        self.repository = repository or ClientsRepository()

    def list_admin_clients(self) -> list[Client]:
        return self.repository.list_admin_clients()

    def planned_admin_client_stub(self, endpoint: str) -> dict[str, str]:
        return {"status": "stub", "endpoint": endpoint}

    def get_current_client_context(self) -> ClientContext:
        return self.repository.get_current_client_context()

    def list_current_client_campaigns(self) -> list[Campaign]:
        client_id = self.repository.get_current_client_context().client.id
        return self.repository.list_current_client_campaigns(client_id)

    def planned_client_stub(self, endpoint: str) -> dict[str, str]:
        return {"status": "stub", "endpoint": endpoint}

    def list_current_client_usage(self) -> list[ApiUsage]:
        client_id = self.repository.get_current_client_context().client.id
        return self.repository.list_current_client_usage(client_id)

    def list_current_client_blocked_sends(self) -> list[BlockedSend]:
        client_id = self.repository.get_current_client_context().client.id
        return self.repository.list_current_client_blocked_sends(client_id)
