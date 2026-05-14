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
  email: string;
  personal_name?: string | null;
  name: string;
  status: ClientStatus;
  email_limit_per_campaign?: number | null;
  max_campaigns?: number | null;
  monthly_email_limit?: number | null;
  daily_email_limit?: number | null;
  created_at: string;
  updated_at: string;
  access?: ClientAccessSummary | null;
}

export interface ClientUser {
  id: string;
  client_id: string;
  email: string;
  portal_slug: string;
  status: "invited" | "active" | "suspended" | "archived";
  created_at: string;
  updated_at: string;
}

export interface ClientContext {
  client: Client;
  user: ClientUser;
}

export interface ClientAccessSummary {
  id: string;
  client_id: string;
  email: string;
  clerk_user_id?: string | null;
  clerk_invitation_id?: string | null;
  portal_slug: string;
  status: "invited" | "active" | "suspended" | "archived";
  invitation_status?: "pending" | "accepted" | "revoked" | "expired" | null;
  invited_at?: string | null;
  accepted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminClientInviteInput {
  email: string;
}

export interface AdminClientInviteResponse {
  client: Client;
  access: ClientAccessSummary;
}

export interface AdminClientUpdateInput {
  personal_name?: string | null;
  email_limit_per_campaign?: number | null;
  max_campaigns?: number | null;
  monthly_email_limit?: number | null;
  daily_email_limit?: number | null;
}

export interface CompleteClientOnboardingInput {
  personal_name: string;
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
  subject?: string | null;
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
  campaign_name?: string | null;
  contact_id?: string | null;
  reason: string;
  decision: SendDecision;
  created_at: string;
}

export interface AdminCampaignStatusCounts {
  active: number;
  paused: number;
  blocked: number;
  draft: number;
  completed: number;
  failed: number;
}

export interface AdminClientStatusCounts {
  trial: number;
  active: number;
  paused: number;
  blocked: number;
  archived: number;
}

export interface AdminRecentCampaign {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  campaignName: string;
  subject?: string | null;
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCriticalEvent {
  id: string;
  eventType: "blocked_send";
  clientId: string;
  clientName: string;
  clientEmail: string;
  campaignName?: string | null;
  campaignId?: string | null;
  reason: string;
  decision: SendDecision;
  createdAt: string;
}

export interface AdminBlockedSendItem {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  campaignName?: string | null;
  campaignId?: string | null;
  reason: string;
  decision: SendDecision;
  createdAt: string;
}

export interface AdminSystemStatus {
  apiStatus: "ok";
  dbStatus: "ok" | "degraded";
  emailSendingEnabled: boolean;
  emailProvider: string;
  providerModeLabel: string;
  realSendAvailable: boolean;
  sesLiveValidationStatus?: "pending" | null;
  providerEventsAvailable: boolean;
  mailpitDevMode: boolean;
  runtime: ProviderRuntimeSummary;
  environment: string;
  authProviderConfigured: boolean;
  clerkManagementApiConfigured: boolean;
  frontendOriginConfigured: boolean;
  deliveryEngineConfigured: boolean;
  generatedAt: string;
}

export interface AdminOverviewClientsSummary {
  totalClients: number;
  activeClients: number;
  invitedOrPendingClients: number;
  archivedOrBlockedClients: number;
  statusCounts: AdminClientStatusCounts;
}

export interface AdminOverviewCampaignsSummary {
  totalCampaigns: number;
  runningCampaigns: number;
  pausedCampaigns: number;
  blockedCampaigns: number;
  statusCounts: AdminCampaignStatusCounts;
  recentCampaigns: AdminRecentCampaign[];
}

export interface AdminTopClientByVolume {
  clientId: string;
  clientName: string;
  clientEmail: string;
  emailsSent: number;
}

export interface AdminOverviewSendingSummary {
  emailsSentToday: number;
  emailsSentThisMonth: number;
  topClientsByVolume: AdminTopClientByVolume[];
}

export interface AdminOverviewBlocksSummary {
  blockedSendsToday: number;
  recentCriticalEvents: AdminCriticalEvent[];
}

export interface AdminClientNearLimit {
  clientId: string;
  clientName: string;
  clientEmail: string;
  usageRatio: number;
  limitingFactor: "campaign_slots" | "email_limit_per_campaign" | "both";
  campaignsInUse: number;
  maxCampaigns?: number | null;
  highestUsageCampaignId?: string | null;
  highestUsageCampaignName?: string | null;
  highestUsageCampaignVolume: number;
  emailLimitPerCampaign?: number | null;
  maxCampaignsRatio?: number | null;
  emailLimitRatio?: number | null;
}

export interface AdminOverviewLimitsSummary {
  clientsNearLimit: AdminClientNearLimit[];
  configuredLimitsCount: number;
  unconfiguredLimitsCount: number;
}

export interface AdminOverviewSummary {
  clients: AdminOverviewClientsSummary;
  campaigns: AdminOverviewCampaignsSummary;
  sending: AdminOverviewSendingSummary;
  blocks: AdminOverviewBlocksSummary;
  limits: AdminOverviewLimitsSummary;
  system: AdminSystemStatus;
}

export interface AdminCampaignSummary {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  name: string;
  status: CampaignStatus;
  subject?: string | null;
  createdAt: string;
  updatedAt: string;
  blockedSendsCount: number;
}

export interface AdminCampaignCreateInput {
  clientId: string;
  name: string;
  subject: string;
}

export interface AdminCampaignUpdateInput {
  name?: string;
  subject?: string | null;
}

export interface AdminCampaignContentInput {
  subject?: string | null;
  previewText?: string | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
}

export interface AdminCampaignContact {
  contactId: string;
  email: string;
  status: ContactStatus | string;
  isValid: boolean;
  isEligible: boolean;
  blockedReasons: string[];
}

export interface AdminCampaignContactsSummary {
  campaignId: string;
  clientId: string;
  total: number;
  valid: number;
  invalid: number;
  suppressed: number;
  unsubscribed: number;
  blacklisted: number;
  bounced: number;
  eligible: number;
  blocked: number;
  contactsReady: boolean;
  contacts: AdminCampaignContact[];
}

export interface AdminCampaignContactsInput {
  emails: string[];
}

export interface AdminCampaignContactsImportResult {
  campaignId: string;
  clientId: string;
  received: number;
  createdContacts: number;
  reusedContacts: number;
  attachedContacts: number;
  duplicateContacts: number;
  invalidContacts: number;
  contactsReady: boolean;
  errors: {
    email: string;
    reason: string;
  }[];
}

export interface AdminCampaignDetail {
  campaignId: string;
  clientId: string;
  clientName: string;
  clientStatus: string;
  name: string;
  status: CampaignStatus;
  subject?: string | null;
  previewText?: string | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
  currentStep: string;
  campaignSlotId?: string | null;
  contentReady: boolean;
  contactsReady: boolean;
  reviewReady: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignSummaryItem {
  id: string;
  clientId: string;
  name: string;
  status: CampaignStatus;
  subject?: string | null;
  previewText?: string | null;
  currentStep: string;
  contentReady: boolean;
  contactsReady: boolean;
  reviewReady: boolean;
}

export interface CampaignClientSummary {
  id: string;
  email: string;
  personalName?: string | null;
  status: string;
}

export interface CampaignSlotSummary {
  id?: string | null;
  label?: string | null;
  maxEmails?: number | null;
  status?: string | null;
  limitSource?: string | null;
}

export interface CampaignRecipientsSummary {
  total: number;
  eligible: number;
  invalid: number;
  suppressed: number;
  blocked: number;
}

export interface CampaignLogsSummary {
  simulated: number;
  queued: number;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  providerEventsAvailable: boolean;
}

export interface ProviderRuntimeSummary {
  emailSendingEnabled: boolean;
  emailProvider: string;
  providerModeLabel: string;
  realSendAvailable: boolean;
  sesLiveValidationStatus?: "pending" | null;
  providerEventsAvailable: boolean;
  mailpitDevMode: boolean;
}

export interface CampaignBlockedSendsSummary {
  total: number;
  latest: BlockedSend[];
}

export interface CampaignReadModel {
  campaign: CampaignSummaryItem;
  slot: CampaignSlotSummary;
  recipients: CampaignRecipientsSummary;
  logs: CampaignLogsSummary;
  runtime: ProviderRuntimeSummary;
  blockedSends: CampaignBlockedSendsSummary;
}

export interface AdminCampaignReadinessSummary extends CampaignReadModel {
  client: CampaignClientSummary;
  canSend: boolean;
  blockingErrors: string[];
  warnings: string[];
}

export interface ClientCampaignStatsReadModel {
  campaignId: string;
  clientId: string;
  recipients: CampaignRecipientsSummary;
  logs: CampaignLogsSummary;
  blockedSends: CampaignBlockedSendsSummary;
}

export interface AdminEmailLimitRow {
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientStatus: ClientStatus;
  accessStatus?: ClientAccessSummary["status"] | null;
  invitationStatus?: ClientAccessSummary["invitation_status"] | null;
  emailLimitPerCampaign?: number | null;
  maxCampaigns?: number | null;
  updatedAt: string;
}

export interface AdminEmailLimitsSummary {
  totalClients: number;
  configuredClients: number;
  unconfiguredClients: number;
}

export interface AdminEmailLimitsResponse {
  summary: AdminEmailLimitsSummary;
  rows: AdminEmailLimitRow[];
}

export interface ClientOverviewSummary {
  client: ClientOverviewIdentity;
  campaigns: ClientOverviewCampaigns;
  usage: ClientOverviewUsage;
  blockedSends: ClientOverviewBlockedSends;
  limits: ClientOverviewLimits;
}

export interface ClientOverviewIdentity {
  id: string;
  name: string;
  email: string;
  portalSlug: string;
  clientStatus: ClientStatus;
  accessStatus: ClientAccessSummary["status"];
  invitationStatus?: ClientAccessSummary["invitation_status"] | null;
}

export interface ClientCampaignStatusCounts {
  draft: number;
  ready: number;
  running: number;
  paused: number;
  blocked: number;
  completed: number;
  failed: number;
}

export interface ClientOverviewCampaigns {
  totalCampaigns: number;
  activeCampaigns: number;
  runningCampaigns: number;
  statusCounts: ClientCampaignStatusCounts;
  recentCampaigns: Campaign[];
}

export interface ClientUsageSummaryItem {
  usageType: string;
  totalQuantity: number;
}

export interface ClientOverviewUsage {
  hasData: boolean;
  totalRecords: number;
  currentPeriodStartedAt: string;
  currentPeriodTotals: ClientUsageSummaryItem[];
  recentUsage: ApiUsage[];
}

export interface ClientOverviewBlockedSends {
  currentPeriodStartedAt: string;
  currentPeriodCount: number;
  recentBlockedSends: BlockedSend[];
}

export interface ClientOverviewLimits {
  emailLimitPerCampaign?: number | null;
  maxCampaigns?: number | null;
}
