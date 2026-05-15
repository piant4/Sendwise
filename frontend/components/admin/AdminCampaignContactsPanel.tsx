"use client";

import { useAuth } from "@clerk/nextjs";
import { FileUp, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type DragEvent, type FormEvent, useRef, useState } from "react";
import { attachAdminCampaignContacts, isApiError } from "../../lib/api";
import type {
  AdminCampaignContactInput,
  AdminCampaignContactsSummary,
} from "../../types";
import { Button } from "../ui/button";
import { StatusBadge } from "../ui/StatusBadge";

interface AdminCampaignContactsPanelProps {
  campaignId: string;
  contacts: AdminCampaignContactsSummary | null;
  errorMessage?: string | null;
  onBack?: () => void;
  onContinue?: () => void;
}

interface ParsedImportResult {
  validContacts: AdminCampaignContactInput[];
  invalidCount: number;
  errors: string[];
}

interface ManualContactForm {
  nome: string;
  cognome: string;
  email: string;
}

const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(normalizeEmail(value));
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^\uFEFF/, "").trim());
}

function parseCsvContacts(value: string): ParsedImportResult {
  const rows = value
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);

  if (rows.length === 0) {
    return {
      validContacts: [],
      invalidCount: 0,
      errors: ["Il file non contiene righe importabili."],
    };
  }

  const firstRow = splitCsvLine(rows[0]).map((cell) => cell.toLowerCase());
  const hasHeaders = firstRow.some((cell) => ["email", "nome", "cognome"].includes(cell));
  const rowOffset = hasHeaders ? 1 : 0;
  const seenEmails = new Set<string>();
  const validContacts: AdminCampaignContactInput[] = [];
  const errors: string[] = [];
  let invalidCount = 0;

  const headerIndex = {
    email: firstRow.indexOf("email"),
    nome: firstRow.indexOf("nome"),
    cognome: firstRow.indexOf("cognome"),
  };

  for (let index = rowOffset; index < rows.length; index += 1) {
    const cells = splitCsvLine(rows[index]);
    const lineNumber = index + 1;
    const email = normalizeEmail(
      hasHeaders
        ? (headerIndex.email >= 0 ? cells[headerIndex.email] ?? "" : "")
        : (cells[0] ?? ""),
    );
    const nome = hasHeaders
      ? (headerIndex.nome >= 0 ? cells[headerIndex.nome] ?? "" : "").trim()
      : (cells[1] ?? "").trim();
    const cognome = hasHeaders
      ? (headerIndex.cognome >= 0 ? cells[headerIndex.cognome] ?? "" : "").trim()
      : (cells[2] ?? "").trim();

    if (!email || !nome) {
      invalidCount += 1;
      errors.push(`Riga ${lineNumber}: email e nome sono obbligatori.`);
      continue;
    }

    if (!isValidEmail(email)) {
      invalidCount += 1;
      errors.push(`Riga ${lineNumber}: email non valida (${email}).`);
      continue;
    }

    if (seenEmails.has(email)) {
      invalidCount += 1;
      errors.push(`Riga ${lineNumber}: email duplicata (${email}).`);
      continue;
    }

    seenEmails.add(email);
    validContacts.push({
      email,
      metadata: {
        nome,
        ...(cognome ? { cognome } : {}),
      },
    });
  }

  return { validContacts, invalidCount, errors };
}

function getSafeContactsErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.isNetworkError) {
      return "Il browser non riesce a raggiungere il backend Sendwise.";
    }

    const detail = error.detail.trim().toLowerCase();

    if (error.status === 401 || error.status === 403) {
      return "La sessione admin non e valida per modificare i destinatari.";
    }

    if (error.status === 404) {
      return "Campagna non trovata o non disponibile per questa sessione admin.";
    }

    if (error.status === 409) {
      return "Il backend ha rifiutato l'associazione per lo stato corrente della campagna.";
    }

    if (error.status === 400) {
      return "Controlla i dati del contatto e riprova.";
    }

    if (error.status === 422) {
      if (detail === "nome_required") {
        return "Il nome e obbligatorio per salvare il contatto.";
      }

      return "Controlla nome ed email prima di aggiungere il destinatario.";
    }

    if (error.status !== null && error.status >= 500) {
      return "Il backend ha restituito un errore. Riprova tra poco.";
    }

    if (error.status !== null && error.status >= 400) {
      return "Il backend ha rifiutato il salvataggio del contatto.";
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

const EMPTY_MANUAL_CONTACT: ManualContactForm = {
  nome: "",
  cognome: "",
  email: "",
};

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
  const [isDropActive, setIsDropActive] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isManualSubmitting, setIsManualSubmitting] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [manualForm, setManualForm] = useState<ManualContactForm>(EMPTY_MANUAL_CONTACT);
  const [manualFormError, setManualFormError] = useState<string | null>(null);
  const [importDraft, setImportDraft] = useState<ParsedImportResult | null>(null);

  async function submitContacts(payload: AdminCampaignContactInput[]) {
    const token = await getToken();
    const result = await attachAdminCampaignContacts(campaignId, { contacts: payload }, token);
    const imported = result.createdContacts + result.reusedContacts;

    setSuccessMessage(
      `${result.attachedContacts.toLocaleString("it-IT")} destinatari associati. ${imported.toLocaleString("it-IT")} contatti validi elaborati dal backend.`,
    );
    setFormError(null);
    router.refresh();
    onContinue?.();
    return result;
  }

  async function appendFiles(files: FileList | File[]) {
    const text = await readDroppedFiles(files);
    const parsed = parseCsvContacts(text);

    setImportDraft(parsed);
    setFormError(null);
    setSuccessMessage(null);

    if (parsed.validContacts.length === 0) {
      setFormError(parsed.errors[0] ?? "Nessun contatto valido trovato nel file selezionato.");
      return;
    }

    setSuccessMessage(
      `${parsed.validContacts.length.toLocaleString("it-IT")} contatti validi rilevati dal file.`,
    );
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

  async function handleImportSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isImporting) {
      return;
    }

    if (!importDraft || importDraft.validContacts.length === 0) {
      setFormError("Seleziona un CSV valido prima di importare.");
      setSuccessMessage(null);
      return;
    }

    setIsImporting(true);
    setFormError(null);
    setSuccessMessage(null);

    try {
      await submitContacts(importDraft.validContacts);
      setImportDraft(null);
    } catch (error) {
      setFormError(getSafeContactsErrorMessage(error));
    } finally {
      setIsImporting(false);
    }
  }

  async function handleManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isManualSubmitting) {
      return;
    }

    const nome = manualForm.nome.trim();
    const cognome = manualForm.cognome.trim();
    const email = normalizeEmail(manualForm.email);

    if (!nome || !email) {
      setManualFormError("Nome ed email sono obbligatori.");
      return;
    }

    if (!isValidEmail(email)) {
      setManualFormError("Inserisci un indirizzo email valido.");
      return;
    }

    setIsManualSubmitting(true);
    setManualFormError(null);
    setFormError(null);
    setSuccessMessage(null);

    try {
      await submitContacts([
        {
          email,
          metadata: {
            nome,
            ...(cognome ? { cognome } : {}),
          },
        },
      ]);
      setManualForm(EMPTY_MANUAL_CONTACT);
      setIsManualModalOpen(false);
    } catch (error) {
      setManualFormError(getSafeContactsErrorMessage(error));
    } finally {
      setIsManualSubmitting(false);
    }
  }

  const importErrors = importDraft?.errors.slice(0, 5) ?? [];
  const extraImportErrors = Math.max((importDraft?.errors.length ?? 0) - importErrors.length, 0);

  return (
    <section className="admin-clients-card campaign-panel" id="destinatari">
      <div className="admin-clients-card__intro">
        <div>
          <p className="admin-surface__eyebrow">Step 3</p>
          <h2 className="admin-clients-card__title" style={{ color: "#0f172a" }}>
            Destinatari
          </h2>
          <p className="admin-clients-card__description">
            Aggiungi singoli contatti o importa un CSV con email, nome e cognome.
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

      {formError ? (
        <p className="admin-clients-feedback admin-clients-feedback--error" role="alert" style={{ marginTop: 18 }}>
          {formError}
        </p>
      ) : null}
      {successMessage ? (
        <p className="admin-clients-feedback admin-clients-feedback--success" role="status" style={{ marginTop: 18 }}>
          {successMessage}
        </p>
      ) : null}

      <div className="campaign-contacts-layout">
        <section className="campaign-contact-section">
          <div className="campaign-contact-section__header">
            <div>
              <h3 className="campaign-contact-section__title">Aggiunta manuale</h3>
              <p className="campaign-contact-section__description">
                Inserisci un singolo destinatario con i campi richiesti.
              </p>
            </div>
            <Button
              type="button"
              className="admin-topbar-action campaign-action campaign-action--primary"
              onClick={() => {
                setManualFormError(null);
                setIsManualModalOpen(true);
              }}
            >
              <Plus aria-hidden="true" className="admin-topbar-action__icon" />
              Aggiungi contatto
            </Button>
          </div>
        </section>

        <form className="campaign-contact-section" onSubmit={handleImportSubmit}>
          <div className="campaign-contact-section__header">
            <div>
              <h3 className="campaign-contact-section__title">Import CSV</h3>
              <p className="campaign-contact-section__description">
                Colonne supportate: email, nome, cognome.
              </p>
            </div>
          </div>

          <label
            className={`campaign-contact-upload${isDropActive ? " campaign-contact-upload--active" : ""}`}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={() => setIsDropActive(true)}
            onDragLeave={() => setIsDropActive(false)}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDropActive(true);
            }}
            onDrop={handleDrop}
          >
            <span className="campaign-contact-upload__icon">
              <FileUp aria-hidden="true" size={18} />
              Trascina qui il CSV
            </span>
            <input
              accept=".csv,.txt,text/csv,text/plain"
              hidden
              onChange={handleFileChange}
              ref={fileInputRef}
              type="file"
            />
            <span className="campaign-contact-upload__label">Oppure seleziona un file</span>
            <span className="campaign-contact-upload__hint">Formati: `email,nome,cognome` oppure righe con intestazioni.</span>
          </label>

          {importDraft ? (
            <div className="campaign-contact-import-summary">
              <div className="campaign-contact-import-summary__stats">
                <strong>{importDraft.validContacts.length.toLocaleString("it-IT")} validi</strong>
                <span>{importDraft.invalidCount.toLocaleString("it-IT")} righe non valide</span>
              </div>
              {importErrors.length > 0 ? (
                <div className="campaign-contact-import-summary__errors" role="status">
                  {importErrors.map((message) => (
                    <span key={message}>{message}</span>
                  ))}
                  {extraImportErrors > 0 ? <span>Altre {extraImportErrors} righe richiedono correzione.</span> : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="campaign-action-row" style={{ marginTop: 16 }}>
            <Button
              type="button"
              variant="outline"
              className="admin-topbar-action campaign-action campaign-action--secondary"
              onClick={onBack}
              style={{ minWidth: 148 }}
            >
              Indietro
            </Button>
            <Button
              type="submit"
              className="admin-topbar-action campaign-action campaign-action--primary"
              disabled={isImporting || !importDraft || importDraft.validContacts.length === 0}
              style={{ minWidth: 190 }}
            >
              {isImporting ? (
                <Loader2 aria-hidden="true" className="admin-topbar-action__icon" />
              ) : (
                <Plus aria-hidden="true" className="admin-topbar-action__icon" />
              )}
              {isImporting ? "Importazione..." : "Importa contatti"}
            </Button>
          </div>
        </form>
      </div>

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

      {isManualModalOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsManualModalOpen(false)}>
          <div
            className="invite-modal campaign-contact-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-contact-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="invite-modal__header">
              <div>
                <p className="invite-modal__eyebrow">Destinatario</p>
                <h3 id="campaign-contact-modal-title" className="invite-modal__title">
                  Aggiungi contatto
                </h3>
              </div>
              <button
                type="button"
                className="invite-modal__close"
                aria-label="Chiudi"
                onClick={() => setIsManualModalOpen(false)}
              >
                <X aria-hidden="true" />
              </button>
            </div>

            <form className="invite-modal__form" onSubmit={handleManualSubmit}>
              {manualFormError ? (
                <p className="admin-clients-feedback admin-clients-feedback--error" role="alert">
                  {manualFormError}
                </p>
              ) : null}

              <label className="invite-modal__field">
                <span>Nome</span>
                <div className="invite-modal__input-shell campaign-contact-modal__input-shell">
                  <input
                    autoComplete="given-name"
                    className="invite-modal__input campaign-contact-modal__input"
                    name="nome"
                    onChange={(event) => setManualForm((current) => ({ ...current, nome: event.target.value }))}
                    required
                    value={manualForm.nome}
                  />
                </div>
              </label>

              <label className="invite-modal__field">
                <span>Cognome</span>
                <div className="invite-modal__input-shell campaign-contact-modal__input-shell">
                  <input
                    autoComplete="family-name"
                    className="invite-modal__input campaign-contact-modal__input"
                    name="cognome"
                    onChange={(event) => setManualForm((current) => ({ ...current, cognome: event.target.value }))}
                    value={manualForm.cognome}
                  />
                </div>
              </label>

              <label className="invite-modal__field">
                <span>Email</span>
                <div className="invite-modal__input-shell campaign-contact-modal__input-shell">
                  <input
                    autoComplete="email"
                    className="invite-modal__input campaign-contact-modal__input"
                    inputMode="email"
                    name="email"
                    onChange={(event) => setManualForm((current) => ({ ...current, email: event.target.value }))}
                    required
                    type="email"
                    value={manualForm.email}
                  />
                </div>
              </label>

              <div className="invite-modal__actions">
                <button
                  type="button"
                  className="invite-modal__button invite-modal__button--secondary"
                  onClick={() => setIsManualModalOpen(false)}
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  className="invite-modal__button invite-modal__button--primary"
                  disabled={isManualSubmitting}
                >
                  {isManualSubmitting ? "Salvataggio..." : "Salva contatto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
