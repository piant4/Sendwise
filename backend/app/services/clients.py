from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status

from app.core.config import Settings, get_settings
from app.repositories.client_access import ClientAccessRecord
from app.repositories.clients import (
    AdminBlockedSendRecord,
    AdminCampaignEmailVolumeRecord,
    AdminCampaignRecord,
    AdminTopClientVolumeRecord,
    ClientRecord,
    ClientRepository,
    get_client_repository,
)
from app.schemas.clients import (
    AdminBlockedSendItem,
    AdminCampaignStatusCounts,
    AdminCampaignSummary,
    AdminClientNearLimit,
    AdminClientStatusCounts,
    AdminCriticalEvent,
    AdminEmailLimitRow,
    AdminEmailLimitsResponse,
    AdminEmailLimitsSummary,
    AdminOverviewBlocksSummary,
    AdminOverviewCampaignsSummary,
    AdminOverviewClientsSummary,
    AdminOverviewLimitsSummary,
    AdminOverviewSendingSummary,
    AdminOverviewSummary,
    AdminRecentCampaign,
    AdminSystemStatus,
    AdminTopClientByVolume,
    Client,
    ClientAccessSummary,
)
from app.schemas.common import CampaignStatus

ACTIVE_CAMPAIGN_STATUSES = {CampaignStatus.ready.value, CampaignStatus.running.value}
RUNNING_CAMPAIGN_STATUSES = {CampaignStatus.running.value}
LIMITED_CAMPAIGN_STATUSES = {
    CampaignStatus.draft.value,
    CampaignStatus.ready.value,
    CampaignStatus.running.value,
    CampaignStatus.paused.value,
    CampaignStatus.blocked.value,
}
NEAR_LIMIT_THRESHOLD = 0.8
RECENT_ADMIN_CAMPAIGNS_LIMIT = 5
RECENT_ADMIN_BLOCKED_SENDS_LIMIT = 5
TOP_CLIENTS_LIMIT = 5
CLIENTS_NEAR_LIMIT_LIMIT = 5


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
    def __init__(
        self,
        repository: ClientRepository,
        settings: Optional[Settings] = None,
    ) -> None:
        self._repository = repository
        self._settings = settings or get_settings()

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
        campaign_email_volumes = self._repository.list_admin_campaign_email_volumes()

        client_status_counts = AdminClientStatusCounts()
        for client in clients:
            if client.status in client_status_counts.model_fields:
                setattr(
                    client_status_counts,
                    client.status,
                    getattr(client_status_counts, client.status) + 1,
                )

        campaign_status_counts = AdminCampaignStatusCounts()
        running_campaigns = 0
        for campaign in campaigns:
            if campaign.status in ACTIVE_CAMPAIGN_STATUSES:
                campaign_status_counts.active += 1
                if campaign.status in RUNNING_CAMPAIGN_STATUSES:
                    running_campaigns += 1
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

        recent_campaigns = [
            self._build_recent_campaign_summary(campaign)
            for campaign in campaigns[:RECENT_ADMIN_CAMPAIGNS_LIMIT]
        ]
        recent_critical_events = [
            self._build_recent_critical_event(blocked_send)
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
        start_of_month = start_of_day.replace(day=1)
        configured_limits_count = sum(
            1 for client in clients if has_any_email_limit_configured(client)
        )
        client_access_by_client_id = {
            client.id: client_access_service.get_access_by_client_id(client.id)
            for client in clients
        }

        return AdminOverviewSummary(
            clients=AdminOverviewClientsSummary(
                total_clients=len(clients),
                active_clients=sum(1 for client in clients if client.status == "active"),
                invited_or_pending_clients=sum(
                    1
                    for access in client_access_by_client_id.values()
                    if access
                    and (
                        access.status == "invited"
                        or (access.invitation_status or "pending") == "pending"
                    )
                ),
                archived_or_blocked_clients=sum(
                    1
                    for client in clients
                    if client.status in {"archived", "blocked"}
                ),
                status_counts=client_status_counts,
            ),
            campaigns=AdminOverviewCampaignsSummary(
                total_campaigns=len(campaigns),
                running_campaigns=running_campaigns,
                paused_campaigns=campaign_status_counts.paused,
                blocked_campaigns=campaign_status_counts.blocked,
                status_counts=campaign_status_counts,
                recent_campaigns=recent_campaigns,
            ),
            sending=AdminOverviewSendingSummary(
                emails_sent_today=self._repository.count_admin_email_logs_since(
                    start_of_day
                ),
                emails_sent_this_month=self._repository.count_admin_email_logs_since(
                    start_of_month
                ),
                top_clients_by_volume=[
                    self._build_top_client_volume(record)
                    for record in self._repository.list_admin_top_sending_clients_since(
                        started_at=start_of_month,
                        limit=TOP_CLIENTS_LIMIT,
                    )
                ],
            ),
            blocks=AdminOverviewBlocksSummary(
                blocked_sends_today=self._repository.count_admin_blocked_sends_since(
                    start_of_day
                ),
                recent_critical_events=recent_critical_events,
            ),
            limits=AdminOverviewLimitsSummary(
                clients_near_limit=self._build_clients_near_limit(
                    clients=clients,
                    campaigns=campaigns,
                    campaign_email_volumes=campaign_email_volumes,
                ),
                configured_limits_count=configured_limits_count,
                unconfigured_limits_count=max(len(clients) - configured_limits_count, 0),
            ),
            system=self.get_admin_system_status(now=current_time),
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

    def get_admin_blocked_sends(
        self,
        *,
        limit: Optional[int] = None,
    ) -> list[AdminBlockedSendItem]:
        return [
            AdminBlockedSendItem(
                id=blocked_send.id,
                client_id=blocked_send.client_id,
                client_name=blocked_send.client_name,
                client_email=blocked_send.client_email,
                campaign_id=blocked_send.campaign_id,
                campaign_name=blocked_send.campaign_name,
                reason=blocked_send.reason,
                decision=blocked_send.decision,
                created_at=blocked_send.created_at,
            )
            for blocked_send in self._repository.list_admin_blocked_sends(limit=limit)
        ]

    def get_admin_system_status(
        self,
        *,
        now: Optional[datetime] = None,
    ) -> AdminSystemStatus:
        current_time = now or datetime.now(timezone.utc)
        auth_provider_configured = bool(
            self._settings.clerk_issuer.strip() and self._settings.clerk_jwks_url.strip()
        )
        return AdminSystemStatus(
            api_status="ok",
            db_status="ok" if self._repository.is_database_available() else "degraded",
            email_sending_enabled=self._settings.email_sending_enabled,
            environment=self._settings.environment.strip() or "unknown",
            auth_provider_configured=auth_provider_configured,
            clerk_management_api_configured=bool(self._settings.clerk_secret_key.strip()),
            frontend_origin_configured=bool(self._settings.frontend_origin),
            delivery_engine_configured=bool(self._settings.listmonk_url.strip()),
            generated_at=current_time,
        )

    def _build_recent_campaign_summary(
        self,
        campaign: AdminCampaignRecord,
    ) -> AdminRecentCampaign:
        return AdminRecentCampaign(
            id=campaign.id,
            client_id=campaign.client_id,
            client_name=campaign.client_name,
            client_email=campaign.client_email,
            campaign_name=campaign.name,
            subject=campaign.subject,
            status=campaign.status,
            created_at=campaign.created_at,
            updated_at=campaign.updated_at,
        )

    def _build_recent_critical_event(
        self,
        blocked_send: AdminBlockedSendRecord,
    ) -> AdminCriticalEvent:
        return AdminCriticalEvent(
            id=blocked_send.id,
            client_id=blocked_send.client_id,
            client_name=blocked_send.client_name,
            client_email=blocked_send.client_email,
            campaign_id=blocked_send.campaign_id,
            campaign_name=blocked_send.campaign_name,
            reason=blocked_send.reason,
            decision=blocked_send.decision,
            created_at=blocked_send.created_at,
        )

    def _build_top_client_volume(
        self,
        record: AdminTopClientVolumeRecord,
    ) -> AdminTopClientByVolume:
        return AdminTopClientByVolume(
            client_id=record.client_id,
            client_name=record.client_name,
            client_email=record.client_email,
            emails_sent=record.emails_sent,
        )

    def _build_clients_near_limit(
        self,
        *,
        clients: list[ClientRecord],
        campaigns: list[AdminCampaignRecord],
        campaign_email_volumes: list[AdminCampaignEmailVolumeRecord],
    ) -> list[AdminClientNearLimit]:
        campaigns_in_use_by_client_id: dict[str, int] = {}
        for campaign in campaigns:
            if campaign.status not in LIMITED_CAMPAIGN_STATUSES:
                continue

            campaigns_in_use_by_client_id[campaign.client_id] = (
                campaigns_in_use_by_client_id.get(campaign.client_id, 0) + 1
            )

        highest_campaign_volume_by_client_id: dict[str, AdminCampaignEmailVolumeRecord] = {}
        for volume in campaign_email_volumes:
            existing = highest_campaign_volume_by_client_id.get(volume.client_id)
            if existing is None or volume.emails_sent > existing.emails_sent:
                highest_campaign_volume_by_client_id[volume.client_id] = volume

        near_limit_clients: list[AdminClientNearLimit] = []
        for client in clients:
            campaigns_in_use = campaigns_in_use_by_client_id.get(client.id, 0)
            highest_campaign_volume = highest_campaign_volume_by_client_id.get(client.id)
            max_campaigns_ratio = self._compute_ratio(
                campaigns_in_use,
                client.max_campaigns,
            )
            email_limit_ratio = self._compute_ratio(
                highest_campaign_volume.emails_sent if highest_campaign_volume else 0,
                client.email_limit_per_campaign,
            )
            usage_ratio = max(max_campaigns_ratio or 0.0, email_limit_ratio or 0.0)

            if usage_ratio < NEAR_LIMIT_THRESHOLD:
                continue

            if (
                max_campaigns_ratio is not None
                and max_campaigns_ratio >= NEAR_LIMIT_THRESHOLD
                and email_limit_ratio is not None
                and email_limit_ratio >= NEAR_LIMIT_THRESHOLD
            ):
                limiting_factor = "both"
            elif max_campaigns_ratio is not None and max_campaigns_ratio >= NEAR_LIMIT_THRESHOLD:
                limiting_factor = "campaign_slots"
            else:
                limiting_factor = "email_limit_per_campaign"

            near_limit_clients.append(
                AdminClientNearLimit(
                    client_id=client.id,
                    client_name=_build_client_name(client),
                    client_email=client.email,
                    usage_ratio=usage_ratio,
                    limiting_factor=limiting_factor,
                    campaigns_in_use=campaigns_in_use,
                    max_campaigns=client.max_campaigns,
                    highest_usage_campaign_id=(
                        highest_campaign_volume.campaign_id if highest_campaign_volume else None
                    ),
                    highest_usage_campaign_name=(
                        highest_campaign_volume.campaign_name if highest_campaign_volume else None
                    ),
                    highest_usage_campaign_volume=(
                        highest_campaign_volume.emails_sent if highest_campaign_volume else 0
                    ),
                    email_limit_per_campaign=client.email_limit_per_campaign,
                    max_campaigns_ratio=max_campaigns_ratio,
                    email_limit_ratio=email_limit_ratio,
                )
            )

        near_limit_clients.sort(
            key=lambda item: (item.usage_ratio, item.campaigns_in_use, item.client_name),
            reverse=True,
        )
        return near_limit_clients[:CLIENTS_NEAR_LIMIT_LIMIT]

    def _compute_ratio(
        self,
        used_value: int,
        configured_limit: Optional[int],
    ) -> Optional[float]:
        if configured_limit is None or configured_limit <= 0:
            return None

        return min(used_value / configured_limit, 1.0)


def get_clients_service(
    repository: ClientRepository = Depends(get_client_repository),
    settings: Settings = Depends(get_settings),
) -> ClientsService:
    return ClientsService(repository, settings=settings)
