from app.repositories.usage import MOCK_USAGE_CLIENT_ID, UsageRepository
from app.schemas.usage import ApiUsage


class UsageService:
    def __init__(self, repository: UsageRepository | None = None) -> None:
        self.repository = repository or UsageRepository()

    def list_current_client_usage(self) -> list[ApiUsage]:
        return self.repository.list_api_usage(client_id=MOCK_USAGE_CLIENT_ID)

    def list_client_usage(self, client_id: str) -> list[ApiUsage]:
        return self.repository.list_api_usage(client_id=client_id)

    def planned_admin_client_usage_stub(self, client_id: str) -> dict[str, str]:
        return self.repository.planned_usage_stub(
            f"GET /admin/clients/{client_id}/usage"
        )

    def planned_admin_api_usage_stub(self) -> dict[str, str]:
        return self.repository.planned_usage_stub("GET /admin/api-usage")
