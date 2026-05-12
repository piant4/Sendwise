from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlencode

from app.core.config import Settings


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


def build_unsubscribe_url(
    *,
    settings: Settings,
    campaign_id: str,
    client_id: str,
    contact_id: str | None = None,
) -> str:
    base_url = settings.frontend_origin or settings.frontend_url.strip()
    base_url = base_url.rstrip("/") or "https://example.invalid"
    query = {"campaign_id": campaign_id, "client_id": client_id}
    if contact_id:
        query["contact_id"] = contact_id
    return f"{base_url}/unsubscribe?{urlencode(query)}"
