"use client";

import { useAuth } from "@clerk/nextjs";
import { FileUp, Loader2, Plus, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type DragEvent, type FormEvent, useMemo, useRef, useState } from "react";
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
  onBack?: () => void;
  onContinue?: () => void;
}

function parseEmails(value: string): string[] {
  return Array.from(
    new Set(
      (value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [])
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
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
    return "Aggiungi destinatari per continuare.";
  }

  if (contacts.eligible === 0 && contacts.blocked === contacts.total) {
    return "Tutti i destinatari associati risultano bloccati o non idonei.";
  }

  if (contacts.eligible === 0) {
    return "Il backend non ha ancora confermato destinatari idonei.";
  }

  return "I conteggi vengono letti dal backend dopo l'associazione.";
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

async function readDroppedFiles(files: FileList | File[]): Promise<string> {
  const texts = await Promise.all(Array.from(files).map((file) => file.text()));
  return texts.join("\n");
}

export function AdminCampaignContactsPanel({
  campaignId,
  contacts,
  errorMessage,
  onBack,
  onContinue,
}: AdminCampaignContactsPanelProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rawEmails, setRawEmails] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDropActive, setIsDropActive] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const parsedEmails = useMemo(() => parseEmails(rawEmails), [rawEmails]);

  async function appendFiles(files: FileList | File[]) {
    const text = await readDroppedFiles(files);
    const extracted = parseEmails(text);

    if (extracted.length === 0) {
      setFormError("Nessun indirizzo email valido trovato nel file selezionato.");
      return;
    }

    setRawEmails((current) => {
      const merged = parseEmails(`${current}\n${extracted.join("\n")}`);
      return merged.join("\n");
    });
    setFormError(null);
    setSuccessMessage(`${extracted.length.toLocaleString("it-IT")} indirizzi rilevati dal file.`);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (!event.target.files || event.target.files.length === 0) {
      return;
    }

    await appendFiles(event.target.files);
    event.target.value = "";
  }

  async function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDropActive(false);

    if (event.dataTransfer.files.length === 0) {
      return;
    }

    await appendFiles(event.dataTransfer.files);
  }

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
      onContinue?.();
    } catch (error) {
      setFormError(getSafeContactsErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="admin-clients-card" id="destinatari">
      <div className="admin-clients-card__intro">
        <div>
          <p className="admin-surface__eyebrow">Step 3</p>
          <h2 className="admin-clients-card__title" style={{ color: "#0f172a" }}>
            Destinatari
          </h2>
          <p className="admin-clients-card__description">
            Incolla email oppure trascina file `.csv` o `.txt`: il frontend estrae gli indirizzi e invia solo il batch email verso l&apos;endpoint esistente.
          </p>
        </div>
        <StatusBadge
          label={contacts?.contactsReady ? "Pronti" : "Da completare"}
          variant={contacts?.contactsReady ? "success" : "neutral"}
        />
      </div>

      {errorMessage ? (
        <p className="admin-clients-feedback admin-clients-feedback--error" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <p className="admin-record-row__note">{getContactsNotice(contacts)}</p>

      {contacts && contacts.total > 0 ? (
        <dl className="admin-record-grid" style={{ marginTop: 16 }}>
          {[
            ["Totali", contacts.total],
            ["Idonei", contacts.eligible],
            ["Bloccati", contacts.blocked],
            ["Invalidi", contacts.invalid],
          ].map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{Number(value).toLocaleString("it-IT")}</dd>
            </div>
          ))}
        </dl>
      ) : null}

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

        <label
          onDragEnter={() => setIsDropActive(true)}
          onDragLeave={() => setIsDropActive(false)}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDropActive(true);
          }}
          onDrop={handleDrop}
          style={{
            background: isDropActive ? "rgba(219, 234, 254, 0.78)" : "rgba(248, 252, 255, 0.82)",
            border: isDropActive
              ? "1px solid rgba(37, 99, 235, 0.35)"
              : "1px dashed rgba(96, 165, 250, 0.36)",
            borderRadius: 18,
            cursor: "pointer",
            display: "grid",
            gap: 10,
            marginBottom: 14,
            padding: 18,
          }}
        >
          <span
            style={{
              alignItems: "center",
              color: "#2563eb",
              display: "inline-flex",
              fontWeight: 700,
              gap: 8,
            }}
          >
            <FileUp aria-hidden="true" size={18} />
            Trascina qui `.csv` o `.txt`
          </span>
          <span className="admin-record-row__note">
            Nessun import avanzato: il file viene letto solo per estrarre indirizzi email e riempire il batch manuale.
          </span>
          <input
            accept=".csv,.txt,text/csv,text/plain"
            hidden
            onChange={handleFileChange}
            ref={fileInputRef}
            type="file"
          />
          <span style={{ color: "#0f172a", fontWeight: 600 }}>Oppure clicca per selezionare un file</span>
        </label>

        <label className="admin-clients-form__field">
          <span>Email destinatari</span>
          <textarea
            className="admin-clients-form__input"
            disabled={isSubmitting}
            onChange={(event) => setRawEmails(event.target.value)}
            placeholder="maria@example.com&#10;luca@example.com"
            rows={6}
            style={{ minHeight: 170, resize: "none" }}
            value={rawEmails}
          />
        </label>

        <p className="admin-record-row__note" style={{ marginTop: 10 }}>
          {parsedEmails.length.toLocaleString("it-IT")} indirizzi pronti per l&apos;associazione.
        </p>

        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "space-between",
            marginTop: 16,
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
              <Upload aria-hidden="true" className="admin-topbar-action__icon" />
              Import avanzato non ancora disponibile
            </Button>
            <Button
              type="submit"
              className="admin-topbar-action admin-topbar-action--primary"
              disabled={isSubmitting || parsedEmails.length === 0}
              style={{
                background: "linear-gradient(135deg, #2563eb, #0ea5e9)",
                border: "1px solid rgba(37, 99, 235, 0.18)",
                boxShadow: "0 16px 34px rgba(37, 99, 235, 0.24)",
                color: "#f8fbff",
                minWidth: 190,
              }}
            >
              {isSubmitting ? (
                <Loader2 aria-hidden="true" className="admin-topbar-action__icon" />
              ) : (
                <Plus aria-hidden="true" className="admin-topbar-action__icon" />
              )}
              {isSubmitting ? "Associazione..." : "Aggiungi destinatari"}
            </Button>
          </div>
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
                    <span>{contact.blockedReasons.map(getReasonLabel).join(", ")}</span>
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
      ) : null}
    </section>
  );
}
