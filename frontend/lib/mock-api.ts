import type {
  ApiUsage,
  BlockedSend,
  Campaign,
  Client,
  ClientContext,
} from "../types";

const CLIENT_ACME = "client_acme";
const CLIENT_NOVA = "client_nova";

const adminClients: Client[] = [
  {
    id: CLIENT_ACME,
    name: "Acme Studio",
    status: "active",
    created_at: "2026-05-01T09:00:00Z",
    updated_at: "2026-05-05T09:00:00Z",
  },
  {
    id: CLIENT_NOVA,
    name: "Nova Retail",
    status: "trial",
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
    subject: "Welcome to Acme Studio",
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
    role: "client_manager",
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

export async function getAdminClients(): Promise<Client[]> {
  return adminClients;
}

export async function getAdminCampaigns(): Promise<Campaign[]> {
  return adminCampaigns;
}

export async function getClientMe(): Promise<ClientContext> {
  return clientContext;
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
