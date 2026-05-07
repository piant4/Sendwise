import type {
  CampaignStatus,
  ClientOverviewSummary,
} from "../../types";

export function getClientAccountVariant(
  status: ClientOverviewSummary["accountStatus"]["status"],
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
