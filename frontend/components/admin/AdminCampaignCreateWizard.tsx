"use client";

import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import {
  createAdminCampaign,
  isApiError,
} from "../../lib/api";
import type { Client } from "../../types";
import { INTERNAL_CAMPAIGN_DRAFT_SUBJECT } from "../shared/campaignUi";
import { Button } from "../ui/button";

interface AdminCampaignCreateWizardProps {
  clients: Client[];
}

const TECHNICAL_NAME_PATTERN = /^[A-Za-z0-9-]+$/;
const WIZARD_STEPS = ["Setup", "Template", "Editor", "Destinatari", "Review", "Invio"] as const;

function getClientDisplayName(client: Client): string {
  return client.personal_name || client.name || client.email;
}

function getSafeCreateErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.isNetworkError) {
      return "Il browser non riesce a raggiungere il backend Sendwise.";
    }

    if (error.status === 401 || error.status === 403) {
      return "La sessione admin non e valida per creare campagne.";
    }

    if (error.status === 404) {
      return "Cliente non trovato o non disponibile per questa sessione admin.";
    }

    if (error.status === 409) {
      return "Il backend ha rifiutato la creazione per un conflitto operativo.";
    }

    if (error.status === 422) {
      return "Compila cliente e nome campagna prima di creare la bozza.";
    }

    if (error.detail.trim()) {
      return error.detail;
    }
  }

  return "Non e stato possibile creare la campagna. Riprova.";
}

export function AdminCampaignCreateWizard({
  clients,
}: AdminCampaignCreateWizardProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [name, setName] = useState("");
  const [periodEmailLimit, setPeriodEmailLimit] = useState("1000");
  const [dailyEmailLimit, setDailyEmailLimit] = useState("50");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === clientId) ?? null,
    [clientId, clients],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!clientId || !name.trim()) {
      setErrorMessage("Cliente e nome campagna sono obbligatori.");
      return;
    }

    if (!TECHNICAL_NAME_PATTERN.test(name.trim())) {
      setErrorMessage(
        "Il nome tecnico campagna puo contenere solo lettere, numeri e trattini.",
      );
      return;
    }

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

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const token = await getToken();
      const createdCampaign = await createAdminCampaign(
        {
          clientId,
          name: name.trim(),
          subject: INTERNAL_CAMPAIGN_DRAFT_SUBJECT,
          periodEmailLimit: periodLimitValue,
          dailyEmailLimit: dailyLimitValue,
        },
        token,
      );
      router.push(`/admin/campaigns/${createdCampaign.campaignId}?mode=edit&step=template`);
      router.refresh();
    } catch (error) {
      setErrorMessage(getSafeCreateErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (clients.length === 0) {
    return (
      <section className="admin-clients-card campaign-panel">
        <div className="admin-clients-card__intro">
          <div>
            <p className="admin-surface__eyebrow">Creazione campagna</p>
            <h2 className="admin-clients-card__title">Nessun cliente disponibile</h2>
            <p className="admin-clients-card__description">
              Crea o invita un cliente prima di aprire una bozza campagna.
            </p>
          </div>
        </div>
        <Button
          asChild
          size="lg"
          className="admin-topbar-action campaign-action campaign-action--primary"
          style={{ marginTop: 20 }}
        >
          <Link href="/admin/clients">Vai ai clienti</Link>
        </Button>
      </section>
    );
  }

  return (
    <form className="admin-clients-card campaign-panel" onSubmit={handleSubmit}>
      <div
        aria-label="Avanzamento wizard campagna"
        style={{
          display: "grid",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <strong style={{ color: "var(--sw-olive)" }}>Step 1 di 6</strong>
          <span className="admin-record-row__note">Setup</span>
        </div>
        <div
          style={{
            background: "rgba(148, 163, 184, 0.18)",
            borderRadius: 999,
            height: 10,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              background: "linear-gradient(90deg, #1d4ed8 0%, #60a5fa 100%)",
              borderRadius: 999,
              height: "100%",
              width: "16.67%",
            }}
          />
        </div>
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          }}
        >
          {WIZARD_STEPS.map((label, index) => (
            <div
              key={label}
              className="campaign-step-button"
              data-current={index === 0}
              data-ready={index === 0}
              style={{
                padding: "10px 12px",
              }}
            >
              <span className="campaign-step-button__header">
                <span className="admin-record-row__note">0{index + 1}</span>
                {index === 0 ? (
                  <span className="campaign-step-button__state">Attuale</span>
                ) : null}
              </span>
              <strong className="campaign-step-button__title" style={{ display: "block", marginTop: 4 }}>
                {label}
              </strong>
              <span className="campaign-step-button__reason">
                {index === 0 ? "Configura cliente, nome e limiti." : "Step disponibile dopo la creazione."}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-clients-card__intro">
        <div>
          <p className="admin-surface__eyebrow">Creazione campagna</p>
          <h2 className="admin-clients-card__title" style={{ color: "var(--sw-olive)" }}>
            Nuova campagna
          </h2>
          <p className="admin-clients-card__description">
            Crea la bozza iniziale e prosegui nel wizard contenuto.
          </p>
        </div>
      </div>

      {errorMessage ? (
        <p className="admin-clients-feedback admin-clients-feedback--error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="campaign-form-grid">
        <label className="campaign-field">
          <span className="campaign-field__label">Cliente</span>
          <select
            className="campaign-select"
            disabled={isSubmitting}
            onChange={(event) => setClientId(event.target.value)}
            required
            value={clientId}
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {getClientDisplayName(client)} - {client.email}
              </option>
            ))}
          </select>
        </label>
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
            Identificatore tecnico della campagna. Usa lettere, numeri e trattini. Esempio:
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
        <div
          className="campaign-callout"
          style={{
            alignItems: "center",
            display: "flex",
            gap: 12,
            justifyContent: "space-between",
          }}
        >
          <div>
            <span className="admin-record-row__note">Cliente selezionato</span>
            <strong style={{ color: "var(--sw-olive)", display: "block", marginTop: 4 }}>
              {selectedClient ? getClientDisplayName(selectedClient) : "-"}
            </strong>
          </div>
          {selectedClient ? (
            <span className="admin-record-chip">{selectedClient.email}</span>
          ) : null}
        </div>
      </div>

      <div className="campaign-action-row">
        <Button
          asChild
          variant="outline"
          size="default"
          className="admin-topbar-action campaign-action campaign-action--secondary"
          style={{ minWidth: 190 }}
        >
          <Link href="/admin/campaigns">
            <ArrowLeft aria-hidden="true" className="admin-topbar-action__icon" />
            Torna alle campagne
          </Link>
        </Button>
        <Button
          type="submit"
          size="default"
          className="admin-topbar-action campaign-action campaign-action--primary"
          disabled={isSubmitting}
          style={{ minWidth: 170 }}
        >
          {isSubmitting ? (
            <Loader2 aria-hidden="true" className="admin-topbar-action__icon" />
          ) : (
            <Check aria-hidden="true" className="admin-topbar-action__icon" />
          )}
          {isSubmitting ? "Creazione..." : "Crea bozza"}
        </Button>
      </div>
    </form>
  );
}
