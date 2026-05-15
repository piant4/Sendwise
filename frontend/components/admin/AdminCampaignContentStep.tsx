"use client";

import { useAuth } from "@clerk/nextjs";
import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import {
  isApiError,
  updateAdminCampaignContent,
} from "../../lib/api";
import type { AdminCampaignDetail } from "../../types";
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  const textareaStyle = {
    minHeight: 160,
    resize: "none" as const,
  };

  return (
    <form className="admin-clients-card" onSubmit={handleSubmit}>
      <div className="admin-clients-card__intro">
        <div>
          <p className="admin-surface__eyebrow">Step 2</p>
          <h2 className="admin-clients-card__title" style={{ color: "#0f172a" }}>
            Contenuto email
          </h2>
          <p className="admin-clients-card__description">
            Completa i campi contenuto supportati dall&apos;endpoint esistente, senza template fittizi.
          </p>
        </div>
      </div>

      {errorMessage ? (
        <p className="admin-clients-feedback admin-clients-feedback--error" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p className="admin-clients-feedback" role="status">
          {successMessage}
        </p>
      ) : null}

      <div className="admin-clients-form">
        <label className="admin-clients-form__field">
          <span>Preview text</span>
          <input
            className="admin-clients-form__input"
            disabled={isSubmitting}
            onChange={(event) => setPreviewText(event.target.value)}
            placeholder="Testo breve mostrato accanto all'oggetto nella inbox"
            value={previewText}
          />
        </label>
        <label className="admin-clients-form__field">
          <span>HTML email</span>
          <textarea
            className="admin-clients-form__input"
            disabled={isSubmitting}
            onChange={(event) => setBodyHtml(event.target.value)}
            placeholder="<html>...</html>"
            rows={8}
            style={textareaStyle}
            value={bodyHtml}
          />
        </label>
        <label className="admin-clients-form__field">
          <span>Testo semplice</span>
          <textarea
            className="admin-clients-form__input"
            disabled={isSubmitting}
            onChange={(event) => setBodyText(event.target.value)}
            placeholder="Versione testuale dell'email"
            rows={6}
            style={textareaStyle}
            value={bodyText}
          />
        </label>
      </div>

      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          justifyContent: "space-between",
          marginTop: 18,
        }}
      >
        <Button
          type="button"
          variant="outline"
          className="admin-topbar-action admin-topbar-action--secondary"
          onClick={onBack}
          style={{
            borderColor: "rgba(148, 163, 184, 0.45)",
            color: "#0f172a",
            minWidth: 148,
          }}
        >
          Indietro
        </Button>
        <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Button
            type="button"
            variant="outline"
            className="admin-topbar-action admin-topbar-action--secondary"
            disabled
            style={{
              background: "rgba(239, 246, 255, 0.72)",
              borderColor: "rgba(96, 165, 250, 0.2)",
              color: "#64748b",
            }}
          >
            Modelli email non ancora disponibili
          </Button>
          <Button
            type="submit"
            className="admin-topbar-action admin-topbar-action--primary"
            disabled={isSubmitting}
            style={{
              background: "linear-gradient(135deg, #2563eb, #0ea5e9)",
              border: "1px solid rgba(37, 99, 235, 0.18)",
              boxShadow: "0 16px 34px rgba(37, 99, 235, 0.24)",
              color: "#f8fbff",
              minWidth: 170,
            }}
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
