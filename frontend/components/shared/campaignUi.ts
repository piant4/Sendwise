import type {
  CampaignLogsSummary,
  CampaignRecipientsSummary,
  CampaignStatus,
  CampaignSummaryItem,
  ProviderRuntimeSummary,
} from "../../types";

type StatusBadgeVariant = "neutral" | "success" | "warning" | "danger";
export type CampaignWizardStep =
  | "setup"
  | "template"
  | "editor"
  | "recipients"
  | "review"
  | "send";

export interface LabelValueItem {
  label: string;
  value: string;
}

export interface ReadableBackendReason {
  label: string;
  raw: string;
  isKnown: boolean;
}

export const INTERNAL_CAMPAIGN_DRAFT_SUBJECT = "[draft] Oggetto da definire";

const BACKEND_REASON_LABELS: Array<[RegExp, string]> = [
  [/^Campaign has no associated contacts\.$/i, "Aggiungi almeno un destinatario valido."],
  [/^Campaign has no eligible contacts to send\.$/i, "Nessun destinatario idoneo disponibile."],
  [
    /^EMAIL_SENDING_ENABLED is not exactly "true"; real dispatch is disabled\.$/i,
    "Invio reale disattivato in questo ambiente.",
  ],
  [/all recipients blocked/i, "Tutti i destinatari risultano esclusi dall'invio."],
  [/^Campaign content is not ready\.$/i, "Completa e salva il contenuto email."],
  [/^Client status .+ is not sendable\.$/i, "Il cliente non è in uno stato che consente l'invio."],
  [/^Only ready or running campaigns may dispatch\.$/i, "Porta la campagna in stato pronta prima dell'invio."],
  [/^Client max_campaigns limit is exceeded\.$/i, "Limite campagne cliente superato"],
  [
    /^Campaign eligible contact count exceeds email_limit_per_campaign\.$/i,
    "I destinatari superano il limite previsto per questa campagna.",
  ],
  [
    /^Campaign eligible contact count exceeds campaign slot max_emails\.$/i,
    "I destinatari superano il limite previsto per questo slot.",
  ],
  [
    /^Campaign contains non-sendable contacts and partial dispatch is not supported\.$/i,
    "Alcuni destinatari non sono idonei all'invio.",
  ],
  [
    /^Controlled dispatch requires development or staging runtime with Mailpit-compatible provider configuration\.$/i,
    "L'invio reale non è disponibile in questo ambiente.",
  ],
  [
    /^SES controlled send is not allowed in this runtime environment\.$/i,
    "L'invio reale non è disponibile in questo ambiente.",
  ],
  [
    /^SES SMTP config is incomplete:/i,
    "La configurazione dell'invio reale non è completa.",
  ],
  [
    /^BACKEND_PUBLIC_URL must be a reachable public URL for SES unsubscribe links\.$/i,
    "La configurazione dei link email non è completa.",
  ],
  [
    /^SES controlled send requires content_ready, contacts_ready, and review_ready\.$/i,
    "Completa contenuto, destinatari e review prima di avviare l'invio.",
  ],
  [
    /^Eligible contact count exceeds REAL_SEND_MAX_RECIPIENTS\.$/i,
    "Invio bloccato dal limite di sicurezza dell'ambiente.",
  ],
  [
    /^REAL_SEND_ALLOWED_RECIPIENTS is required for SES controlled send\.$/i,
    "L'invio reale è limitato ai destinatari autorizzati in questo ambiente.",
  ],
  [
    /^SES controlled send includes recipients outside REAL_SEND_ALLOWED_RECIPIENTS\.$/i,
    "L'invio reale è limitato ai destinatari autorizzati in questo ambiente.",
  ],
  [
    /^Campaign daily email limit reached for the current pacing window\.$/i,
    "Limite giornaliero della campagna raggiunto: aumenta il limite o riprova domani.",
  ],
  [
    /^Campaign 30-day period email limit reached\.$/i,
    "Limite di 30 giorni della campagna raggiunto: aumenta il limite o attendi il rinnovo del periodo.",
  ],
  [
    /^Prepared SES campaign content does not include a real unsubscribe URL\.$/i,
    "Il contenuto email non include ancora un link di disiscrizione valido.",
  ],
  [
    /^Campaign HTML template is not ready for dispatch\.$/i,
    "Il contenuto HTML preparato dal backend non è ancora pronto all'invio.",
  ],
  [/^Campaign send is already in progress\.$/i, "Campagna già inviata o in elaborazione."],
  [/^Campaign already has queued email logs\.$/i, "Campagna già inviata o in elaborazione."],
  [
    /^Campaign was already accepted by the provider\.$/i,
    "Campagna già inviata o in elaborazione.",
  ],
  [
    /^Campaign already has accepted or processed email logs\.$/i,
    "Campagna già inviata o in elaborazione.",
  ],
  [
    /^Campaign already has existing email logs and cannot be retried safely\.$/i,
    "Campagna già inviata o in elaborazione.",
  ],
  [
    /^Campaign failed previously, but the recipient set changed and cannot be retried safely\.$/i,
    "Campagna già inviata o in elaborazione.",
  ],
];

export interface CampaignReviewStateMeta {
  badgeLabel: string;
  badgeVariant: StatusBadgeVariant;
  summaryLabel: string;
  helperText: string;
  buttonLabel: string;
}

export interface CampaignDispatchUiMeta {
  title: string;
  summary: string;
  badgeLabel: string;
  badgeVariant: StatusBadgeVariant;
}

export interface CampaignOperationalSendState {
  label: string;
  detail: string;
  variant: StatusBadgeVariant;
}

export function formatCampaignCount(value: number): string {
  return value.toLocaleString("it-IT");
}

export function isInternalCampaignDraftSubject(value?: string | null): boolean {
  return value?.trim() === INTERNAL_CAMPAIGN_DRAFT_SUBJECT;
}

export function getCampaignSubjectDisplay(
  value?: string | null,
  fallback = "Oggetto email da completare",
): string {
  const normalizedValue = value?.trim() ?? "";
  if (!normalizedValue || isInternalCampaignDraftSubject(normalizedValue)) {
    return fallback;
  }

  return normalizedValue;
}

export function getProviderEventsAvailabilityLabel(
  logs: CampaignLogsSummary,
): string {
  if (logs.providerEventsAvailable) {
    return "Disponibili";
  }

  if (logs.sent > 0) {
    return "In attesa di eventi provider";
  }

  return "Non disponibili";
}

export function formatProviderEventMetric(
  value: number,
  logs: CampaignLogsSummary,
): string {
  if (logs.providerEventsAvailable) {
    return formatCampaignCount(value);
  }

  return logs.sent > 0 ? "In attesa di eventi provider" : "Non disponibili";
}

export function getCampaignOperationalSendState(
  logs: CampaignLogsSummary,
): CampaignOperationalSendState {
  if (logs.sent > 0 && logs.failed > 0) {
    return {
      label: "Invio parziale",
      detail: "Parte dei destinatari e' stata accettata, altri invii sono falliti.",
      variant: "warning",
    };
  }

  if (logs.sent > 0) {
    return {
      label: "Accettata dal sistema",
      detail: "Gli invii risultano accettati dal sistema di invio.",
      variant: "success",
    };
  }

  if (logs.queued > 0) {
    return {
      label: "In preparazione",
      detail: "Gli invii sono stati preparati ma non ancora accettati.",
      variant: "warning",
    };
  }

  if (logs.failed > 0) {
    return {
      label: "Invio fallito",
      detail: "Il backend ha registrato errori di dispatch o provider.",
      variant: "danger",
    };
  }

  return {
    label: "Non avviata",
    detail: "Nessun invio reale risulta ancora avviato.",
    variant: "neutral",
  };
}

export function getReadableBackendReason(reason: string): ReadableBackendReason {
  const normalizedReason = reason.trim();
  const campaignStatusMatch = normalizedReason.match(
    /^Campaign status (.+) is not sendable\.$/i,
  );
  if (campaignStatusMatch) {
    const normalizedStatus = campaignStatusMatch[1]?.trim().toLowerCase() ?? "";
    const statusLabel = getCampaignStatusLabel(normalizedStatus as CampaignStatus);
    const label =
      normalizedStatus === "draft"
        ? "La review non ha ancora portato la campagna in stato pronta."
        : normalizedStatus === "paused"
          ? "La campagna è in pausa: riportala in stato pronta per poterla inviare."
          : `La campagna è in stato ${statusLabel.toLowerCase()}: portala in stato pronta prima dell'invio.`;
    return {
      label,
      raw: normalizedReason,
      isKnown: true,
    };
  }
  const knownReason = BACKEND_REASON_LABELS.find(([pattern]) =>
    pattern.test(normalizedReason),
  );

  if (knownReason) {
    return {
      label: knownReason[1],
      raw: normalizedReason,
      isKnown: true,
    };
  }

  return {
    label: normalizedReason || "Verifica operativa richiesta.",
    raw: normalizedReason || "Reason non disponibile",
    isKnown: false,
  };
}

export function getCampaignReviewStateMeta(
  reviewReady: boolean,
  reviewExecuted: boolean,
): CampaignReviewStateMeta {
  if (reviewReady) {
    return {
      badgeLabel: "Pronta",
      badgeVariant: "success",
      summaryLabel: "Campagna pronta",
      helperText: "La verifica è stata eseguita. Nessun invio è stato avviato.",
      buttonLabel: "Verifica",
    };
  }

  if (reviewExecuted) {
    return {
      badgeLabel: "Richiede intervento",
      badgeVariant: "warning",
      summaryLabel: "Campagna non pronta",
      helperText: "La verifica è stata eseguita. Risolvi i punti sotto e poi rieseguila.",
      buttonLabel: "Riesegui verifica",
    };
  }

  return {
    badgeLabel: "Da verificare",
    badgeVariant: "warning",
    summaryLabel: "Verifica da eseguire",
    helperText: "Esegui la verifica finale per controllare contenuto, destinatari e stato della campagna.",
    buttonLabel: "Verifica",
  };
}

export function dedupeReviewReasons(reasons: ReadableBackendReason[]): ReadableBackendReason[] {
  const seen = new Set<string>();

  return reasons.filter((reason) => {
    const key = `${reason.label}::${reason.raw}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function getCampaignStatusLabel(status: CampaignStatus): string {
  switch (status) {
    case "ready":
      return "Pronta";
    case "running":
      return "In corso";
    case "paused":
      return "In pausa";
    case "blocked":
      return "Bloccata";
    case "draft":
      return "Bozza";
    case "completed":
      return "Completata";
    case "failed":
      return "Errore";
    default:
      return "Stato";
  }
}

export function getCampaignStatusVariant(
  status: CampaignStatus,
): StatusBadgeVariant {
  switch (status) {
    case "ready":
    case "running":
    case "completed":
      return "success";
    case "paused":
      return "warning";
    case "blocked":
    case "failed":
      return "danger";
    default:
      return "neutral";
  }
}

export function getCampaignReadinessItems(
  campaign: Pick<
    CampaignSummaryItem,
    "contentReady" | "contactsReady" | "reviewReady"
  >,
): LabelValueItem[] {
  return [
    {
      label: "Contenuto",
      value: campaign.contentReady ? "Pronto" : "Da completare",
    },
    {
      label: "Destinatari",
      value: campaign.contactsReady ? "Presenti" : "Non pronti",
    },
    {
      label: "Verifica",
      value: campaign.reviewReady ? "Approvata" : "In attesa",
    },
  ];
}

export function getCampaignReadinessLabel(
  campaign: Pick<
    CampaignSummaryItem,
    "contentReady" | "contactsReady" | "reviewReady"
  >,
): string {
  const missing = getCampaignReadinessItems(campaign)
    .filter((item) =>
      ["Da completare", "Non pronti", "In attesa"].includes(item.value),
    )
    .map((item) => item.label.toLowerCase());

  if (missing.length === 0) {
    return "Pronta";
  }

  return `Non pronta: ${missing.join(", ")}`;
}

export function getCampaignReadinessShortLabel(
  campaign: Pick<
    CampaignSummaryItem,
    "contentReady" | "contactsReady" | "reviewReady"
  >,
): string {
  if (campaign.contentReady && campaign.contactsReady && campaign.reviewReady) {
    return "Pronta";
  }

  if (!campaign.contentReady) {
    return "Contenuto da completare";
  }

  if (!campaign.contactsReady) {
    return "Destinatari da verificare";
  }

  return "Verifica finale richiesta";
}

export function getCampaignStepLabel(step: string): string {
  switch (step) {
    case "setup":
      return "Setup";
    case "template":
      return "Template";
    case "content":
    case "editor":
      return "Editor";
    case "recipients":
      return "Destinatari";
    case "review":
      return "Verifica";
    case "send":
      return "Invio";
    default:
      return step || "Setup";
  }
}

export function normalizeCampaignWizardStep(step?: string | null): CampaignWizardStep {
  if (
    step === "template" ||
    step === "editor" ||
    step === "recipients" ||
    step === "review" ||
    step === "send"
  ) {
    return step;
  }

  if (step === "content") {
    return "editor";
  }

  return "setup";
}

export function getRecipientSummaryItems(
  recipients: CampaignRecipientsSummary,
): LabelValueItem[] {
  return [
    { label: "Totali", value: formatCampaignCount(recipients.total) },
    { label: "Idonei", value: formatCampaignCount(recipients.eligible) },
    { label: "Bloccati", value: formatCampaignCount(recipients.blocked) },
    { label: "Soppressi", value: formatCampaignCount(recipients.suppressed) },
    { label: "Email non valide", value: formatCampaignCount(recipients.invalid) },
  ];
}

export function getRecipientEmptyState(
  recipients: CampaignRecipientsSummary,
): string | null {
  if (recipients.total === 0) {
    return "Nessun contatto associato";
  }

  if (recipients.eligible === 0 && recipients.blocked === recipients.total) {
    return "Tutti i destinatari sono bloccati.";
  }

  if (recipients.eligible === 0) {
    return "Nessun destinatario idoneo.";
  }

  return null;
}

export function getBlockedReasonItems(
  recipients: CampaignRecipientsSummary,
): LabelValueItem[] {
  return [
    { label: "Soppressioni", value: formatCampaignCount(recipients.suppressed) },
    { label: "Email non valide", value: formatCampaignCount(recipients.invalid) },
    { label: "Bloccati dal Guard", value: formatCampaignCount(recipients.blocked) },
  ].filter((item) => item.value !== "0");
}

export function getProviderEventsLabel(logs: CampaignLogsSummary): string {
  if (logs.providerEventsAvailable) {
    return "Eventi provider disponibili";
  }

  return "Metriche provider non disponibili";
}

export function getProviderEventsDetail(logs: CampaignLogsSummary): string {
  if (logs.providerEventsAvailable) {
    return "Le metriche evento usano solo dati provider processati.";
  }

  return "In attesa di eventi provider.";
}

export function getCampaignLogStatItems(
  logs: CampaignLogsSummary,
): LabelValueItem[] {
  return [
    { label: "In coda", value: formatCampaignCount(logs.queued) },
    {
      label: "Accettate dal sistema di invio",
      value: formatCampaignCount(logs.sent),
    },
    { label: "Fallite", value: formatCampaignCount(logs.failed) },
    { label: "Bounce", value: formatCampaignCount(logs.bounced) },
    { label: "Disiscritti", value: formatCampaignCount(logs.unsubscribed) },
    { label: "Reclami", value: formatCampaignCount(logs.complained) },
  ];
}

export function isDuplicateDispatchCode(code: string): boolean {
  return [
    "campaign_already_dispatched",
    "campaign_send_already_in_progress",
    "campaign_send_already_accepted",
  ].includes(code);
}

export function hasDuplicateDispatchBlock(reasons: string[]): boolean {
  return reasons.some((reason) => {
    const normalizedReason = reason.trim();

    return (
      /^Campaign send is already in progress\.$/i.test(normalizedReason) ||
      /^Campaign already has queued email logs\.$/i.test(normalizedReason) ||
      /^Campaign was already accepted by the provider\.$/i.test(normalizedReason) ||
      /^Campaign already has accepted or processed email logs\.$/i.test(normalizedReason) ||
      /^Campaign already has existing email logs and cannot be retried safely\.$/i.test(
        normalizedReason,
      ) ||
      /^Campaign failed previously, but the recipient set changed and cannot be retried safely\.$/i.test(
        normalizedReason,
      )
    );
  });
}

export function getCampaignDispatchUiMeta(args: {
  status: string;
  allowed: boolean;
  code: string;
}): CampaignDispatchUiMeta {
  if (isDuplicateDispatchCode(args.code)) {
    return {
      title: "Campagna già inviata o in elaborazione",
      summary: "Non è stato creato un nuovo invio.",
      badgeLabel: "Nessun nuovo invio",
      badgeVariant: "warning",
    };
  }

  if (args.status === "accepted" && args.allowed) {
    return {
      title: "Invio accettato",
      summary: "Accettate dal sistema di invio. Questo stato non conferma la consegna in inbox.",
      badgeLabel: "Invio avviato",
      badgeVariant: "success",
    };
  }

  if (args.status === "dispatch_failed") {
    return {
      title: "Invio fallito",
      summary: "L'invio è stato tentato ma non è stato accettato dal sistema di invio.",
      badgeLabel: "Invio fallito",
      badgeVariant: "danger",
    };
  }

  return {
    title: "Non è stato creato un nuovo invio",
    summary: "Il backend ha mantenuto bloccato il flusso di invio per questa campagna.",
    badgeLabel: "Invio non avviato",
    badgeVariant: "warning",
  };
}

export function getRuntimeSafetyItems(
  runtime: ProviderRuntimeSummary,
): LabelValueItem[] {
  const items: LabelValueItem[] = [];

  items.push({
    label: "Invio reale",
    value: !runtime.emailSendingEnabled
      ? "Invio reale disattivato"
      : runtime.realSendAvailable
        ? "Invio reale disponibile"
        : "Invio reale non disponibile",
  });

  items.push({
    label: "Ambiente",
    value: runtime.mailpitDevMode
      ? "Ambiente Mailpit/dev"
      : runtime.providerModeLabel || "Provider non specificato",
  });

  if (runtime.emailProvider === "ses") {
    items.push({
      label: "SES",
      value:
        runtime.sesLiveValidationStatus === "pending"
          ? "SES configurato, validazione live pending"
          : "SES configurato",
    });
  }

  return items;
}

export function getSesPendingWarning(
  runtime: ProviderRuntimeSummary,
): string | null {
  if (
    runtime.emailProvider === "ses" &&
    runtime.sesLiveValidationStatus === "pending"
  ) {
    return "SES configurato, validazione live pending: non interpretare in coda o invio tentato come consegna.";
  }

  return null;
}
