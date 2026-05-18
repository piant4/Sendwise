from __future__ import annotations

import base64
import hashlib
import hmac
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from app.core.config import Settings, get_settings
from app.repositories.contacts import ContactRepository, get_contact_repository
from app.services.provider_events import (
    NormalizedProviderEvent,
    ProviderEventIngestionService,
    get_provider_event_ingestion_service,
)

LISTMONK_UNSUBSCRIBE_TOKEN_ATTR = "sendwise_unsubscribe_token"
LISTMONK_UNSUBSCRIBE_TOKEN_PLACEHOLDER = "{{ .Subscriber.Attribs.sendwise_unsubscribe_token }}"


class InvalidUnsubscribeTokenError(ValueError):
    pass


@dataclass(frozen=True)
class UnsubscribeTokenService:
    settings: Settings

    def generate_token(
        self,
        *,
        client_id: str,
        contact_id: str,
    ) -> str:
        payload = {
            "v": 1,
            "client_id": client_id,
            "contact_id": contact_id,
        }
        encoded = self._encode_payload(payload)
        signature = self._sign(encoded)
        return f"{encoded}.{signature}"

    def parse_token(self, token: str) -> dict[str, str]:
        encoded, separator, provided_signature = token.partition(".")
        if not encoded or separator != "." or not provided_signature:
            raise InvalidUnsubscribeTokenError("Invalid unsubscribe token.")

        expected_signature = self._sign(encoded)
        if not hmac.compare_digest(provided_signature, expected_signature):
            raise InvalidUnsubscribeTokenError("Invalid unsubscribe token.")

        try:
            payload = json.loads(_urlsafe_b64decode(encoded).decode("utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError, ValueError) as error:
            raise InvalidUnsubscribeTokenError("Invalid unsubscribe token.") from error

        if (
            not isinstance(payload, dict)
            or payload.get("v") != 1
            or not str(payload.get("client_id") or "").strip()
            or not str(payload.get("contact_id") or "").strip()
        ):
            raise InvalidUnsubscribeTokenError("Invalid unsubscribe token.")

        return {
            "client_id": str(payload["client_id"]).strip(),
            "contact_id": str(payload["contact_id"]).strip(),
        }

    def _encode_payload(self, payload: dict[str, Any]) -> str:
        serialized = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode(
            "utf-8"
        )
        return _urlsafe_b64encode(serialized)

    def _sign(self, value: str) -> str:
        digest = hmac.new(
            self.settings.unsubscribe_token_secret.encode("utf-8"),
            value.encode("utf-8"),
            hashlib.sha256,
        ).digest()
        return _urlsafe_b64encode(digest)


@dataclass(frozen=True)
class UnsubscribeService:
    settings: Settings
    token_service: UnsubscribeTokenService
    contact_repository: ContactRepository
    provider_event_service: ProviderEventIngestionService

    def unsubscribe(
        self,
        *,
        token: str,
        campaign_id: str | None = None,
    ) -> dict[str, Any]:
        resolved = self.token_service.parse_token(token)
        contact = self.contact_repository.get_by_id(resolved["contact_id"])
        if contact is None or contact.client_id != resolved["client_id"]:
            raise InvalidUnsubscribeTokenError("Invalid unsubscribe token.")

        response = self.provider_event_service.ingest_event(
            NormalizedProviderEvent(
                provider="sendwise",
                source="unsubscribe_link",
                provider_event_id=(
                    f"unsubscribe:{contact.id}:{campaign_id or 'global'}"
                ),
                event_type="sendwise_unsubscribe",
                occurred_at=datetime.now(timezone.utc),
                campaign_id=campaign_id,
                contact_id=contact.id,
                client_id=contact.client_id,
                email=contact.email,
                payload={
                    "campaign_id": campaign_id,
                    "contact_id": contact.id,
                    "client_id": contact.client_id,
                    "email": contact.email,
                },
            )
        )

        return {
            "status": "unsubscribed",
            "contact_id": contact.id,
            "campaign_id": campaign_id,
            "already_suppressed": not response.created,
        }


def _urlsafe_b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("utf-8").rstrip("=")


def _urlsafe_b64decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}".encode("utf-8"))


def get_unsubscribe_service() -> UnsubscribeService:
    settings = get_settings()
    token_service = UnsubscribeTokenService(settings)
    return UnsubscribeService(
        settings=settings,
        token_service=token_service,
        contact_repository=get_contact_repository(),
        provider_event_service=get_provider_event_ingestion_service(),
    )
