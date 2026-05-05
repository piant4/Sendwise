from app.repositories.campaigns import CampaignsRepository
from app.schemas.campaigns import Campaign


class CampaignsService:
    def __init__(self, repository: CampaignsRepository | None = None) -> None:
        self.repository = repository or CampaignsRepository()

    def list_admin_campaigns(self) -> list[Campaign]:
        return self.repository.list_admin_campaigns()

    def planned_admin_campaign_stub(self, endpoint: str) -> dict[str, str]:
        return {"status": "stub", "endpoint": endpoint}
