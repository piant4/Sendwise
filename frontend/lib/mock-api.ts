import type {
  AdminOverviewSummary,
  ApiUsage,
  BlockedSend,
  Campaign,
  Client,
  ClientContext,
  ClientOverviewSummary,
} from "../types";

const CLIENT_ACME = "client_acme";
const CLIENT_NOVA = "client_nova";

// Temporary frontend-only fixtures. UI pages/components should consume these
// through frontend/lib/api.ts so real backend integration can replace them.
const adminOverviewSummary: AdminOverviewSummary = {
  clients: {
    totalClients: 2,
    activeClients: 1,
    invitedOrPendingClients: 1,
    archivedOrBlockedClients: 0,
    statusCounts: {
      trial: 1,
      active: 1,
      paused: 0,
      blocked: 0,
      archived: 0,
    },
  },
  campaigns: {
    totalCampaigns: 3,
    runningCampaigns: 1,
    pausedCampaigns: 0,
    blockedCampaigns: 1,
    statusCounts: {
      active: 1,
      paused: 0,
      blocked: 1,
      draft: 1,
      completed: 0,
      failed: 0,
    },
    recentCampaigns: [
      {
        id: "campaign_nova_launch",
        clientId: CLIENT_NOVA,
        clientName: "Nora Nova",
        clientEmail: "nora@example.test",
        campaignName: "Spring Launch",
        subject: "Anteprima stagione",
        status: "draft",
        createdAt: "2026-05-04T11:00:00Z",
        updatedAt: "2026-05-05T11:00:00Z",
      },
      {
        id: "campaign_acme_welcome",
        clientId: CLIENT_ACME,
        clientName: "Alice Acme",
        clientEmail: "alice@example.test",
        campaignName: "Welcome Series",
        subject: "Welcome to Alice",
        status: "ready",
        createdAt: "2026-05-03T08:00:00Z",
        updatedAt: "2026-05-05T08:00:00Z",
      },
    ],
  },
  sending: {
    emailsSentToday: 24,
    emailsSentThisMonth: 388,
    topClientsByVolume: [
      {
        clientId: CLIENT_ACME,
        clientName: "Alice Acme",
        clientEmail: "alice@example.test",
        emailsSent: 240,
      },
      {
        clientId: CLIENT_NOVA,
        clientName: "Nora Nova",
        clientEmail: "nora@example.test",
        emailsSent: 148,
      },
    ],
  },
  blocks: {
    blockedSendsToday: 1,
    recentCriticalEvents: [
      {
        id: "blocked_admin_001",
        eventType: "blocked_send",
        clientId: CLIENT_ACME,
        clientName: "Alice Acme",
        clientEmail: "alice@example.test",
        campaignId: "campaign_acme_reactivation",
        campaignName: "Reactivation Draft",
        reason: "La campagna e ancora in bozza e non puo essere inviata.",
        decision: "blocked",
        createdAt: "2026-05-05T12:10:00Z",
      },
      {
        id: "blocked_admin_002",
        eventType: "blocked_send",
        clientId: CLIENT_NOVA,
        clientName: "Nora Nova",
        clientEmail: "nora@example.test",
        campaignId: "campaign_nova_launch",
        campaignName: "Spring Launch",
        reason: "Il cliente e ancora in verifica operativa.",
        decision: "blocked",
        createdAt: "2026-05-04T16:40:00Z",
      },
    ],
  },
  limits: {
    clientsNearLimit: [
      {
        clientId: CLIENT_ACME,
        clientName: "Alice Acme",
        clientEmail: "alice@example.test",
        usageRatio: 0.84,
        limitingFactor: "campaign_slots",
        campaignsInUse: 2,
        maxCampaigns: 4,
        maxCampaignsRatio: 0.5,
      },
    ],
    configuredLimitsCount: 2,
    unconfiguredLimitsCount: 0,
  },
  system: {
    apiStatus: "ok",
    dbStatus: "ok",
    emailSendingEnabled: false,
    emailProvider: "mailpit",
    providerModeLabel: "Sending disabled",
    realSendAvailable: false,
    sesLiveValidationStatus: null,
    providerEventsAvailable: false,
    mailpitDevMode: true,
    runtime: {
      emailSendingEnabled: false,
      emailProvider: "mailpit",
      providerModeLabel: "Sending disabled",
      realSendAvailable: false,
      sesLiveValidationStatus: null,
      providerEventsAvailable: false,
      mailpitDevMode: true,
    },
    environment: "development",
    authProviderConfigured: true,
    clerkManagementApiConfigured: false,
    frontendOriginConfigured: true,
    deliveryEngineConfigured: true,
    generatedAt: "2026-05-05T12:15:00Z",
  },
};

const clientOverviewSummary: ClientOverviewSummary = {
  client: {
    id: CLIENT_ACME,
    name: "Alice Acme",
    email: "acme@example.test",
    portalSlug: "mockclientportalslug00000000000001",
    clientStatus: "active",
    accessStatus: "active",
    invitationStatus: "accepted",
  },
  campaigns: {
    totalCampaigns: 2,
    activeCampaigns: 1,
    runningCampaigns: 1,
    statusCounts: {
      draft: 1,
      ready: 0,
      running: 1,
      paused: 0,
      blocked: 0,
      completed: 0,
      failed: 0,
    },
    recentCampaigns: [
      {
        id: "campaign_acme_welcome",
        client_id: CLIENT_ACME,
        name: "Serie benvenuto",
        status: "running",
        subject: "Benvenuto in Sendwise",
        created_at: "2026-05-03T08:00:00Z",
        updated_at: "2026-05-05T09:20:00Z",
      },
      {
        id: "campaign_acme_reactivation",
        client_id: CLIENT_ACME,
        name: "Bozza riattivazione",
        status: "draft",
        subject: "Ti aspettiamo ancora",
        created_at: "2026-05-04T14:00:00Z",
        updated_at: "2026-05-04T14:00:00Z",
      },
    ],
  },
  usage: {
    hasData: true,
    totalRecords: 2,
    currentPeriodStartedAt: "2026-05-01T00:00:00Z",
    currentPeriodTotals: [
      {
        usageType: "api_requests",
        totalQuantity: 42,
      },
      {
        usageType: "dry_run_sends",
        totalQuantity: 3,
      },
    ],
    recentUsage: [
      {
        id: "usage_acme_api",
        client_id: CLIENT_ACME,
        usage_type: "api_requests",
        quantity: 42,
        metadata: { period: "2026-05" },
        created_at: "2026-05-05T12:00:00Z",
      },
      {
        id: "usage_acme_dry_runs",
        client_id: CLIENT_ACME,
        usage_type: "dry_run_sends",
        quantity: 3,
        metadata: { period: "2026-05" },
        created_at: "2026-05-05T12:05:00Z",
      },
    ],
  },
  blockedSends: {
    currentPeriodStartedAt: "2026-05-01T00:00:00Z",
    currentPeriodCount: 1,
    recentBlockedSends: [
      {
        id: "blocked_acme_001",
        client_id: CLIENT_ACME,
        campaign_id: "campaign_acme_reactivation",
        campaign_name: "Bozza riattivazione",
        contact_id: "contact_acme_001",
        reason: "La campagna e ancora in bozza e non puo essere inviata.",
        decision: "blocked",
        created_at: "2026-05-05T12:10:00Z",
      },
    ],
  },
  limits: {
    emailLimitPerCampaign: 1000,
    maxCampaigns: 4,
  },
};

const adminClients: Client[] = [
  {
    id: CLIENT_ACME,
    email: "acme@example.test",
    personal_name: "Alice Acme",
    name: "Alice Acme",
    status: "active",
    monthly_email_limit: 1000,
    daily_email_limit: 100,
    created_at: "2026-05-01T09:00:00Z",
    updated_at: "2026-05-05T09:00:00Z",
  },
  {
    id: CLIENT_NOVA,
    email: "nova@example.test",
    personal_name: "Nora Nova",
    name: "Nora Nova",
    status: "trial",
    monthly_email_limit: 5000,
    daily_email_limit: 400,
    created_at: "2026-05-02T10:30:00Z",
    updated_at: "2026-05-05T10:30:00Z",
  },
];

const adminCampaigns: Campaign[] = [
  {
    id: "campaign_acme_welcome",
    client_id: CLIENT_ACME,
    name: "Welcome Series",
    status: "ready",
    subject: "Welcome to Alice",
    created_at: "2026-05-03T08:00:00Z",
    updated_at: "2026-05-05T08:00:00Z",
  },
  {
    id: "campaign_nova_launch",
    client_id: CLIENT_NOVA,
    name: "Spring Launch",
    status: "draft",
    subject: "Spring preview",
    created_at: "2026-05-04T11:00:00Z",
    updated_at: "2026-05-05T11:00:00Z",
  },
];

const clientContext: ClientContext = {
  client: adminClients[0],
  user: {
    id: "user_acme_manager",
    client_id: CLIENT_ACME,
    email: "manager@example.test",
    portal_slug: "mockclientportalslug00000000000001",
    status: "active",
    created_at: "2026-05-01T09:05:00Z",
    updated_at: "2026-05-05T09:05:00Z",
  },
};

const clientCampaigns: Campaign[] = [
  adminCampaigns[0],
  {
    id: "campaign_acme_reactivation",
    client_id: CLIENT_ACME,
    name: "Reactivation Draft",
    status: "draft",
    subject: "We saved your preferences",
    created_at: "2026-05-04T14:00:00Z",
    updated_at: "2026-05-05T14:00:00Z",
  },
];

const clientUsage: ApiUsage[] = [
  {
    id: "usage_acme_api",
    client_id: CLIENT_ACME,
    usage_type: "api_requests",
    quantity: 42,
    metadata: { period: "2026-05" },
    created_at: "2026-05-05T12:00:00Z",
  },
  {
    id: "usage_acme_dry_runs",
    client_id: CLIENT_ACME,
    usage_type: "dry_run_sends",
    quantity: 3,
    metadata: { period: "2026-05" },
    created_at: "2026-05-05T12:05:00Z",
  },
];

const clientBlockedSends: BlockedSend[] = [
  {
    id: "blocked_acme_001",
    client_id: CLIENT_ACME,
    campaign_id: "campaign_acme_reactivation",
    campaign_name: "Reactivation Draft",
    contact_id: "contact_acme_001",
    reason: "Milestone 0.5 fake blocked send for UI contract testing.",
    decision: "blocked",
    created_at: "2026-05-05T12:10:00Z",
  },
];

export async function getAdminOverviewSummary(): Promise<AdminOverviewSummary> {
  return adminOverviewSummary;
}

export async function getAdminClients(): Promise<Client[]> {
  return adminClients;
}

export async function getAdminCampaigns(): Promise<Campaign[]> {
  return [
    {
      ...adminCampaigns[1],
      subject: "Anteprima stagione",
    },
    adminCampaigns[0],
  ];
}

export async function getClientMe(): Promise<ClientContext> {
  return clientContext;
}

export async function getClientOverviewSummary(): Promise<ClientOverviewSummary> {
  return clientOverviewSummary;
}

export async function getClientCampaigns(): Promise<Campaign[]> {
  return clientCampaigns;
}

export async function getClientUsage(): Promise<ApiUsage[]> {
  return clientUsage;
}

export async function getClientBlockedSends(): Promise<BlockedSend[]> {
  return clientBlockedSends;
}
