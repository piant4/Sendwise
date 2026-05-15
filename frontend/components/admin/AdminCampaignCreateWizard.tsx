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
import { Button } from "../ui/button";

interface AdminCampaignCreateWizardProps {
  clients: Client[];
}

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
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
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

    if (!clientId || !name.trim() || !subject.trim()) {
      setErrorMessage("Cliente, nome campagna e oggetto sono obbligatori.");
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
          subject: subject.trim(),
        },
        token,
      );
      router.push(`/admin/campaigns/${createdCampaign.campaignId}?mode=edit&step=content`);
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
      <div className="admin-clients-card__intro">
        <div>
          <p className="admin-surface__eyebrow">Creazione campagna</p>
          <h2 className="admin-clients-card__title" style={{ color: "#0f172a" }}>
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
            required
            value={subject}
          />
        </label>
        <div className="campaign-callout">
          <span className="admin-record-row__note">Cliente selezionato</span>
          <strong style={{ color: "#0f172a" }}>
            {selectedClient ? getClientDisplayName(selectedClient) : "-"}
          </strong>
        </div>
      </div>

      <div className="campaign-action-row">
        <Button
          asChild
          variant="outline"
          size="default"
          className="admin-topbar-action campaign-action campaign-action--secondary"
          style={{ minWidth: 148 }}
        >
          <Link href="/admin/campaigns">
            <ArrowLeft aria-hidden="true" className="admin-topbar-action__icon" />
            Annulla
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
