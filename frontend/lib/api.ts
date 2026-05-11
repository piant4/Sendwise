import type {
  AdminBlockedSendItem,
  AdminCampaignSummary,
  AdminClientInviteResponse,
  AdminClientUpdateInput,
  AdminEmailLimitsResponse,
  AdminOverviewSummary,
  AdminSystemStatus,
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

export interface DeleteAccountResponse {
  deleted: boolean;
  redirect_to: string;
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

interface AdminCampaignApiItem {
  id: string;
  client_id: string;
  client_name: string;
  client_email: string;
  name: string;
  status: Campaign["status"];
  subject?: string | null;
  created_at: string;
  updated_at: string;
  blocked_sends_count: number;
}

interface AdminBlockedSendApiItem {
  id: string;
  client_id: string;
  client_name: string;
  client_email: string;
  campaign_id?: string | null;
  campaign_name?: string | null;
  reason: string;
  decision: BlockedSend["decision"];
  created_at: string;
}

interface AdminOverviewApiResponse {
  clients: {
    total_clients: number;
    active_clients: number;
    invited_or_pending_clients: number;
    archived_or_blocked_clients: number;
    status_counts: {
      trial: number;
      active: number;
      paused: number;
      blocked: number;
      archived: number;
    };
  };
  campaigns: {
    total_campaigns: number;
    running_campaigns: number;
    paused_campaigns: number;
    blocked_campaigns: number;
    status_counts: {
      active: number;
      paused: number;
      blocked: number;
      draft: number;
      completed: number;
      failed: number;
    };
    recent_campaigns: {
      id: string;
      client_id: string;
      client_name: string;
      client_email: string;
      campaign_name: string;
      subject?: string | null;
      status: Campaign["status"];
      created_at: string;
      updated_at: string;
    }[];
  };
  sending: {
    emails_sent_today: number;
    emails_sent_this_month: number;
    top_clients_by_volume: {
      client_id: string;
      client_name: string;
      client_email: string;
      emails_sent: number;
    }[];
  };
  blocks: {
    blocked_sends_today: number;
    recent_critical_events: {
      id: string;
      event_type: "blocked_send";
      client_id: string;
      client_name: string;
      client_email: string;
      campaign_id?: string | null;
      campaign_name?: string | null;
      reason: string;
      decision: BlockedSend["decision"];
      created_at: string;
    }[];
  };
  limits: {
    clients_near_limit: {
      client_id: string;
      client_name: string;
      client_email: string;
      usage_ratio: number;
      limiting_factor: "campaign_slots" | "email_limit_per_campaign" | "both";
      campaigns_in_use: number;
      max_campaigns?: number | null;
      highest_usage_campaign_id?: string | null;
      highest_usage_campaign_name?: string | null;
      highest_usage_campaign_volume: number;
      email_limit_per_campaign?: number | null;
      max_campaigns_ratio?: number | null;
      email_limit_ratio?: number | null;
    }[];
    configured_limits_count: number;
    unconfigured_limits_count: number;
  };
  system: {
    api_status: "ok";
    db_status: "ok" | "degraded";
    email_sending_enabled: boolean;
    environment: string;
    auth_provider_configured: boolean;
    clerk_management_api_configured: boolean;
    frontend_origin_configured: boolean;
    delivery_engine_configured: boolean;
    generated_at: string;
  };
}

interface AdminEmailLimitsApiResponse {
  summary: {
    total_clients: number;
    configured_clients: number;
    unconfigured_clients: number;
  };
  rows: {
    client_id: string;
    client_name: string;
    client_email: string;
    client_status: Client["status"];
    access_status?: Client["access"] extends infer T
      ? T extends { status?: infer Status }
        ? Status
        : never
      : never;
    invitation_status?: Client["access"] extends infer T
      ? T extends { invitation_status?: infer InvitationStatus }
        ? InvitationStatus
        : never
      : never;
    email_limit_per_campaign?: number | null;
    max_campaigns?: number | null;
    updated_at: string;
  }[];
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

async function fetchAdminOverview(
  accessToken?: string | null,
): Promise<AdminOverviewApiResponse> {
  return apiGet<AdminOverviewApiResponse>("/admin/overview", accessToken);
}

async function fetchAdminCampaigns(
  accessToken?: string | null,
): Promise<AdminCampaignApiItem[]> {
  return apiGet<AdminCampaignApiItem[]>("/admin/campaigns", accessToken);
}

async function fetchAdminBlockedSends(
  accessToken?: string | null,
): Promise<AdminBlockedSendApiItem[]> {
  return apiGet<AdminBlockedSendApiItem[]>("/admin/blocked-sends", accessToken);
}

async function fetchAdminEmailLimits(
  accessToken?: string | null,
): Promise<AdminEmailLimitsApiResponse> {
  return apiGet<AdminEmailLimitsApiResponse>("/admin/email-limits", accessToken);
}

async function fetchAdminSystemStatus(
  accessToken?: string | null,
): Promise<AdminOverviewApiResponse["system"]> {
  return apiGet<AdminOverviewApiResponse["system"]>("/admin/system", accessToken);
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

async function postDeleteCurrentAccount(
  confirmationText: string,
  accessToken?: string | null,
): Promise<DeleteAccountResponse> {
  return apiPost<DeleteAccountResponse, { confirmation_text: string }>(
    "/auth/delete-account",
    { confirmation_text: confirmationText },
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

function assertAdminBackendEnabled(path: string): void {
  if (!USE_MOCK_API) {
    return;
  }

  throw new ApiError({
    path,
    status: 500,
    detail:
      "Admin overview pages require NEXT_PUBLIC_USE_MOCK_API=false so the backend remains the source of truth.",
  });
}

function mapAdminOverviewSummary(
  payload: AdminOverviewApiResponse,
): AdminOverviewSummary {
  return {
    clients: {
      totalClients: payload.clients.total_clients,
      activeClients: payload.clients.active_clients,
      invitedOrPendingClients: payload.clients.invited_or_pending_clients,
      archivedOrBlockedClients: payload.clients.archived_or_blocked_clients,
      statusCounts: {
        trial: payload.clients.status_counts.trial,
        active: payload.clients.status_counts.active,
        paused: payload.clients.status_counts.paused,
        blocked: payload.clients.status_counts.blocked,
        archived: payload.clients.status_counts.archived,
      },
    },
    campaigns: {
      totalCampaigns: payload.campaigns.total_campaigns,
      runningCampaigns: payload.campaigns.running_campaigns,
      pausedCampaigns: payload.campaigns.paused_campaigns,
      blockedCampaigns: payload.campaigns.blocked_campaigns,
      statusCounts: {
        active: payload.campaigns.status_counts.active,
        paused: payload.campaigns.status_counts.paused,
        blocked: payload.campaigns.status_counts.blocked,
        draft: payload.campaigns.status_counts.draft,
        completed: payload.campaigns.status_counts.completed,
        failed: payload.campaigns.status_counts.failed,
      },
      recentCampaigns: payload.campaigns.recent_campaigns.map((campaign) => ({
        id: campaign.id,
        clientId: campaign.client_id,
        clientName: campaign.client_name,
        clientEmail: campaign.client_email,
        campaignName: campaign.campaign_name,
        subject: campaign.subject ?? null,
        status: campaign.status,
        createdAt: campaign.created_at,
        updatedAt: campaign.updated_at,
      })),
    },
    sending: {
      emailsSentToday: payload.sending.emails_sent_today,
      emailsSentThisMonth: payload.sending.emails_sent_this_month,
      topClientsByVolume: payload.sending.top_clients_by_volume.map((client) => ({
        clientId: client.client_id,
        clientName: client.client_name,
        clientEmail: client.client_email,
        emailsSent: client.emails_sent,
      })),
    },
    blocks: {
      blockedSendsToday: payload.blocks.blocked_sends_today,
      recentCriticalEvents: payload.blocks.recent_critical_events.map((event) => ({
        id: event.id,
        eventType: event.event_type,
        clientId: event.client_id,
        clientName: event.client_name,
        clientEmail: event.client_email,
        campaignId: event.campaign_id ?? null,
        campaignName: event.campaign_name ?? null,
        reason: event.reason,
        decision: event.decision,
        createdAt: event.created_at,
      })),
    },
    limits: {
      clientsNearLimit: payload.limits.clients_near_limit.map((client) => ({
        clientId: client.client_id,
        clientName: client.client_name,
        clientEmail: client.client_email,
        usageRatio: client.usage_ratio,
        limitingFactor: client.limiting_factor,
        campaignsInUse: client.campaigns_in_use,
        maxCampaigns: client.max_campaigns ?? null,
        highestUsageCampaignId: client.highest_usage_campaign_id ?? null,
        highestUsageCampaignName: client.highest_usage_campaign_name ?? null,
        highestUsageCampaignVolume: client.highest_usage_campaign_volume,
        emailLimitPerCampaign: client.email_limit_per_campaign ?? null,
        maxCampaignsRatio: client.max_campaigns_ratio ?? null,
        emailLimitRatio: client.email_limit_ratio ?? null,
      })),
      configuredLimitsCount: payload.limits.configured_limits_count,
      unconfiguredLimitsCount: payload.limits.unconfigured_limits_count,
    },
    system: {
      apiStatus: payload.system.api_status,
      dbStatus: payload.system.db_status,
      emailSendingEnabled: payload.system.email_sending_enabled,
      environment: payload.system.environment,
      authProviderConfigured: payload.system.auth_provider_configured,
      clerkManagementApiConfigured: payload.system.clerk_management_api_configured,
      frontendOriginConfigured: payload.system.frontend_origin_configured,
      deliveryEngineConfigured: payload.system.delivery_engine_configured,
      generatedAt: payload.system.generated_at,
    },
  };
}

function mapAdminBlockedSendItem(
  payload: AdminBlockedSendApiItem,
): AdminBlockedSendItem {
  return {
    id: payload.id,
    clientId: payload.client_id,
    clientName: payload.client_name,
    clientEmail: payload.client_email,
    campaignId: payload.campaign_id ?? null,
    campaignName: payload.campaign_name ?? null,
    reason: payload.reason,
    decision: payload.decision,
    createdAt: payload.created_at,
  };
}

function mapAdminCampaignSummary(
  payload: AdminCampaignApiItem,
): AdminCampaignSummary {
  return {
    id: payload.id,
    clientId: payload.client_id,
    clientName: payload.client_name,
    clientEmail: payload.client_email,
    name: payload.name,
    status: payload.status,
    subject: payload.subject ?? null,
    createdAt: payload.created_at,
    updatedAt: payload.updated_at,
    blockedSendsCount: payload.blocked_sends_count,
  };
}

function mapAdminEmailLimitsResponse(
  payload: AdminEmailLimitsApiResponse,
): AdminEmailLimitsResponse {
  return {
    summary: {
      totalClients: payload.summary.total_clients,
      configuredClients: payload.summary.configured_clients,
      unconfiguredClients: payload.summary.unconfigured_clients,
    },
    rows: payload.rows.map((row) => ({
      clientId: row.client_id,
      clientName: row.client_name,
      clientEmail: row.client_email,
      clientStatus: row.client_status,
      accessStatus: row.access_status ?? null,
      invitationStatus: row.invitation_status ?? null,
      emailLimitPerCampaign: row.email_limit_per_campaign ?? null,
      maxCampaigns: row.max_campaigns ?? null,
      updatedAt: row.updated_at,
    })),
  };
}

function mapAdminSystemStatus(
  payload: AdminOverviewApiResponse["system"],
): AdminSystemStatus {
  return {
    apiStatus: payload.api_status,
    dbStatus: payload.db_status,
    emailSendingEnabled: payload.email_sending_enabled,
    environment: payload.environment,
    authProviderConfigured: payload.auth_provider_configured,
    clerkManagementApiConfigured: payload.clerk_management_api_configured,
    frontendOriginConfigured: payload.frontend_origin_configured,
    deliveryEngineConfigured: payload.delivery_engine_configured,
    generatedAt: payload.generated_at,
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
  assertAdminBackendEnabled("/admin/overview");
  return fetchAdminOverview(accessToken).then(mapAdminOverviewSummary);
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
): Promise<AdminCampaignSummary[]> {
  assertAdminBackendEnabled("/admin/campaigns");
  return fetchAdminCampaigns(accessToken).then((campaigns) =>
    campaigns.map(mapAdminCampaignSummary),
  );
}

export function getAdminBlockedSends(
  accessToken?: string | null,
): Promise<AdminBlockedSendItem[]> {
  assertAdminBackendEnabled("/admin/blocked-sends");
  return fetchAdminBlockedSends(accessToken).then((items) =>
    items.map(mapAdminBlockedSendItem),
  );
}

export function getAdminEmailLimits(
  accessToken?: string | null,
): Promise<AdminEmailLimitsResponse> {
  assertAdminBackendEnabled("/admin/email-limits");
  return fetchAdminEmailLimits(accessToken).then(mapAdminEmailLimitsResponse);
}

export function getAdminSystemStatus(
  accessToken?: string | null,
): Promise<AdminSystemStatus> {
  assertAdminBackendEnabled("/admin/system");
  return fetchAdminSystemStatus(accessToken).then(mapAdminSystemStatus);
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

export function deleteCurrentAccount(
  confirmationText: string,
  accessToken?: string | null,
): Promise<DeleteAccountResponse> {
  return postDeleteCurrentAccount(confirmationText, accessToken);
}
