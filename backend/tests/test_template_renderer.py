from pathlib import Path

import pytest

from app.services.template_renderer import (
    CompiledTemplateNotFoundError,
    TemplateRenderer,
    build_social_icons_html,
    ensure_unsubscribe_link,
)


def write_template(tmp_path: Path, name: str, contents: str) -> TemplateRenderer:
    dist_dir = tmp_path / "dist"
    dist_dir.mkdir()
    (dist_dir / f"{name}.html").write_text(contents, encoding="utf-8")
    return TemplateRenderer(dist_dir=dist_dir)


def test_template_loader_finds_compiled_template(tmp_path: Path) -> None:
    renderer = write_template(
        tmp_path,
        "campaign",
        "<html><body>{{body}}<a href='{{unsubscribe_url}}'>u</a></body></html>",
    )

    template = renderer.load_compiled_template("campaign")

    assert "{{body}}" in template


def test_template_loader_fails_on_missing_template(tmp_path: Path) -> None:
    renderer = TemplateRenderer(dist_dir=tmp_path / "dist")

    with pytest.raises(CompiledTemplateNotFoundError):
        renderer.load_compiled_template("missing")


def test_render_replaces_minimal_variables(tmp_path: Path) -> None:
    renderer = write_template(
        tmp_path,
        "campaign",
        (
            "<html><head><title>{{subject}}</title></head><body>"
            "<p>{{preview_text}}</p><div>{{body}}</div>"
            "<a href='{{unsubscribe_url}}'>unsubscribe</a>"
            "<span>{{client_name}}</span></body></html>"
        ),
    )

    rendered = renderer.render(
        template_name="campaign",
        subject="Launch",
        preview_text="Preview line",
        body="<p>Hello</p>",
        unsubscribe_url="https://example.test/unsubscribe",
        client_name="Acme",
    )

    assert "{{subject}}" not in rendered.body
    assert "Launch" in rendered.body
    assert "Preview line" in rendered.body
    assert "<p>Hello</p>" in rendered.body
    assert "https://example.test/unsubscribe" in rendered.body
    assert "Acme" in rendered.body


def test_render_replaces_brand_variables_and_social_icons(tmp_path: Path) -> None:
    renderer = write_template(
        tmp_path,
        "campaign",
        (
            "<html><body>{{company_name}}|{{sender_name}}|{{logo}}|{{website_url}}|"
            "{{linkedin_url}}|{{instagram_url}}|{{facebook_url}}|{{x_url}}|{{social_icons}}|"
            "<a href='{{unsubscribe_url}}'>unsubscribe</a>{{body}}</body></html>"
        ),
    )

    rendered = renderer.render(
        template_name="campaign",
        subject="Launch",
        preview_text="Preview line",
        body="<p>Hello</p>",
        unsubscribe_url="https://example.test/unsubscribe",
        client_name="Acme",
        email_brand={
            "company_name": "Acme Labs",
            "sender_name": "Team Acme",
            "logo_url": "/static/client-brand-logos/acme.webp",
            "website_url": "https://acme.example.test",
            "linkedin_url": "https://linkedin.com/company/acme",
            "x_url": "https://x.com/acme",
        },
    )

    assert "Acme Labs" in rendered.body
    assert "Team Acme" in rendered.body
    assert "/static/client-brand-logos/acme.webp" in rendered.body
    assert "https://acme.example.test" in rendered.body
    assert "https://linkedin.com/company/acme" in rendered.body
    assert "https://x.com/acme" in rendered.body
    assert "{{social_icons}}" not in rendered.body


def test_build_social_icons_html_omits_missing_urls() -> None:
    html = build_social_icons_html(
        {
            "linkedin_url": "https://linkedin.com/company/acme",
            "facebook_url": None,
        }
    )

    assert "linkedin.com/company/acme" in html
    assert "facebook.com" not in html


def test_ensure_unsubscribe_link_appends_footer_when_missing() -> None:
    rendered = ensure_unsubscribe_link(
        "<html><body><p>Hello</p></body></html>",
        "https://example.test/unsubscribe/token",
    )

    assert "https://example.test/unsubscribe/token" in rendered
    assert rendered.count("unsubscribe") >= 1
    assert "You are receiving this email because you subscribed to updates from Sendwise." in rendered
