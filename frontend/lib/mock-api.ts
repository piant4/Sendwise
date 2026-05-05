import type { ApiUsage, Campaign, Client } from "../types";

export function getMockAdminClients(): Client[] {
  return [
    {
      id: "client_demo",
      name: "Demo Client",
      status: "trial",
      createdAt: "2026-05-05T00:00:00Z",
    },
  ];
}

export function getMockAdminCampaigns(): Campaign[] {
  return [
    {
      id: "campaign_demo",
      clientId: "client_demo",
      name: "Skeleton Campaign",
      status: "draft",
      subject: "Placeholder only",
      createdAt: "2026-05-05T00:00:00Z",
    },
  ];
}

export function getMockClientCampaigns(): Campaign[] {
  return getMockAdminCampaigns();
}

export function getMockClientUsage(): ApiUsage {
  return {
    id: "usage_demo",
    clientId: "client_demo",
    usageType: "ai_tokens",
    quantity: 0,
    createdAt: "2026-05-05T00:00:00Z",
  };
}
