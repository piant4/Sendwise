from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from html import escape
from html.parser import HTMLParser
from pathlib import Path
import re
from typing import Mapping
from urllib.parse import urlencode

from app.core.config import Settings, get_settings
from app.services.unsubscribe import LISTMONK_UNSUBSCRIBE_TOKEN_PLACEHOLDER

TEMPLATE_VARIABLE_PATTERN = re.compile(r"{{\s*([A-Za-z0-9_]+)\s*}}")
KNOWN_TEMPLATE_VARIABLES = frozenset(
    {
        "subject",
        "preview_text",
        "body",
        "unsubscribe_url",
        "client_name",
        "nome",
        "cognome",
        "email",
        "campaign_name",
        "current_year",
        "company_name",
        "sender_name",
        "logo",
        "website_url",
        "linkedin_url",
        "instagram_url",
        "facebook_url",
        "x_url",
        "social_icons",
    }
)
LISTMONK_NATIVE_SIMPLE_PLACEHOLDERS = frozenset(
    {
        "messageurl",
        "unsubscribeurl",
    }
)
MANDATORY_USED_TEMPLATE_VARIABLES = frozenset({"company_name"})


class TemplateRenderError(RuntimeError):
    pass


class CompiledTemplateNotFoundError(TemplateRenderError):
    pass


class UnresolvedSendwisePlaceholderError(TemplateRenderError):
    def __init__(self, *, field_name: str, placeholders: set[str]) -> None:
        formatted = ", ".join(
            sorted(f"{{{{{placeholder}}}}}" for placeholder in placeholders)
        )
        super().__init__(
            "Unsupported Sendwise placeholders remain in "
            f"{field_name}: {formatted}. Remove them or replace them with supported placeholders before dispatch."
        )
        self.field_name = field_name
        self.placeholders = frozenset(placeholders)


class TemplateContentReadinessError(TemplateRenderError):
    def __init__(self, *, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class RenderedEmailTemplate:
    template_name: str
    subject: str
    preview_text: str
    body: str
    unsubscribe_url: str
    client_name: str


@dataclass(frozen=True)
class TemplateRenderer:
    dist_dir: Path
    asset_origin: str = ""

    def render(
        self,
        *,
        template_name: str,
        subject: str,
        preview_text: str,
        body: str,
        unsubscribe_url: str,
        client_name: str,
        contact_first_name: str | None = None,
        contact_last_name: str | None = None,
        contact_email: str | None = None,
        campaign_name: str | None = None,
        current_year: int | None = None,
        email_brand: Mapping[str, str | None] | None = None,
    ) -> RenderedEmailTemplate:
        template_html = self.load_compiled_template(template_name)
        rendered_html = template_html
        replacements = build_template_variable_values(
            subject=subject,
            preview_text=preview_text,
            body=body,
            unsubscribe_url=unsubscribe_url,
            client_name=client_name,
            contact_first_name=contact_first_name,
            contact_last_name=contact_last_name,
            contact_email=contact_email,
            campaign_name=campaign_name,
            current_year=current_year,
            email_brand=email_brand,
            asset_origin=self.asset_origin,
        )
        for key, value in replacements.items():
            placeholder = f"{{{{{key}}}}}"
            rendered_html = rendered_html.replace(placeholder, value)
        rendered_html = render_template_string(rendered_html, replacements)
        self._validate_rendered_html(
            template_name=template_name,
            rendered_html=rendered_html,
            body=body,
            unsubscribe_url=unsubscribe_url,
        )
        return RenderedEmailTemplate(
            template_name=template_name,
            subject=subject,
            preview_text=preview_text,
            body=rendered_html,
            unsubscribe_url=unsubscribe_url,
            client_name=client_name,
        )

    def load_compiled_template(self, template_name: str) -> str:
        template_path = self.dist_dir / f"{template_name}.html"
        if not template_path.is_file():
            raise CompiledTemplateNotFoundError(
                f"Compiled template '{template_name}' was not found in {self.dist_dir}."
            )
        return template_path.read_text(encoding="utf-8")

    def _validate_rendered_html(
        self,
        *,
        template_name: str,
        rendered_html: str,
        body: str,
        unsubscribe_url: str,
    ) -> None:
        if "<html" not in rendered_html.lower() or "</html>" not in rendered_html.lower():
            raise TemplateRenderError(
                f"Compiled template '{template_name}' did not render a complete HTML document."
            )
        if not body.strip():
            raise TemplateRenderError(
                f"Compiled template '{template_name}' requires a non-empty body."
            )
        if unsubscribe_url not in rendered_html:
            raise TemplateRenderError(
                f"Compiled template '{template_name}' is missing the unsubscribe URL."
            )
        if TEMPLATE_VARIABLE_PATTERN.search(rendered_html):
            raise TemplateRenderError(
                f"Compiled template '{template_name}' still contains unresolved placeholders."
            )


def build_template_variable_values(
    *,
    subject: str = "",
    preview_text: str = "",
    body: str = "",
    unsubscribe_url: str = "",
    client_name: str = "",
    contact_first_name: str | None = None,
    contact_last_name: str | None = None,
    contact_email: str | None = None,
    campaign_name: str | None = None,
    current_year: int | None = None,
    email_brand: Mapping[str, str | None] | None = None,
    asset_origin: str = "",
) -> dict[str, str]:
    resolved_current_year = current_year or datetime.now(timezone.utc).year
    return {
        "subject": subject,
        "preview_text": preview_text,
        "body": body,
        "unsubscribe_url": unsubscribe_url,
        "client_name": client_name,
        "nome": (contact_first_name or "").strip(),
        "cognome": (contact_last_name or "").strip(),
        "email": (contact_email or "").strip(),
        "campaign_name": (campaign_name or "").strip(),
        "current_year": str(resolved_current_year),
        **build_brand_template_variables(email_brand, asset_origin=asset_origin),
    }


def render_template_string(
    value: str,
    replacements: Mapping[str, str],
    *,
    preserve_placeholders: set[str] | None = None,
) -> str:
    preserved_keys = {key.strip().lower() for key in (preserve_placeholders or set())}

    def replacer(match: re.Match[str]) -> str:
        key = match.group(1).strip().lower()
        if key in replacements:
            return replacements[key]
        if key in preserved_keys:
            return match.group(0)
        return ""

    return TEMPLATE_VARIABLE_PATTERN.sub(replacer, value)


def render_sendwise_template_string(
    value: str,
    replacements: Mapping[str, str],
    *,
    field_name: str,
    preserve_placeholders: set[str] | None = None,
) -> str:
    preserved_keys = {
        key.strip().lower()
        for key in (
            set(preserve_placeholders or set()) | LISTMONK_NATIVE_SIMPLE_PLACEHOLDERS
        )
    }
    unknown_placeholders: set[str] = set()

    def replacer(match: re.Match[str]) -> str:
        key = match.group(1).strip()
        normalized_key = key.lower()
        if normalized_key in replacements:
            return replacements[normalized_key]
        if normalized_key in preserved_keys:
            return match.group(0)
        unknown_placeholders.add(key)
        return match.group(0)

    rendered = TEMPLATE_VARIABLE_PATTERN.sub(replacer, value)
    if unknown_placeholders:
        raise UnresolvedSendwisePlaceholderError(
            field_name=field_name,
            placeholders=unknown_placeholders,
        )
    return rendered


def validate_rendered_template_content_ready(
    *,
    source_fields: Mapping[str, str | None],
    rendered_body_html: str,
    resolved_variables: Mapping[str, str],
) -> None:
    used_variables = _extract_template_variables(source_fields.values())
    for variable in sorted(MANDATORY_USED_TEMPLATE_VARIABLES & used_variables):
        if not str(resolved_variables.get(variable) or "").strip():
            raise TemplateContentReadinessError(
                code=f"template_missing_{variable}",
                message=(
                    "Campaign template content is not ready: required brand "
                    f"variable {{{{{variable}}}}} is blank."
                ),
            )

    href_placeholder = _source_blank_href_placeholder(
        source_fields=source_fields,
        resolved_variables=resolved_variables,
    )
    if href_placeholder is not None:
        raise TemplateContentReadinessError(
            code=(
                "template_empty_cta_url"
                if href_placeholder == "website_url"
                else f"template_empty_{href_placeholder}"
            ),
            message=(
                "Campaign template content is not ready: a visible link rendered "
                "with a missing or blank href."
            ),
        )

    empty_anchor = _find_first_empty_visible_anchor(rendered_body_html)
    if empty_anchor is not None:
        code = "template_empty_cta_url"
        if empty_anchor.placeholder_name:
            code = f"template_empty_{empty_anchor.placeholder_name}"
        raise TemplateContentReadinessError(
            code=code,
            message=(
                "Campaign template content is not ready: a visible link rendered "
                "with a missing or blank href."
            ),
        )

    unresolved = {
        placeholder
        for placeholder in _extract_template_variables([rendered_body_html])
        if placeholder not in LISTMONK_NATIVE_SIMPLE_PLACEHOLDERS
    }
    if unresolved:
        raise TemplateContentReadinessError(
            code="template_content_not_ready",
            message=(
                "Campaign template content is not ready: supported placeholders "
                "remain unresolved in required output."
            ),
        )


def _extract_template_variables(values: object) -> set[str]:
    variables: set[str] = set()
    for value in values:
        if not value:
            continue
        variables.update(
            match.group(1).strip().lower()
            for match in TEMPLATE_VARIABLE_PATTERN.finditer(str(value))
        )
    return variables


def _source_blank_href_placeholder(
    *,
    source_fields: Mapping[str, str | None],
    resolved_variables: Mapping[str, str],
) -> str | None:
    href_pattern = re.compile(
        r"<a\b[^>]*\bhref\s*=\s*(['\"])\s*{{\s*([A-Za-z0-9_]+)\s*}}\s*\1",
        re.IGNORECASE,
    )
    for value in source_fields.values():
        if not value:
            continue
        for match in href_pattern.finditer(str(value)):
            placeholder = match.group(2).strip().lower()
            if not str(resolved_variables.get(placeholder) or "").strip():
                return placeholder
    return None


@dataclass(frozen=True)
class _RenderedAnchorIssue:
    placeholder_name: str | None = None


class _EmptyAnchorParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._anchor_stack: list[dict[str, object]] = []
        self.issue: _RenderedAnchorIssue | None = None

    def handle_starttag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        if self.issue is not None:
            return
        normalized_tag = tag.lower()
        if normalized_tag != "a":
            if normalized_tag == "img" and self._anchor_stack:
                self._anchor_stack[-1]["visible"] = True
            return

        attr_map = {key.lower(): value for key, value in attrs}
        href = attr_map.get("href")
        self._anchor_stack.append(
            {
                "empty": href is None or not str(href).strip(),
                "visible": False,
                "placeholder": self._placeholder_name_from_attrs(attrs),
            }
        )

    def handle_endtag(self, tag: str) -> None:
        if self.issue is not None or tag.lower() != "a" or not self._anchor_stack:
            return
        anchor = self._anchor_stack.pop()
        if bool(anchor["empty"]) and bool(anchor["visible"]):
            self.issue = _RenderedAnchorIssue(
                placeholder_name=anchor["placeholder"]
                if isinstance(anchor["placeholder"], str)
                else None
            )

    def handle_data(self, data: str) -> None:
        if self.issue is None and self._anchor_stack and data.strip():
            self._anchor_stack[-1]["visible"] = True

    def _placeholder_name_from_attrs(
        self,
        attrs: list[tuple[str, str | None]],
    ) -> str | None:
        for _key, value in attrs:
            if value is None:
                continue
            match = TEMPLATE_VARIABLE_PATTERN.search(value)
            if match:
                return match.group(1).strip().lower()
        return None


def _find_first_empty_visible_anchor(
    rendered_body_html: str,
) -> _RenderedAnchorIssue | None:
    parser = _EmptyAnchorParser()
    parser.feed(rendered_body_html)
    parser.close()
    return parser.issue


def build_brand_template_variables(
    email_brand: Mapping[str, str | None] | None,
    *,
    asset_origin: str = "",
) -> dict[str, str]:
    email_brand_payload = dict(email_brand or {})
    company_name = (email_brand_payload.get("company_name") or "").strip()
    sender_name = (email_brand_payload.get("sender_name") or "").strip()

    return {
        "company_name": company_name,
        "sender_name": sender_name or company_name or "Sendwise",
        "logo": build_logo_html(email_brand_payload.get("logo_url"), asset_origin=asset_origin),
        "website_url": (email_brand_payload.get("website_url") or "").strip(),
        "linkedin_url": (email_brand_payload.get("linkedin_url") or "").strip(),
        "instagram_url": (email_brand_payload.get("instagram_url") or "").strip(),
        "facebook_url": (email_brand_payload.get("facebook_url") or "").strip(),
        "x_url": (email_brand_payload.get("x_url") or "").strip(),
        "social_icons": build_social_icons_html(email_brand_payload),
    }


def build_logo_html(logo_url: str | None, *, asset_origin: str = "") -> str:
    safe_logo_url = (logo_url or "").strip()
    if not safe_logo_url:
        return ""

    if safe_logo_url.startswith("/") and asset_origin.strip():
        safe_logo_url = f"{asset_origin.rstrip('/')}{safe_logo_url}"

    escaped_logo_url = escape(safe_logo_url, quote=True)
    return (
        '<img src="'
        f"{escaped_logo_url}"
        '" alt="" width="120" '
        'style="display:block;max-width:120px;height:auto;border:0;outline:none;text-decoration:none;" />'
    )


def build_social_icons_html(email_brand: Mapping[str, str | None]) -> str:
    social_items = (
        ("website_url", "WEB", "#2563eb"),
        ("linkedin_url", "in", "#0a66c2"),
        ("instagram_url", "ig", "#d946ef"),
        ("facebook_url", "f", "#1877f2"),
        ("x_url", "x", "#111827"),
    )
    icon_cells: list[str] = []

    for key, label, background_color in social_items:
        social_url = (email_brand.get(key) or "").strip()
        if not social_url:
            continue

        escaped_url = escape(social_url, quote=True)
        icon_cells.append(
            "<td style=\"padding-right:8px;\">"
            f"<a href=\"{escaped_url}\" "
            "style=\"display:inline-block;text-decoration:none;\">"
            f"<span style=\"display:inline-block;min-width:32px;padding:8px 10px;border-radius:999px;background:{background_color};color:#ffffff;font-size:12px;line-height:1;font-weight:700;text-align:center;text-transform:uppercase;\">{escape(label)}</span>"
            "</a></td>"
        )

    if not icon_cells:
        return ""

    return (
        "<table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\">"
        "<tr>"
        f"{''.join(icon_cells)}"
        "</tr>"
        "</table>"
    )


def get_default_template_renderer() -> TemplateRenderer:
    settings = get_settings()
    return TemplateRenderer(
        dist_dir=Path(__file__).resolve().parents[3] / "templates" / "dist",
        asset_origin=settings.backend_public_origin or settings.backend_public_url.strip(),
    )


def ensure_unsubscribe_link(body: str, unsubscribe_url: str) -> str:
    if unsubscribe_url in body:
        return body

    if "{{unsubscribe_url}}" in body:
        return body.replace("{{unsubscribe_url}}", unsubscribe_url)

    footer = (
        '<p style="font-size:12px;line-height:20px;color:#52606d;">'
        "You are receiving this email because you subscribed to updates from Sendwise. "
        f'Manage preferences or <a href="{unsubscribe_url}">unsubscribe</a>.'
        "</p>"
    )
    lower_body = body.lower()
    body_close_index = lower_body.rfind("</body>")
    if body_close_index >= 0:
        return f"{body[:body_close_index]}{footer}{body[body_close_index:]}"
    return f"{body}{footer}"


def build_unsubscribe_url(
    *,
    settings: Settings,
    campaign_id: str,
    token: str = LISTMONK_UNSUBSCRIBE_TOKEN_PLACEHOLDER,
    send_kind: str | None = None,
) -> str:
    base_url = settings.frontend_origin or settings.frontend_url.strip()
    base_url = base_url.rstrip("/") or "https://example.invalid"
    path = f"{base_url}/unsubscribe/{token}"
    query_values = {
        key: value
        for key, value in {
            "campaign_id": campaign_id if send_kind is not None else None,
            "send_kind": send_kind,
        }.items()
        if value is not None
    }
    if not query_values:
        return path
    return f"{path}?{urlencode(query_values)}"


def render_client_access_email_html(
    *,
    recipient_name: str,
    panel_url: str,
    login_email: str,
    action_url: str,
) -> str:
    safe_name = escape(recipient_name)
    safe_panel_url = escape(panel_url, quote=True)
    safe_login_email = escape(login_email)
    safe_action_url = escape(action_url, quote=True)
    return (
        "<html><body style=\"margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#0f172a;\">"
        "<div style=\"max-width:640px;margin:0 auto;padding:32px 20px;\">"
        "<div style=\"background:#ffffff;border:1px solid #dbe4f0;border-radius:24px;padding:32px;\">"
        "<p style=\"margin:0 0 16px;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;color:#2563eb;\">Sendwise</p>"
        f"<h1 style=\"margin:0 0 16px;font-size:28px;line-height:1.2;\">Ciao {safe_name}, il tuo accesso a Sendwise e pronto.</h1>"
        "<p style=\"margin:0 0 20px;font-size:16px;line-height:1.6;color:#334155;\">"
        "Abbiamo preparato il tuo accesso al pannello cliente. Usa il pulsante qui sotto per impostare la password o completare l'attivazione in modo sicuro."
        "</p>"
        "<div style=\"margin:24px 0;padding:20px;border-radius:16px;background:#f8fafc;border:1px solid #e2e8f0;\">"
        f"<p style=\"margin:0 0 8px;font-size:14px;color:#475569;\"><strong>Email di accesso:</strong> {safe_login_email}</p>"
        f"<p style=\"margin:0;font-size:14px;color:#475569;\"><strong>URL pannello:</strong> <a href=\"{safe_panel_url}\">{safe_panel_url}</a></p>"
        "</div>"
        f"<p style=\"margin:28px 0;\"><a href=\"{safe_action_url}\" style=\"display:inline-block;padding:14px 22px;border-radius:999px;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:700;\">Imposta password e accedi</a></p>"
        "<p style=\"margin:0 0 12px;font-size:14px;line-height:1.6;color:#475569;\">"
        "Se il pulsante non funziona, copia e incolla questo link nel browser:"
        "</p>"
        f"<p style=\"margin:0 0 20px;font-size:14px;line-height:1.6;word-break:break-word;\"><a href=\"{safe_action_url}\">{safe_action_url}</a></p>"
        "<p style=\"margin:0;font-size:14px;line-height:1.6;color:#475569;\">"
        "Se hai bisogno di assistenza o vuoi ricevere una nuova email di accesso, contatta il team Sendwise."
        "</p>"
        "</div></div></body></html>"
    )


def render_client_access_email_text(
    *,
    recipient_name: str,
    panel_url: str,
    login_email: str,
    action_url: str,
) -> str:
    return (
        f"Ciao {recipient_name},\n\n"
        "Il tuo accesso a Sendwise e pronto.\n\n"
        f"Email di accesso: {login_email}\n"
        f"URL pannello: {panel_url}\n\n"
        f"Imposta password e accedi: {action_url}\n\n"
        "Se hai bisogno di assistenza o vuoi ricevere una nuova email di accesso, contatta il team Sendwise.\n"
    )
