"use client";

import { useAuth } from "@clerk/nextjs";
import { Loader2, Pencil, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import {
  isApiError,
  updateAdminCampaign,
} from "../../lib/api";
import type { AdminCampaignDetail, AdminCampaignReadinessSummary } from "../../types";
import { Button } from "../ui/button";

interface AdminCampaignSetupFormProps {
  campaign: AdminCampaignDetail;
  summary?: AdminCampaignReadinessSummary | null;
  onContinue?: () => void;
}

const TECHNICAL_NAME_PATTERN = /^[A-Za-z0-9-]+$/;

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
      return "Verifica nome campagna e limiti invio prima di salvare.";
    }

    if (error.detail.trim()) {
      return error.detail;
    }
  }

  return "Non e stato possibile salvare la configurazione di base. Riprova.";
}

export function AdminCampaignSetupForm({
  campaign,
  summary,
  onContinue,
}: AdminCampaignSetupFormProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [name, setName] = useState(campaign.name);
  const [periodEmailLimit, setPeriodEmailLimit] = useState(
    String(campaign.periodEmailLimit),
  );
  const [dailyEmailLimit, setDailyEmailLimit] = useState(
    String(campaign.dailyEmailLimit),
  );
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

    if (!TECHNICAL_NAME_PATTERN.test(name.trim())) {
      setErrorMessage(
        "Il nome tecnico campagna puo contenere solo lettere, numeri e trattini.",
      );
      return;
    }

    const nameChanged = name.trim() !== campaign.name;
    const periodLimitValue = Number(periodEmailLimit);
    const dailyLimitValue = Number(dailyEmailLimit);
    if (
      !Number.isInteger(periodLimitValue) ||
      periodLimitValue <= 0 ||
      !Number.isInteger(dailyLimitValue) ||
      dailyLimitValue <= 0
    ) {
      setErrorMessage("Inserisci limiti interi maggiori di zero per periodo e giorno.");
      return;
    }
    const periodLimitChanged = periodLimitValue !== campaign.periodEmailLimit;
    const dailyLimitChanged = dailyLimitValue !== campaign.dailyEmailLimit;

    if (!nameChanged && !periodLimitChanged && !dailyLimitChanged) {
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

      await updateAdminCampaign(
        campaign.campaignId,
        {
          ...(nameChanged ? { name: name.trim() } : {}),
          ...(periodLimitChanged ? { periodEmailLimit: periodLimitValue } : {}),
          ...(dailyLimitChanged ? { dailyEmailLimit: dailyLimitValue } : {}),
        },
        token,
      );

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
            Definisci cliente, nome tecnico e limiti di invio. L&apos;oggetto si completa nello step Editor.
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
            ["Nome tecnico campagna", campaign.name],
            ["Limite invii 30 giorni", campaign.periodEmailLimit.toLocaleString("it-IT")],
            ["Limite invii giornaliero", campaign.dailyEmailLimit.toLocaleString("it-IT")],
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
            <span className="campaign-field__label">Nome tecnico campagna</span>
            <input
              className="campaign-input"
              disabled={isSubmitting}
              onChange={(event) => setName(event.target.value)}
              pattern="[A-Za-z0-9-]+"
              placeholder="prova-mailgun-01"
              required
              value={name}
            />
            <span className="campaign-field__helper">
              Nome tecnico esplicito della campagna. Usa lettere, numeri e trattini. Esempio:
              {" "}prova-mailgun-01
            </span>
          </label>
          <div
            style={{
              display: "grid",
              gap: 14,
              gridColumn: "1 / -1",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            <label className="campaign-field" style={{ marginBottom: 0 }}>
              <span className="campaign-field__label">Limite invii 30 giorni</span>
              <input
                className="campaign-input"
                disabled={isSubmitting}
                min={1}
                onChange={(event) => setPeriodEmailLimit(event.target.value)}
                required
                type="number"
                value={periodEmailLimit}
              />
            </label>
            <label className="campaign-field" style={{ marginBottom: 0 }}>
              <span className="campaign-field__label">Limite invii giornaliero</span>
              <input
                className="campaign-input"
                disabled={isSubmitting}
                min={1}
                onChange={(event) => setDailyEmailLimit(event.target.value)}
                required
                type="number"
                value={dailyEmailLimit}
              />
            </label>
          </div>
        </div>
      )}

      {summary ? (
        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {[
            [
              "Invii oggi",
              `${summary.dailyUsed.toLocaleString("it-IT")} / ${(summary.dailyLimit ?? campaign.dailyEmailLimit).toLocaleString("it-IT")}`,
            ],
            [
              "Residuo oggi",
              (summary.dailyRemaining ?? 0).toLocaleString("it-IT"),
            ],
            [
              "Invii periodo",
              `${summary.periodUsed.toLocaleString("it-IT")} / ${(summary.periodLimit ?? campaign.periodEmailLimit).toLocaleString("it-IT")}`,
            ],
            [
              "Periodo",
              summary.periodStartedAt ? "Avviato" : "Periodo non ancora avviato",
            ],
            [
              "Residuo periodo",
              (summary.periodRemaining ?? 0).toLocaleString("it-IT"),
            ],
          ].map(([label, value]) => (
            <article key={label} className="campaign-callout">
              <span className="admin-record-row__note">{label}</span>
              <strong style={{ color: "#0f172a" }}>{value}</strong>
            </article>
          ))}
        </div>
      ) : null}

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
