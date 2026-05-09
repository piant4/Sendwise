from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status

from app.repositories.client_access import ClientAccessRecord
from app.repositories.clients import (
    AdminBlockedSendRecord,
    AdminCampaignRecord,
    ClientRecord,
    ClientRepository,
    get_client_repository,
)
from app.schemas.clients import (
    AdminCampaignStatusCounts,
    AdminCampaignSummary,
    AdminClientStatusCounts,
    AdminEmailLimitOverview,
    AdminEmailLimitRow,
    AdminEmailLimitsResponse,
    AdminEmailLimitsSummary,
    AdminOverviewSummary,
    AdminRecentBlockedSend,
    AdminRecentCampaign,
    Client,
    ClientAccessSummary,
)
from app.schemas.common import CampaignStatus

ACTIVE_CAMPAIGN_STATUSES = {CampaignStatus.ready.value, CampaignStatus.running.value}
RECENT_ADMIN_CAMPAIGNS_LIMIT = 4
RECENT_ADMIN_BLOCKED_SENDS_LIMIT = 4


def _build_client_name(client: ClientRecord) -> str:
    if client.personal_name:
        return client.personal_name

    return client.email


def normalize_profile_value(
    value: Optional[str],
    *,
    field_label: str,
    required: bool = False,
) -> Optional[str]:
    if value is None:
        if required:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{field_label} is required.",
            )
        return None

    normalized_value = value.strip()

    if not normalized_value:
        if required:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"{field_label} is required.",
            )
        return None

    return normalized_value


def is_client_profile_complete(client: ClientRecord) -> bool:
    return bool(
        normalize_profile_value(
            client.personal_name,
            field_label="personal_name",
        )
    )


def validate_non_negative_int(
    value: Optional[int],
    *,
    field_label: str,
) -> Optional[int]:
    if value is None:
        return None

    if value < 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{field_label} must be greater than or equal to zero.",
        )

    return value


def build_client_schema(
    client: ClientRecord,
    *,
    access: Optional[ClientAccessRecord] = None,
) -> Client:
    access_summary = (
        ClientAccessSummary.model_validate(access.model_dump()) if access else None
    )
    return Client(
        id=client.id,
        email=client.email,
        personal_name=client.personal_name,
        name=_build_client_name(client),
        status=client.status,
        email_limit_per_campaign=client.email_limit_per_campaign,
        max_campaigns=client.max_campaigns,
        monthly_email_limit=client.monthly_email_limit,
        daily_email_limit=client.daily_email_limit,
        created_at=client.created_at,
        updated_at=client.updated_at,
        access=access_summary,
    )


def build_admin_email_limit_row(
    client: ClientRecord,
    *,
    access: Optional[ClientAccessRecord] = None,
) -> AdminEmailLimitRow:
    return AdminEmailLimitRow(
        client_id=client.id,
        client_name=_build_client_name(client),
        client_email=client.email,
        client_status=client.status,
        access_status=access.status if access else None,
        invitation_status=access.invitation_status if access else None,
        email_limit_per_campaign=client.email_limit_per_campaign,
        max_campaigns=client.max_campaigns,
        updated_at=client.updated_at,
    )


def has_any_email_limit_configured(client: ClientRecord) -> bool:
    return (
        client.email_limit_per_campaign is not None
        or client.max_campaigns is not None
    )


class ClientsService:
    def __init__(self, repository: ClientRepository) -> None:
        self._repository = repository

    def list_clients(self) -> list[ClientRecord]:
        return self._repository.list_clients()

    def get_client_by_id(self, client_id: str) -> ClientRecord:
        client = self._repository.get_by_id(client_id)

        if client is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Client not found.",
            )

        return client

    def get_client_by_email(self, email: str) -> Optional[ClientRecord]:
        return self._repository.get_by_email(email)

    def upsert_client_profile(
        self,
        *,
        email: str,
        personal_name: Optional[str],
    ) -> ClientRecord:
        existing = self._repository.get_by_email(email)

        if existing is None:
            return self._repository.create_client(
                email=email,
                personal_name=personal_name,
                status="active",
            )

        return self._repository.update_client(
            client_id=existing.id,
            email=email,
            personal_name=personal_name,
            status=existing.status,
            email_limit_per_campaign=existing.email_limit_per_campaign,
            max_campaigns=existing.max_campaigns,
            monthly_email_limit=existing.monthly_email_limit,
            daily_email_limit=existing.daily_email_limit,
        )

    def update_client(
        self,
        *,
        client_id: str,
        email: str,
        personal_name: Optional[str],
        status: Optional[str] = None,
        email_limit_per_campaign: Optional[int] = None,
        max_campaigns: Optional[int] = None,
        monthly_email_limit: Optional[int] = None,
        daily_email_limit: Optional[int] = None,
    ) -> ClientRecord:
        return self._repository.update_client(
            client_id=client_id,
            email=email,
            personal_name=normalize_profile_value(
                personal_name,
                field_label="personal_name",
            ),
            status=status,
            email_limit_per_campaign=validate_non_negative_int(
                email_limit_per_campaign,
                field_label="email_limit_per_campaign",
            ),
            max_campaigns=validate_non_negative_int(
                max_campaigns,
                field_label="max_campaigns",
            ),
            monthly_email_limit=validate_non_negative_int(
                monthly_email_limit,
                field_label="monthly_email_limit",
            ),
            daily_email_limit=validate_non_negative_int(
                daily_email_limit,
                field_label="daily_email_limit",
            ),
        )

    def complete_onboarding_profile(
        self,
        *,
        client_id: str,
        personal_name: str,
    ) -> ClientRecord:
        existing = self.get_client_by_id(client_id)
        normalized_personal_name = normalize_profile_value(
            personal_name,
            field_label="personal_name",
            required=True,
        )

        return self.update_client(
            client_id=existing.id,
            email=existing.email,
            personal_name=normalized_personal_name,
            status=existing.status,
            email_limit_per_campaign=existing.email_limit_per_campaign,
            max_campaigns=existing.max_campaigns,
            monthly_email_limit=existing.monthly_email_limit,
            daily_email_limit=existing.daily_email_limit,
        )

    def archive_client(self, client_id: str) -> ClientRecord:
        existing = self.get_client_by_id(client_id)
        return self.update_client(
            client_id=existing.id,
            email=existing.email,
            personal_name=existing.personal_name,
            status="archived",
            email_limit_per_campaign=existing.email_limit_per_campaign,
            max_campaigns=existing.max_campaigns,
            monthly_email_limit=existing.monthly_email_limit,
            daily_email_limit=existing.daily_email_limit,
        )

    def list_admin_campaigns(self) -> list[AdminCampaignSummary]:
        return [
            AdminCampaignSummary(
                id=campaign.id,
                client_id=campaign.client_id,
                client_name=campaign.client_name,
                client_email=campaign.client_email,
                name=campaign.name,
                status=campaign.status,
                subject=campaign.subject,
                created_at=campaign.created_at,
                updated_at=campaign.updated_at,
                blocked_sends_count=campaign.blocked_sends_count,
            )
            for campaign in self._repository.list_admin_campaigns()
        ]

    def get_admin_overview(
        self,
        *,
        client_access_service,
        now: Optional[datetime] = None,
    ) -> AdminOverviewSummary:
        current_time = now or datetime.now(timezone.utc)
        clients = self.list_clients()
        campaigns = self._repository.list_admin_campaigns()

        client_status_counts = AdminClientStatusCounts()
        for client in clients:
            if client.status in client_status_counts.model_fields:
                setattr(
                    client_status_counts,
                    client.status,
                    getattr(client_status_counts, client.status) + 1,
                )

        campaign_status_counts = AdminCampaignStatusCounts()
        active_campaigns = 0
        for campaign in campaigns:
            if campaign.status in ACTIVE_CAMPAIGN_STATUSES:
                campaign_status_counts.active += 1
                active_campaigns += 1
                continue

            if campaign.status == CampaignStatus.paused.value:
                campaign_status_counts.paused += 1
                continue

            if campaign.status == CampaignStatus.blocked.value:
                campaign_status_counts.blocked += 1
                continue

            if campaign.status == CampaignStatus.draft.value:
                campaign_status_counts.draft += 1
                continue

            if campaign.status == CampaignStatus.completed.value:
                campaign_status_counts.completed += 1
                continue

            if campaign.status == CampaignStatus.failed.value:
                campaign_status_counts.failed += 1

        configured_clients = sum(
            1 for client in clients if has_any_email_limit_configured(client)
        )
        email_limit_overview = AdminEmailLimitOverview(
            configured_clients=configured_clients,
            unconfigured_clients=max(len(clients) - configured_clients, 0),
            total_email_limit_per_campaign=sum(
                client.email_limit_per_campaign or 0 for client in clients
            ),
            total_max_campaigns=sum(client.max_campaigns or 0 for client in clients),
        )

        recent_campaigns = [
            self._build_recent_campaign_summary(campaign)
            for campaign in campaigns[:RECENT_ADMIN_CAMPAIGNS_LIMIT]
        ]
        recent_blocked_sends = [
            self._build_recent_blocked_send_summary(blocked_send)
            for blocked_send in self._repository.list_recent_admin_blocked_sends(
                limit=RECENT_ADMIN_BLOCKED_SENDS_LIMIT,
            )
        ]
        start_of_day = current_time.astimezone(timezone.utc).replace(
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )

        return AdminOverviewSummary(
            total_clients=len(clients),
            active_campaigns=active_campaigns,
            blocked_sends_today=self._repository.count_admin_blocked_sends_since(
                start_of_day
            ),
            monthly_ai_calls_used=0,
            campaign_status_counts=campaign_status_counts,
            client_status_counts=client_status_counts,
            email_limit_overview=email_limit_overview,
            recent_campaigns=recent_campaigns,
            recent_blocked_sends=recent_blocked_sends,
        )

    def get_admin_email_limits(
        self,
        *,
        client_access_service,
    ) -> AdminEmailLimitsResponse:
        clients = self.list_clients()
        rows = [
            build_admin_email_limit_row(
                client,
                access=client_access_service.get_access_by_client_id(client.id),
            )
            for client in clients
        ]
        configured_clients = sum(
            1 for client in clients if has_any_email_limit_configured(client)
        )
        return AdminEmailLimitsResponse(
            summary=AdminEmailLimitsSummary(
                total_clients=len(rows),
                configured_clients=configured_clients,
                unconfigured_clients=max(len(rows) - configured_clients, 0),
            ),
            rows=rows,
        )

    def _build_recent_campaign_summary(
        self,
        campaign: AdminCampaignRecord,
    ) -> AdminRecentCampaign:
        return AdminRecentCampaign(
            id=campaign.id,
            client_id=campaign.client_id,
            client_name=campaign.client_name,
            campaign_name=campaign.name,
            subject=campaign.subject,
            status=campaign.status,
            created_at=campaign.created_at,
            updated_at=campaign.updated_at,
        )

    def _build_recent_blocked_send_summary(
        self,
        blocked_send: AdminBlockedSendRecord,
    ) -> AdminRecentBlockedSend:
        return AdminRecentBlockedSend(
            id=blocked_send.id,
            client_id=blocked_send.client_id,
            client_name=blocked_send.client_name,
            campaign_id=blocked_send.campaign_id,
            campaign_name=blocked_send.campaign_name,
            reason=blocked_send.reason,
            decision=blocked_send.decision,
            created_at=blocked_send.created_at,
        )


def get_clients_service(
    repository: ClientRepository = Depends(get_client_repository),
) -> ClientsService:
    return ClientsService(repository)
