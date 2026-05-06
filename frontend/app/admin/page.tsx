import { DashboardCard } from "../../components/ui/DashboardCard";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { getAdminOverviewSummary } from "../../lib/api";
import type { AdminSystemStatus } from "../../types";

const systemStatusLabels: Record<keyof AdminSystemStatus, string> = {
  api: "Frontend API boundary",
  mockData: "Mock data",
  sending: "Sending",
  mailpit: "Mailpit",
};

const systemStatusCopy: Record<AdminSystemStatus[keyof AdminSystemStatus], string> = {
  ok: "OK",
  warning: "Warning",
  enabled: "Enabled",
  disabled: "Disabled",
  dev_only: "Dev only",
};

export default async function AdminPage() {
  const summary = await getAdminOverviewSummary();
  const campaignStatuses = [
    { label: "Active", value: summary.campaignStatusCounts.active },
    { label: "Paused", value: summary.campaignStatusCounts.paused },
    { label: "Blocked", value: summary.campaignStatusCounts.blocked },
    { label: "Draft", value: summary.campaignStatusCounts.draft },
  ];
  const emailLimitRows = [
    {
      label: "Monthly sent",
      value: summary.emailLimitOverview.monthlySent,
      limit: summary.emailLimitOverview.monthlyLimit,
    },
    {
      label: "Daily sent",
      value: summary.emailLimitOverview.dailySent,
      limit: summary.emailLimitOverview.dailyLimit,
    },
  ];
  const systemStatuses = Object.entries(summary.systemStatus) as [
    keyof AdminSystemStatus,
    AdminSystemStatus[keyof AdminSystemStatus],
  ][];

  return (
    <main className="shell">
      <section
        className="panel admin-overview"
        style={{ display: "grid", gap: 24, maxWidth: 1120 }}
      >
        <SectionHeader
          title="Admin Overview"
          description="Operational snapshot from the mock-backed frontend API boundary."
          actions={<StatusBadge label="Mock-backed" variant="neutral" />}
        />
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <DashboardCard
            title="Clients"
            description="Total client accounts visible to the admin overview."
            value={summary.totalClients.toLocaleString()}
            footer="Read through the frontend API boundary."
          />
          <DashboardCard
            title="Campaigns"
            description="Active campaigns reported by the overview summary."
            value={summary.activeCampaigns.toLocaleString()}
            footer={<StatusBadge label="Overview summary" variant="success" />}
          />
          <DashboardCard
            title="Blocked sends"
            description="Send attempts blocked by backend-owned rules today."
            value={summary.blockedSendsToday.toLocaleString()}
            footer="Displayed only; send rules stay backend-owned."
          />
          <DashboardCard
            title="AI calls"
            description="Monthly AI calls used across the overview."
            value={summary.monthlyAiCallsUsed.toLocaleString()}
            footer="Usage enforcement stays outside the UI."
          />
        </div>
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          <DashboardCard
            title="Campaign status"
            description="Compact status mix for the admin overview."
          >
            <div style={{ display: "grid", gap: 12 }}>
              {campaignStatuses.map((status) => (
                <div
                  key={status.label}
                  style={{
                    alignItems: "center",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 16,
                  }}
                >
                  <span style={{ color: "var(--muted)" }}>{status.label}</span>
                  <strong>{status.value.toLocaleString()}</strong>
                </div>
              ))}
            </div>
          </DashboardCard>

          <DashboardCard
            title="Email limits"
            description="Limit usage displayed from mock overview data."
          >
            <div style={{ display: "grid", gap: 14 }}>
              {emailLimitRows.map((row) => (
                <div key={row.label} style={{ display: "grid", gap: 6 }}>
                  <div
                    style={{
                      alignItems: "center",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 16,
                    }}
                  >
                    <span style={{ color: "var(--muted)" }}>{row.label}</span>
                    <strong>
                      {row.value.toLocaleString()} / {row.limit.toLocaleString()}
                    </strong>
                  </div>
                  <div
                    aria-hidden="true"
                    style={{
                      background: "var(--sw-muted-surface)",
                      borderRadius: 999,
                      height: 8,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        background: "var(--sw-accent)",
                        height: "100%",
                        width: `${Math.min((row.value / row.limit) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>

        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          <DashboardCard
            title="Recent blocked sends"
            description="Preview of recent blocked attempts across clients."
          >
            <div style={{ display: "grid", gap: 12 }}>
              {summary.recentBlockedSends.map((blockedSend) => (
                <article
                  key={blockedSend.id}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    display: "grid",
                    gap: 4,
                    paddingBottom: 12,
                  }}
                >
                  <div
                    style={{
                      alignItems: "center",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      justifyContent: "space-between",
                    }}
                  >
                    <strong>{blockedSend.clientName}</strong>
                    <span style={{ color: "var(--muted)", fontSize: 13 }}>
                      {blockedSend.createdAtLabel}
                    </span>
                  </div>
                  <span>{blockedSend.campaignName}</span>
                  <span style={{ color: "var(--muted)" }}>
                    {blockedSend.reason}
                  </span>
                </article>
              ))}
            </div>
          </DashboardCard>

          <DashboardCard
            title="System status"
            description="Development-mode service notes for operators."
          >
            <div style={{ display: "grid", gap: 12 }}>
              {systemStatuses.map(([key, value]) => (
                <div
                  key={key}
                  style={{
                    alignItems: "center",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <span style={{ color: "var(--muted)" }}>
                    {systemStatusLabels[key]}
                  </span>
                  <StatusBadge
                    label={systemStatusCopy[value]}
                    variant={value === "warning" ? "warning" : "neutral"}
                  />
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>
      </section>
    </main>
  );
}
