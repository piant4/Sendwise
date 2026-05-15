"use client";

import { CheckCircle2, LayoutTemplate } from "lucide-react";
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
  return value.length > 150 ? `${value.slice(0, 147)}...` : value;
}

export function AdminCampaignTemplatePicker({
  templates,
  selectedTemplateId,
  disabled = false,
  onSelect,
  onApply,
}: AdminCampaignTemplatePickerProps) {
  return (
    <section className="campaign-panel campaign-panel--subtle" style={{ padding: 20 }}>
      <div className="admin-clients-card__intro">
        <div>
          <p className="admin-surface__eyebrow">Modelli frontend-only</p>
          <h3 className="admin-clients-card__title" style={{ color: "#0f172a", fontSize: "1.1rem" }}>
            Selezione template email
          </h3>
          <p className="admin-clients-card__description" style={{ marginTop: 8 }}>
            Applica un preset locale per precompilare anteprima, HTML e testo semplice. Il contenuto resta modificabile e non viene salvato automaticamente.
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

              <div className="campaign-template-card__preview">
                <strong style={{ color: "#0f172a", display: "block", marginBottom: 6 }}>
                  Uso consigliato
                </strong>
                <span>{template.recommendedUseCase}</span>
              </div>

              <div className="campaign-template-card__preview">
                <strong style={{ color: "#0f172a", display: "block", marginBottom: 6 }}>
                  Anteprima
                </strong>
                <span>{getPreviewExcerpt(template.previewText)}</span>
              </div>

              <div className="campaign-action-row__group">
                <Button
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  className={`admin-topbar-action ${isSelected ? "campaign-action campaign-action--primary" : "campaign-action campaign-action--secondary"}`}
                  disabled={disabled}
                  onClick={() => onSelect(template.id)}
                >
                  <LayoutTemplate aria-hidden="true" className="admin-topbar-action__icon" />
                  {isSelected ? "Modello selezionato" : "Seleziona"}
                </Button>
                <Button
                  type="button"
                  className="admin-topbar-action campaign-action campaign-action--primary"
                  disabled={disabled}
                  onClick={() => onApply(template)}
                >
                  Usa questo modello
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
