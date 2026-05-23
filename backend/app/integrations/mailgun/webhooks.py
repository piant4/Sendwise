from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


class InvalidMailgunWebhookError(ValueError):
    pass


@dataclass(frozen=True)
class MailgunWebhookEnvelope:
    timestamp: str
    token: str
    signature: str
    event_data: dict[str, Any]


@dataclass(frozen=True)
class MailgunWebhookVerifier:
    signing_key: str

    def verify(self, *, timestamp: str, token: str, signature: str) -> bool:
        normalized_timestamp = timestamp.strip()
        normalized_token = token.strip()
        normalized_signature = signature.strip().lower()
        if (
            not self.signing_key.strip()
            or not normalized_timestamp
            or not normalized_token
            or not normalized_signature
        ):
            return False
        expected = hmac.new(
            self.signing_key.encode("utf-8"),
            f"{normalized_timestamp}{normalized_token}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, normalized_signature)


def parse_mailgun_webhook_payload(payload: dict[str, Any]) -> MailgunWebhookEnvelope:
    event_data = _extract_event_data(payload)
    signature_payload = _extract_signature_payload(payload)
    timestamp = _coerce_required_string(signature_payload.get("timestamp"), field_name="timestamp")
    token = _coerce_required_string(signature_payload.get("token"), field_name="token")
    signature = _coerce_required_string(signature_payload.get("signature"), field_name="signature")
    return MailgunWebhookEnvelope(
        timestamp=timestamp,
        token=token,
        signature=signature,
        event_data=event_data,
    )


def _extract_event_data(payload: dict[str, Any]) -> dict[str, Any]:
    if isinstance(payload.get("event-data"), dict):
        return dict(payload["event-data"])
    if isinstance(payload.get("event_data"), dict):
        return dict(payload["event_data"])

    encoded = payload.get("event-data") or payload.get("event_data")
    if isinstance(encoded, str) and encoded.strip():
        try:
            parsed = json.loads(encoded)
        except json.JSONDecodeError as error:
            raise InvalidMailgunWebhookError("Invalid Mailgun event-data payload.") from error
        if isinstance(parsed, dict):
            return parsed
    raise InvalidMailgunWebhookError("Mailgun event-data payload is required.")


def _extract_signature_payload(payload: dict[str, Any]) -> dict[str, Any]:
    if isinstance(payload.get("signature"), dict):
        return dict(payload["signature"])
    if isinstance(payload.get("Signature"), dict):
        return dict(payload["Signature"])

    flattened = {
        "timestamp": payload.get("timestamp"),
        "token": payload.get("token"),
        "signature": payload.get("signature"),
    }
    if any(value is not None for value in flattened.values()):
        return flattened
    raise InvalidMailgunWebhookError("Mailgun signature payload is required.")


def _coerce_required_string(value: Any, *, field_name: str) -> str:
    normalized = str(value or "").strip()
    if not normalized:
        raise InvalidMailgunWebhookError(f"Mailgun webhook {field_name} is required.")
    return normalized


def coerce_mailgun_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(float(value), tz=timezone.utc)
    if isinstance(value, str) and value.strip():
        normalized = value.strip().replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError as error:
            raise InvalidMailgunWebhookError("Invalid Mailgun event timestamp.") from error
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc)
