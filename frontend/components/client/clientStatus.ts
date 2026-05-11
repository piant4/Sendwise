import type {
  CampaignStatus,
  ClientOverviewSummary,
} from "../../types";

export function getClientAccountVariant(
  status: ClientOverviewSummary["client"]["clientStatus"],
) {
  switch (status) {
    case "active":
      return "success" as const;
    case "trial":
    case "paused":
      return "warning" as const;
    case "blocked":
    case "archived":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

export function getClientStatusLabel(
  status: ClientOverviewSummary["client"]["clientStatus"],
): string {
  switch (status) {
    case "active":
      return "Account attivo";
    case "trial":
      return "Account in prova";
    case "paused":
      return "Account in pausa";
    case "blocked":
      return "Account bloccato";
    case "archived":
      return "Account archiviato";
    default:
      return "Stato account";
  }
}

export function getClientAccessStatusLabel(
  status: ClientOverviewSummary["client"]["accessStatus"],
): string {
  switch (status) {
    case "active":
      return "Accesso attivo";
    case "invited":
      return "Invito aperto";
    case "suspended":
      return "Accesso sospeso";
    case "archived":
      return "Accesso archiviato";
    default:
      return "Accesso cliente";
  }
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

export function getCampaignStatusVariant(status: CampaignStatus) {
  switch (status) {
    case "ready":
    case "running":
    case "completed":
      return "success" as const;
    case "paused":
      return "warning" as const;
    case "blocked":
    case "failed":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

export function formatLimitValue(value: number): string {
  return value > 0 ? value.toLocaleString() : "In definizione";
}

export function formatOptionalLimit(value?: number | null): string {
  return typeof value === "number" && value > 0
    ? value.toLocaleString()
    : "Non configurato";
}

export function formatDateTimeLabel(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}
