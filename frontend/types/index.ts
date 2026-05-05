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
  createdAt: string;
}

export interface ClientUser {
  id: string;
  clientId: string;
  email: string;
  role: "admin" | "client_user";
}

export interface Campaign {
  id: string;
  clientId: string;
  name: string;
  status: CampaignStatus;
  subject: string;
  createdAt: string;
}

export interface Contact {
  id: string;
  clientId: string;
  email: string;
  status: ContactStatus;
}

export interface BlockedSend {
  id: string;
  clientId: string;
  campaignId?: string;
  contactId?: string;
  decision: SendDecision;
  reason: string;
  createdAt: string;
}

export interface ApiUsage {
  id: string;
  clientId: string;
  usageType: string;
  quantity: number;
  createdAt: string;
}
