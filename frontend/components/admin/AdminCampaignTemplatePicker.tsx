"use client";

import { CheckCircle2, Eye, LayoutTemplate, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { CampaignTemplate } from "../../lib/campaignTemplates";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface AdminCampaignTemplatePickerProps {
  templates: CampaignTemplate[];
  selectedTemplateId: string | null;
  disabled?: boolean;
  onSelect: (templateId: string) => void;
  onApply: (template: CampaignTemplate) => void;
}

function getPreviewExcerpt(value: string): string {
  return value.length > 110 ? `${value.slice(0, 107)}...` : value;
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
            Preset locali per precompilare i campi del contenuto.
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
                <Badge
                  variant="secondary"
                  style={{
                    background: "rgba(219, 234, 254, 0.88)",
                    color: "#1d4ed8",
                  }}
                >
                  {template.category}
                </Badge>
                {isSelected ? (
                  <Badge
                    style={{
                      background: "rgba(14, 165, 233, 0.14)",
                      color: "#0369a1",
                    }}
                  >
                    <CheckCircle2 aria-hidden="true" size={12} />
                    Selezionato
                  </Badge>
                ) : null}
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <h4 className="campaign-template-card__title">{template.name}</h4>
                <p className="campaign-template-card__description">{template.description}</p>
              </div>

              <div className="campaign-template-preview">{getPreviewExcerpt(template.previewText)}</div>

              <div className="campaign-template-actions">
                <Button
                  type="button"
                  variant="outline"
                  className="admin-topbar-action campaign-action campaign-action--secondary"
                  disabled={disabled}
                  onClick={() => setPreviewTemplateId(template.id)}
                >
                  <Eye aria-hidden="true" className="admin-topbar-action__icon" />
                  Anteprima
                </Button>
                <Button
                  type="button"
                  className="admin-topbar-action campaign-action campaign-action--primary"
                  disabled={disabled}
                  onClick={() => {
                    onSelect(template.id);
                    onApply(template);
                  }}
                >
                  <LayoutTemplate aria-hidden="true" className="admin-topbar-action__icon" />
                  {isSelected ? "Usa modello" : "Usa modello"}
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
                <Badge
                  variant="secondary"
                  style={{ background: "rgba(219, 234, 254, 0.88)", color: "#1d4ed8" }}
                >
                  {previewTemplate.category}
                </Badge>
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
