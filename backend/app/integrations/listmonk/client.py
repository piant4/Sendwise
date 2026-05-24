from dataclasses import dataclass
from typing import Any, Optional

import httpx


class ListmonkError(RuntimeError):
    """Controlled error for failed listmonk API calls."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        method: str | None = None,
        path: str | None = None,
        response_message: str | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.method = method
        self.path = path
        self.response_message = response_message


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

    def get_subscriber(self, subscriber_id: int | str) -> dict[str, Any]:
        return self._request("GET", f"/api/subscribers/{subscriber_id}")

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
            if status_code == 403:
                raise self._build_forbidden_error(method=method, path=path) from error
            response_message = self._extract_response_message(error.response)
            raise ListmonkError(
                self._build_http_error_message(
                    method=method,
                    path=path,
                    status_code=status_code,
                    response=error.response,
                    payload=json,
                ),
                status_code=status_code,
                method=method.upper(),
                path=self._redact_path(path),
                response_message=response_message,
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

    def _build_forbidden_error(self, *, method: str, path: str) -> ListmonkError:
        redacted_path = self._redact_path(path)
        permission_hint = self._permission_hint(method=method, path=path)
        message = (
            f"Listmonk rejected {permission_hint['action']}. "
            f"Verify API credentials and the {permission_hint['permission']} permission "
            f"for {method.upper()} {redacted_path}."
        )
        return ListmonkError(
            message,
            status_code=403,
            method=method.upper(),
            path=redacted_path,
        )

    def _build_http_error_message(
        self,
        *,
        method: str,
        path: str,
        status_code: int,
        response: httpx.Response,
        payload: dict[str, Any] | None,
    ) -> str:
        diagnostics = self._build_safe_http_diagnostics(
            method=method,
            path=path,
            status_code=status_code,
            response=response,
            payload=payload,
        )
        return f"listmonk returned HTTP {status_code}. Safe diagnostics: {diagnostics}"

    def _build_safe_http_diagnostics(
        self,
        *,
        method: str,
        path: str,
        status_code: int,
        response: httpx.Response,
        payload: dict[str, Any] | None,
    ) -> str:
        payload_keys = sorted(payload.keys()) if isinstance(payload, dict) else []
        numeric_list_ids = self._extract_numeric_list_ids(payload)
        template_id = self._extract_numeric_template_id(payload)
        response_message = self._extract_response_message(response)
        message_parts = [
            f"method={method.upper()}",
            f"endpoint={self._redact_path(path)}",
            f"status_code={status_code}",
            f"response_message={response_message or 'none'}",
            f"payload_keys={payload_keys}",
            f"list_ids_count={len(numeric_list_ids)}",
            f"list_ids={numeric_list_ids}",
            f"content_type={self._string_or_none(payload, 'content_type')}",
            f"campaign_type={self._string_or_none(payload, 'type')}",
            (
                f"template_id={template_id}"
                if template_id is not None
                else "template_id=absent"
            ),
            f"has_body={self._has_non_empty_string(payload, 'body')}",
            f"has_altbody={self._has_non_empty_string(payload, 'altbody')}",
            f"has_subject={self._has_non_empty_string(payload, 'subject')}",
        ]
        return ", ".join(message_parts)

    def _extract_response_message(self, response: httpx.Response) -> str | None:
        try:
            payload = response.json()
        except ValueError:
            text = response.text.strip()
            return text or None
        return self._extract_message_from_payload(payload)

    def _extract_message_from_payload(self, payload: Any) -> str | None:
        if isinstance(payload, dict):
            for key in ("message", "error", "detail"):
                value = payload.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()
            errors = payload.get("errors")
            if isinstance(errors, list):
                normalized = [str(item).strip() for item in errors if str(item).strip()]
                if normalized:
                    return "; ".join(normalized)
            data = payload.get("data")
            if isinstance(data, dict):
                return self._extract_message_from_payload(data)
        return None

    def _extract_numeric_list_ids(self, payload: dict[str, Any] | None) -> list[int]:
        if not isinstance(payload, dict):
            return []
        list_value = payload.get("lists")
        if not isinstance(list_value, list):
            return []
        numeric_ids: list[int] = []
        for item in list_value:
            try:
                numeric_ids.append(int(str(item).strip()))
            except (TypeError, ValueError):
                continue
        return numeric_ids

    def _extract_numeric_template_id(self, payload: dict[str, Any] | None) -> int | None:
        if not isinstance(payload, dict):
            return None
        template_id = payload.get("template_id")
        try:
            return int(str(template_id).strip())
        except (TypeError, ValueError):
            return None

    def _string_or_none(self, payload: dict[str, Any] | None, key: str) -> str:
        if not isinstance(payload, dict):
            return "none"
        value = str(payload.get(key) or "").strip()
        return value or "none"

    def _has_non_empty_string(self, payload: dict[str, Any] | None, key: str) -> bool:
        if not isinstance(payload, dict):
            return False
        return bool(str(payload.get(key) or "").strip())

    def _permission_hint(self, *, method: str, path: str) -> dict[str, str]:
        normalized_method = method.upper()
        redacted_path = self._redact_path(path)
        if redacted_path == "/api/campaigns/{campaign_id}/status" and normalized_method == "PUT":
            return {
                "action": "campaign start",
                "permission": "campaigns:send",
            }
        if redacted_path == "/api/campaigns" and normalized_method == "POST":
            return {
                "action": "campaign creation",
                "permission": "campaigns:create",
            }
        if redacted_path == "/api/campaigns/{campaign_id}" and normalized_method == "PUT":
            return {
                "action": "campaign update",
                "permission": "campaigns:update",
            }
        if redacted_path == "/api/subscribers" and normalized_method == "GET":
            return {
                "action": "subscriber lookup",
                "permission": "subscribers:get",
            }
        if (
            redacted_path == "/api/subscribers/{subscriber_id}"
            and normalized_method == "GET"
        ):
            return {
                "action": "subscriber lookup",
                "permission": "subscribers:get",
            }
        if redacted_path == "/api/subscribers" and normalized_method == "POST":
            return {
                "action": "subscriber creation",
                "permission": "subscribers:create",
            }
        if redacted_path == "/api/subscribers/{subscriber_id}" and normalized_method == "PATCH":
            return {
                "action": "subscriber update",
                "permission": "subscribers:update",
            }
        if redacted_path == "/api/subscribers/lists" and normalized_method == "PUT":
            return {
                "action": "subscriber list assignment",
                "permission": "subscribers:update",
            }
        if redacted_path == "/api/lists" and normalized_method == "POST":
            return {
                "action": "list creation",
                "permission": "lists:create",
            }
        return {
            "action": "API access",
            "permission": "required Listmonk API",
        }

    def _redact_path(self, path: str) -> str:
        normalized = f"/{path.lstrip('/')}"
        segments = normalized.split("/")
        redacted_segments: list[str] = []
        for index, segment in enumerate(segments):
            if not segment:
                redacted_segments.append(segment)
                continue
            previous = redacted_segments[index - 1] if index > 0 else ""
            if previous == "campaigns" and segment not in {"status"}:
                redacted_segments.append("{campaign_id}")
                continue
            if previous == "subscribers" and segment not in {"lists"}:
                redacted_segments.append("{subscriber_id}")
                continue
            redacted_segments.append(segment)
        return "/".join(redacted_segments)
