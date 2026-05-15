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
    <form className="admin-clients-card" onSubmit={handleSubmit}>
      <div className="admin-clients-card__intro">
        <div>
          <p className="admin-surface__eyebrow">Step 1</p>
          <h2 className="admin-clients-card__title" style={{ color: "#0f172a" }}>
            Setup base
          </h2>
          <p className="admin-clients-card__description">
            Verifica i dati principali. In modifica, nome e oggetto email restano compatti finche non scegli di editarli.
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
              style={{
                background: "rgba(239, 246, 255, 0.62)",
                border: "1px solid rgba(96, 165, 250, 0.18)",
                borderRadius: 18,
                display: "grid",
                gap: 6,
                padding: 16,
              }}
            >
              <span className="admin-record-row__note">{label}</span>
              <strong style={{ color: "#0f172a" }}>{value}</strong>
            </article>
          ))}
        </div>
      ) : (
        <div className="admin-clients-form">
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
            <span>Oggetto email</span>
            <input
              className="admin-clients-form__input"
              disabled={isSubmitting}
              onChange={(event) => setSubject(event.target.value)}
              value={subject}
            />
          </label>
        </div>
      )}

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
          onClick={() => setIsEditingBase((value) => !value)}
          style={{
            borderColor: "rgba(148, 163, 184, 0.45)",
            color: "#0f172a",
            minWidth: 160,
          }}
        >
          <Pencil aria-hidden="true" className="admin-topbar-action__icon" />
          {isEditingBase ? "Chiudi modifica" : "Modifica dati base"}
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
    </form>
  );
}
