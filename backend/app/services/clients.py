from __future__ import annotations

from typing import Optional

from fastapi import Depends, HTTPException, status

from app.repositories.client_access import ClientAccessRecord
from app.repositories.clients import ClientRecord, ClientRepository, get_client_repository
from app.schemas.clients import Client, ClientAccessSummary


def _build_client_name(client: ClientRecord) -> str:
    if client.company_name:
        return client.company_name

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
        and normalize_profile_value(
            client.company_name,
            field_label="company_name",
        )
    )


def validate_email_limit(
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
        company_name=client.company_name,
        name=_build_client_name(client),
        status=client.status,
        monthly_email_limit=client.monthly_email_limit,
        daily_email_limit=client.daily_email_limit,
        created_at=client.created_at,
        updated_at=client.updated_at,
        access=access_summary,
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
        company_name: Optional[str],
    ) -> ClientRecord:
        existing = self._repository.get_by_email(email)

        if existing is None:
            return self._repository.create_client(
                email=email,
                personal_name=personal_name,
                company_name=company_name,
                status="active",
            )

        return self._repository.update_client(
            client_id=existing.id,
            email=email,
            personal_name=personal_name,
            company_name=company_name,
        )

    def update_client(
        self,
        *,
        client_id: str,
        email: str,
        personal_name: Optional[str],
        company_name: Optional[str],
        status: Optional[str] = None,
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
            company_name=normalize_profile_value(
                company_name,
                field_label="company_name",
            ),
            status=status,
            monthly_email_limit=validate_email_limit(
                monthly_email_limit,
                field_label="monthly_email_limit",
            ),
            daily_email_limit=validate_email_limit(
                daily_email_limit,
                field_label="daily_email_limit",
            ),
        )

    def complete_onboarding_profile(
        self,
        *,
        client_id: str,
        personal_name: str,
        company_name: str,
    ) -> ClientRecord:
        existing = self.get_client_by_id(client_id)
        normalized_personal_name = normalize_profile_value(
            personal_name,
            field_label="personal_name",
            required=True,
        )
        normalized_company_name = normalize_profile_value(
            company_name,
            field_label="company_name",
            required=True,
        )

        return self.update_client(
            client_id=existing.id,
            email=existing.email,
            personal_name=normalized_personal_name,
            company_name=normalized_company_name,
            status=existing.status,
            monthly_email_limit=existing.monthly_email_limit,
            daily_email_limit=existing.daily_email_limit,
        )


def get_clients_service(
    repository: ClientRepository = Depends(get_client_repository),
) -> ClientsService:
    return ClientsService(repository)
