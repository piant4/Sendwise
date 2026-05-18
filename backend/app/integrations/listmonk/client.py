from dataclasses import dataclass
import re
from typing import Any, Optional

import httpx


class ListmonkError(RuntimeError):
    """Controlled error for failed listmonk API calls."""

    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


def extract_listmonk_id(payload: dict[str, Any]) -> str:
    """Return a stable id from common listmonk response shapes."""
    candidates = [
        payload.get("id"),
        payload.get("campaign_id"),
    ]
    data = payload.get("data")
    if isinstance(data, dict):
        candidates.extend([data.get("id"), data.get("campaign_id")])

    for candidate in candidates:
        if candidate is not None:
            normalized = str(candidate).strip()
            if normalized:
                return normalized

    raise ListmonkError("listmonk response did not include a technical id")


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

    def update_campaign(
        self,
        campaign_id: int | str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        return self._request("PUT", f"/api/campaigns/{campaign_id}", json=payload)

    def trigger_campaign_send(self, campaign_id: int | str) -> dict[str, Any]:
        return self._request("PUT", f"/api/campaigns/{campaign_id}/status", json={"status": "running"})

    def create_list(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/api/lists", json=payload)

    def get_subscriber_by_email(self, email: str) -> dict[str, Any] | None:
        escaped_email = email.replace("'", "''")
        payload = self._request(
            "GET",
            "/api/subscribers",
            params={
                "query": f"subscribers.email = '{escaped_email}'",
                "per_page": "1",
            },
        )
        data = payload.get("data")
        if isinstance(data, dict):
            results = data.get("results")
            if isinstance(results, list) and results:
                first = results[0]
                if isinstance(first, dict):
                    return first
        return None

    def create_subscriber(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self._request("POST", "/api/subscribers", json=payload)

    def patch_subscriber(
        self,
        subscriber_id: int | str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        return self._request("PATCH", f"/api/subscribers/{subscriber_id}", json=payload)

    def assign_subscriber_lists(
        self,
        *,
        subscriber_ids: list[int],
        list_ids: list[int],
        status: str = "confirmed",
    ) -> dict[str, Any]:
        return self._request(
            "PUT",
            "/api/subscribers/lists",
            json={
                "ids": subscriber_ids,
                "action": "add",
                "target_list_ids": list_ids,
                "status": status,
            },
        )

    def _request(
        self,
        method: str,
        path: str,
        *,
        json: Optional[dict[str, Any]] = None,
        params: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        url = f"{self.base_url.rstrip('/')}/{path.lstrip('/')}"
        auth = (self.username, self.password or "") if self.username else None

        try:
            response = self._perform_request(
                method=method,
                path=path,
                url=url,
                auth=auth,
                json=json,
                params=params,
            )
        except httpx.TimeoutException as error:
            raise ListmonkError("listmonk request timed out") from error
        except httpx.HTTPStatusError as error:
            status_code = error.response.status_code
            raise ListmonkError(
                f"listmonk returned HTTP {status_code}",
                status_code=status_code,
            ) from error
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

    def _perform_request(
        self,
        *,
        method: str,
        path: str,
        url: str,
        auth: tuple[str, str] | None,
        json: Optional[dict[str, Any]],
        params: Optional[dict[str, Any]],
    ) -> httpx.Response:
        try:
            response = httpx.request(
                method,
                url,
                auth=auth,
                json=json,
                params=params,
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
            return response
        except httpx.HTTPStatusError as error:
            if error.response.status_code != 403 or auth is None:
                raise
            return self._perform_session_request(
                method=method,
                path=path,
                json=json,
                params=params,
            )

    def _perform_session_request(
        self,
        *,
        method: str,
        path: str,
        json: Optional[dict[str, Any]],
        params: Optional[dict[str, Any]],
    ) -> httpx.Response:
        if not self.username or self.password is None:
            raise ListmonkError("listmonk session login requires configured credentials")

        with httpx.Client(
            base_url=self.base_url.rstrip("/"),
            follow_redirects=True,
            timeout=self.timeout_seconds,
        ) as client:
            login_page = client.get("/admin/login?next=%2Fadmin")
            login_page.raise_for_status()
            nonce_match = re.search(r'name="nonce" value="([^"]+)"', login_page.text)
            login_payload = {
                "username": self.username,
                "password": self.password,
                "next": "/admin",
                "nonce": nonce_match.group(1) if nonce_match else "",
            }
            login_response = client.post("/admin/login", data=login_payload)
            login_response.raise_for_status()
            response = client.request(
                method,
                f"/{path.lstrip('/')}",
                json=json,
                params=params,
            )
            response.raise_for_status()
            return response
