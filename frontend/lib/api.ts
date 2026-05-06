import type {
  AdminOverviewSummary,
  ApiUsage,
  BlockedSend,
  Campaign,
  Client,
  ClientContext,
  ClientOverviewSummary,
} from "../types";
import * as mockApi from "./mock-api";

// UI pages/components must consume dashboard data through this boundary.
export const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "";

const DEFAULT_EMPTY_ADMIN_LIMITS = {
  monthlyLimit: 0,
  monthlySent: 0,
  dailyLimit: 0,
  dailySent: 0,
} as const;

const ACTIVE_CAMPAIGN_STATUSES = new Set<Campaign["status"]>(["ready", "running"]);

function formatDateTimeLabel(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function isActiveCampaignStatus(status: Campaign["status"]): boolean {
  return ACTIVE_CAMPAIGN_STATUSES.has(status);
}

function getRequiredApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is required when NEXT_PUBLIC_USE_MOCK_API=false.",
    );
  }

  return API_BASE_URL.replace(/\/$/, "");
}

async function readErrorDetails(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const payload = (await response.json().catch(() => null)) as
      | { detail?: unknown; message?: unknown }
      | null;

    if (typeof payload?.detail === "string" && payload.detail.trim()) {
      return payload.detail;
    }

    if (typeof payload?.message === "string" && payload.message.trim()) {
      return payload.message;
    }
  }

  const text = await response.text().catch(() => "");
  return text.trim() || response.statusText || "Unknown error";
}

async function apiGet<T>(path: string): Promise<T> {
  const requestUrl = `${getRequiredApiBaseUrl()}${path}`;
  let response: Response;

  try {
    response = await fetch(requestUrl, {
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown network error";
    throw new Error(`API request failed for ${path}: ${message}`);
  }

  if (!response.ok) {
    const details = await readErrorDetails(response);
    throw new Error(
      `API request failed for ${path}: ${response.status} ${details}`,
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(`API request failed for ${path}: invalid JSON response`);
  }
}

async function fetchAdminClients(): Promise<Client[]> {
  return apiGet<Client[]>("/admin/clients");
}

async function fetchAdminCampaigns(): Promise<Campaign[]> {
  return apiGet<Campaign[]>("/admin/campaigns");
}

async function fetchClientMe(): Promise<ClientContext> {
  return apiGet<ClientContext>("/client/me");
}

async function fetchClientCampaigns(): Promise<Campaign[]> {
  return apiGet<Campaign[]>("/client/campaigns");
}

async function fetchClientUsage(): Promise<ApiUsage[]> {
  return apiGet<ApiUsage[]>("/client/usage");
}

async function fetchClientBlockedSends(): Promise<BlockedSend[]> {
  return apiGet<BlockedSend[]>("/client/blocked-sends");
}

function getClientStatusLabel(status: Client["status"]): string {
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

function buildAdminOverviewSummary(
  clients: Client[],
  campaigns: Campaign[],
): AdminOverviewSummary {
  const campaignStatusCounts = {
    active: 0,
    paused: 0,
    blocked: 0,
    draft: 0,
  };

  for (const campaign of campaigns) {
    if (isActiveCampaignStatus(campaign.status)) {
      campaignStatusCounts.active += 1;
      continue;
    }

    if (campaign.status === "paused") {
      campaignStatusCounts.paused += 1;
      continue;
    }

    if (campaign.status === "blocked") {
      campaignStatusCounts.blocked += 1;
      continue;
    }

    if (campaign.status === "draft") {
      campaignStatusCounts.draft += 1;
    }
  }

  return {
    totalClients: clients.length,
    activeCampaigns: campaigns.filter((campaign) =>
      isActiveCampaignStatus(campaign.status),
    ).length,
    blockedSendsToday: 0,
    monthlyAiCallsUsed: 0,
    campaignStatusCounts,
    emailLimitOverview: DEFAULT_EMPTY_ADMIN_LIMITS,
    recentBlockedSends: [],
    systemStatus: {
      api: "ok",
      mockData: "disabled",
      sending: "disabled",
      mailpit: "dev_only",
    },
  };
}

function buildClientOverviewSummary(
  clientContext: ClientContext,
  campaigns: Campaign[],
  usage: ApiUsage[],
  blockedSends: BlockedSend[],
): ClientOverviewSummary {
  const campaignNames = new Map(
    campaigns.map((campaign) => [campaign.id, campaign.name]),
  );

  const deliveryOverview = campaigns.reduce(
    (totals, campaign) => ({
      sent: totals.sent + (campaign.stats?.sent ?? 0),
      opened: totals.opened + (campaign.stats?.opened ?? 0),
      spam: totals.spam,
      bounced: totals.bounced + (campaign.stats?.bounced ?? 0),
      blocked: totals.blocked,
    }),
    {
      sent: 0,
      opened: 0,
      spam: 0,
      bounced: 0,
      blocked: blockedSends.length,
    },
  );
  const usageRecordForEmails = usage.find((entry) => entry.usage_type === "emails_sent");
  const monthlyEmailsSent = usageRecordForEmails?.quantity ?? deliveryOverview.sent;
  const monthlyEmailLimit = 0;

  return {
    activeCampaigns: campaigns.filter((campaign) =>
      isActiveCampaignStatus(campaign.status),
    ).length,
    monthlyEmailLimit,
    monthlyEmailsSent,
    blockedSendsThisMonth: blockedSends.length,
    campaignSummaries: campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      sent: campaign.stats?.sent ?? 0,
      limit: 0,
      lastActivityLabel: formatDateTimeLabel(campaign.updated_at),
    })),
    limitOverview: {
      monthlyEmailLimit,
      monthlyEmailsSent,
    },
    deliveryOverview,
    readableBlockedSends: blockedSends.map((blockedSend) => ({
      id: blockedSend.id,
      campaignName:
        (blockedSend.campaign_id && campaignNames.get(blockedSend.campaign_id)) ||
        "Campagna non disponibile",
      reason: blockedSend.reason,
      readableReason: blockedSend.reason,
      createdAtLabel: formatDateTimeLabel(blockedSend.created_at),
    })),
    accountStatus: {
      status: clientContext.client.status,
      label: getClientStatusLabel(clientContext.client.status),
      note: "I dati arrivano dagli endpoint client correnti. Le autorizzazioni e i controlli di invio restano nel backend.",
    },
  };
}

export function getAdminOverviewSummary(): Promise<AdminOverviewSummary> {
  if (USE_MOCK_API) {
    return mockApi.getAdminOverviewSummary();
  }

  return Promise.all([fetchAdminClients(), fetchAdminCampaigns()]).then(
    ([clients, campaigns]) => buildAdminOverviewSummary(clients, campaigns),
  );
}

export function getAdminClients(): Promise<Client[]> {
  return USE_MOCK_API
    ? mockApi.getAdminClients()
    : fetchAdminClients();
}

export function getAdminCampaigns(): Promise<Campaign[]> {
  return USE_MOCK_API
    ? mockApi.getAdminCampaigns()
    : fetchAdminCampaigns();
}

export function getClientMe(): Promise<ClientContext> {
  return USE_MOCK_API
    ? mockApi.getClientMe()
    : fetchClientMe();
}

export function getClientOverviewSummary(): Promise<ClientOverviewSummary> {
  if (USE_MOCK_API) {
    return mockApi.getClientOverviewSummary();
  }

  return Promise.all([
    fetchClientMe(),
    fetchClientCampaigns(),
    fetchClientUsage(),
    fetchClientBlockedSends(),
  ]).then(([clientContext, campaigns, usage, blockedSends]) =>
    buildClientOverviewSummary(clientContext, campaigns, usage, blockedSends),
  );
}

export function getClientCampaigns(): Promise<Campaign[]> {
  return USE_MOCK_API
    ? mockApi.getClientCampaigns()
    : fetchClientCampaigns();
}

export function getClientUsage(): Promise<ApiUsage[]> {
  return USE_MOCK_API
    ? mockApi.getClientUsage()
    : fetchClientUsage();
}

export function getClientBlockedSends(): Promise<BlockedSend[]> {
  return USE_MOCK_API
    ? mockApi.getClientBlockedSends()
    : fetchClientBlockedSends();
}
