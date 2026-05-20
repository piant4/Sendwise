from pathlib import Path


def test_campaign_template_source_includes_unsubscribe_footer() -> None:
    template_source = (
        Path(__file__).resolve().parents[2] / "frontend" / "lib" / "campaignTemplates.ts"
    ).read_text(encoding="utf-8")

    assert "{{unsubscribe_url}}" in template_source
    assert "Gestisci le preferenze o disiscriviti" in template_source
    assert "{{social_icons}}" in template_source
    assert "{{logo}}" in template_source
