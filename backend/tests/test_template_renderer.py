from pathlib import Path

import pytest

from app.services.template_renderer import (
    CompiledTemplateNotFoundError,
    TemplateRenderer,
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


def test_ensure_unsubscribe_link_appends_footer_when_missing() -> None:
    rendered = ensure_unsubscribe_link(
        "<html><body><p>Hello</p></body></html>",
        "https://example.test/unsubscribe/token",
    )

    assert "https://example.test/unsubscribe/token" in rendered
    assert rendered.count("unsubscribe") >= 1
    assert "You are receiving this email because you subscribed to updates from Sendwise." in rendered
