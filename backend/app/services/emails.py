from __future__ import annotations

import smtplib
from dataclasses import dataclass
from email.message import EmailMessage

from fastapi import HTTPException, status

from app.core.config import Settings
from app.services.template_renderer import (
    render_client_access_email_html,
    render_client_access_email_text,
)


@dataclass(frozen=True)
class ClientAccessEmailPayload:
    recipient_email: str
    recipient_name: str
    login_email: str
    panel_url: str
    action_url: str


class ClientAccessEmailService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def send_client_access_email(self, payload: ClientAccessEmailPayload) -> None:
        self._ensure_delivery_is_allowed()
        self._ensure_recipient_email_is_valid(payload.recipient_email)

        message = EmailMessage()
        message["Subject"] = "Il tuo accesso a Sendwise e pronto"
        message["From"] = self._settings.smtp_from_email.strip()
        message["To"] = payload.recipient_email
        message.set_content(
            render_client_access_email_text(
                recipient_name=payload.recipient_name,
                panel_url=payload.panel_url,
                login_email=payload.login_email,
                action_url=payload.action_url,
            )
        )
        message.add_alternative(
            render_client_access_email_html(
                recipient_name=payload.recipient_name,
                panel_url=payload.panel_url,
                login_email=payload.login_email,
                action_url=payload.action_url,
            ),
            subtype="html",
        )

        try:
            with smtplib.SMTP(
                self._settings.smtp_host.strip(),
                self._settings.smtp_port,
                timeout=10,
            ) as smtp:
                if self._settings.smtp_tls:
                    smtp.starttls()
                if self._settings.smtp_username.strip():
                    smtp.login(
                        self._settings.smtp_username.strip(),
                        self._settings.smtp_password,
                    )
                smtp.send_message(message)
        except OSError as error:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="client_access_email_send_failed",
            ) from error
        except smtplib.SMTPException as error:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="client_access_email_send_failed",
            ) from error

    def _ensure_delivery_is_allowed(self) -> None:
        provider = self._settings.email_provider_normalized

        if provider in {"mailpit", "smtp_dev"}:
            self._ensure_smtp_config()
            return

        if not self._settings.email_sending_enabled:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="client_access_email_config_missing",
            )

        self._ensure_smtp_config()

    def _ensure_smtp_config(self) -> None:
        missing: list[str] = []

        if not self._settings.smtp_host.strip():
            missing.append("SMTP_HOST")
        if self._settings.smtp_port <= 0:
            missing.append("SMTP_PORT")
        if not self._settings.smtp_from_email.strip():
            missing.append("SMTP_FROM_EMAIL")

        if self._settings.email_provider_normalized == "ses":
            if not self._settings.smtp_username.strip():
                missing.append("SMTP_USERNAME")
            if not self._settings.smtp_password.strip():
                missing.append("SMTP_PASSWORD")
            if not self._settings.smtp_tls:
                missing.append("SMTP_TLS=true")

        if missing:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="client_access_email_config_missing",
            )

    def _ensure_recipient_email_is_valid(self, email: str) -> None:
        normalized_email = email.strip()
        if "@" in normalized_email and "." in normalized_email.rsplit("@", 1)[-1]:
            return
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="client_access_email_invalid",
        )
