"use client";

import { useAuth } from "@clerk/nextjs";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import {
  createAdminClientCampaign,
  isApiError,
} from "../../lib/api";
import type { Client } from "../../types";
import { Button } from "../ui/button";

interface AdminCampaignCreateWizardProps {
  clients: Client[];
}

type Step = 1 | 2 | 3;

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
      return "Compila cliente, nome campagna e oggetto prima di creare la bozza.";
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
  const [step, setStep] = useState<Step>(1);
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === clientId) ?? null,
    [clientId, clients],
  );
  const canContinueFromClient = Boolean(clientId);
  const canContinueFromDetails = Boolean(name.trim() && subject.trim());

  function goToNextStep() {
    setErrorMessage(null);

    if (step === 1 && !canContinueFromClient) {
      setErrorMessage("Seleziona un cliente prima di continuare.");
      return;
    }

    if (step === 2 && !canContinueFromDetails) {
      setErrorMessage("Nome campagna e oggetto sono obbligatori.");
      return;
    }

    setStep((currentStep) => Math.min(currentStep + 1, 3) as Step);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!clientId || !name.trim() || !subject.trim()) {
      setErrorMessage("Cliente, nome campagna e oggetto sono obbligatori.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const token = await getToken();
      await createAdminClientCampaign(
        {
          clientId,
          name: name.trim(),
          subject: subject.trim(),
        },
        token,
      );
      router.push("/admin/campaigns");
      router.refresh();
    } catch (error) {
      setErrorMessage(getSafeCreateErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (clients.length === 0) {
    return (
      <section className="admin-clients-card">
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
          className="admin-topbar-action admin-topbar-action--primary"
          style={{ marginTop: 20 }}
        >
          <Link href="/admin/clients">Vai ai clienti</Link>
        </Button>
      </section>
    );
  }

  return (
    <form className="admin-clients-card" onSubmit={handleSubmit}>
      <div className="admin-clients-card__intro">
        <div>
          <p className="admin-surface__eyebrow">Creazione campagna</p>
          <h2 className="admin-clients-card__title">
            {step === 1
              ? "Cliente"
              : step === 2
                ? "Dettagli campagna"
                : "Riepilogo"}
          </h2>
          <p className="admin-clients-card__description">
            La campagna verra creata come bozza sicura. Invio, provider e
            destinatari restano governati dal backend.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 20 }}>
        {[
          { value: 1, label: "Cliente" },
          { value: 2, label: "Dettagli campagna" },
          { value: 3, label: "Riepilogo" },
        ].map((item) => (
          <span
            key={item.value}
            className="admin-record-chip"
            style={{
              background:
                step === item.value ? "var(--sw-primary)" : "rgba(93, 118, 78, 0.12)",
              color: step === item.value ? "var(--sw-surface)" : "var(--sw-primary)",
            }}
          >
            {item.value}. {item.label}
          </span>
        ))}
      </div>

      {errorMessage ? (
        <p className="admin-clients-feedback admin-clients-feedback--error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="admin-clients-form">
        {step === 1 ? (
          <label className="admin-clients-form__field">
            <span>Cliente</span>
            <select
              className="admin-clients-form__input"
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
        ) : null}

        {step === 2 ? (
          <>
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
                required
                value={subject}
              />
            </label>
          </>
        ) : null}

        {step === 3 ? (
          <dl className="admin-record-grid">
            <div>
              <dt>Cliente</dt>
              <dd>{selectedClient ? getClientDisplayName(selectedClient) : "-"}</dd>
            </div>
            <div>
              <dt>Campagna</dt>
              <dd>{name.trim() || "-"}</dd>
            </div>
            <div>
              <dt>Oggetto</dt>
              <dd>{subject.trim() || "-"}</dd>
            </div>
            <div>
              <dt>Stato iniziale</dt>
              <dd>Bozza backend</dd>
            </div>
          </dl>
        ) : null}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 22 }}>
        <Button
          asChild
          variant="outline"
          size="lg"
          className="admin-topbar-action admin-topbar-action--secondary"
        >
          <Link href="/admin/campaigns">
            <ArrowLeft aria-hidden="true" className="admin-topbar-action__icon" />
            Annulla
          </Link>
        </Button>
        {step > 1 ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="admin-topbar-action admin-topbar-action--secondary"
            disabled={isSubmitting}
            onClick={() => setStep((currentStep) => (currentStep - 1) as Step)}
          >
            <ArrowLeft aria-hidden="true" className="admin-topbar-action__icon" />
            Indietro
          </Button>
        ) : null}
        {step < 3 ? (
          <Button
            type="button"
            size="lg"
            className="admin-topbar-action admin-topbar-action--primary"
            disabled={isSubmitting}
            onClick={goToNextStep}
          >
            Avanti
            <ArrowRight aria-hidden="true" className="admin-topbar-action__icon" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="lg"
            className="admin-topbar-action admin-topbar-action--primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 aria-hidden="true" className="admin-topbar-action__icon" />
            ) : (
              <Check aria-hidden="true" className="admin-topbar-action__icon" />
            )}
            {isSubmitting ? "Creazione..." : "Crea bozza"}
          </Button>
        )}
      </div>
    </form>
  );
}
