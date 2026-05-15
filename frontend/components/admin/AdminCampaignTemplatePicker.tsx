"use client";

import { CheckCircle2, Eye, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { CampaignTemplate } from "../../lib/campaignTemplates";
import { Button } from "../ui/button";

interface AdminCampaignTemplatePickerProps {
  templates: CampaignTemplate[];
  selectedTemplateId: string | null;
  disabled?: boolean;
  onSelect: (templateId: string) => void;
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

export function AdminCampaignTemplatePicker({
  templates,
  selectedTemplateId,
  disabled = false,
  onSelect,
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
            <p className="admin-surface__eyebrow">Modelli</p>
            <h3 className="admin-clients-card__title" style={{ color: "#0f172a", fontSize: "1.1rem" }}>
              Template email
            </h3>
            <p className="admin-clients-card__description" style={{ marginTop: 8 }}>
              Preset locali per precompilare il contenuto.
            </p>
          </div>
        </div>

        <div className="campaign-template-grid" style={{ marginTop: 18 }}>
          {templates.map((template) => {
            const isSelected = selectedTemplateId === template.id;

            return (
              <article
                key={template.id}
                className={`campaign-template-card${isSelected ? " campaign-template-card--selected" : ""}`}
              >
                <div className="campaign-template-card__meta">
                  <span className="campaign-template-badge">{template.category}</span>
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
                  <p className="campaign-template-card__excerpt">{getPreviewExcerpt(template.previewText)}</p>
                </div>

                <div className="campaign-template-actions">
                  <Button
                    aria-label="Anteprima template"
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    title="Anteprima template"
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
                    onClick={() => {
                      onSelect(template.id);
                      onApply(template);
                    }}
                  >
                    Usa modello
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
                onClick={() => setPreviewTemplateId(null)}
              >
                <X aria-hidden="true" />
              </Button>
            </div>

            <div className="campaign-template-modal__grid">
              <section className="campaign-template-modal__section">
                <strong style={{ color: "#0f172a" }}>Preview text</strong>
                <span>{previewTemplate.previewText}</span>
              </section>

              <section className="campaign-template-modal__section">
                <strong style={{ color: "#0f172a" }}>HTML email</strong>
                <div
                  style={{ color: "#334155" }}
                  dangerouslySetInnerHTML={{ __html: previewTemplate.htmlBody }}
                />
              </section>

              <section className="campaign-template-modal__section">
                <strong style={{ color: "#0f172a" }}>Versione testo semplice</strong>
                <pre>{previewTemplate.plainTextBody}</pre>
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
