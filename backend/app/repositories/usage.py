from copy import deepcopy

from app.schemas.usage import ApiUsage


MOCK_USAGE_CLIENT_ID = "client_acme"

_API_USAGE: list[ApiUsage] = [
    ApiUsage(
        id="usage_acme_api",
        client_id=MOCK_USAGE_CLIENT_ID,
        usage_type="api_requests",
        quantity=42,
        metadata={"period": "2026-05"},
        created_at="2026-05-05T12:00:00Z",
    ),
    ApiUsage(
        id="usage_acme_dry_runs",
        client_id=MOCK_USAGE_CLIENT_ID,
        usage_type="dry_run_sends",
        quantity=3,
        metadata={"period": "2026-05"},
        created_at="2026-05-05T12:05:00Z",
    ),
]


class UsageRepository:
    """In-memory usage data boundary for Milestone 0.5 stubs."""

    def list_api_usage(self, client_id: str | None = None) -> list[ApiUsage]:
        usage_records = _API_USAGE
        if client_id is not None:
            usage_records = [
                usage for usage in usage_records if usage.client_id == client_id
            ]
        return deepcopy(usage_records)

    def planned_usage_stub(self, endpoint: str) -> dict[str, str]:
        return {"status": "stub", "endpoint": endpoint}
