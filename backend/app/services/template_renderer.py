from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from html import escape

from app.core.config import Settings
from app.services.unsubscribe import LISTMONK_UNSUBSCRIBE_TOKEN_PLACEHOLDER


class TemplateRenderError(RuntimeError):
    pass


class CompiledTemplateNotFoundError(TemplateRenderError):
    pass


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

    def render(
        self,
        *,
        template_name: str,
        subject: str,
        preview_text: str,
        body: str,
        unsubscribe_url: str,
        client_name: str,
    ) -> RenderedEmailTemplate:
        template_html = self.load_compiled_template(template_name)
        rendered_html = template_html
        replacements = {
            "{{subject}}": subject,
            "{{preview_text}}": preview_text,
            "{{body}}": body,
            "{{unsubscribe_url}}": unsubscribe_url,
            "{{client_name}}": client_name,
        }
        for placeholder, value in replacements.items():
            rendered_html = rendered_html.replace(placeholder, value)
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
        for placeholder in (
            "{{subject}}",
            "{{preview_text}}",
            "{{body}}",
            "{{unsubscribe_url}}",
            "{{client_name}}",
        ):
            if placeholder in rendered_html:
                raise TemplateRenderError(
                    f"Compiled template '{template_name}' still contains unresolved placeholders."
                )


def get_default_template_renderer() -> TemplateRenderer:
    return TemplateRenderer(
        dist_dir=Path(__file__).resolve().parents[3] / "templates" / "dist"
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
) -> str:
    _ = campaign_id
    base_url = settings.frontend_origin or settings.frontend_url.strip()
    base_url = base_url.rstrip("/") or "https://example.invalid"
    return f"{base_url}/unsubscribe/{token}"


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
