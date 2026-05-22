"use client";

import { CheckCircle2, Eye, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { CampaignTemplate } from "../../lib/campaignTemplates";
import { Button } from "../ui/button";

interface AdminCampaignTemplatePickerProps {
  templates: CampaignTemplate[];
  selectedTemplateId: string | null;
  disabled?: boolean;
  isLoading?: boolean;
  onApply: (template: CampaignTemplate) => void;
}

function getPreviewExcerpt(value: string): string {
  if (value.length <= 82) {
    return value;
  }

  const trimmed = value.slice(0, 82);
  const lastSpace = trimmed.lastIndexOf(" ");
  return `${trimmed.slice(0, lastSpace > 48 ? lastSpace : trimmed.length).trim()}...`;
}

function getStructureHint(template: CampaignTemplate): string {
  if (template.htmlBody.includes("<table")) {
    return "Layout email strutturato";
  }

  if (template.htmlBody.includes("<section")) {
    return "Sezioni editoriali";
  }

  return "Markup essenziale";
}

function stripScripts(value: string): string {
  return value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

function buildPreviewDocument(value: string): string {
  const cleanedValue = stripScripts(value).trim();
  const content =
    cleanedValue.length > 0
      ? cleanedValue
      : '<div class="sw-preview-empty">Nessun contenuto HTML da mostrare.</div>';

  return `<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:; form-action 'none'; frame-ancestors 'none'; base-uri 'none'"
    />
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: #ffffff;
        color: #0f172a;
        padding: 20px;
      }

      img {
        height: auto;
        max-width: 100%;
      }

      .sw-preview-empty {
        border: 1px dashed rgba(148, 163, 184, 0.4);
        border-radius: 16px;
        color: #64748b;
        padding: 20px;
      }
    </style>
  </head>
  <body>${content}</body>
</html>`;
}

export function AdminCampaignTemplatePicker({
  templates,
  selectedTemplateId,
  disabled = false,
  isLoading = false,
  onApply,
}: AdminCampaignTemplatePickerProps) {
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const previewTemplate = useMemo(
    () => templates.find((template) => template.id === previewTemplateId) ?? null,
    [previewTemplateId, templates],
  );

  return (
    <>
      <section className="campaign-panel campaign-panel--subtle" style={{ padding: 20 }}>
        <div className="admin-clients-card__intro">
          <div>
            <p className="admin-surface__eyebrow">Template</p>
            <h3 className="admin-clients-card__title" style={{ color: "#0f172a", fontSize: "1.1rem" }}>
              Libreria template
            </h3>
            <p className="admin-clients-card__description" style={{ marginTop: 8 }}>
              Preset built-in e template cliente selezionabili prima della scrittura.
            </p>
          </div>
        </div>

        <div className="campaign-template-grid" style={{ marginTop: 18 }}>
          {isLoading ? (
            <article className="campaign-template-card campaign-template-card--empty">
              <div className="campaign-template-card__copy">
                <h4 className="campaign-template-card__title">Caricamento template</h4>
                <p className="campaign-template-card__description">
                  Recupero dei template cliente in corso.
                </p>
              </div>
            </article>
          ) : null}
          {templates.map((template) => {
            const isSelected = selectedTemplateId === template.id;

            return (
              <article
                key={template.id}
                className={`campaign-template-card${isSelected ? " campaign-template-card--selected" : ""}`}
              >
                <div className="campaign-template-card__meta">
                  <span className="campaign-template-badge">{template.category}</span>
                  <span className="campaign-template-badge campaign-template-badge--muted">
                    {template.source === "saved" ? "Cliente" : "Default"}
                  </span>
                  {isSelected ? (
                    <span className="campaign-template-selected">
                      <CheckCircle2 aria-hidden="true" size={11} />
                      Scelto
                    </span>
                  ) : null}
                </div>

                <div className="campaign-template-card__copy">
                  <h4 className="campaign-template-card__title">{template.name}</h4>
                  <p className="campaign-template-card__description">{template.description}</p>
                  <p className="campaign-template-card__subject">{template.subject}</p>
                  <p className="campaign-template-card__excerpt">{getStructureHint(template)}</p>
                  <p className="campaign-template-card__excerpt">{getPreviewExcerpt(template.previewText)}</p>
                </div>

                <div className="campaign-template-actions" style={{ alignItems: "stretch" }}>
                  <Button
                    aria-label="Anteprima email"
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    title="Anteprima email"
                    className="admin-topbar-action campaign-action campaign-action--secondary campaign-template-preview-button"
                    disabled={disabled}
                    onClick={() => setPreviewTemplateId(template.id)}
                  >
                    <Eye aria-hidden="true" className="admin-topbar-action__icon" />
                  </Button>
                  <Button
                    type="button"
                    className="admin-topbar-action campaign-action campaign-action--primary campaign-template-apply-button"
                    disabled={disabled}
                    onClick={() => onApply(template)}
                  >
                    Usa template
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {previewTemplate ? (
        <div
          className="campaign-template-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="campaign-template-preview-title"
          onClick={() => setPreviewTemplateId(null)}
        >
          <div
            className="campaign-template-modal__card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="campaign-template-modal__header">
              <div style={{ display: "grid", gap: 8 }}>
                <div className="campaign-template-card__meta">
                  <span className="campaign-template-badge">{previewTemplate.category}</span>
                </div>
                <div>
                  <h4 id="campaign-template-preview-title" className="campaign-template-card__title">
                    {previewTemplate.name}
                  </h4>
                  <p className="campaign-template-card__description">
                    {previewTemplate.recommendedUseCase}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Chiudi anteprima email"
                className="campaign-template-modal__close"
                onClick={() => setPreviewTemplateId(null)}
              >
                <X aria-hidden="true" />
              </Button>
            </div>

            <div className="campaign-template-modal__grid">
              <section className="campaign-template-modal__section">
                <strong style={{ color: "#0f172a" }}>Oggetto</strong>
                <p className="campaign-template-modal__preview-text">
                  {previewTemplate.subject}
                </p>
              </section>

              <section className="campaign-template-modal__section">
                <strong style={{ color: "#0f172a" }}>Anteprima email</strong>
                <p className="campaign-template-modal__preview-text">
                  {previewTemplate.previewText}
                </p>
              </section>

              <section className="campaign-template-modal__section">
                <strong style={{ color: "#0f172a" }}>HTML</strong>
                <iframe
                  className="campaign-email-preview-frame campaign-email-preview-frame--template"
                  sandbox=""
                  srcDoc={buildPreviewDocument(previewTemplate.htmlBody)}
                  title={`Anteprima email ${previewTemplate.name}`}
                />
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
