import type {
  AdminClientInviteResponse,
  AdminClientUpdateInput,
  AdminClientStatusCounts,
  AdminOverviewSummary,
  AdminRecentCampaign,
  ApiUsage,
  BlockedSend,
  Campaign,
  Client,
  ClientContext,
  ClientOverviewSummary,
  CompleteClientOnboardingInput,
} from "../types";
import * as mockApi from "./mock-api";

// Default to mock mode unless the frontend is explicitly pointed at the backend.
export const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API !== "false";
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ?? "";
const INTERNAL_API_BASE_URL =
  process.env.BACKEND_URL?.trim() || API_BASE_URL;

const DEFAULT_EMPTY_ADMIN_LIMITS = {
  monthlyLimit: 0,
  monthlySent: 0,
  dailyLimit: 0,
  dailySent: 0,
} as const;

const ACTIVE_CAMPAIGN_STATUSES = new Set<Campaign["status"]>(["ready", "running"]);
const ADMIN_ROUTE = "/admin";
const CLIENT_PORTAL_ROUTE_PREFIX = "/c";

export type AuthAccessType = "platform_admin" | "client";
export type AuthUserStatus = "invited" | "active" | "suspended" | "archived";

export interface AuthMeResponse {
  access_type: AuthAccessType;
  client_id: string | null;
  portal_slug: string | null;
  email: string | null;
  status: AuthUserStatus;
  invitation_status:
    | "pending"
    | "accepted"
    | "revoked"
    | "expired"
    | null;
  onboarding_required: boolean;
}

interface ApiErrorOptions {
  path: string;
  detail: string;
  status?: number | null;
  isNetworkError?: boolean;
}

interface ApiRequestOptions<TPayload> {
  method?: "GET" | "POST" | "PATCH";
  payload?: TPayload;
  accessToken?: string | null;
}

export class ApiError extends Error {
  readonly path: string;
  readonly detail: string;
  readonly status: number | null;
  readonly isNetworkError: boolean;

  constructor({
    path,
    detail,
    status = null,
    isNetworkError = false,
  }: ApiErrorOptions) {
    const statusPrefix = typeof status === "number" ? `${status} ` : "";
    super(`API request failed for ${path}: ${statusPrefix}${detail}`.trim());
    this.name = "ApiError";
    this.path = path;
    this.detail = detail;
    this.status = status;
    this.isNetworkError = isNetworkError;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

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
  const candidateApiBaseUrl =
    typeof window === "undefined" ? INTERNAL_API_BASE_URL : API_BASE_URL;

  if (!candidateApiBaseUrl) {
    throw new ApiError({
      path: "config",
      status: 500,
      detail:
        "NEXT_PUBLIC_API_BASE_URL is required in the browser and BACKEND_URL is required for server-side container requests when NEXT_PUBLIC_USE_MOCK_API=false.",
    });
  }

  return candidateApiBaseUrl.replace(/\/$/, "");
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

async function getApiHeaders(
  accessToken?: string | null,
): Promise<HeadersInit> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (USE_MOCK_API) {
    return headers;
  }

  if (!accessToken || !accessToken.trim()) {
    throw new ApiError({
      path: "auth",
      status: 401,
      detail: "Missing Clerk session token for protected backend request.",
    });
  }

  return {
    ...headers,
    Authorization: `Bearer ${accessToken.trim()}`,
  };
}

async function apiRequest<TResponse, TPayload = undefined>(
  path: string,
  options?: ApiRequestOptions<TPayload>,
): Promise<TResponse> {
  const requestUrl = `${getRequiredApiBaseUrl()}${path}`;
  let response: Response;

  try {
    response = await fetch(requestUrl, {
      method: options?.method ?? "GET",
      cache: "no-store",
      headers: await getApiHeaders(options?.accessToken),
      body:
        options?.payload === undefined
          ? undefined
          : JSON.stringify(options.payload),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown network error";
    throw new ApiError({
      path,
      detail: message,
      isNetworkError: true,
    });
  }

  if (!response.ok) {
    const details = await readErrorDetails(response);
    throw new ApiError({
      path,
      status: response.status,
      detail: details,
    });
  }

  try {
    return (await response.json()) as TResponse;
  } catch {
    throw new ApiError({
      path,
      detail: "invalid JSON response",
    });
  }
}

async function apiGet<TResponse>(
  path: string,
  accessToken?: string | null,
): Promise<TResponse> {
  return apiRequest<TResponse>(path, { method: "GET", accessToken });
}

async function apiPost<TResponse, TPayload>(
  path: string,
  payload: TPayload,
  accessToken?: string | null,
): Promise<TResponse> {
  return apiRequest<TResponse, TPayload>(path, {
    method: "POST",
    payload,
    accessToken,
  });
}

async function apiPatch<TResponse, TPayload>(
  path: string,
  payload: TPayload,
  accessToken?: string | null,
): Promise<TResponse> {
  return apiRequest<TResponse, TPayload>(path, {
    method: "PATCH",
    payload,
    accessToken,
  });
}

function assertBackendAuthRoutingEnabled(): void {
  if (!USE_MOCK_API) {
    return;
  }

  throw new ApiError({
    path: "auth-routing",
    status: 500,
    detail:
      "Post-login routing requires NEXT_PUBLIC_USE_MOCK_API=false so the frontend can resolve access through the backend.",
  });
}

async function fetchAdminClients(accessToken?: string | null): Promise<Client[]> {
  return apiGet<Client[]>("/admin/clients", accessToken);
}

async function fetchAdminClient(
  clientId: string,
  accessToken?: string | null,
): Promise<Client> {
  return apiGet<Client>(`/admin/clients/${clientId}`, accessToken);
}

async function fetchAdminCampaigns(accessToken?: string | null): Promise<Campaign[]> {
  return apiGet<Campaign[]>("/admin/campaigns", accessToken);
}

async function fetchClientMe(accessToken?: string | null): Promise<ClientContext> {
  return apiGet<ClientContext>("/client/me", accessToken);
}

async function fetchClientCampaigns(accessToken?: string | null): Promise<Campaign[]> {
  return apiGet<Campaign[]>("/client/campaigns", accessToken);
}

async function fetchClientUsage(accessToken?: string | null): Promise<ApiUsage[]> {
  return apiGet<ApiUsage[]>("/client/usage", accessToken);
}

async function fetchClientBlockedSends(
  accessToken?: string | null,
): Promise<BlockedSend[]> {
  return apiGet<BlockedSend[]>("/client/blocked-sends", accessToken);
}

async function fetchAuthMe(accessToken?: string | null): Promise<AuthMeResponse> {
  assertBackendAuthRoutingEnabled();
  return apiGet<AuthMeResponse>("/auth/me", accessToken);
}

async function postAdminClientInvite(
  email: string,
  accessToken?: string | null,
): Promise<AdminClientInviteResponse> {
  return apiPost<AdminClientInviteResponse, { email: string }>(
    "/admin/clients",
    { email },
    accessToken,
  );
}

async function patchAdminClient(
  clientId: string,
  payload: AdminClientUpdateInput,
  accessToken?: string | null,
): Promise<Client> {
  return apiPatch<Client, AdminClientUpdateInput>(
    `/admin/clients/${clientId}`,
    payload,
    accessToken,
  );
}

async function postAdminClientRevokeAccess(
  clientId: string,
  accessToken?: string | null,
): Promise<Client> {
  return apiPost<Client, Record<string, never>>(
    `/admin/clients/${clientId}/revoke-access`,
    {},
    accessToken,
  );
}

async function postAdminClientArchive(
  clientId: string,
  accessToken?: string | null,
): Promise<Client> {
  return apiPost<Client, Record<string, never>>(
    `/admin/clients/${clientId}/archive`,
    {},
    accessToken,
  );
}

async function postClientOnboarding(
  payload: CompleteClientOnboardingInput,
  accessToken?: string | null,
): Promise<AuthMeResponse> {
  return apiPost<AuthMeResponse, CompleteClientOnboardingInput>(
    "/auth/onboarding",
    payload,
    accessToken,
  );
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
  const clientStatusCounts: AdminClientStatusCounts = {
    trial: 0,
    active: 0,
    paused: 0,
    blocked: 0,
    archived: 0,
  };
  const campaignStatusCounts = {
    active: 0,
    paused: 0,
    blocked: 0,
    draft: 0,
  };
  const clientNames = new Map(clients.map((client) => [client.id, client.name]));

  for (const client of clients) {
    clientStatusCounts[client.status] += 1;
  }

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

  const recentCampaigns: AdminRecentCampaign[] = [...campaigns]
    .sort(
      (left, right) =>
        new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime(),
    )
    .slice(0, 4)
    .map((campaign) => ({
      id: campaign.id,
      clientName: clientNames.get(campaign.client_id) ?? "Cliente non disponibile",
      campaignName: campaign.name,
      subject: campaign.subject,
      status: campaign.status,
      updatedAtLabel: formatDateTimeLabel(campaign.updated_at),
    }));

  return {
    totalClients: clients.length,
    activeCampaigns: campaigns.filter((campaign) =>
      isActiveCampaignStatus(campaign.status),
    ).length,
    blockedSendsToday: 0,
    monthlyAiCallsUsed: 0,
    campaignStatusCounts,
    clientStatusCounts,
    emailLimitOverview: DEFAULT_EMPTY_ADMIN_LIMITS,
    recentCampaigns,
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

export function getAdminOverviewSummary(
  accessToken?: string | null,
): Promise<AdminOverviewSummary> {
  if (USE_MOCK_API) {
    return mockApi.getAdminOverviewSummary();
  }

  return Promise.all([
    fetchAdminClients(accessToken),
    fetchAdminCampaigns(accessToken),
  ]).then(
    ([clients, campaigns]) => buildAdminOverviewSummary(clients, campaigns),
  );
}

export function getAdminClients(accessToken?: string | null): Promise<Client[]> {
  return USE_MOCK_API ? mockApi.getAdminClients() : fetchAdminClients(accessToken);
}

export function createAdminClientInvite(
  email: string,
  accessToken?: string | null,
): Promise<AdminClientInviteResponse> {
  if (USE_MOCK_API) {
    throw new ApiError({
      path: "/admin/clients",
      status: 500,
      detail:
        "Client invitations require NEXT_PUBLIC_USE_MOCK_API=false so the backend can create Clerk invites.",
    });
  }

  return postAdminClientInvite(email, accessToken);
}

export async function getAdminClient(
  clientId: string,
  accessToken?: string | null,
): Promise<Client> {
  if (USE_MOCK_API) {
    const clients = await mockApi.getAdminClients();
    const client = clients.find((item) => item.id === clientId);

    if (!client) {
      throw new ApiError({
        path: `/admin/clients/${clientId}`,
        status: 404,
        detail: "Client not found.",
      });
    }

    return client;
  }

  return fetchAdminClient(clientId, accessToken);
}

export function updateAdminClientLimits(
  clientId: string,
  payload: AdminClientUpdateInput,
  accessToken?: string | null,
): Promise<Client> {
  if (USE_MOCK_API) {
    throw new ApiError({
      path: `/admin/clients/${clientId}`,
      status: 500,
      detail:
        "Client updates require NEXT_PUBLIC_USE_MOCK_API=false so the backend can persist admin changes.",
    });
  }

  return patchAdminClient(clientId, payload, accessToken);
}

export function revokeAdminClientAccess(
  clientId: string,
  accessToken?: string | null,
): Promise<Client> {
  if (USE_MOCK_API) {
    throw new ApiError({
      path: `/admin/clients/${clientId}/revoke-access`,
      status: 500,
      detail:
        "Client access revocation requires NEXT_PUBLIC_USE_MOCK_API=false so the backend can persist the change.",
    });
  }

  return postAdminClientRevokeAccess(clientId, accessToken);
}

export function archiveAdminClient(
  clientId: string,
  accessToken?: string | null,
): Promise<Client> {
  if (USE_MOCK_API) {
    throw new ApiError({
      path: `/admin/clients/${clientId}/archive`,
      status: 500,
      detail:
        "Client archive requires NEXT_PUBLIC_USE_MOCK_API=false so the backend can persist the change.",
    });
  }

  return postAdminClientArchive(clientId, accessToken);
}

export function getAdminCampaigns(
  accessToken?: string | null,
): Promise<Campaign[]> {
  return USE_MOCK_API
    ? mockApi.getAdminCampaigns()
    : fetchAdminCampaigns(accessToken);
}

export function getClientMe(accessToken?: string | null): Promise<ClientContext> {
  return USE_MOCK_API ? mockApi.getClientMe() : fetchClientMe(accessToken);
}

export function getClientOverviewSummary(
  accessToken?: string | null,
): Promise<ClientOverviewSummary> {
  if (USE_MOCK_API) {
    return mockApi.getClientOverviewSummary();
  }

  return Promise.all([
    fetchClientMe(accessToken),
    fetchClientCampaigns(accessToken),
    fetchClientUsage(accessToken),
    fetchClientBlockedSends(accessToken),
  ]).then(([clientContext, campaigns, usage, blockedSends]) =>
    buildClientOverviewSummary(clientContext, campaigns, usage, blockedSends),
  );
}

export function getClientCampaigns(
  accessToken?: string | null,
): Promise<Campaign[]> {
  return USE_MOCK_API
    ? mockApi.getClientCampaigns()
    : fetchClientCampaigns(accessToken);
}

export function getClientUsage(
  accessToken?: string | null,
): Promise<ApiUsage[]> {
  return USE_MOCK_API
    ? mockApi.getClientUsage()
    : fetchClientUsage(accessToken);
}

export function getClientBlockedSends(
  accessToken?: string | null,
): Promise<BlockedSend[]> {
  return USE_MOCK_API
    ? mockApi.getClientBlockedSends()
    : fetchClientBlockedSends(accessToken);
}

export async function getPostLoginRedirectPath(
  accessToken?: string | null,
): Promise<string> {
  const authMe = await fetchAuthMe(accessToken);

  if (authMe.access_type === "platform_admin") {
    return ADMIN_ROUTE;
  }

  if (authMe.status === "invited" || authMe.onboarding_required) {
    return "/onboarding";
  }

  if (!authMe.portal_slug) {
    throw new ApiError({
      path: "/auth/me",
      status: 403,
      detail: "Authenticated client is missing a portal slug.",
    });
  }

  return `${CLIENT_PORTAL_ROUTE_PREFIX}/${authMe.portal_slug}`;
}

export function getAuthMe(accessToken?: string | null): Promise<AuthMeResponse> {
  return fetchAuthMe(accessToken);
}

export function completeClientOnboarding(
  payload: CompleteClientOnboardingInput,
  accessToken?: string | null,
): Promise<AuthMeResponse> {
  return postClientOnboarding(payload, accessToken);
}
