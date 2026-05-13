from app.core.config import Settings
from app.schemas.campaigns import ProviderRuntimeSummary


def build_provider_runtime_summary(
    settings: Settings,
    *,
    provider_events_available: bool = False,
) -> ProviderRuntimeSummary:
    email_provider = settings.email_provider_normalized or "unknown"
    mailpit_dev_mode = email_provider in {"mailpit", "smtp_dev"}

    if not settings.email_sending_enabled:
        provider_mode_label = "Sending disabled"
    elif email_provider == "ses":
        provider_mode_label = "SES configured but live validation pending"
    elif mailpit_dev_mode:
        provider_mode_label = "Mailpit/dev"
    else:
        provider_mode_label = "Provider mode unavailable"

    return ProviderRuntimeSummary(
        email_sending_enabled=settings.email_sending_enabled,
        email_provider=email_provider,
        provider_mode_label=provider_mode_label,
        real_send_available=False,
        ses_live_validation_status="pending" if email_provider == "ses" else None,
        provider_events_available=provider_events_available,
        mailpit_dev_mode=mailpit_dev_mode,
    )
