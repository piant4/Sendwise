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

export interface ClientDashboardActionItem {
  count: number;
  description: string;
  href: string;
  title: string;
  tone: "danger" | "neutral" | "warning";
}

export interface ClientDashboardLimitStatus {
  detail: string;
  label: string;
  tone: "danger" | "neutral" | "success" | "warning";
}

export interface ClientDashboardReadinessSummary {
  withDetailsCount: number;
  readyCount: number;
  needsSetupCount: number;
  blockedRecipientsCount: number;
  providerEventsUnavailableCount: number;
}

export interface ClientDashboardRecommendation {
  title: string;
  description: string;
  href: string;
  actionLabel: string;
}

export interface ClientDashboardModel {
  actionItems: ClientDashboardActionItem[];
  blockedSendsCount: number;
  campaignsNeedingAttention: number;
  campaignsToComplete: number;
  capacityRatio: number | null;
  limitStatus: ClientDashboardLimitStatus;
  readyCampaigns: number;
  recentCampaignsVisible: number;
  recentProviderEventsCount: number;
  readinessSummary: ClientDashboardReadinessSummary;
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

function buildLimitStatus(
  totalCampaigns: number,
  maxCampaigns?: number | null,
): ClientDashboardLimitStatus {
  if (typeof maxCampaigns !== "number" || maxCampaigns <= 0) {
    return {
      label: "Limite non configurato",
      detail: "La capacità campagne non è stata definita nel workspace.",
      tone: "neutral",
    };
  }

  const ratio = totalCampaigns / maxCampaigns;

  if (ratio >= 1) {
    return {
      label: "Limite raggiunto",
      detail: "Nessuno slot aggiuntivo disponibile finché il totale non si riduce.",
      tone: "danger",
    };
  }

  if (ratio >= 0.8) {
    return {
      label: "Capacità quasi satura",
      detail: "Conviene pianificare i prossimi slot prima di aprire nuove campagne.",
      tone: "warning",
    };
  }

  return {
    label: "Capacità disponibile",
    detail: "Il numero di campagne attive resta entro il limite configurato.",
    tone: "success",
  };
}

function hasRecentProviderSignal(
  snapshot: ClientDashboardCampaignSnapshot,
): boolean {
  const logs = snapshot.stats?.logs ?? snapshot.detail?.logs;

  if (!logs) {
    return false;
  }

  return logs.sent > 0 || logs.queued > 0 || snapshot.campaign.status === "running";
}

function buildActionItems(
  summary: ClientOverviewSummary,
  campaignsToComplete: number,
  blockedSendsCount: number,
  providerEventsUnavailableCount: number,
): ClientDashboardActionItem[] {
  const portalBase = `/c/${summary.client.portalSlug}`;
  const items: ClientDashboardActionItem[] = [];

  if (campaignsToComplete > 0) {
    items.push({
      count: campaignsToComplete,
      description:
        campaignsToComplete === 1
          ? "campagna recente ancora da completare"
          : "campagne recenti ancora da completare",
      href: `${portalBase}/campaigns`,
      title: "Completa le campagne",
      tone: "warning",
    });
  }

  if (blockedSendsCount > 0) {
    items.push({
      count: blockedSendsCount,
      description:
        blockedSendsCount === 1
          ? "blocco registrato nel periodo corrente"
          : "blocchi registrati nel periodo corrente",
      href: `${portalBase}/blocked-sends`,
      title: "Verifica i blocchi",
      tone: "danger",
    });
  }

  if (providerEventsUnavailableCount > 0) {
    items.push({
      count: providerEventsUnavailableCount,
      description:
        providerEventsUnavailableCount === 1
          ? "campagna recente senza eventi provider esposti"
          : "campagne recenti senza eventi provider esposti",
      href: `${portalBase}/campaigns`,
      title: "Controlla gli eventi provider",
      tone: "neutral",
    });
  }

  return items;
}

export function getCampaignUsageLimit(
  detail: CampaignReadModel | null,
  fallbackLimit?: number | null,
): number | null {
  if (typeof detail?.slot.maxEmails === "number" && detail.slot.maxEmails > 0) {
    return detail.slot.maxEmails;
  }

  if (typeof fallbackLimit === "number" && fallbackLimit > 0) {
    return fallbackLimit;
  }

  return null;
}

export function buildCampaignProgress(
  snapshot: ClientDashboardCampaignSnapshot,
  fallbackLimit?: number | null,
): {
  current: number;
  detail: string;
  label: string;
  limit: number;
  ratio: number;
} | null {
  if (!snapshot.detail) {
    return null;
  }

  const limit = getCampaignUsageLimit(snapshot.detail, fallbackLimit);

  if (!limit) {
    return null;
  }

  const logs = snapshot.stats?.logs ?? snapshot.detail.logs;
  const trackedSendVolume = logs.sent + logs.queued;

  if (trackedSendVolume > 0) {
    return {
      current: trackedSendVolume,
      detail:
        trackedSendVolume === 1
          ? "1 invio registrato tra coda e tentativi"
          : `${trackedSendVolume.toLocaleString("it-IT")} invii registrati tra coda e tentativi`,
      label: "Invii registrati sul limite",
      limit,
      ratio: trackedSendVolume / limit,
    };
  }

  return {
    current: snapshot.detail.recipients.eligible,
    detail:
      snapshot.detail.recipients.eligible === 1
        ? "1 destinatario idoneo rispetto al limite"
        : `${snapshot.detail.recipients.eligible.toLocaleString("it-IT")} destinatari idonei rispetto al limite`,
    label: "Destinatari sul limite",
    limit,
    ratio: snapshot.detail.recipients.eligible / limit,
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
  const recentCampaignsVisible = summary.campaigns.recentCampaigns.length;
  const recentCampaignsWithDetailsCount = snapshots.filter(
    (snapshot) => snapshot.detail,
  ).length;
  const recentBlockedRecipientsCount = snapshots.filter((snapshot) => {
    if (!snapshot.detail) {
      return false;
    }

    return snapshot.detail.recipients.blocked > 0;
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
  const recentProviderEventsCount = snapshots.filter((snapshot) => {
    const logs = snapshot.stats?.logs ?? snapshot.detail?.logs;

    return logs?.providerEventsAvailable;
  }).length;
  const providerEventsUnavailableCount = snapshots.filter((snapshot) => {
    if (!snapshot.detail) {
      return false;
    }

    const logs = snapshot.stats?.logs ?? snapshot.detail.logs;

    return !logs.providerEventsAvailable && hasRecentProviderSignal(snapshot);
  }).length;
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
    actionItems: buildActionItems(
      summary,
      campaignsToComplete,
      summary.blockedSends.currentPeriodCount,
      providerEventsUnavailableCount,
    ),
    blockedSendsCount: summary.blockedSends.currentPeriodCount,
    campaignsNeedingAttention,
    campaignsToComplete,
    capacityRatio: getCapacityRatio(
      summary.campaigns.totalCampaigns,
      summary.limits.maxCampaigns,
    ),
    limitStatus: buildLimitStatus(
      summary.campaigns.totalCampaigns,
      summary.limits.maxCampaigns,
    ),
    readyCampaigns: summary.campaigns.statusCounts.ready,
    recentCampaignsVisible,
    recentProviderEventsCount,
    readinessSummary: {
      withDetailsCount: recentCampaignsWithDetailsCount,
      readyCount: recentReadyCampaignsCount,
      needsSetupCount: recentRecipientIssuesCount,
      blockedRecipientsCount: recentBlockedRecipientsCount,
      providerEventsUnavailableCount,
    },
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
