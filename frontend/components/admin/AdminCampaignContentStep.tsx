"use client";

import { useAuth } from "@clerk/nextjs";
import { Loader2, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import {
  isApiError,
  updateAdminCampaignContent,
} from "../../lib/api";
import {
  CAMPAIGN_TEMPLATES,
} from "../../lib/campaignTemplates";
import type { CampaignTemplate } from "../../lib/campaignTemplates";
import type { AdminCampaignDetail } from "../../types";
import { AdminCampaignTemplatePicker } from "./AdminCampaignTemplatePicker";
import { Button } from "../ui/button";

interface AdminCampaignContentStepProps {
  campaign: AdminCampaignDetail;
  onBack?: () => void;
  onContinue?: () => void;
}

type ContentEditorMode = "html" | "preview";

function getValue(value?: string | null): string {
  return value ?? "";
}

function normalizeText(value?: string | null): string {
  return (value ?? "").trim();
}

function stripScripts(value: string): string {
  return value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

function normalizePlainText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function derivePlainTextFromHtml(value: string): string {
  const cleanedValue = stripScripts(value);

  if (typeof window !== "undefined" && typeof window.DOMParser !== "undefined") {
    const document = new window.DOMParser().parseFromString(cleanedValue, "text/html");
    return normalizePlainText(document.body.textContent ?? "");
  }

  return normalizePlainText(
    cleanedValue
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function buildPreviewDocument(value: string): string {
  const cleanedValue = stripScripts(value).trim();
  const content =
    cleanedValue.length > 0
      ? cleanedValue
      : '<div class="sw-preview-empty">Nessun contenuto HTML da mostrare.</div>';

  return `<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:; form-action 'none'; frame-ancestors 'none'; base-uri 'none'"
    />
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: #ffffff;
        color: #0f172a;
        padding: 20px;
      }

      img {
        height: auto;
        max-width: 100%;
      }

      .sw-preview-empty {
        border: 1px dashed rgba(148, 163, 184, 0.4);
        border-radius: 16px;
        color: #64748b;
        padding: 20px;
      }
    </style>
  </head>
  <body>${content}</body>
</html>`;
}

function getSafeUpdateErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.isNetworkError) {
      return "Il browser non riesce a raggiungere il backend Sendwise.";
    }

    if (error.status === 401 || error.status === 403) {
      return "La sessione admin non e valida per modificare il contenuto.";
    }

    if (error.status === 404) {
      return "Campagna non trovata o non disponibile per questa sessione admin.";
    }

    if (error.status === 409) {
      return "Il backend ha rifiutato la modifica per lo stato corrente della campagna.";
    }

    if (error.status === 422) {
      return "Verifica il contenuto email prima di salvare.";
    }

    if (error.detail.trim()) {
      return error.detail;
    }
  }

  return "Non e stato possibile salvare il contenuto. Riprova.";
}

const SUPPORTED_TEMPLATE_VARIABLES = [
  {
    token: "{{nome}}",
    description: "Nome del contatto dalla campagna.",
  },
  {
    token: "{{cognome}}",
    description: "Cognome del contatto dalla campagna.",
  },
  {
    token: "{{email}}",
    description: "Email del contatto dalla campagna.",
  },
  {
    token: "{{campaign_name}}",
    description: "Nome della campagna corrente.",
  },
  {
    token: "{{unsubscribe_url}}",
    description: "Link pubblico di disiscrizione, sempre preservato.",
  },
  {
    token: "{{current_year}}",
    description: "Anno corrente nel rendering finale.",
  },
  {
    token: "{{company_name}}",
    description: "Ragione sociale dal brand email del cliente.",
  },
  {
    token: "{{sender_name}}",
    description: "Nome mittente dal brand email del cliente.",
  },
  {
    token: "{{logo}}",
    description: "Logo gestito nel brand email del cliente.",
  },
  {
    token: "{{social_icons}}",
    description: "Blocco social generato solo con URL presenti.",
  },
  {
    token: "{{website_url}}",
    description: "URL sito dal brand email del cliente.",
  },
  {
    token: "{{linkedin_url}}",
    description: "URL LinkedIn dal brand email del cliente.",
  },
  {
    token: "{{instagram_url}}",
    description: "URL Instagram dal brand email del cliente.",
  },
  {
    token: "{{facebook_url}}",
    description: "URL Facebook dal brand email del cliente.",
  },
  {
    token: "{{x_url}}",
    description: "URL X dal brand email del cliente.",
  },
] as const;
const BRAND_VARIABLE_TOKENS = new Set([
  "{{company_name}}",
  "{{sender_name}}",
  "{{logo}}",
  "{{social_icons}}",
  "{{website_url}}",
  "{{linkedin_url}}",
  "{{instagram_url}}",
  "{{facebook_url}}",
  "{{x_url}}",
]);
const ALLOWED_RECIPIENT_PLACEHOLDERS = new Set(
  SUPPORTED_TEMPLATE_VARIABLES.map((variable) =>
    variable.token.replaceAll("{", "").replaceAll("}", ""),
  ),
);
const PLACEHOLDER_PATTERN = /{{\s*([A-Za-z0-9_]+)\s*}}/g;

function collectUnsupportedPlaceholders(value: string, allowed: Set<string>): string[] {
  const unsupported = new Set<string>();

  for (const match of value.matchAll(PLACEHOLDER_PATTERN)) {
    const key = match[1]?.trim().toLowerCase();
    if (!key || allowed.has(key)) {
      continue;
    }
    unsupported.add(key);
  }

  return Array.from(unsupported);
}

export function AdminCampaignContentStep({
  campaign,
  onBack,
  onContinue,
}: AdminCampaignContentStepProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [previewText, setPreviewText] = useState(getValue(campaign.previewText));
  const [bodyHtml, setBodyHtml] = useState(getValue(campaign.bodyHtml));
  const [bodyText, setBodyText] = useState(getValue(campaign.bodyText));
  const [editorMode, setEditorMode] = useState<ContentEditorMode>("html");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<CampaignTemplate | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const availableBrandVariables = SUPPORTED_TEMPLATE_VARIABLES.filter((variable) =>
    BRAND_VARIABLE_TOKENS.has(variable.token),
  ).filter((variable) => {
    const brand = campaign.emailBrand;
    if (!brand) {
      return false;
    }
    switch (variable.token) {
      case "{{company_name}}":
        return Boolean(brand.company_name?.trim());
      case "{{sender_name}}":
        return Boolean(brand.sender_name?.trim());
      case "{{logo}}":
        return Boolean(brand.logo_url?.trim());
      case "{{social_icons}}":
        return Boolean(
          brand.website_url ||
            brand.linkedin_url ||
            brand.instagram_url ||
            brand.facebook_url ||
            brand.x_url,
        );
      case "{{website_url}}":
        return Boolean(brand.website_url?.trim());
      case "{{linkedin_url}}":
        return Boolean(brand.linkedin_url?.trim());
      case "{{instagram_url}}":
        return Boolean(brand.instagram_url?.trim());
      case "{{facebook_url}}":
        return Boolean(brand.facebook_url?.trim());
      case "{{x_url}}":
        return Boolean(brand.x_url?.trim());
      default:
        return false;
    }
  });

  function hasCurrentContent(): boolean {
    return [previewText, bodyHtml, bodyText].some((value) => normalizeText(value).length > 0);
  }

  function commitTemplate(template: CampaignTemplate) {
    setSelectedTemplateId(template.id);
    setPreviewText(template.previewText);
    setBodyHtml(template.htmlBody);
    setBodyText(template.plainTextBody);
    setEditorMode("html");
    setErrorMessage(null);
    setSuccessMessage(`Modello "${template.name}" applicato localmente. Salva per inviare il contenuto al backend.`);
  }

  function applyTemplate(template: CampaignTemplate) {
    if (hasCurrentContent()) {
      setPendingTemplate(template);
      return;
    }

    commitTemplate(template);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const previewValue = normalizeText(previewText);
    const bodyHtmlValue = normalizeText(bodyHtml);
    const bodyTextValue =
      bodyHtmlValue === normalizeText(campaign.bodyHtml) && normalizeText(bodyText)
        ? normalizeText(bodyText)
        : derivePlainTextFromHtml(bodyHtmlValue);
    const unsupportedSubjectPlaceholders = collectUnsupportedPlaceholders(
      normalizeText(campaign.subject),
      ALLOWED_RECIPIENT_PLACEHOLDERS,
    );
    const unsupportedPlaceholders = [
      ...unsupportedSubjectPlaceholders,
      ...collectUnsupportedPlaceholders(previewValue, ALLOWED_RECIPIENT_PLACEHOLDERS),
      ...collectUnsupportedPlaceholders(bodyHtmlValue, ALLOWED_RECIPIENT_PLACEHOLDERS),
      ...collectUnsupportedPlaceholders(bodyTextValue, ALLOWED_RECIPIENT_PLACEHOLDERS),
    ];
    const contentChanged =
      previewValue !== normalizeText(campaign.previewText) ||
      bodyHtmlValue !== normalizeText(campaign.bodyHtml) ||
      bodyTextValue !== normalizeText(campaign.bodyText);

    if (unsupportedPlaceholders.length > 0) {
      setErrorMessage("Completa o rimuovi le variabili del template prima di salvare.");
      setSuccessMessage(null);
      return;
    }

    if (!contentChanged) {
      setSuccessMessage("Nessuna modifica da salvare.");
      setErrorMessage(null);
      onContinue?.();
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const token = await getToken();
      setBodyText(bodyTextValue);
      await updateAdminCampaignContent(
        campaign.campaignId,
        {
          previewText: previewValue,
          bodyHtml: bodyHtmlValue,
          bodyText: bodyTextValue,
        },
        token,
      );

      setSuccessMessage("Contenuto salvato. La prontezza resta determinata dal backend.");
      router.refresh();
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
          <p className="admin-surface__eyebrow">Step 2</p>
          <h2 className="admin-clients-card__title" style={{ color: "#0f172a" }}>
            Contenuto email
          </h2>
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

      <div className="campaign-form-grid">
        <AdminCampaignTemplatePicker
          disabled={isSubmitting}
          onApply={applyTemplate}
          selectedTemplateId={selectedTemplateId}
          templates={CAMPAIGN_TEMPLATES}
        />

        <label className="campaign-field">
          <span className="campaign-field__label">Anteprima email</span>
          <input
            className="campaign-input"
            disabled={isSubmitting}
            onChange={(event) => setPreviewText(event.target.value)}
            placeholder="Un riepilogo sintetico del contenuto dell'email"
            value={previewText}
          />
        </label>
        <section className="campaign-variable-helper" aria-label="Variabili supportate">
          <div className="campaign-variable-helper__header">
            <div>
              <p className="admin-surface__eyebrow">Variabili</p>
              <h3 className="campaign-variable-helper__title">Placeholder supportati</h3>
            </div>
            <p className="campaign-variable-helper__note">
              Le variabili contatto usano solo i destinatari collegati alla campagna.
            </p>
          </div>
          <div className="campaign-variable-helper__grid">
            {SUPPORTED_TEMPLATE_VARIABLES.map((variable) => (
              <article key={variable.token} className="campaign-variable-chip">
                <code>{variable.token}</code>
                <span>{variable.description}</span>
              </article>
            ))}
          </div>
          <p className="campaign-variable-helper__availability">
            Brand cliente disponibile ora:{" "}
            {availableBrandVariables.length > 0
              ? availableBrandVariables.map((variable) => variable.token).join(", ")
              : "nessuna variabile brand valorizzata."}
          </p>
        </section>
        <section className="campaign-field">
          <div className="campaign-field__header">
            <span className="campaign-field__label">Anteprima email</span>
            <div className="campaign-editor-toggle" role="tablist" aria-label="Modalita editor email">
              {(["html", "preview"] as const).map((mode) => {
                const isActive = editorMode === mode;

                return (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className="campaign-editor-toggle__button"
                    data-active={isActive}
                    disabled={isSubmitting}
                    onClick={() => setEditorMode(mode)}
                  >
                    {mode === "html" ? "HTML" : "Preview"}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="campaign-editor-shell">
            {editorMode === "html" ? (
              <textarea
                className="campaign-textarea campaign-textarea--editor"
                disabled={isSubmitting}
                onChange={(event) => setBodyHtml(event.target.value)}
                placeholder="<html>...</html>"
                rows={14}
                value={bodyHtml}
              />
            ) : (
              <iframe
                className="campaign-email-preview-frame"
                sandbox=""
                srcDoc={buildPreviewDocument(bodyHtml)}
                title="Anteprima email"
              />
            )}
          </div>
        </section>
      </div>

      <div className="campaign-action-row">
        <Button
          type="button"
          variant="outline"
          className="admin-topbar-action campaign-action campaign-action--secondary"
          onClick={onBack}
          style={{ minWidth: 148 }}
        >
          Indietro
        </Button>
        <div className="campaign-action-row__group">
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
            {isSubmitting ? "Salvataggio..." : "Salva contenuto"}
          </Button>
        </div>
      </div>

      {pendingTemplate ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setPendingTemplate(null)}
        >
          <div
            className="invite-modal campaign-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-template-confirm-title"
            aria-describedby="campaign-template-confirm-body"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="invite-modal__header">
              <div>
                <p className="invite-modal__eyebrow">Modello</p>
                <h3 id="campaign-template-confirm-title" className="invite-modal__title">
                  Sostituire il contenuto?
                </h3>
                <p id="campaign-template-confirm-body" className="invite-modal__message">
                  Il modello sostituira il contenuto email attuale.
                </p>
              </div>
              <button
                type="button"
                className="invite-modal__close"
                aria-label="Chiudi"
                onClick={() => setPendingTemplate(null)}
              >
                <X aria-hidden="true" />
              </button>
            </div>

            <div className="invite-modal__actions campaign-confirm-modal__actions">
              <button
                type="button"
                className="invite-modal__button invite-modal__button--secondary"
                onClick={() => setPendingTemplate(null)}
              >
                Annulla
              </button>
              <button
                type="button"
                className="invite-modal__button invite-modal__button--primary"
                onClick={() => {
                  commitTemplate(pendingTemplate);
                  setPendingTemplate(null);
                }}
              >
                Usa modello
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
