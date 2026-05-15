"use client";

import { useAuth } from "@clerk/nextjs";
import { Loader2, Pencil, Save } from "lucide-react";
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
      return "La sessione admin non e valida per modificare questa campagna.";
    }

    if (error.status === 404) {
      return "Campagna non trovata o non disponibile per questa sessione admin.";
    }

    if (error.status === 409) {
      return "Il backend ha rifiutato la modifica per lo stato corrente della campagna.";
    }

    if (error.status === 422) {
      return "Verifica nome campagna e oggetto email prima di salvare.";
    }

    if (error.detail.trim()) {
      return error.detail;
    }
  }

  return "Non e stato possibile salvare la configurazione di base. Riprova.";
}

export function AdminCampaignSetupForm({
  campaign,
  onContinue,
}: AdminCampaignSetupFormProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [name, setName] = useState(campaign.name);
  const [subject, setSubject] = useState(getValue(campaign.subject));
  const [isEditingBase, setIsEditingBase] = useState(false);
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
    const subjectChanged = subjectValue !== normalizeText(campaign.subject);

    if (!nameChanged && !subjectChanged) {
      setSuccessMessage("Dati base invariati.");
      setErrorMessage(null);
      onContinue?.();
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

      if (subjectChanged) {
        await updateAdminCampaignContent(
          campaign.campaignId,
          {
            subject: subjectValue,
          },
          token,
        );
      }

      setSuccessMessage("Dati base salvati. La readiness resta calcolata dal backend.");
      router.refresh();
      setIsEditingBase(false);
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
          <p className="admin-surface__eyebrow">Step 1</p>
          <h2 className="admin-clients-card__title" style={{ color: "#0f172a" }}>
            Setup base
          </h2>
          <p className="admin-clients-card__description">
            Verifica i dati principali prima di passare al contenuto. Nome e oggetto restano compatti finche non scegli di editarli.
          </p>
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

      {!isEditingBase ? (
        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {[
            ["Cliente", campaign.clientName],
            ["Nome campagna", campaign.name],
            ["Oggetto email", campaign.subject?.trim() || "Da completare"],
          ].map(([label, value]) => (
            <article
              key={label}
              className="campaign-callout"
            >
              <span className="admin-record-row__note">{label}</span>
              <strong style={{ color: "#0f172a" }}>{value}</strong>
            </article>
          ))}
        </div>
      ) : (
        <div className="campaign-form-grid">
          <label className="campaign-field">
            <span className="campaign-field__label">Nome campagna</span>
            <input
              className="campaign-input"
              disabled={isSubmitting}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </label>
          <label className="campaign-field">
            <span className="campaign-field__label">Oggetto email</span>
            <input
              className="campaign-input"
              disabled={isSubmitting}
              onChange={(event) => setSubject(event.target.value)}
              value={subject}
            />
          </label>
        </div>
      )}

      <div className="campaign-action-row">
        <Button
          type="button"
          variant="outline"
          className="admin-topbar-action campaign-action campaign-action--secondary"
          onClick={() => setIsEditingBase((value) => !value)}
          style={{ minWidth: 160 }}
        >
          <Pencil aria-hidden="true" className="admin-topbar-action__icon" />
          {isEditingBase ? "Chiudi modifica" : "Modifica dati base"}
        </Button>
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
    </form>
  );
}
