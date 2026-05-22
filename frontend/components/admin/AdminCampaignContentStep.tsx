"use client";

import { useAuth } from "@clerk/nextjs";
import { Loader2, RotateCcw, Save, WandSparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createAdminEmailTemplate,
  getAdminEmailTemplates,
  getBackendAssetUrl,
  isApiError,
  updateAdminCampaignContent,
} from "../../lib/api";
import {
  CAMPAIGN_TEMPLATES,
  DEFAULT_CAMPAIGN_TEMPLATE_ID,
  type CampaignTemplate,
} from "../../lib/campaignTemplates";
import type { AdminCampaignDetail, AdminEmailTemplate } from "../../types";
import { Button } from "../ui/button";
import { CampaignCodeEditor } from "./CampaignCodeEditor";
import { AdminCampaignTemplatePicker } from "./AdminCampaignTemplatePicker";

interface AdminCampaignContentStepProps {
  campaign: AdminCampaignDetail;
  mode?: "template" | "editor";
  initialTemplateId?: string | null;
  forceTemplateApply?: boolean;
  onBack?: () => void;
  onContinue?: () => void;
  onTemplateSelect?: (templateId: string, force?: boolean) => void;
}

type ContentEditorMode = "split" | "html" | "preview";
type ActiveField = "subject" | "preview" | "html";
type PreviewDevice = "desktop" | "mobile";
type PreviewBrand = AdminCampaignDetail["emailBrand"];

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
  return value.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
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

function normalizePlaceholderValue(value?: string | null): string {
  return (value ?? "").trim();
}

function buildPreviewLogoHtml(logoUrl?: string | null): string {
  const safeLogoUrl = normalizePlaceholderValue(getBackendAssetUrl(logoUrl));
  if (!safeLogoUrl) {
    return "";
  }

  return `<img src="${safeLogoUrl.replaceAll("\"", "&quot;")}" alt="" width="120" style="display:block;max-width:120px;height:auto;border:0;outline:none;text-decoration:none;" />`;
}

function buildPreviewSocialIconsHtml(brand?: PreviewBrand | null): string {
  const socialItems = [
    ["website_url", "WEB", "#2563eb"],
    ["linkedin_url", "in", "#0a66c2"],
    ["instagram_url", "ig", "#d946ef"],
    ["facebook_url", "f", "#1877f2"],
    ["x_url", "x", "#111827"],
  ] as const;

  const iconCells = socialItems
    .map(([key, label, backgroundColor]) => {
      const socialUrl = normalizePlaceholderValue(brand?.[key]);
      if (!socialUrl) {
        return "";
      }

      const escapedUrl = socialUrl.replaceAll("\"", "&quot;");
      return `<td style="padding-right:8px;"><a href="${escapedUrl}" style="display:inline-block;text-decoration:none;"><span style="display:inline-block;min-width:32px;padding:8px 10px;border-radius:999px;background:${backgroundColor};color:#ffffff;font-size:12px;line-height:1;font-weight:700;text-align:center;text-transform:uppercase;">${label}</span></a></td>`;
    })
    .filter(Boolean)
    .join("");

  if (!iconCells) {
    return "";
  }

  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>${iconCells}</tr></table>`;
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

  return "Non e stato possibile completare l'azione. Riprova.";
}

const SUPPORTED_TEMPLATE_VARIABLES = [
  { token: "{{nome}}", description: "Nome del contatto dalla campagna." },
  { token: "{{cognome}}", description: "Cognome del contatto dalla campagna." },
  { token: "{{email}}", description: "Email del contatto dalla campagna." },
  { token: "{{campaign_name}}", description: "Nome della campagna corrente." },
  { token: "{{unsubscribe_url}}", description: "Link pubblico di disiscrizione, sempre preservato." },
  { token: "{{current_year}}", description: "Anno corrente nel rendering finale." },
  { token: "{{company_name}}", description: "Ragione sociale dal brand email del cliente." },
  { token: "{{sender_name}}", description: "Nome mittente dal brand email del cliente." },
  { token: "{{logo}}", description: "Logo gestito nel brand email del cliente." },
  { token: "{{social_icons}}", description: "Blocco social generato solo con URL presenti." },
  { token: "{{website_url}}", description: "URL sito dal brand email del cliente." },
  { token: "{{linkedin_url}}", description: "URL LinkedIn dal brand email del cliente." },
  { token: "{{instagram_url}}", description: "URL Instagram dal brand email del cliente." },
  { token: "{{facebook_url}}", description: "URL Facebook dal brand email del cliente." },
  { token: "{{x_url}}", description: "URL X dal brand email del cliente." },
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

const EDITOR_ONLY_TEMPLATE_VARIABLES = ["preview_text"] as const;

const ALLOWED_EDITOR_PLACEHOLDERS = new Set(
  SUPPORTED_TEMPLATE_VARIABLES.map((variable) =>
    variable.token.replaceAll("{", "").replaceAll("}", ""),
  ).concat(Array.from(EDITOR_ONLY_TEMPLATE_VARIABLES)),
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

function buildLocalPreviewReplacements(
  campaign: AdminCampaignDetail,
  previewText: string,
): Record<string, string> {
  const brand = campaign.emailBrand;
  const companyName = normalizePlaceholderValue(brand?.company_name);
  const senderName =
    normalizePlaceholderValue(brand?.sender_name) || companyName || "Sendwise";

  return {
    preview_text: previewText,
    nome: "Nome",
    cognome: "Cognome",
    email: "contatto@example.test",
    campaign_name: campaign.name,
    unsubscribe_url: "#unsubscribe",
    current_year: String(new Date().getUTCFullYear()),
    company_name: companyName,
    sender_name: senderName,
    logo: buildPreviewLogoHtml(brand?.logo_url),
    social_icons: buildPreviewSocialIconsHtml(brand),
    website_url: normalizePlaceholderValue(brand?.website_url),
    linkedin_url: normalizePlaceholderValue(brand?.linkedin_url),
    instagram_url: normalizePlaceholderValue(brand?.instagram_url),
    facebook_url: normalizePlaceholderValue(brand?.facebook_url),
    x_url: normalizePlaceholderValue(brand?.x_url),
  };
}

function renderLocalPreviewTemplate(
  value: string,
  replacements: Record<string, string>,
): string {
  return value.replaceAll(PLACEHOLDER_PATTERN, (match, rawKey: string) => {
    const key = rawKey.trim().toLowerCase();
    if (key in replacements) {
      return replacements[key] ?? "";
    }
    if (ALLOWED_EDITOR_PLACEHOLDERS.has(key)) {
      return "";
    }
    return match;
  });
}

function mapSavedTemplate(template: AdminEmailTemplate): CampaignTemplate {
  return {
    id: template.id,
    clientId: template.clientId,
    name: template.name,
    description: "Template salvato da una campagna del cliente.",
    category: "Salvato",
    subject: template.subject,
    recommendedUseCase: "Riutilizza soggetto, preview e contenuto gia approvati per questo cliente.",
    previewText: template.previewText ?? "",
    htmlBody: template.bodyHtml ?? "",
    plainTextBody: template.bodyText ?? "",
    source: "saved",
  };
}

export function AdminCampaignContentStep({
  campaign,
  mode = "editor",
  initialTemplateId,
  forceTemplateApply = false,
  onBack,
  onContinue,
  onTemplateSelect,
}: AdminCampaignContentStepProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const previewRef = useRef<HTMLInputElement | null>(null);
  const htmlRef = useRef<HTMLTextAreaElement | null>(null);
  const appliedTemplatePreferenceRef = useRef<string | null>(null);
  const initialBoilerplateTemplate =
    CAMPAIGN_TEMPLATES.find((template) => template.id === DEFAULT_CAMPAIGN_TEMPLATE_ID) ??
    CAMPAIGN_TEMPLATES[0];
  const isInitialContentEmpty = [campaign.previewText, campaign.bodyHtml, campaign.bodyText].every(
    (value) => normalizeText(value).length === 0,
  );

  const [subject, setSubject] = useState(
    normalizeText(campaign.subject).length > 0
      ? getValue(campaign.subject)
      : isInitialContentEmpty
        ? initialBoilerplateTemplate.subject
        : "",
  );
  const [previewText, setPreviewText] = useState(
    isInitialContentEmpty
      ? initialBoilerplateTemplate.previewText
      : getValue(campaign.previewText),
  );
  const [bodyHtml, setBodyHtml] = useState(
    isInitialContentEmpty
      ? initialBoilerplateTemplate.htmlBody
      : getValue(campaign.bodyHtml),
  );
  const [bodyText, setBodyText] = useState(
    isInitialContentEmpty
      ? initialBoilerplateTemplate.plainTextBody
      : getValue(campaign.bodyText),
  );
  const [editorMode, setEditorMode] = useState<ContentEditorMode>("split");
  const [activeField, setActiveField] = useState<ActiveField>("html");
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    isInitialContentEmpty ? initialBoilerplateTemplate.id : null,
  );
  const [pendingTemplate, setPendingTemplate] = useState<CampaignTemplate | null>(null);
  const [savedTemplates, setSavedTemplates] = useState<CampaignTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isVariableHelperOpen, setIsVariableHelperOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [templateToConfirm, setTemplateToConfirm] = useState<CampaignTemplate | null>(null);

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

  const templateCatalog = useMemo(
    () => [...CAMPAIGN_TEMPLATES, ...savedTemplates],
    [savedTemplates],
  );
  const defaultTemplate = useMemo(
    () =>
      templateCatalog.find((template) => template.id === DEFAULT_CAMPAIGN_TEMPLATE_ID) ??
      CAMPAIGN_TEMPLATES[0],
    [templateCatalog],
  );
  const previewHtml = useMemo(() => {
    const previewSource = normalizeText(bodyHtml) || defaultTemplate.htmlBody;
    return renderLocalPreviewTemplate(
      previewSource,
      buildLocalPreviewReplacements(campaign, normalizeText(previewText)),
    );
  }, [bodyHtml, campaign, defaultTemplate.htmlBody, previewText]);

  useEffect(() => {
    if (mode !== "editor" || !initialTemplateId || templateCatalog.length === 0) {
      return;
    }

    const requestedTemplate =
      templateCatalog.find((template) => template.id === initialTemplateId) ?? null;
    if (!requestedTemplate) {
      return;
    }

    const preferenceKey = `${requestedTemplate.id}:${forceTemplateApply ? "force" : "keep"}`;
    if (appliedTemplatePreferenceRef.current === preferenceKey) {
      return;
    }
    appliedTemplatePreferenceRef.current = preferenceKey;

    const contentIsEmpty = [campaign.previewText, campaign.bodyHtml, campaign.bodyText].every(
      (value) => normalizeText(value).length === 0,
    );

    setSelectedTemplateId(requestedTemplate.id);
    if (forceTemplateApply || contentIsEmpty) {
      commitTemplate(requestedTemplate);
    }
  }, [
    campaign.bodyHtml,
    campaign.bodyText,
    campaign.previewText,
    forceTemplateApply,
    initialTemplateId,
    mode,
    templateCatalog,
  ]);

  useEffect(() => {
    let isCancelled = false;

    async function loadTemplates() {
      setIsLoadingTemplates(true);

      try {
        const token = await getToken();
        const templates = await getAdminEmailTemplates(campaign.clientId, token);
        if (!isCancelled) {
          setSavedTemplates(templates.map(mapSavedTemplate));
        }
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(getSafeUpdateErrorMessage(error));
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingTemplates(false);
        }
      }
    }

    void loadTemplates();

    return () => {
      isCancelled = true;
    };
  }, [campaign.clientId, getToken]);

  function hasCurrentContent(): boolean {
    return [previewText, bodyHtml, bodyText].some(
      (value) => normalizeText(value).length > 0,
    );
  }

  function commitTemplate(template: CampaignTemplate) {
    setSelectedTemplateId(template.id);
    setSubject(template.subject);
    setPreviewText(template.previewText);
    setBodyHtml(template.htmlBody);
    setBodyText(template.plainTextBody);
    setEditorMode("split");
    setActiveField("html");
    setPreviewDevice("desktop");
    setErrorMessage(null);
    setSuccessMessage(
      `Modello "${template.name}" applicato localmente. Salva per inviare il contenuto al backend.`,
    );
  }

  function applyTemplate(template: CampaignTemplate) {
    if (hasCurrentContent()) {
      setPendingTemplate(template);
      return;
    }

    commitTemplate(template);
  }

  function requestTemplateSelection(template: CampaignTemplate) {
    if (mode === "template") {
      if (hasCurrentContent()) {
        setTemplateToConfirm(template);
        return;
      }

      onTemplateSelect?.(template.id, false);
      return;
    }

    applyTemplate(template);
  }

  function updateFieldValue(field: ActiveField, nextValue: string) {
    switch (field) {
      case "subject":
        setSubject(nextValue);
        break;
      case "preview":
        setPreviewText(nextValue);
        break;
      case "html":
        setBodyHtml(nextValue);
        break;
    }
  }

  function getFieldRef(field: ActiveField) {
    switch (field) {
      case "subject":
        return subjectRef.current;
      case "preview":
        return previewRef.current;
      case "html":
        return htmlRef.current;
    }
  }

  function insertVariable(token: string) {
    const field = activeField || "html";
    const element = getFieldRef(field);
    if (!element) {
      return;
    }

    const start = element.selectionStart ?? element.value.length;
    const end = element.selectionEnd ?? start;
    const nextValue = `${element.value.slice(0, start)}${token}${element.value.slice(end)}`;
    updateFieldValue(field, nextValue);

    window.requestAnimationFrame(() => {
      const nextElement = getFieldRef(field);
      if (!nextElement) {
        return;
      }
      nextElement.focus();
      const caret = start + token.length;
      nextElement.setSelectionRange(caret, caret);
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const subjectValue = normalizeText(subject);
    const previewValue = normalizeText(previewText);
    const bodyHtmlValue = normalizeText(bodyHtml);
    const bodyTextValue = derivePlainTextFromHtml(bodyHtmlValue);
    const unsupportedPlaceholders = [
      ...collectUnsupportedPlaceholders(subjectValue, ALLOWED_EDITOR_PLACEHOLDERS),
      ...collectUnsupportedPlaceholders(previewValue, ALLOWED_EDITOR_PLACEHOLDERS),
      ...collectUnsupportedPlaceholders(bodyHtmlValue, ALLOWED_EDITOR_PLACEHOLDERS),
      ...collectUnsupportedPlaceholders(bodyTextValue, ALLOWED_EDITOR_PLACEHOLDERS),
    ];
    const contentChanged =
      subjectValue !== normalizeText(campaign.subject) ||
      previewValue !== normalizeText(campaign.previewText) ||
      bodyHtmlValue !== normalizeText(campaign.bodyHtml) ||
      bodyTextValue !== normalizeText(campaign.bodyText);

    if (unsupportedPlaceholders.length > 0) {
      setErrorMessage("Completa o rimuovi le variabili del template prima di salvare.");
      setSuccessMessage(null);
      return;
    }

    if (!subjectValue || !bodyHtmlValue) {
      setErrorMessage("Oggetto e HTML sono obbligatori per salvare il contenuto.");
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
          subject: subjectValue,
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

  async function handleSaveTemplate() {
    if (isSavingTemplate) {
      return;
    }

    const normalizedTemplateName = normalizeText(templateName);
    const subjectValue = normalizeText(subject);
    const previewValue = normalizeText(previewText);
    const bodyHtmlValue = normalizeText(bodyHtml);
    const bodyTextValue = derivePlainTextFromHtml(bodyHtmlValue);
    const unsupportedPlaceholders = [
      ...collectUnsupportedPlaceholders(subjectValue, ALLOWED_EDITOR_PLACEHOLDERS),
      ...collectUnsupportedPlaceholders(previewValue, ALLOWED_EDITOR_PLACEHOLDERS),
      ...collectUnsupportedPlaceholders(bodyHtmlValue, ALLOWED_EDITOR_PLACEHOLDERS),
      ...collectUnsupportedPlaceholders(bodyTextValue, ALLOWED_EDITOR_PLACEHOLDERS),
    ];

    if (!normalizedTemplateName) {
      setErrorMessage("Inserisci un nome template prima di salvare.");
      return;
    }

    if (!subjectValue || !bodyHtmlValue) {
      setErrorMessage("Salva un soggetto e un HTML validi prima di creare il template.");
      return;
    }

    if (unsupportedPlaceholders.length > 0) {
      setErrorMessage("Completa o rimuovi le variabili del template prima di salvarlo.");
      return;
    }

    setIsSavingTemplate(true);
    setErrorMessage(null);

    try {
      const token = await getToken();
      const created = await createAdminEmailTemplate(
        {
          clientId: campaign.clientId,
          name: normalizedTemplateName,
          subject: subjectValue,
          previewText: previewValue,
          bodyHtml: bodyHtmlValue,
          bodyText: bodyTextValue,
        },
        token,
      );
      const mappedTemplate = mapSavedTemplate(created);
      setSavedTemplates((current) => [mappedTemplate, ...current]);
      setSelectedTemplateId(mappedTemplate.id);
      setTemplateName("");
      setIsTemplateDialogOpen(false);
      setSuccessMessage(`Template "${created.name}" salvato per ${campaign.clientName}.`);
    } catch (error) {
      setErrorMessage(getSafeUpdateErrorMessage(error));
    } finally {
      setIsSavingTemplate(false);
    }
  }

  const hasUnsavedChanges =
    normalizeText(subject) !== normalizeText(campaign.subject) ||
    normalizeText(previewText) !== normalizeText(campaign.previewText) ||
    normalizeText(bodyHtml) !== normalizeText(campaign.bodyHtml);

  return (
    <form className="admin-clients-card campaign-panel" onSubmit={handleSubmit}>
      <div className="admin-clients-card__intro">
        <div>
          <p className="admin-surface__eyebrow">{mode === "template" ? "Step 2" : "Step 3"}</p>
          <h2 className="admin-clients-card__title" style={{ color: "#0f172a" }}>
            {mode === "template" ? "Selezione template" : "Editor email"}
          </h2>
          <p className="admin-clients-card__description" style={{ marginTop: 8 }}>
            {mode === "template"
              ? "Scegli un template prima di entrare nell'editor. I modelli salvati restano limitati al cliente selezionato."
              : "Scrivi HTML e preview in uno spazio piu compatto, con placeholder a portata di mano e anteprima formattata."}
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

      {mode === "template" ? (
        <>
          <AdminCampaignTemplatePicker
            disabled={isSubmitting || isLoadingTemplates || isSavingTemplate}
            isLoading={isLoadingTemplates}
            onApply={requestTemplateSelection}
            selectedTemplateId={selectedTemplateId}
            templates={templateCatalog}
          />

          <div className="campaign-action-row" style={{ marginTop: 24 }}>
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
              onClick={() => onTemplateSelect?.(selectedTemplateId ?? defaultTemplate.id, false)}
              style={{ minWidth: 190 }}
            >
              Continua all&apos;editor
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="campaign-form-grid">
            <section
              className="campaign-panel campaign-panel--subtle campaign-template-toolbar"
              style={{
                alignItems: "start",
                display: "grid",
                gap: 16,
                gridColumn: "1 / -1",
              }}
            >
              <div
                style={{
                  alignItems: "start",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 16,
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "grid", gap: 6 }}>
                  <p className="admin-surface__eyebrow">Template attivo</p>
                  <h3 className="campaign-variable-helper__title" style={{ margin: 0 }}>
                    {templateCatalog.find((template) => template.id === selectedTemplateId)?.name ??
                      "Template custom"}
                  </h3>
                  <p className="campaign-variable-helper__note">
                    {templateCatalog.find((template) => template.id === selectedTemplateId)?.description ??
                      "Contenuto in modifica. I template completi restano nello step precedente."}
                  </p>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  <span className="campaign-template-badge">
                    {selectedTemplateId?.startsWith("saved:")
                      ? "Salvato cliente"
                      : selectedTemplateId
                        ? "Default / scelto"
                        : "Editor libero"}
                  </span>
                  <span className="campaign-template-badge campaign-template-badge--muted">
                    {hasUnsavedChanges
                      ? "Modifiche non salvate"
                      : isSubmitting
                        ? "Salvataggio in corso"
                        : "Allineato alla bozza"}
                  </span>
                </div>
              </div>
              <div className="campaign-template-toolbar__actions">
                <Button
                  type="button"
                  variant="outline"
                  className="admin-topbar-action campaign-action campaign-action--secondary"
                  disabled={isSubmitting || isSavingTemplate}
                  onClick={() => commitTemplate(defaultTemplate)}
                >
                  <RotateCcw aria-hidden="true" className="admin-topbar-action__icon" />
                  Ripristina default
                </Button>
                <Button
                  type="button"
                  className="admin-topbar-action campaign-action campaign-action--primary"
                  disabled={isSubmitting || isSavingTemplate}
                  onClick={() => setIsTemplateDialogOpen(true)}
                >
                  <WandSparkles aria-hidden="true" className="admin-topbar-action__icon" />
                  Salva come template
                </Button>
              </div>
            </section>

            <label className="campaign-field">
              <span className="campaign-field__label">Oggetto email</span>
              <input
                ref={subjectRef}
                className="campaign-input"
                disabled={isSubmitting}
                onChange={(event) => setSubject(event.target.value)}
                onFocus={() => setActiveField("subject")}
                placeholder="Oggetto della campagna"
                value={subject}
              />
            </label>

            <label className="campaign-field">
              <span className="campaign-field__label">Preview text</span>
              <input
                ref={previewRef}
                className="campaign-input"
                disabled={isSubmitting}
                onChange={(event) => setPreviewText(event.target.value)}
                onFocus={() => setActiveField("preview")}
                placeholder="Un riepilogo sintetico del contenuto dell'email"
                value={previewText}
              />
            </label>

            <section className="campaign-field" style={{ gridColumn: "1 / -1" }}>
              <div className="campaign-field__header">
                <span className="campaign-field__label">HTML email</span>
              </div>
              <div
                style={{
                  background: "rgba(248, 250, 252, 0.96)",
                  border: "1px solid rgba(148, 163, 184, 0.2)",
                  borderRadius: 24,
                  display: "grid",
                  gap: 16,
                  padding: 18,
                  position: "sticky",
                  top: 12,
                  zIndex: 2,
                }}
              >
                <div
                  style={{
                    alignItems: "center",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                    justifyContent: "space-between",
                  }}
                >
                  <div className="campaign-editor-toolbar__meta">
                    <span className="campaign-editor-toolbar__chip">Monospace</span>
                    <span className="campaign-editor-toolbar__chip">Tab per indentare</span>
                    <span className="campaign-editor-toolbar__chip">Linee attive</span>
                    <span className="campaign-editor-toolbar__chip">
                      {isSubmitting
                        ? "Salvataggio..."
                        : hasUnsavedChanges
                          ? "Da salvare"
                          : "Salvato"}
                    </span>
                  </div>
                  <div className="campaign-editor-toolbar__controls">
                    <div
                      className="campaign-editor-toggle"
                      role="tablist"
                      aria-label="Modalita editor email"
                    >
                      {(["split", "html", "preview"] as const).map((editorView) => {
                        const isActive = editorMode === editorView;

                        return (
                          <button
                            key={editorView}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            className="campaign-editor-toggle__button"
                            data-active={isActive}
                            disabled={isSubmitting}
                            onClick={() => setEditorMode(editorView)}
                          >
                            {editorView === "split"
                              ? "Split"
                              : editorView === "html"
                                ? "HTML"
                                : "Preview"}
                          </button>
                        );
                      })}
                    </div>

                    {editorMode !== "html" ? (
                      <div
                        className="campaign-editor-toggle"
                        role="group"
                        aria-label="Formato preview"
                      >
                        {(["desktop", "mobile"] as const).map((device) => (
                          <button
                            key={device}
                            type="button"
                            className="campaign-editor-toggle__button"
                            data-active={previewDevice === device}
                            disabled={isSubmitting}
                            onClick={() => setPreviewDevice(device)}
                          >
                            {device === "desktop" ? "Desktop" : "Mobile"}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <section className="campaign-variable-helper" aria-label="Variabili supportate">
                  <div className="campaign-variable-helper__header">
                    <div>
                      <p className="admin-surface__eyebrow">Placeholder</p>
                      <h3 className="campaign-variable-helper__title">Inserimento rapido</h3>
                    </div>
                    <div className="campaign-variable-helper__actions">
                      <p className="campaign-variable-helper__note">
                        Campo attivo: <strong>{activeField}</strong>
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="admin-topbar-action campaign-action campaign-action--secondary campaign-variable-helper__toggle"
                        aria-expanded={isVariableHelperOpen}
                        disabled={isSubmitting}
                        onClick={() => setIsVariableHelperOpen((current) => !current)}
                      >
                        {isVariableHelperOpen ? "Nascondi menu" : "Apri menu placeholder"}
                      </Button>
                    </div>
                  </div>
                  {isVariableHelperOpen ? (
                    <div className="campaign-variable-helper__list">
                      {SUPPORTED_TEMPLATE_VARIABLES.map((variable) => (
                        <button
                          key={variable.token}
                          type="button"
                          className="campaign-variable-chip campaign-variable-chip--button"
                          disabled={isSubmitting}
                          onClick={() => insertVariable(variable.token)}
                        >
                          <code>{variable.token}</code>
                          <span>{variable.description}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <p className="campaign-variable-helper__availability">
                    Brand cliente disponibile ora:{" "}
                    {availableBrandVariables.length > 0
                      ? availableBrandVariables.map((variable) => variable.token).join(", ")
                      : "nessuna variabile brand valorizzata."}
                  </p>
                </section>
              </div>

              <div className="campaign-editor-shell" data-mode={editorMode}>
                {editorMode !== "preview" ? (
                  <div className="campaign-editor-pane">
                    <div className="campaign-editor-pane__header">
                      <strong>Markup</strong>
                      <span>Editor HTML a altezza fissa, scrollabile e focalizzato sulla scrittura.</span>
                    </div>
                    <CampaignCodeEditor
                      ref={htmlRef}
                      disabled={isSubmitting}
                      onChange={setBodyHtml}
                      onFocus={() => setActiveField("html")}
                      placeholder="<html>...</html>"
                      rows={24}
                      style={{ minHeight: 720 }}
                      value={bodyHtml}
                    />
                  </div>
                ) : null}

                {editorMode !== "html" ? (
                  <div className="campaign-editor-pane campaign-editor-pane--preview">
                    <div className="campaign-editor-pane__header">
                      <strong>Preview</strong>
                      <span>Anteprima formattata con un solo viewport di scorrimento.</span>
                    </div>
                    <div className="campaign-preview-viewport" data-device={previewDevice}>
                      <iframe
                        className="campaign-email-preview-frame campaign-email-preview-frame--editor"
                        sandbox=""
                        srcDoc={buildPreviewDocument(previewHtml)}
                        style={{ height: 840 }}
                        title="Anteprima email"
                      />
                    </div>
                  </div>
                ) : null}
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
        </>
      )}

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
                  Il modello selezionato sostituira oggetto, preview, HTML e fallback testo derivato.
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
                Usa template
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {templateToConfirm ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setTemplateToConfirm(null)}
        >
          <div
            className="invite-modal campaign-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-template-step-confirm-title"
            aria-describedby="campaign-template-step-confirm-body"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="invite-modal__header">
              <div>
                <p className="invite-modal__eyebrow">Template</p>
                <h3 id="campaign-template-step-confirm-title" className="invite-modal__title">
                  Sostituire il contenuto attuale?
                </h3>
                <p id="campaign-template-step-confirm-body" className="invite-modal__message">
                  Il template selezionato diventera la base del prossimo step editor e sostituira oggetto, preview e markup correnti.
                </p>
              </div>
              <button
                type="button"
                className="invite-modal__close"
                aria-label="Chiudi"
                onClick={() => setTemplateToConfirm(null)}
              >
                <X aria-hidden="true" />
              </button>
            </div>

            <div className="invite-modal__actions campaign-confirm-modal__actions">
              <button
                type="button"
                className="invite-modal__button invite-modal__button--secondary"
                onClick={() => setTemplateToConfirm(null)}
              >
                Annulla
              </button>
              <button
                type="button"
                className="invite-modal__button invite-modal__button--primary"
                onClick={() => {
                  onTemplateSelect?.(templateToConfirm.id, true);
                  setTemplateToConfirm(null);
                }}
              >
                Usa template
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isTemplateDialogOpen ? (
        <div
          className="campaign-template-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="campaign-template-save-title"
          onClick={() => setIsTemplateDialogOpen(false)}
        >
          <div
            className="campaign-template-modal__card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="campaign-template-modal__header">
              <div style={{ display: "grid", gap: 8 }}>
                <p className="admin-surface__eyebrow">Salva template</p>
                <div>
                  <h4 id="campaign-template-save-title" className="campaign-template-card__title">
                    Nuovo template cliente
                  </h4>
                  <p className="campaign-template-card__description">
                    Salva il contenuto corrente per riutilizzarlo nelle prossime campagne di {campaign.clientName}.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Chiudi salvataggio template"
                className="campaign-template-modal__close"
                onClick={() => setIsTemplateDialogOpen(false)}
              >
                <X aria-hidden="true" />
              </Button>
            </div>

            <section className="campaign-template-modal__section">
              <label className="campaign-field">
                <span className="campaign-field__label">Nome template</span>
                <input
                  className="campaign-input"
                  disabled={isSavingTemplate}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder="Es. Promo onboarding giugno"
                  value={templateName}
                />
              </label>
              <div className="campaign-template-save-grid">
                <article>
                  <span>Oggetto</span>
                  <strong>{normalizeText(subject) || "Non impostato"}</strong>
                </article>
                <article>
                  <span>Preview</span>
                  <strong>{normalizeText(previewText) || "Non impostata"}</strong>
                </article>
              </div>
            </section>

            <div className="campaign-action-row campaign-action-row--wizard">
              <Button
                type="button"
                variant="outline"
                className="admin-topbar-action campaign-action campaign-action--secondary"
                disabled={isSavingTemplate}
                onClick={() => setIsTemplateDialogOpen(false)}
              >
                Annulla
              </Button>
              <Button
                type="button"
                className="admin-topbar-action campaign-action campaign-action--primary"
                disabled={isSavingTemplate}
                onClick={handleSaveTemplate}
              >
                {isSavingTemplate ? (
                  <Loader2 aria-hidden="true" className="admin-topbar-action__icon" />
                ) : (
                  <Save aria-hidden="true" className="admin-topbar-action__icon" />
                )}
                {isSavingTemplate ? "Salvataggio..." : "Salva template"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
