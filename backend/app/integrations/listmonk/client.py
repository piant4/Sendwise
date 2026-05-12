from dataclasses import dataclass
from typing import Any, Optional

import httpx


class ListmonkError(RuntimeError):
    """Controlled error for failed listmonk API calls."""


@dataclass(frozen=True)
class ListmonkClient:
    """Thin listmonk API adapter.

    The adapter translates backend-approved operations to listmonk HTTP calls.
    It must not decide campaign ownership, contact sendability, limits, or
    suppression policy.
    """

    base_url: str
    username: str | None = None
    password: str | None = None
    timeout_seconds: float = 5.0

    def health(self) -> dict[str, Any]:
        return self._request("GET", "/api/health")

    def create_campaign(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/api/campaigns", json=payload)

    def trigger_campaign_send(self, campaign_id: int | str) -> dict[str, Any]:
        return self._request("PUT", f"/api/campaigns/{campaign_id}/status", json={"status": "running"})

    def _request(
        self,
        method: str,
        path: str,
        *,
        json: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        url = f"{self.base_url.rstrip('/')}/{path.lstrip('/')}"
        auth = (self.username, self.password or "") if self.username else None

        try:
            response = httpx.request(
                method,
                url,
                auth=auth,
                json=json,
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
        except httpx.TimeoutException as error:
            raise ListmonkError("listmonk request timed out") from error
        except httpx.HTTPStatusError as error:
            status_code = error.response.status_code
            raise ListmonkError(f"listmonk returned HTTP {status_code}") from error
        except httpx.RequestError as error:
            raise ListmonkError("listmonk request failed") from error

        if not response.content:
            return {"status": "ok"}

        try:
            payload = response.json()
        except ValueError as error:
            raise ListmonkError("listmonk returned a non-JSON response") from error

        if isinstance(payload, dict):
            return payload

        return {"data": payload}
