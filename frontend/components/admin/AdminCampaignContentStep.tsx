"use client";

import { useAuth } from "@clerk/nextjs";
import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import {
  isApiError,
  updateAdminCampaignContent,
} from "../../lib/api";
import {
  CAMPAIGN_TEMPLATES,
} from "../../lib/campaignTemplates";
import type { CampaignTemplate } from "../../lib/campaignTemplates";
import type { AdminCampaignDetail } from "../../types";
import { AdminCampaignTemplatePicker } from "./AdminCampaignTemplatePicker";
import { Button } from "../ui/button";

interface AdminCampaignContentStepProps {
  campaign: AdminCampaignDetail;
  onBack?: () => void;
  onContinue?: () => void;
}

function getValue(value?: string | null): string {
  return value ?? "";
}

function normalizeText(value?: string | null): string {
  return (value ?? "").trim();
}

function getSafeUpdateErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.isNetworkError) {
      return "Il browser non riesce a raggiungere il backend Sendwise.";
    }

    if (error.status === 401 || error.status === 403) {
      return "La sessione admin non e valida per modificare il contenuto.";
    }

    if (error.status === 404) {
      return "Campagna non trovata o non disponibile per questa sessione admin.";
    }

    if (error.status === 409) {
      return "Il backend ha rifiutato la modifica per lo stato corrente della campagna.";
    }

    if (error.status === 422) {
      return "Verifica il contenuto email prima di salvare.";
    }

    if (error.detail.trim()) {
      return error.detail;
    }
  }

  return "Non e stato possibile salvare il contenuto. Riprova.";
}

export function AdminCampaignContentStep({
  campaign,
  onBack,
  onContinue,
}: AdminCampaignContentStepProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [previewText, setPreviewText] = useState(getValue(campaign.previewText));
  const [bodyHtml, setBodyHtml] = useState(getValue(campaign.bodyHtml));
  const [bodyText, setBodyText] = useState(getValue(campaign.bodyText));
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function hasCurrentContent(): boolean {
    return [previewText, bodyHtml, bodyText].some((value) => normalizeText(value).length > 0);
  }

  function applyTemplate(template: CampaignTemplate) {
    if (
      hasCurrentContent() &&
      window.confirm("Questo sostituirà il contenuto attuale dello step.") === false
    ) {
      return;
    }

    setSelectedTemplateId(template.id);
    setPreviewText(template.previewText);
    setBodyHtml(template.htmlBody);
    setBodyText(template.plainTextBody);
    setErrorMessage(null);
    setSuccessMessage(`Modello "${template.name}" applicato localmente. Salva per inviare il contenuto al backend.`);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const previewValue = normalizeText(previewText);
    const bodyHtmlValue = normalizeText(bodyHtml);
    const bodyTextValue = normalizeText(bodyText);
    const contentChanged =
      previewValue !== normalizeText(campaign.previewText) ||
      bodyHtmlValue !== normalizeText(campaign.bodyHtml) ||
      bodyTextValue !== normalizeText(campaign.bodyText);

    if (!contentChanged) {
      setSuccessMessage("Nessuna modifica da salvare.");
      setErrorMessage(null);
      onContinue?.();
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const token = await getToken();
      await updateAdminCampaignContent(
        campaign.campaignId,
        {
          previewText: previewValue,
          bodyHtml: bodyHtmlValue,
          bodyText: bodyTextValue,
        },
        token,
      );

      setSuccessMessage("Contenuto salvato. La prontezza resta determinata dal backend.");
      router.refresh();
      onContinue?.();
    } catch (error) {
      setErrorMessage(getSafeUpdateErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="admin-clients-card campaign-panel" onSubmit={handleSubmit}>
      <div className="admin-clients-card__intro">
        <div>
          <p className="admin-surface__eyebrow">Step 2</p>
          <h2 className="admin-clients-card__title" style={{ color: "#0f172a" }}>
            Contenuto email
          </h2>
        </div>
      </div>

      {errorMessage ? (
        <p className="admin-clients-feedback admin-clients-feedback--error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p className="admin-clients-feedback admin-clients-feedback--success" role="status">
          {successMessage}
        </p>
      ) : null}

      <div className="campaign-form-grid">
        <AdminCampaignTemplatePicker
          disabled={isSubmitting}
          onApply={applyTemplate}
          onSelect={setSelectedTemplateId}
          selectedTemplateId={selectedTemplateId}
          templates={CAMPAIGN_TEMPLATES}
        />

        <label className="campaign-field">
          <span className="campaign-field__label">Anteprima email</span>
          <input
            className="campaign-input"
            disabled={isSubmitting}
            onChange={(event) => setPreviewText(event.target.value)}
            placeholder="Un riepilogo sintetico del contenuto dell'email"
            value={previewText}
          />
        </label>
        <label className="campaign-field">
          <span className="campaign-field__label">HTML email</span>
          <textarea
            className="campaign-textarea"
            disabled={isSubmitting}
            onChange={(event) => setBodyHtml(event.target.value)}
            placeholder="<html>...</html>"
            rows={8}
            value={bodyHtml}
          />
        </label>
        <label className="campaign-field">
          <span className="campaign-field__label">Versione testo semplice</span>
          <p className="campaign-field__helper">
            Versione leggibile senza HTML.
          </p>
          <textarea
            className="campaign-textarea"
            disabled={isSubmitting}
            onChange={(event) => setBodyText(event.target.value)}
            placeholder="Versione testuale dell'email"
            rows={6}
            value={bodyText}
          />
        </label>
      </div>

      <div className="campaign-action-row">
        <Button
          type="button"
          variant="outline"
          className="admin-topbar-action campaign-action campaign-action--secondary"
          onClick={onBack}
          style={{ minWidth: 148 }}
        >
          Indietro
        </Button>
        <div className="campaign-action-row__group">
          <Button
            type="submit"
            className="admin-topbar-action campaign-action campaign-action--primary"
            disabled={isSubmitting}
            style={{ minWidth: 170 }}
          >
            {isSubmitting ? (
              <Loader2 aria-hidden="true" className="admin-topbar-action__icon" />
            ) : (
              <Save aria-hidden="true" className="admin-topbar-action__icon" />
            )}
            {isSubmitting ? "Salvataggio..." : "Salva e continua"}
          </Button>
        </div>
      </div>
    </form>
  );
}
