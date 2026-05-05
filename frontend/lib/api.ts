import type {
  ApiUsage,
  BlockedSend,
  Campaign,
  Client,
  ClientContext,
} from "../types";
import * as mockApi from "./mock-api";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export const USE_MOCK_API = process.env.NEXT_PUBLIC_USE_MOCK_API === "true";

async function apiGet<T>(path: string): Promise<T> {
  const baseUrl = API_BASE_URL.replace(/\/$/, "");
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getAdminClients(): Promise<Client[]> {
  return USE_MOCK_API
    ? mockApi.getAdminClients()
    : apiGet<Client[]>("/admin/clients");
}

export function getAdminCampaigns(): Promise<Campaign[]> {
  return USE_MOCK_API
    ? mockApi.getAdminCampaigns()
    : apiGet<Campaign[]>("/admin/campaigns");
}

export function getClientMe(): Promise<ClientContext> {
  return USE_MOCK_API
    ? mockApi.getClientMe()
    : apiGet<ClientContext>("/client/me");
}

export function getClientCampaigns(): Promise<Campaign[]> {
  return USE_MOCK_API
    ? mockApi.getClientCampaigns()
    : apiGet<Campaign[]>("/client/campaigns");
}

export function getClientUsage(): Promise<ApiUsage[]> {
  return USE_MOCK_API
    ? mockApi.getClientUsage()
    : apiGet<ApiUsage[]>("/client/usage");
}

export function getClientBlockedSends(): Promise<BlockedSend[]> {
  return USE_MOCK_API
    ? mockApi.getClientBlockedSends()
    : apiGet<BlockedSend[]>("/client/blocked-sends");
}
