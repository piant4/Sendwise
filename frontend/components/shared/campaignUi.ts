import type {
  CampaignLogsSummary,
  CampaignRecipientsSummary,
  CampaignStatus,
  CampaignSummaryItem,
  ProviderRuntimeSummary,
} from "../../types";

type StatusBadgeVariant = "neutral" | "success" | "warning" | "danger";
export type CampaignWizardStep = "setup" | "content" | "recipients" | "review";

export interface LabelValueItem {
  label: string;
  value: string;
}

export interface ReadableBackendReason {
  label: string;
  raw: string;
  isKnown: boolean;
}

const BACKEND_REASON_LABELS: Array<[RegExp, string]> = [
  [/^Campaign has no associated contacts\.$/i, "Nessun contatto associato"],
  [/^Campaign has no eligible contacts to send\.$/i, "Nessun destinatario idoneo"],
  [
    /^EMAIL_SENDING_ENABLED is not exactly true; real dispatch is disabled\.$/i,
    "Invio reale disattivato",
  ],
  [/all recipients blocked/i, "Tutti i destinatari sono bloccati"],
  [/^Campaign content is not ready\.$/i, "Contenuto campagna da completare"],
  [/^Campaign status .+ is not sendable\.$/i, "Stato campagna non inviabile"],
  [/^Only ready or running campaigns may dispatch\.$/i, "Campagna non pronta all'invio"],
  [/^Client max_campaigns limit is exceeded\.$/i, "Limite campagne cliente superato"],
  [
    /^Campaign eligible contact count exceeds email_limit_per_campaign\.$/i,
    "Destinatari oltre il limite per campagna",
  ],
  [
    /^Campaign eligible contact count exceeds campaign slot max_emails\.$/i,
    "Destinatari oltre il limite dello slot",
  ],
  [
    /^Campaign contains non-sendable contacts and partial dispatch is not supported\.$/i,
    "Sono presenti destinatari non inviabili",
  ],
];

export function formatCampaignCount(value: number): string {
  return value.toLocaleString("it-IT");
}

export function getReadableBackendReason(reason: string): ReadableBackendReason {
  const normalizedReason = reason.trim();
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
    label: "Verifica operativa richiesta",
    raw: normalizedReason || "Reason non disponibile",
    isKnown: false,
  };
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
      label: "Review",
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
    case "content":
      return "Contenuto";
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
  if (step === "content" || step === "recipients" || step === "review") {
    return step;
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

  return "Nessun evento provider registrato";
}

export function getProviderEventsDetail(logs: CampaignLogsSummary): string {
  if (logs.providerEventsAvailable) {
    return "Le metriche evento usano solo dati provider processati.";
  }

  if (
    logs.queued === 0 &&
    logs.sent === 0 &&
    logs.opened === 0 &&
    logs.clicked === 0 &&
    logs.bounced === 0 &&
    logs.complained === 0 &&
    logs.unsubscribed === 0
  ) {
    return "Nessun evento provider registrato.";
  }

  return "Le metriche provider restano pending finche non arrivano eventi processati.";
}

export function getCampaignLogStatItems(
  logs: CampaignLogsSummary,
): LabelValueItem[] {
  return [
    { label: "In coda", value: formatCampaignCount(logs.queued) },
    { label: "Invio tentato", value: formatCampaignCount(logs.sent) },
    { label: "Bounce", value: formatCampaignCount(logs.bounced) },
    { label: "Disiscritti", value: formatCampaignCount(logs.unsubscribed) },
    { label: "Reclami", value: formatCampaignCount(logs.complained) },
  ];
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
