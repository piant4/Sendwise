"use client";

import { useAuth } from "@clerk/nextjs";
import { FileUp, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type DragEvent, type FormEvent, useRef, useState } from "react";
import {
  attachAdminCampaignContacts,
  isApiConfigurationError,
  isApiError,
  removeAdminCampaignContact,
} from "../../lib/api";
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

type ImportStatus = "idle" | "parsing" | "importing" | "imported" | "failed";

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
      errors.push(`Riga ${lineNumber}: email non valida.`);
      continue;
    }

    if (seenEmails.has(email)) {
      invalidCount += 1;
      errors.push(`Riga ${lineNumber}: email duplicata.`);
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
  if (isApiConfigurationError(error)) {
    return "Configurazione API non valida per questo ambiente.";
  }

  if (isApiError(error)) {
    if (error.isNetworkError) {
      return "Il browser non riesce a raggiungere il servizio Sendwise.";
    }

    const detail = error.detail.trim().toLowerCase();

    if (error.status === 401 || error.status === 403) {
      return "La sessione admin non è valida per modificare i destinatari.";
    }

    if (error.status === 404) {
      return "Campagna non trovata o non disponibile per questa sessione admin.";
    }

    if (error.status === 409) {
      return "Il servizio ha rifiutato l'associazione per lo stato corrente della campagna.";
    }

    if (error.status === 400) {
      return "Controlla i dati del contatto e riprova.";
    }

    if (error.status === 422) {
      if (detail === "nome_required") {
        return "Il nome è obbligatorio per salvare il contatto.";
      }

      return "Controlla nome ed email prima di aggiungere il destinatario.";
    }

    if (error.status !== null && error.status >= 500) {
      return "Il servizio ha restituito un errore. Riprova tra poco.";
    }

    if (error.status !== null && error.status >= 400) {
      return "Il servizio ha rifiutato il salvataggio del contatto.";
    }
  }

  return "Non è stato possibile aggiornare i destinatari. Riprova.";
}

function getSafeContactRemovalErrorMessage(error: unknown): string {
  if (isApiConfigurationError(error)) {
    return "Configurazione API non valida per questo ambiente.";
  }

  if (isApiError(error)) {
    if (error.isNetworkError) {
      return "Il browser non riesce a raggiungere il servizio Sendwise.";
    }

    if (error.status === 401 || error.status === 403) {
      return "La sessione admin non è valida per modificare i destinatari.";
    }

    if (error.status === 404) {
      return "Il destinatario non è più associato a questa campagna.";
    }

    if (error.status === 409) {
      return "Il servizio ha rifiutato la rimozione per lo stato corrente della campagna.";
    }

    if (error.status !== null && error.status >= 500) {
      return "Il servizio ha restituito un errore. Riprova tra poco.";
    }
  }

  return "Non è stato possibile rimuovere il destinatario. Riprova.";
}

function getContactsNotice(contacts: AdminCampaignContactsSummary | null): string {
  if (!contacts || contacts.total === 0) {
    return "Aggiungi destinatari per continuare.";
  }

  if (contacts.eligible === 0 && contacts.blocked === contacts.total) {
    return "Tutti i destinatari associati risultano bloccati o non idonei.";
  }

  if (contacts.eligible === 0) {
    return "Nessun destinatario risulta idoneo al momento.";
  }

  return "I conteggi si aggiornano dopo ogni associazione.";
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

function getContactDisplayName(contact: AdminCampaignContactsSummary["contacts"][number]): string | null {
  const nome = contact.metadata.nome?.trim() ?? "";
  const cognome = contact.metadata.cognome?.trim() ?? "";
  const fullName = `${nome} ${cognome}`.trim();
  return fullName || null;
}

function getContactStatusLabel(status: string): string {
  switch (status) {
    case "sendable":
      return "Attivo";
    case "pending":
      return "In verifica";
    case "suppressed":
      return "Soppresso";
    case "unsubscribed":
      return "Disiscritto";
    case "blacklisted":
      return "Blacklisted";
    case "bounced":
      return "Bounce";
    case "error":
      return "Errore";
    default:
      return status;
  }
}

function getContactSupportText(contact: AdminCampaignContactsSummary["contacts"][number]): string | null {
  if (contact.blockedReasons.length > 0) {
    return contact.blockedReasons.map(getReasonLabel).join(", ");
  }

  if (contact.isEligible) {
    return null;
  }

  return getContactStatusLabel(contact.status);
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

type CampaignContactRow = AdminCampaignContactsSummary["contacts"][number];

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
  const [isManualSubmitting, setIsManualSubmitting] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [manualForm, setManualForm] = useState<ManualContactForm>(EMPTY_MANUAL_CONTACT);
  const [manualFormError, setManualFormError] = useState<string | null>(null);
  const [importDraft, setImportDraft] = useState<ParsedImportResult | null>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus>("idle");
  const [contactPendingRemoval, setContactPendingRemoval] = useState<CampaignContactRow | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isRemovingContact, setIsRemovingContact] = useState(false);

  function closeManualModal() {
    setIsManualModalOpen(false);
    setManualForm(EMPTY_MANUAL_CONTACT);
    setManualFormError(null);
  }

  function closeRemoveModal() {
    if (isRemovingContact) {
      return;
    }

    setContactPendingRemoval(null);
    setRemoveError(null);
  }

  async function submitContacts(payload: AdminCampaignContactInput[]) {
    const token = await getToken();
    const result = await attachAdminCampaignContacts(campaignId, { contacts: payload }, token);
    const imported = result.createdContacts + result.reusedContacts;

    setSuccessMessage(
      `${result.attachedContacts.toLocaleString("it-IT")} destinatari associati. ${imported.toLocaleString("it-IT")} contatti validi elaborati.`,
    );
    setFormError(null);
    router.refresh();
    return result;
  }

  async function appendFiles(files: FileList | File[]) {
    setImportStatus("parsing");
    setFormError(null);
    setSuccessMessage(null);

    try {
      const text = await readDroppedFiles(files);
      const parsed = parseCsvContacts(text);
      setImportDraft(parsed);

      if (parsed.validContacts.length === 0) {
        setImportStatus("failed");
        setFormError(parsed.errors[0] ?? "Nessun contatto valido trovato nel file selezionato.");
        return;
      }

      setImportStatus("importing");
      await submitContacts(parsed.validContacts);
      setImportStatus("imported");
    } catch (error) {
      setImportStatus("failed");
      setFormError(getSafeContactsErrorMessage(error));
    }
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
      closeManualModal();
    } catch (error) {
      setManualFormError(getSafeContactsErrorMessage(error));
    } finally {
      setIsManualSubmitting(false);
    }
  }

  async function handleRemoveContact() {
    if (!contactPendingRemoval || isRemovingContact) {
      return;
    }

    setIsRemovingContact(true);
    setRemoveError(null);
    setFormError(null);
    setSuccessMessage(null);

    try {
      const token = await getToken();
      await removeAdminCampaignContact(campaignId, contactPendingRemoval.contactId, token);
      setSuccessMessage("Destinatario rimosso dalla campagna.");
      setRemoveError(null);
      setContactPendingRemoval(null);
      router.refresh();
    } catch (error) {
      setRemoveError(getSafeContactRemovalErrorMessage(error));
    } finally {
      setIsRemovingContact(false);
    }
  }

  const importErrors = importDraft?.errors.slice(0, 5) ?? [];
  const extraImportErrors = Math.max((importDraft?.errors.length ?? 0) - importErrors.length, 0);
  const importStatusLabel =
    importStatus === "parsing"
      ? "Parsing CSV..."
      : importStatus === "importing"
        ? "Importazione in corso..."
        : importStatus === "imported"
          ? "CSV importato"
          : importStatus === "failed"
            ? "Import fallito"
            : null;

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
        <div style={{ alignSelf: "flex-start" }}>
          <StatusBadge
            label={contacts?.contactsReady ? "Pronti" : "Da completare"}
            variant={contacts?.contactsReady ? "success" : "neutral"}
          />
        </div>
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
        <div className="campaign-contact-manual-action" style={{ alignItems: "center" }}>
          <div>
            <p className="campaign-contact-manual-action__eyebrow">Aggiunta manuale</p>
            <p className="campaign-contact-manual-action__title">Aggiungi un singolo destinatario.</p>
          </div>
          <Button
            type="button"
            className="admin-topbar-action campaign-action campaign-action--primary"
            onClick={() => {
              setManualForm(EMPTY_MANUAL_CONTACT);
              setManualFormError(null);
              setSuccessMessage(null);
              setIsManualModalOpen(true);
            }}
          >
            <Plus aria-hidden="true" className="admin-topbar-action__icon" />
            Aggiungi contatto
          </Button>
        </div>

        <section className="campaign-contact-section campaign-contact-section--full">
          <div className="campaign-contact-section__header">
            <div>
              <h3 className="campaign-contact-section__title">Import CSV</h3>
              <p className="campaign-contact-section__description">
                Colonne supportate: email, nome, cognome.
              </p>
            </div>
            {importStatusLabel ? (
              <StatusBadge
                label={importStatusLabel}
                variant={
                  importStatus === "imported"
                    ? "success"
                    : importStatus === "failed"
                      ? "danger"
                      : "neutral"
                }
              />
            ) : null}
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
            <span className="campaign-contact-upload__hint">
              Auto-import dopo drop o selezione. Formati: `email,nome,cognome` oppure righe con intestazioni.
            </span>
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
        </section>
      </div>

      {contacts && contacts.contacts.length > 0 ? (
        <div className="campaign-contact-list-shell" style={{ marginTop: 18 }}>
          <div className="campaign-contact-list" role="list" aria-label="Destinatari associati">
            {contacts.contacts.map((contact) => {
              const displayName = getContactDisplayName(contact);
              const supportText = getContactSupportText(contact);

              return (
                <article key={contact.contactId} className="admin-record-row campaign-contact-row" role="listitem">
                  <div className="admin-record-row__primary campaign-contact-row__primary">
                    <div className="campaign-contact-row__summary">
                      <div className="admin-record-row__copy">
                        <strong>{displayName ?? contact.email}</strong>
                        {displayName ? <span>{contact.email}</span> : null}
                        {supportText ? <span>{supportText}</span> : null}
                      </div>
                      <StatusBadge
                        label={contact.isEligible ? "Idoneo" : "Bloccato"}
                        variant={contact.isEligible ? "success" : "warning"}
                      />
                    </div>
                    <button
                      type="button"
                      className="campaign-contact-row__remove"
                      aria-label="Rimuovi destinatario dalla campagna"
                      onClick={() => {
                        setContactPendingRemoval(contact);
                        setRemoveError(null);
                        setFormError(null);
                        setSuccessMessage(null);
                      }}
                    >
                      <X aria-hidden="true" size={16} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="campaign-action-row campaign-action-row--wizard">
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
          type="button"
          className="admin-topbar-action campaign-action campaign-action--primary"
          disabled={!contacts?.contactsReady}
          onClick={onContinue}
          style={{ minWidth: 190 }}
        >
          Continua alla verifica
        </Button>
      </div>

      {isManualModalOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={closeManualModal}>
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
                onClick={closeManualModal}
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
                    onChange={(event) => {
                      setManualFormError(null);
                      setManualForm((current) => ({ ...current, nome: event.target.value }));
                    }}
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
                    onChange={(event) => {
                      setManualFormError(null);
                      setManualForm((current) => ({ ...current, cognome: event.target.value }));
                    }}
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
                    onChange={(event) => {
                      setManualFormError(null);
                      setManualForm((current) => ({ ...current, email: event.target.value }));
                    }}
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
                  onClick={closeManualModal}
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

      {contactPendingRemoval ? (
        <div className="modal-backdrop" role="presentation" onClick={closeRemoveModal}>
          <div
            className="invite-modal campaign-contact-remove-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-contact-remove-title"
            aria-describedby="campaign-contact-remove-message"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="invite-modal__header">
              <div>
                <p className="invite-modal__eyebrow">Destinatario</p>
                <h3 id="campaign-contact-remove-title" className="invite-modal__title">
                  Rimuovere destinatario?
                </h3>
              </div>
              <button
                type="button"
                className="invite-modal__close"
                aria-label="Chiudi"
                disabled={isRemovingContact}
                onClick={closeRemoveModal}
              >
                <X aria-hidden="true" />
              </button>
            </div>

            <p id="campaign-contact-remove-message" className="invite-modal__message">
              Il contatto resterà salvato, ma non sarà più associato a questa campagna.
            </p>

            {removeError ? (
              <p
                className="admin-clients-feedback admin-clients-feedback--error"
                role="alert"
                style={{ marginTop: 18 }}
              >
                {removeError}
              </p>
            ) : null}

            <div className="invite-modal__actions" style={{ marginTop: 18 }}>
              <button
                type="button"
                className="invite-modal__button invite-modal__button--secondary"
                disabled={isRemovingContact}
                onClick={closeRemoveModal}
              >
                Annulla
              </button>
              <button
                type="button"
                className="invite-modal__button invite-modal__button--primary"
                disabled={isRemovingContact}
                onClick={handleRemoveContact}
              >
                {isRemovingContact ? "Rimozione..." : "Rimuovi"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
