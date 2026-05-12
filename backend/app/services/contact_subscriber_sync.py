from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.core.config import Settings, get_settings
from app.integrations.listmonk.client import (
    ListmonkClient,
    ListmonkError,
    extract_listmonk_id,
)
from app.repositories.contacts import (
    ContactRecord,
    ContactRepository,
    PostgresContactRepository,
)
from app.repositories.listmonk_mappings import get_listmonk_mapping_repository
from app.services.campaigns import build_listmonk_client
from app.services.listmonk_mappings import (
    ENTITY_TYPE_CAMPAIGN,
    ENTITY_TYPE_CLIENT,
    ENTITY_TYPE_CONTACT,
    LISTMONK_TYPE_LIST,
    LISTMONK_TYPE_SUBSCRIBER,
    ListmonkMappingConflictError,
    ListmonkMappingService,
)

BLOCKLISTED_CONTACT_STATUSES = {
    "suppressed",
    "bounced",
    "unsubscribed",
    "blacklisted",
}
SKIPPED_CAMPAIGN_CONTACT_STATUSES = {"error"}


@dataclass(frozen=True)
class ContactSubscriberSyncService:
    listmonk_client: ListmonkClient
    mapping_service: ListmonkMappingService
    contact_repository: ContactRepository

    def sync_campaign_contacts(
        self,
        *,
        client_id: str,
        campaign_id: str,
    ) -> dict[str, Any]:
        contacts = self.contact_repository.list_campaign_contacts(
            client_id=client_id,
            campaign_id=campaign_id,
        )
        summary: dict[str, Any] = {
            "campaign_id": campaign_id,
            "client_id": client_id,
            "total_contacts": len(contacts),
            "synced_count": 0,
            "skipped_count": 0,
            "failed_count": 0,
            "errors": [],
        }

        for contact in contacts:
            if contact.client_id != client_id:
                summary["skipped_count"] += 1
                summary["errors"].append(
                    {
                        "contact_id": contact.id,
                        "reason": "Contact does not belong to this campaign client.",
                    }
                )
                continue

            if contact.status in SKIPPED_CAMPAIGN_CONTACT_STATUSES:
                summary["skipped_count"] += 1
                summary["errors"].append(
                    {
                        "contact_id": contact.id,
                        "reason": f"Contact status {contact.status} is not syncable.",
                    }
                )
                continue

            try:
                result = self.sync_contact(
                    contact_id=contact.id,
                    campaign_id=campaign_id,
                )
            except ListmonkError as error:
                summary["failed_count"] += 1
                summary["errors"].append(
                    {"contact_id": contact.id, "reason": str(error)}
                )
                continue

            if result.get("status") == "synced":
                summary["synced_count"] += 1
            elif result.get("status") == "not_synced":
                summary["skipped_count"] += 1
                summary["errors"].append(
                    {
                        "contact_id": contact.id,
                        "reason": result.get("reason", "Contact was not synced."),
                    }
                )
            else:
                summary["failed_count"] += 1
                summary["errors"].append(
                    {
                        "contact_id": contact.id,
                        "reason": result.get("reason", "Contact sync failed."),
                    }
                )

        return summary

    def ensure_campaign_list(self, *, client_id: str, campaign_id: str) -> tuple[Any, bool]:
        return self._ensure_target_list(client_id=client_id, campaign_id=campaign_id)

    def sync_contact(
        self,
        *,
        contact_id: str,
        campaign_id: str | None = None,
    ) -> dict[str, Any]:
        contact = self.contact_repository.get_by_id(contact_id)
        if contact is None:
            return {
                "status": "not_found",
                "contact_id": contact_id,
                "listmonk_synced": False,
                "reason": "Contact was not found in Business DB.",
            }

        if campaign_id is not None and not self.contact_repository.campaign_contact_exists(
            client_id=contact.client_id,
            campaign_id=campaign_id,
            contact_id=contact.id,
        ):
            return {
                "status": "not_synced",
                "contact_id": contact.id,
                "client_id": contact.client_id,
                "campaign_id": campaign_id,
                "listmonk_synced": False,
                "reason": "Contact is not assigned to this campaign in Business DB.",
            }

        list_mapping, list_created = self._ensure_target_list(
            client_id=contact.client_id,
            campaign_id=campaign_id,
        )
        list_id = self._coerce_listmonk_int(list_mapping.listmonk_id, "list")

        subscriber_mapping = self.mapping_service.get_mapping(
            client_id=contact.client_id,
            entity_type=ENTITY_TYPE_CONTACT,
            entity_id=contact.id,
            listmonk_type=LISTMONK_TYPE_SUBSCRIBER,
        )

        subscriber_created = False
        if subscriber_mapping is None:
            existing_subscriber = self.listmonk_client.get_subscriber_by_email(
                contact.email
            )
            if existing_subscriber is None:
                subscriber_payload = self._build_subscriber_payload(contact, [list_id])
                (
                    subscriber,
                    subscriber_created,
                ) = self._create_or_recover_duplicate_subscriber(
                    contact.email,
                    subscriber_payload,
                )
            else:
                subscriber = existing_subscriber
                subscriber_id = extract_listmonk_id(subscriber)
                self.listmonk_client.patch_subscriber(
                    subscriber_id,
                    self._build_subscriber_patch_payload(contact),
                )

            subscriber_id = extract_listmonk_id(subscriber)
            try:
                subscriber_mapping = (
                    self.mapping_service.ensure_contact_subscriber_mapping(
                        client_id=contact.client_id,
                        contact_id=contact.id,
                        listmonk_subscriber_id=subscriber_id,
                    )
                )
            except ListmonkMappingConflictError as error:
                return self._failed_response(contact, campaign_id, str(error))
        else:
            subscriber_id = subscriber_mapping.listmonk_id
            self.listmonk_client.patch_subscriber(
                subscriber_id,
                self._build_subscriber_patch_payload(contact),
            )

        subscriber_id_int = self._coerce_listmonk_int(
            subscriber_mapping.listmonk_id,
            "subscriber",
        )
        self.listmonk_client.assign_subscriber_lists(
            subscriber_ids=[subscriber_id_int],
            list_ids=[list_id],
            status="confirmed",
        )

        return {
            "status": "synced",
            "contact_id": contact.id,
            "client_id": contact.client_id,
            "campaign_id": campaign_id,
            "listmonk_synced": True,
            "subscriber_created": subscriber_created,
            "list_created": list_created,
            "listmonk_mapping": {
                "entity_type": subscriber_mapping.entity_type,
                "entity_id": subscriber_mapping.entity_id,
                "listmonk_type": subscriber_mapping.listmonk_type,
                "listmonk_id": subscriber_mapping.listmonk_id,
            },
            "list_mapping": {
                "entity_type": list_mapping.entity_type,
                "entity_id": list_mapping.entity_id,
                "listmonk_type": list_mapping.listmonk_type,
                "listmonk_id": list_mapping.listmonk_id,
            },
        }

    def _ensure_target_list(
        self,
        *,
        client_id: str,
        campaign_id: str | None,
    ) -> tuple[Any, bool]:
        entity_type = ENTITY_TYPE_CAMPAIGN if campaign_id is not None else ENTITY_TYPE_CLIENT
        entity_id = campaign_id or client_id
        existing = self.mapping_service.get_mapping(
            client_id=client_id,
            entity_type=entity_type,
            entity_id=entity_id,
            listmonk_type=LISTMONK_TYPE_LIST,
        )
        if existing is not None:
            return existing, False

        created_list = self.listmonk_client.create_list(
            self._build_list_payload(client_id=client_id, campaign_id=campaign_id)
        )
        list_id = extract_listmonk_id(created_list)
        if campaign_id is not None:
            mapping = self.mapping_service.ensure_campaign_list_mapping(
                client_id=client_id,
                campaign_id=campaign_id,
                listmonk_list_id=list_id,
            )
        else:
            mapping = self.mapping_service.ensure_client_list_mapping(
                client_id=client_id,
                listmonk_list_id=list_id,
            )
        return mapping, True

    def _build_list_payload(
        self,
        *,
        client_id: str,
        campaign_id: str | None,
    ) -> dict[str, Any]:
        if campaign_id is None:
            name = f"sendwise-client-{client_id}"
            description = "Sendwise technical client list"
        else:
            name = f"sendwise-campaign-{campaign_id}"
            description = "Sendwise technical campaign list"

        return {
            "name": name,
            "type": "private",
            "optin": "single",
            "status": "active",
            "tags": ["sendwise"],
            "description": description,
        }

    def _build_subscriber_payload(
        self,
        contact: ContactRecord,
        list_ids: list[int],
    ) -> dict[str, Any]:
        payload = self._build_subscriber_patch_payload(contact)
        payload["lists"] = list_ids
        payload["preconfirm_subscriptions"] = True
        return payload

    def _create_or_recover_duplicate_subscriber(
        self,
        email: str,
        payload: dict[str, Any],
    ) -> tuple[dict[str, Any], bool]:
        try:
            return self.listmonk_client.create_subscriber(payload), True
        except ListmonkError as error:
            if error.status_code not in {400, 409}:
                raise
            existing = self.listmonk_client.get_subscriber_by_email(email)
            if existing is None:
                raise
            return existing, False

    def _build_subscriber_patch_payload(self, contact: ContactRecord) -> dict[str, Any]:
        return {
            "email": contact.email,
            "name": contact.email,
            "status": self._listmonk_status(contact.status),
            "attribs": {
                "sendwise_client_id": contact.client_id,
                "sendwise_contact_id": contact.id,
            },
        }

    def _listmonk_status(self, contact_status: str) -> str:
        if contact_status in BLOCKLISTED_CONTACT_STATUSES:
            return "blocklisted"
        return "enabled"

    def _coerce_listmonk_int(self, value: str, label: str) -> int:
        try:
            return int(value)
        except ValueError as error:
            raise ListmonkError(f"listmonk {label} id is not numeric") from error

    def _failed_response(
        self,
        contact: ContactRecord,
        campaign_id: str | None,
        reason: str,
    ) -> dict[str, Any]:
        return {
            "status": "sync_failed",
            "contact_id": contact.id,
            "client_id": contact.client_id,
            "campaign_id": campaign_id,
            "listmonk_synced": False,
            "reason": reason,
        }


def get_contact_subscriber_sync_service() -> ContactSubscriberSyncService:
    settings: Settings = get_settings()
    mapping_repository = get_listmonk_mapping_repository()
    return ContactSubscriberSyncService(
        listmonk_client=build_listmonk_client(settings),
        mapping_service=ListmonkMappingService(mapping_repository),
        contact_repository=PostgresContactRepository(settings),
    )
