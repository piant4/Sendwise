from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from app.repositories.listmonk_mappings import (
    ListmonkMappingRecord,
    ListmonkMappingRepository,
)

ENTITY_TYPE_CAMPAIGN = "campaign"
ENTITY_TYPE_CAMPAIGN_FOLLOWUP = "campaign_followup"
ENTITY_TYPE_CLIENT = "client"
ENTITY_TYPE_CONTACT = "contact"
LISTMONK_TYPE_CAMPAIGN = "campaign"
LISTMONK_TYPE_LIST = "list"
LISTMONK_TYPE_SUBSCRIBER = "subscriber"


class ListmonkMappingConflictError(RuntimeError):
    """Raised when a business entity points at a different listmonk target."""


@dataclass(frozen=True)
class ListmonkMappingService:
    repository: ListmonkMappingRepository

    def get_mapping(
        self,
        *,
        client_id: str,
        entity_type: str,
        entity_id: str,
        listmonk_type: str,
    ) -> Optional[ListmonkMappingRecord]:
        return self.repository.get_mapping(
            client_id=client_id,
            entity_type=entity_type,
            entity_id=entity_id,
            listmonk_type=listmonk_type,
        )

    def list_by_listmonk_id(
        self,
        *,
        client_id: str,
        listmonk_type: str,
        listmonk_id: str,
    ) -> list[ListmonkMappingRecord]:
        return self.repository.list_by_listmonk_id(
            client_id=client_id,
            listmonk_type=listmonk_type,
            listmonk_id=listmonk_id,
        )

    def upsert_mapping(
        self,
        *,
        client_id: str,
        entity_type: str,
        entity_id: str,
        listmonk_type: str,
        listmonk_id: str,
    ) -> ListmonkMappingRecord:
        existing = self.get_mapping(
            client_id=client_id,
            entity_type=entity_type,
            entity_id=entity_id,
            listmonk_type=listmonk_type,
        )
        if existing is not None:
            if existing.listmonk_id != listmonk_id:
                raise ListmonkMappingConflictError(
                    "listmonk mapping already points to a different technical id"
                )
            return existing

        return self.repository.upsert_mapping(
            client_id=client_id,
            entity_type=entity_type,
            entity_id=entity_id,
            listmonk_type=listmonk_type,
            listmonk_id=listmonk_id,
        )

    def delete_business_entity_mappings(
        self,
        *,
        client_id: str,
        entity_type: str,
        entity_id: str,
    ) -> bool:
        return self.repository.delete_by_business_entity(
            client_id=client_id,
            entity_type=entity_type,
            entity_id=entity_id,
        )

    def ensure_campaign_mapping(
        self,
        *,
        client_id: str,
        campaign_id: str,
        listmonk_campaign_id: str,
    ) -> ListmonkMappingRecord:
        return self.upsert_mapping(
            client_id=client_id,
            entity_type=ENTITY_TYPE_CAMPAIGN,
            entity_id=campaign_id,
            listmonk_type=LISTMONK_TYPE_CAMPAIGN,
            listmonk_id=listmonk_campaign_id,
        )

    def ensure_followup_campaign_mapping(
        self,
        *,
        client_id: str,
        campaign_id: str,
        listmonk_campaign_id: str,
    ) -> ListmonkMappingRecord:
        return self.upsert_mapping(
            client_id=client_id,
            entity_type=ENTITY_TYPE_CAMPAIGN_FOLLOWUP,
            entity_id=campaign_id,
            listmonk_type=LISTMONK_TYPE_CAMPAIGN,
            listmonk_id=listmonk_campaign_id,
        )

    def ensure_client_list_mapping(
        self,
        *,
        client_id: str,
        listmonk_list_id: str,
    ) -> ListmonkMappingRecord:
        return self.upsert_mapping(
            client_id=client_id,
            entity_type=ENTITY_TYPE_CLIENT,
            entity_id=client_id,
            listmonk_type=LISTMONK_TYPE_LIST,
            listmonk_id=listmonk_list_id,
        )

    def ensure_campaign_list_mapping(
        self,
        *,
        client_id: str,
        campaign_id: str,
        listmonk_list_id: str,
    ) -> ListmonkMappingRecord:
        return self.upsert_mapping(
            client_id=client_id,
            entity_type=ENTITY_TYPE_CAMPAIGN,
            entity_id=campaign_id,
            listmonk_type=LISTMONK_TYPE_LIST,
            listmonk_id=listmonk_list_id,
        )

    def ensure_followup_campaign_list_mapping(
        self,
        *,
        client_id: str,
        campaign_id: str,
        listmonk_list_id: str,
    ) -> ListmonkMappingRecord:
        return self.upsert_mapping(
            client_id=client_id,
            entity_type=ENTITY_TYPE_CAMPAIGN_FOLLOWUP,
            entity_id=campaign_id,
            listmonk_type=LISTMONK_TYPE_LIST,
            listmonk_id=listmonk_list_id,
        )

    def ensure_contact_subscriber_mapping(
        self,
        *,
        client_id: str,
        contact_id: str,
        listmonk_subscriber_id: str,
    ) -> ListmonkMappingRecord:
        return self.upsert_mapping(
            client_id=client_id,
            entity_type=ENTITY_TYPE_CONTACT,
            entity_id=contact_id,
            listmonk_type=LISTMONK_TYPE_SUBSCRIBER,
            listmonk_id=listmonk_subscriber_id,
        )
