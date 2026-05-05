export type ClientStatus = "trial" | "active" | "paused" | "blocked" | "archived";

export type CampaignStatus =
  | "draft"
  | "ready"
  | "running"
  | "paused"
  | "blocked"
  | "completed"
  | "failed";

export type ContactStatus =
  | "pending"
  | "sendable"
  | "suppressed"
  | "bounced"
  | "unsubscribed"
  | "blacklisted"
  | "error";

export type SendDecision = "authorized" | "blocked" | "dry_run";

export interface Client {
  id: string;
  name: string;
  status: ClientStatus;
  created_at: string;
  updated_at: string;
}

export interface ClientUser {
  id: string;
  client_id: string;
  email: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface ClientContext {
  client: Client;
  user: ClientUser;
}

export interface CampaignStats {
  campaign_id: string;
  client_id: string;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
}

export interface Campaign {
  id: string;
  client_id: string;
  name: string;
  status: CampaignStatus;
  subject: string;
  stats?: CampaignStats | null;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  client_id: string;
  email: string;
  status: ContactStatus;
  created_at: string;
  updated_at: string;
}

export interface ApiUsage {
  id: string;
  client_id: string;
  usage_type: string;
  quantity: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface BlockedSend {
  id: string;
  client_id: string;
  campaign_id?: string | null;
  contact_id?: string | null;
  reason: string;
  decision: SendDecision;
  created_at: string;
}

export interface AdminOverviewSummary {
  totalClients: number;
  activeCampaigns: number;
  blockedSendsToday: number;
  monthlyAiCallsUsed: number;
}

export interface ClientOverviewSummary {
  activeCampaigns: number;
  monthlyEmailLimit: number;
  monthlyEmailsSent: number;
  blockedSendsThisMonth: number;
}
