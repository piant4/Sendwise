import type {
  Campaign,
  CampaignReadModel,
  ClientCampaignStatsReadModel,
  ClientOverviewSummary,
} from "../../types";

type DashboardStatusTone =
  | "ready"
  | "running"
  | "paused"
  | "attention"
  | "completed";

export interface ClientDashboardCampaignSnapshot {
  campaign: Campaign;
  detail: CampaignReadModel | null;
  stats: ClientCampaignStatsReadModel | null;
}

export interface ClientDashboardStatusSegment {
  label: string;
  value: number;
  tone: DashboardStatusTone;
}

export interface ClientDashboardRecommendation {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}

export interface ClientDashboardModel {
  blockedSendsCount: number;
  campaignsNeedingAttention: number;
  campaignsToComplete: number;
  capacityRatio: number | null;
  readyCampaigns: number;
  recentProviderEventsCount: number;
  recentReadyCampaignsCount: number;
  recentRecipientIssuesCount: number;
  remainingCampaignSlots: number | null;
  statusSegments: ClientDashboardStatusSegment[];
  totalCampaigns: number;
  workspaceStatus: {
    detail: string;
    label: string;
    variant: "danger" | "neutral" | "success" | "warning";
  };
  recommendation: ClientDashboardRecommendation;
}

function getCapacityRatio(
  totalCampaigns: number,
  maxCampaigns?: number | null,
): number | null {
  if (typeof maxCampaigns !== "number" || maxCampaigns <= 0) {
    return null;
  }

  return totalCampaigns / maxCampaigns;
}

function buildWorkspaceStatus(
  summary: ClientOverviewSummary,
  campaignsNeedingAttention: number,
): ClientDashboardModel["workspaceStatus"] {
  if (summary.client.clientStatus !== "active") {
    return {
      label: "Workspace limitato",
      detail: "Lo stato attuale del workspace riduce l'operatività.",
      variant: "warning",
    };
  }

  if (summary.client.accessStatus !== "active") {
    return {
      label: "Accesso da verificare",
      detail: "Serve confermare l'accesso prima di nuove attività.",
      variant: "warning",
    };
  }

  if (summary.blockedSends.currentPeriodCount > 0) {
    return {
      label: "Blocchi presenti",
      detail: "Sono presenti invii bloccati nel periodo corrente.",
      variant: "danger",
    };
  }

  if (campaignsNeedingAttention > 0) {
    return {
      label: "Campagne da verificare",
      detail: "Alcune campagne richiedono ancora un intervento operativo.",
      variant: "warning",
    };
  }

  if (summary.campaigns.statusCounts.ready > 0) {
    return {
      label: "Campagne pronte",
      detail: "Il workspace ha campagne già pronte per il prossimo passo.",
      variant: "success",
    };
  }

  return {
    label: "Workspace in ordine",
    detail: "Non emergono blocchi critici dal riepilogo disponibile.",
    variant: "neutral",
  };
}

function buildRecommendation(
  summary: ClientOverviewSummary,
  campaignsNeedingAttention: number,
  campaignsToComplete: number,
): ClientDashboardRecommendation {
  const campaignsHref = `/c/${summary.client.portalSlug}/campaigns`;
  const blockedHref = `/c/${summary.client.portalSlug}/blocked-sends`;
  const limitsHref = `/c/${summary.client.portalSlug}/email-limits`;

  if (summary.blockedSends.currentPeriodCount > 0) {
    return {
      title: "Rivedi i blocchi recenti",
      description: "Controlla le campagne e i motivi di stop registrati nel periodo.",
      href: blockedHref,
      actionLabel: "Vai ai blocchi",
    };
  }

  if (campaignsNeedingAttention > 0) {
    return {
      title: "Sistema le campagne da seguire",
      description: "Verifica pause, errori o altri stati che richiedono attenzione.",
      href: campaignsHref,
      actionLabel: "Vai alle campagne",
    };
  }

  if (campaignsToComplete > 0) {
    return {
      title: "Completa le campagne in lavorazione",
      description: "Rifinisci contenuto, destinatari o review prima dell'invio.",
      href: campaignsHref,
      actionLabel: "Apri le campagne",
    };
  }

  if (summary.limits.maxCampaigns && summary.campaigns.totalCampaigns >= summary.limits.maxCampaigns) {
    return {
      title: "Capacità campagne esaurita",
      description: "Valuta se chiudere campagne concluse o rivedere i limiti disponibili.",
      href: limitsHref,
      actionLabel: "Controlla i limiti",
    };
  }

  return {
    title: "Monitoraggio ordinario",
    description: "Apri l'elenco campagne per seguire i prossimi aggiornamenti.",
    href: campaignsHref,
    actionLabel: "Vai alle campagne",
  };
}

export function getUsageTypeLabel(usageType: string): string {
  switch (usageType) {
    case "api_requests":
      return "Richieste API";
    case "dry_run_sends":
      return "Invii di prova";
    default:
      return usageType
        .split("_")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
  }
}

export function buildClientDashboardModel(
  summary: ClientOverviewSummary,
  snapshots: ClientDashboardCampaignSnapshot[],
): ClientDashboardModel {
  const campaignsNeedingAttention =
    summary.campaigns.statusCounts.blocked +
    summary.campaigns.statusCounts.failed +
    summary.campaigns.statusCounts.paused;
  const campaignsToComplete =
    summary.campaigns.statusCounts.draft + summary.campaigns.statusCounts.paused;
  const recentReadyCampaignsCount = snapshots.filter((snapshot) => {
    if (!snapshot.detail) {
      return false;
    }

    return (
      snapshot.detail.campaign.contentReady &&
      snapshot.detail.campaign.contactsReady &&
      snapshot.detail.campaign.reviewReady &&
      snapshot.detail.recipients.eligible > 0
    );
  }).length;
  const recentRecipientIssuesCount = snapshots.filter((snapshot) => {
    if (!snapshot.detail) {
      return false;
    }

    return (
      snapshot.detail.recipients.total === 0 ||
      snapshot.detail.recipients.eligible === 0 ||
      snapshot.detail.recipients.blocked > 0 ||
      !snapshot.detail.campaign.contactsReady
    );
  }).length;
  const recentProviderEventsCount = snapshots.filter(
    (snapshot) => snapshot.stats?.logs.providerEventsAvailable,
  ).length;
  const remainingCampaignSlots =
    typeof summary.limits.maxCampaigns === "number" && summary.limits.maxCampaigns > 0
      ? Math.max(summary.limits.maxCampaigns - summary.campaigns.totalCampaigns, 0)
      : null;
  const statusSegments = [
    {
      label: "Pronte",
      value: summary.campaigns.statusCounts.ready,
      tone: "ready",
    },
    {
      label: "In corso",
      value: summary.campaigns.statusCounts.running,
      tone: "running",
    },
    {
      label: "Da completare",
      value: campaignsToComplete,
      tone: "paused",
    },
    {
      label: "Bloccate",
      value:
        summary.campaigns.statusCounts.blocked + summary.campaigns.statusCounts.failed,
      tone: "attention",
    },
    {
      label: "Completate",
      value: summary.campaigns.statusCounts.completed,
      tone: "completed",
    },
  ] as ClientDashboardStatusSegment[];

  return {
    blockedSendsCount: summary.blockedSends.currentPeriodCount,
    campaignsNeedingAttention,
    campaignsToComplete,
    capacityRatio: getCapacityRatio(
      summary.campaigns.totalCampaigns,
      summary.limits.maxCampaigns,
    ),
    readyCampaigns: summary.campaigns.statusCounts.ready,
    recentProviderEventsCount,
    recentReadyCampaignsCount,
    recentRecipientIssuesCount,
    remainingCampaignSlots,
    statusSegments: statusSegments.filter((segment) => segment.value > 0),
    totalCampaigns: summary.campaigns.totalCampaigns,
    workspaceStatus: buildWorkspaceStatus(summary, campaignsNeedingAttention),
    recommendation: buildRecommendation(
      summary,
      campaignsNeedingAttention,
      campaignsToComplete,
    ),
  };
}
