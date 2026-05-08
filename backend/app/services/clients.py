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


def get_clients_service(
    repository: ClientRepository = Depends(get_client_repository),
) -> ClientsService:
    return ClientsService(repository)
