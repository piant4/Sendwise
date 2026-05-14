"use client";

import { useAuth } from "@clerk/nextjs";
import { Loader2, Plus, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import {
  attachAdminCampaignContacts,
  isApiError,
} from "../../lib/api";
import type { AdminCampaignContactsSummary } from "../../types";
import { Button } from "../ui/button";
import { StatusBadge } from "../ui/StatusBadge";

interface AdminCampaignContactsPanelProps {
  campaignId: string;
  contacts: AdminCampaignContactsSummary | null;
  errorMessage?: string | null;
}

function parseEmails(value: string): string[] {
  return value
    .split(/[\s,;]+/)
    .map((email) => email.trim())
    .filter(Boolean);
}

function getSafeContactsErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.isNetworkError) {
      return "Il browser non riesce a raggiungere il backend Sendwise.";
    }

    if (error.status === 401 || error.status === 403) {
      return "La sessione admin non e valida per modificare i destinatari.";
    }

    if (error.status === 404) {
      return "Campagna non trovata o non disponibile per questa sessione admin.";
    }

    if (error.status === 409) {
      return "Il backend ha rifiutato l'associazione per lo stato corrente della campagna.";
    }

    if (error.status === 422) {
      return "Controlla gli indirizzi email prima di aggiungerli.";
    }

    if (error.detail.trim()) {
      return error.detail;
    }
  }

  return "Non e stato possibile aggiornare i destinatari. Riprova.";
}

function getContactsNotice(contacts: AdminCampaignContactsSummary | null): string {
  if (!contacts || contacts.total === 0) {
    return "Nessun destinatario associato.";
  }

  if (contacts.eligible === 0 && contacts.blocked === contacts.total) {
    return "Tutti i destinatari sono bloccati o non idonei.";
  }

  if (contacts.eligible === 0) {
    return "Nessun destinatario idoneo.";
  }

  return "La prontezza destinatari resta calcolata dal backend.";
}

function getReasonLabel(reason: string): string {
  switch (reason) {
    case "invalid_email":
      return "Email non valida";
    case "suppressed":
    case "suppression_list":
      return "Soppresso";
    case "unsubscribed":
      return "Disiscritto";
    case "blacklisted":
      return "Blacklisted";
    case "bounced":
      return "Bounce";
    default:
      return reason.replace(/^contact_/, "Stato ");
  }
}

export function AdminCampaignContactsPanel({
  campaignId,
  contacts,
  errorMessage,
}: AdminCampaignContactsPanelProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [rawEmails, setRawEmails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const parsedEmails = useMemo(() => parseEmails(rawEmails), [rawEmails]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (parsedEmails.length === 0) {
      setFormError("Inserisci almeno un indirizzo email.");
      setSuccessMessage(null);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setSuccessMessage(null);

    try {
      const token = await getToken();
      const result = await attachAdminCampaignContacts(
        campaignId,
        { emails: parsedEmails },
        token,
      );
      const imported = result.createdContacts + result.reusedContacts;

      setRawEmails("");
      setSuccessMessage(
        `${result.attachedContacts.toLocaleString("it-IT")} destinatari associati. ${imported.toLocaleString("it-IT")} contatti validi elaborati dal backend.`,
      );
      router.refresh();
    } catch (error) {
      setFormError(getSafeContactsErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  const blocked = contacts?.blocked ?? 0;

  return (
    <section className="admin-clients-card" id="destinatari">
      <div className="admin-clients-card__intro">
        <div>
          <p className="admin-surface__eyebrow">Destinatari</p>
          <h2 className="admin-clients-card__title">Contatti campagna</h2>
          <p className="admin-clients-card__description">
            Associa indirizzi email alla campagna usando solo il contratto backend
            disponibile. Import CSV e selezione avanzata restano non disponibili.
          </p>
        </div>
        <StatusBadge
          label={contacts?.contactsReady ? "Pronti" : "Non pronti"}
          variant={contacts?.contactsReady ? "success" : "neutral"}
        />
      </div>

      {errorMessage ? (
        <p className="admin-clients-feedback admin-clients-feedback--error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <dl className="admin-record-grid">
        {[
          ["Totali", contacts?.total ?? 0],
          ["Idonei", contacts?.eligible ?? 0],
          ["Bloccati", blocked],
          ["Invalidi", contacts?.invalid ?? 0],
          ["Soppressi", contacts?.suppressed ?? 0],
          ["Disiscritti", contacts?.unsubscribed ?? 0],
          ["Bounce", contacts?.bounced ?? 0],
          ["Blacklisted", contacts?.blacklisted ?? 0],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{Number(value).toLocaleString("it-IT")}</dd>
          </div>
        ))}
      </dl>

      <p className="admin-record-row__note">{getContactsNotice(contacts)}</p>

      <form onSubmit={handleSubmit} style={{ marginTop: 18 }}>
        {formError ? (
          <p className="admin-clients-feedback admin-clients-feedback--error" role="alert">
            {formError}
          </p>
        ) : null}
        {successMessage ? (
          <p className="admin-clients-feedback" role="status">
            {successMessage}
          </p>
        ) : null}

        <label className="admin-clients-form__field">
          <span>Email destinatari</span>
          <textarea
            className="admin-clients-form__input"
            disabled={isSubmitting}
            onChange={(event) => setRawEmails(event.target.value)}
            placeholder="maria@example.com&#10;luca@example.com"
            rows={5}
            value={rawEmails}
          />
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
          <Button
            type="submit"
            size="lg"
            className="admin-topbar-action admin-topbar-action--primary"
            disabled={isSubmitting || parsedEmails.length === 0}
          >
            {isSubmitting ? (
              <Loader2 aria-hidden="true" className="admin-topbar-action__icon" />
            ) : (
              <Plus aria-hidden="true" className="admin-topbar-action__icon" />
            )}
            {isSubmitting ? "Associazione..." : "Aggiungi destinatari"}
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="admin-topbar-action admin-topbar-action--secondary"
            disabled
          >
            <Upload aria-hidden="true" className="admin-topbar-action__icon" />
            Import CSV non ancora disponibile
          </Button>
        </div>
      </form>

      {contacts && contacts.contacts.length > 0 ? (
        <div className="admin-record-list" style={{ marginTop: 18 }}>
          {contacts.contacts.map((contact) => (
            <article key={contact.contactId} className="admin-record-row">
              <div className="admin-record-row__primary">
                <div className="admin-record-row__copy">
                  <strong>{contact.email}</strong>
                  <span>{contact.status}</span>
                  {contact.blockedReasons.length > 0 ? (
                    <span>
                      {contact.blockedReasons.map(getReasonLabel).join(", ")}
                    </span>
                  ) : (
                    <span>Idoneita confermata dal backend</span>
                  )}
                </div>
                <StatusBadge
                  label={contact.isEligible ? "Idoneo" : "Bloccato"}
                  variant={contact.isEligible ? "success" : "warning"}
                />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="admin-empty-state" style={{ marginTop: 18 }}>
          <strong>Nessun contatto associato</strong>
          <p>I contatti devono essere aggiunti da questo modulo o da un futuro import.</p>
        </div>
      )}
    </section>
  );
}
