"use client";

import { useAuth } from "@clerk/nextjs";
import { AlertCircle, Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import {
  isApiError,
  updateAdminCampaign,
  updateAdminCampaignContent,
} from "../../lib/api";
import type { AdminCampaignDetail } from "../../types";
import { Button } from "../ui/button";

interface AdminCampaignSetupFormProps {
  campaign: AdminCampaignDetail;
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
      return "La sessione admin non e valida per modificare questa campagna.";
    }

    if (error.status === 404) {
      return "Campagna non trovata o non disponibile per questa sessione admin.";
    }

    if (error.status === 409) {
      return "Il backend ha rifiutato la modifica per lo stato corrente della campagna.";
    }

    if (error.status === 422) {
      return "Verifica nome, oggetto e contenuto prima di salvare.";
    }

    if (error.detail.trim()) {
      return error.detail;
    }
  }

  return "Non e stato possibile salvare la configurazione. Riprova.";
}

export function AdminCampaignSetupForm({
  campaign,
}: AdminCampaignSetupFormProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [name, setName] = useState(campaign.name);
  const [subject, setSubject] = useState(getValue(campaign.subject));
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

    if (!name.trim()) {
      setErrorMessage("Il nome campagna e obbligatorio.");
      return;
    }

    const nameChanged = name.trim() !== campaign.name;
    const subjectValue = normalizeText(subject);
    const previewValue = normalizeText(previewText);
    const bodyHtmlValue = normalizeText(bodyHtml);
    const bodyTextValue = normalizeText(bodyText);
    const contentChanged =
      subjectValue !== normalizeText(campaign.subject) ||
      previewValue !== normalizeText(campaign.previewText) ||
      bodyHtmlValue !== normalizeText(campaign.bodyHtml) ||
      bodyTextValue !== normalizeText(campaign.bodyText);

    if (!nameChanged && !contentChanged) {
      setSuccessMessage("Nessuna modifica da salvare.");
      setErrorMessage(null);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const token = await getToken();

      if (nameChanged) {
        await updateAdminCampaign(
          campaign.campaignId,
          {
            name: name.trim(),
          },
          token,
        );
      }

      if (contentChanged) {
        await updateAdminCampaignContent(
          campaign.campaignId,
          {
            subject: subjectValue,
            previewText: previewValue,
            bodyHtml: bodyHtmlValue,
            bodyText: bodyTextValue,
          },
          token,
        );
      }

      setSuccessMessage("Configurazione salvata. Stato e prontezza sono aggiornati dal backend.");
      router.refresh();
    } catch (error) {
      setErrorMessage(getSafeUpdateErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="admin-clients-card" onSubmit={handleSubmit}>
      <div className="admin-clients-card__intro">
        <div>
          <p className="admin-surface__eyebrow">Setup base</p>
          <h2 className="admin-clients-card__title">Configurazione e contenuto</h2>
          <p className="admin-clients-card__description">
            Salva i campi supportati dal backend. La prontezza resta letta dalle
            risposte API.
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

      {!campaign.contentReady ? (
        <p className="admin-clients-feedback" role="status">
          <AlertCircle aria-hidden="true" size={16} /> Contenuto non ancora pronto
          secondo il backend.
        </p>
      ) : null}

      <div className="admin-clients-form" id="setup-base">
        <label className="admin-clients-form__field">
          <span>Nome campagna</span>
          <input
            className="admin-clients-form__input"
            disabled={isSubmitting}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </label>
        <label className="admin-clients-form__field">
          <span>Oggetto</span>
          <input
            className="admin-clients-form__input"
            disabled={isSubmitting}
            onChange={(event) => setSubject(event.target.value)}
            value={subject}
          />
        </label>
      </div>

      <div className="admin-clients-form" id="content" style={{ marginTop: 18 }}>
        <div>
          <p className="admin-surface__eyebrow">Contenuto</p>
          <h3 className="admin-clients-card__title">Email campagna</h3>
        </div>
        <label className="admin-clients-form__field">
          <span>Preview text</span>
          <input
            className="admin-clients-form__input"
            disabled={isSubmitting}
            onChange={(event) => setPreviewText(event.target.value)}
            value={previewText}
          />
        </label>
        <label className="admin-clients-form__field">
          <span>HTML contenuto</span>
          <textarea
            className="admin-clients-form__input"
            disabled={isSubmitting}
            onChange={(event) => setBodyHtml(event.target.value)}
            rows={8}
            value={bodyHtml}
          />
        </label>
        <label className="admin-clients-form__field">
          <span>Testo semplice</span>
          <textarea
            className="admin-clients-form__input"
            disabled={isSubmitting}
            onChange={(event) => setBodyText(event.target.value)}
            rows={5}
            value={bodyText}
          />
        </label>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 22 }}>
        <Button
          type="submit"
          size="lg"
          className="admin-topbar-action admin-topbar-action--primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 aria-hidden="true" className="admin-topbar-action__icon" />
          ) : (
            <Save aria-hidden="true" className="admin-topbar-action__icon" />
          )}
          {isSubmitting ? "Salvataggio..." : "Salva configurazione"}
        </Button>
      </div>
    </form>
  );
}
