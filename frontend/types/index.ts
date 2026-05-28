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
export type PublicUnsubscribeStatus =
  | "unsubscribed"
  | "already_unsubscribed"
  | "invalid"
  | "unavailable";

export interface ClientEmailBrand {
  company_name?: string | null;
  sender_name?: string | null;
  website_url?: string | null;
  linkedin_url?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  x_url?: string | null;
  logo_url?: string | null;
}

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
  email_brand?: ClientEmailBrand | null;
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

export interface InviteActivationContext {
  first_name: string | null;
  last_name: string | null;
}

export interface ClientAccessSummary {
  id: string;
  client_id: string;
  email: string;
  clerk_user_id?: string | null;
  clerk_invitation_id?: string | null;
  portal_slug?: string | null;
  status: "invited" | "active" | "suspended" | "archived";
  invitation_status?: "pending" | "accepted" | "revoked" | "expired" | null;
  invited_at?: string | null;
  accepted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminClientAccessInput {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
}

export interface AdminClientAccessResponse {
  client: Client;
  access: ClientAccessSummary;
}

export type AdminClientAccessErrorCode =
  | "client_access_clerk_config_missing"
  | "client_access_clerk_link_failed"
  | "client_access_clerk_email_failed"
  | "client_access_email_config_missing"
  | "client_access_email_send_failed"
  | "client_access_email_invalid"
  | "client_access_existing_user_conflict"
  | "client_access_existing_user_resend_unsupported";

export interface AdminClientAccessErrorDetail {
  code: AdminClientAccessErrorCode;
  message: string;
}

export interface AdminClientUpdateInput {
  personal_name?: string | null;
  email_limit_per_campaign?: number | null;
  max_campaigns?: number | null;
  monthly_email_limit?: number | null;
  daily_email_limit?: number | null;
  email_brand?: ClientEmailBrand | null;
}

export interface CompleteClientOnboardingInput {
  personal_name: string;
}

export interface PublicUnsubscribeResponse {
  status: PublicUnsubscribeStatus;
  message: string;
  already_unsubscribed: boolean;
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
  limitingFactor: "campaign_slots";
  campaignsInUse: number;
  maxCampaigns?: number | null;
  maxCampaignsRatio?: number | null;
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
  periodEmailLimit?: number | null;
  dailyEmailLimit?: number | null;
  followupEnabled?: boolean | null;
  followupDailyLimit?: number | null;
  followupMonthlyLimit?: number | null;
  followupDelayValue?: number | null;
  followupDelayUnit?: "hours" | "days" | null;
}

export interface AdminCampaignUpdateInput {
  name?: string;
  subject?: string | null;
  periodEmailLimit?: number | null;
  dailyEmailLimit?: number | null;
  followupEnabled?: boolean | null;
  followupDailyLimit?: number | null;
  followupMonthlyLimit?: number | null;
  followupDelayValue?: number | null;
  followupDelayUnit?: "hours" | "days" | null;
}

export interface AdminCampaignContentInput {
  subject?: string | null;
  previewText?: string | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
}

export interface AdminEmailTemplate {
  id: string;
  clientId: string;
  name: string;
  subject: string;
  previewText?: string | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCampaignContact {
  contactId: string;
  email: string;
  metadata: {
    nome?: string;
    cognome?: string;
  };
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

export interface AdminCampaignContactInput {
  email: string;
  metadata: {
    nome: string;
    cognome?: string;
  };
}

export interface AdminCampaignContactsInput {
  contacts: AdminCampaignContactInput[];
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

export interface AdminCampaignContactRemoveResult {
  campaignId: string;
  clientId: string;
  contactId: string;
  removed: boolean;
  contactsReady: boolean;
}

export interface AdminCampaignReviewResult {
  campaignId: string;
  clientId: string;
  status: CampaignStatus;
  allowedToSend: boolean;
  canSendWhenEnabled: boolean;
  sendingEnabled: boolean;
  warnings: string[];
  blockingErrors: string[];
  eligibleContactCount: number;
  blockedContactCount: number;
  slotLimit?: number | null;
  limitSource?: string | null;
  contentReady: boolean;
  contactsReady: boolean;
  reviewReady: boolean;
  currentStep: string;
  dailyLimit?: number | null;
  dailyUsed: number;
  dailyRemaining?: number | null;
  periodLimit?: number | null;
  periodUsed: number;
  periodRemaining?: number | null;
  periodStartedAt?: string | null;
  periodEndsAt?: string | null;
  followupEnabled: boolean;
  followupDailyLimit?: number | null;
  followupMonthlyLimit?: number | null;
  followupDelayValue: number;
  followupDelayUnit: "hours" | "days";
  providerHistory: ProviderHistoryPolicySummary[];
}

export interface AdminCampaignDetail {
  campaignId: string;
  clientId: string;
  clientName: string;
  clientStatus: string;
  emailBrand?: ClientEmailBrand | null;
  name: string;
  status: CampaignStatus;
  subject?: string | null;
  renderedSubject?: string | null;
  previewText?: string | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
  currentStep: string;
  campaignSlotId?: string | null;
  contentReady: boolean;
  contactsReady: boolean;
  reviewReady: boolean;
  periodEmailLimit: number;
  dailyEmailLimit: number;
  followupEnabled: boolean;
  followupDailyLimit?: number | null;
  followupMonthlyLimit?: number | null;
  followupDelayValue: number;
  followupDelayUnit: "hours" | "days";
  periodStartedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignSummaryItem {
  id: string;
  clientId: string;
  name: string;
  status: CampaignStatus;
  subject?: string | null;
  renderedSubject?: string | null;
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
  sent: number | null;
  failed: number;
  delivered: number | null;
  opened: number | null;
  clicked: number | null;
  bounced: number | null;
  complained: number | null;
  unsubscribed: number | null;
  sentAvailable: boolean;
  failedAvailable: boolean;
  deliveredAvailable: boolean;
  openedAvailable: boolean;
  clickedAvailable: boolean;
  bouncedAvailable: boolean;
  complainedAvailable: boolean;
  unsubscribedAvailable: boolean;
  deliveryRate: number | null;
  openRate: number | null;
  clickRate: number | null;
  bounceRate: number | null;
  complaintRate: number | null;
  unsubscribeRate: number | null;
  deliveryRateAvailable: boolean;
  openRateAvailable: boolean;
  clickRateAvailable: boolean;
  bounceRateAvailable: boolean;
  complaintRateAvailable: boolean;
  unsubscribeRateAvailable: boolean;
  providerEventsAvailable: boolean;
}

export interface CampaignPolicyStatusSummary {
  allowed: boolean;
  decision: string;
  code: string;
  severity: string;
  reason: string;
}

export interface ProviderHistoryPolicySummary {
  code: string;
  severity: string;
  reason: string;
  metric: string;
  rate?: number | null;
  band: string;
  sendingDomain?: string | null;
  blocking: boolean;
}

export interface CampaignPolicyStateSummary {
  deliverabilityGuard: CampaignPolicyStatusSummary;
  duplicateGuard: CampaignPolicyStatusSummary;
  warmupGuard: CampaignPolicyStatusSummary;
  providerHistory: ProviderHistoryPolicySummary[];
  scoreProductsAvailable: boolean;
  domainHealthScoreAvailable: boolean;
  contactQualityScoreAvailable: boolean;
  campaignRiskScoreAvailable: boolean;
}

export interface CampaignPeriodUsageSummary {
  periodEmailLimit?: number | null;
  periodUsed: number;
  periodRemaining?: number | null;
  periodStartedAt?: string | null;
  periodEndsAt?: string | null;
  hasRealUsage: boolean;
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
  periodUsage: CampaignPeriodUsageSummary;
  policyState?: CampaignPolicyStateSummary | null;
  runtime: ProviderRuntimeSummary;
  blockedSends: CampaignBlockedSendsSummary;
}

export interface AdminCampaignReadinessSummary extends CampaignReadModel {
  client: CampaignClientSummary;
  canSend: boolean;
  canSendWhenEnabled: boolean;
  sendingEnabled: boolean;
  blockingErrors: string[];
  warnings: string[];
  dailyLimit?: number | null;
  dailyUsed: number;
  dailyRemaining?: number | null;
  periodLimit?: number | null;
  periodUsed: number;
  periodRemaining?: number | null;
  periodStartedAt?: string | null;
  periodEndsAt?: string | null;
}

export interface AdminCampaignDispatchResult {
  status: string;
  mode: string;
  provider?: string | null;
  providerStatus?: string | null;
  campaignId: string;
  clientId?: string | null;
  allowed: boolean;
  decision: SendDecision | string;
  reason: string;
  code: string;
  severity: string;
  safetyChecked?: boolean;
  safetyPassed?: boolean;
  allowedRecipientsChecked?: boolean;
  eligibleContactCount: number;
  maxRealSendRecipients?: number | null;
  blockedContactCount: number;
  blockedReasons: Record<string, number>;
  diagnostic?: string | null;
  limitSource?: string | null;
  limitValue?: number | null;
  dailyLimit?: number | null;
  dailyUsed: number;
  dailyRemaining?: number | null;
  periodLimit?: number | null;
  periodUsed: number;
  periodRemaining?: number | null;
  periodStartedAt?: string | null;
  periodEndsAt?: string | null;
  dispatchAttempted: boolean;
  realSendAttempted: boolean;
  providerPrepared: boolean;
  providerDispatched: boolean;
  contentReady: boolean;
  unsubscribeReady?: boolean;
  providerEventsReady?: boolean;
  emailLogsCreated: number;
  emailLogsUpdated: number;
  queuedCount: number;
  sentOrAcceptedCount: number;
  failedCount: number;
}

export interface AdminFollowupSimulationResult {
  status: string;
  mode: "followup_simulation" | string;
  campaignId: string;
  clientId: string;
  decision: string;
  code: string;
  reason: string;
  allowed: boolean;
  realSendAttempted: boolean;
  externalPreparationPerformed: boolean;
  externalDispatchPerformed: boolean;
  contentReady: boolean;
  dedicatedFollowupContentReady: boolean;
  totalPrimaryRecipientsEvaluated: number;
  eligibleCount: number;
  blockedCount: number;
  blockedReasonCounts: Record<string, number>;
  followupSettings: {
    followupEnabled: boolean;
    followupDailyLimit?: number | null;
    followupDailyUsed: number;
    followupMonthlyLimit?: number | null;
    followupMonthlyUsed: number;
    followupDelayValue: number;
    followupDelayUnit: "hours" | "days";
    referenceTime?: string | null;
    eligibleAt?: string | null;
  };
  emailLogsCreated: number;
  providerEventsCreated: number;
  externalMappingsCreated: number;
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
  clientDashboard?: ClientDashboardSummary | null;
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

export type ClientDashboardWindowKey = "24h" | "7d" | "14d" | "30d" | "allTime";

export interface ClientDashboardKpiValue {
  value: number | null;
  limit?: number | null;
  available: boolean;
}

export interface ClientDashboardKpis {
  activeCampaigns: ClientDashboardKpiValue;
  sentLast7d: ClientDashboardKpiValue;
  deliveredLast7d: ClientDashboardKpiValue;
  openedLast7d: ClientDashboardKpiValue;
  clickedLast7d: ClientDashboardKpiValue;
  deliveryRateLast7d: number | null;
  openRateLast7d: number | null;
  clickRateLast7d: number | null;
  deliveryRateAvailable: boolean;
  openRateAvailable: boolean;
  clickRateAvailable: boolean;
}

export interface ClientDashboardWindowMetrics {
  sent: number | null;
  failed: number | null;
  delivered: number | null;
  opened: number | null;
  clicked: number | null;
  sentAvailable: boolean;
  failedAvailable: boolean;
  deliveredAvailable: boolean;
  openedAvailable: boolean;
  clickedAvailable: boolean;
  deliveryRate: number | null;
  openRate: number | null;
  clickRate: number | null;
  deliveryRateAvailable: boolean;
  openRateAvailable: boolean;
  clickRateAvailable: boolean;
  windowStartedAt: string | null;
  windowEndedAt: string;
}

export interface ClientDashboardPerformanceAnalytics {
  defaultWindow: ClientDashboardWindowKey;
  windows: Record<ClientDashboardWindowKey, ClientDashboardWindowMetrics>;
}

export interface ClientDashboardActionItem {
  label: string;
  count: number;
  severity: "neutral" | "warning" | "danger";
}

export interface ClientDashboardActionsRequired {
  campaignsToComplete: number;
  blockedSendsToReview: number;
  providerEventsIssues: number | null;
  items: ClientDashboardActionItem[];
}

export interface ClientDashboardStatusSummary {
  totalCampaigns: number;
  running: number;
  ready: number;
  toComplete: number;
  blocked: number;
  completed: number;
}

export interface ClientDashboardPeriodUsage {
  hasRealUsage: boolean;
  sent: number | null;
  failed: number | null;
  delivered: number | null;
  opened: number | null;
  clicked: number | null;
}

export interface ClientDashboardScoreAvailability {
  scoreProductsAvailable: boolean;
  domainHealthScoreAvailable: boolean;
  contactQualityScoreAvailable: boolean;
  campaignRiskScoreAvailable: boolean;
}

export interface ClientDashboardSummary {
  greetingName: string;
  cta: {
    campaignsHref: string;
  };
  kpis: ClientDashboardKpis;
  performanceAnalytics: ClientDashboardPerformanceAnalytics;
  actionsRequired: ClientDashboardActionsRequired;
  statusSummary: ClientDashboardStatusSummary;
  periodUsage: ClientDashboardPeriodUsage;
  scoreAvailability: ClientDashboardScoreAvailability;
}
