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
  totalClients: 2,
  activeCampaigns: 1,
  blockedSendsToday: 1,
  monthlyAiCallsUsed: 42,
  campaignStatusCounts: {
    active: 1,
    paused: 0,
    blocked: 1,
    draft: 1,
  },
  clientStatusCounts: {
    trial: 1,
    active: 1,
    paused: 0,
    blocked: 0,
    archived: 0,
  },
  emailLimitOverview: {
    monthlyLimit: 5000,
    monthlySent: 1420,
    dailyLimit: 400,
    dailySent: 86,
  },
  recentCampaigns: [
    {
      id: "campaign_nova_launch",
      clientName: "Nora Nova",
      campaignName: "Spring Launch",
      subject: "Anteprima stagione",
      status: "draft",
      updatedAtLabel: "05/05/26, 13:00",
    },
    {
      id: "campaign_acme_welcome",
      clientName: "Alice Acme",
      campaignName: "Welcome Series",
      subject: "Welcome to Alice",
      status: "ready",
      updatedAtLabel: "05/05/26, 10:00",
    },
  ],
  recentBlockedSends: [
    {
      id: "blocked_admin_001",
      clientName: "Alice Acme",
      campaignName: "Reactivation Draft",
      reason: "La campagna e ancora in bozza e non puo essere inviata.",
      createdAtLabel: "Oggi, 12:10",
    },
    {
      id: "blocked_admin_002",
      clientName: "Nora Nova",
      campaignName: "Spring Launch",
      reason: "Il cliente e ancora in verifica operativa.",
      createdAtLabel: "Ieri, 16:40",
    },
  ],
  systemStatus: {
    api: "ok",
    mockData: "enabled",
    sending: "disabled",
    mailpit: "dev_only",
  },
};

const clientOverviewSummary: ClientOverviewSummary = {
  activeCampaigns: 1,
  monthlyEmailLimit: 1000,
  monthlyEmailsSent: 120,
  blockedSendsThisMonth: 1,
  campaignSummaries: [
    {
      id: "campaign_acme_welcome",
      name: "Serie benvenuto",
      status: "running",
      sent: 120,
      limit: 400,
      lastActivityLabel: "Oggi, 09:20",
    },
    {
      id: "campaign_acme_reactivation",
      name: "Bozza riattivazione",
      status: "draft",
      sent: 0,
      limit: 250,
      lastActivityLabel: "Ieri, 14:00",
    },
    {
      id: "campaign_acme_warmup",
      name: "Controllo warmup dominio",
      status: "blocked",
      sent: 0,
      limit: 100,
      lastActivityLabel: "Ieri, 12:10",
    },
  ],
  limitOverview: {
    monthlyEmailLimit: 1000,
    monthlyEmailsSent: 120,
  },
  deliveryOverview: {
    sent: 120,
    opened: 74,
    spam: 3,
    bounced: 5,
    blocked: 1,
  },
  readableBlockedSends: [
    {
      id: "blocked_acme_001",
      campaignName: "Bozza riattivazione",
      reason: "campaign_draft",
      readableReason:
        "La campagna e ancora in bozza e non puo essere valutata per l'invio.",
      createdAtLabel: "Ieri, 12:10",
    },
  ],
  accountStatus: {
    status: "active",
    label: "Account attivo",
    note: "I dati mock mostrano l'account come attivo. L'autorizzazione di invio resta controllata dal backend.",
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
