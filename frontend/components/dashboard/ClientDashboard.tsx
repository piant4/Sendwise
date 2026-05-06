import { DashboardCard } from "../ui/DashboardCard";
import { EmptyState } from "../ui/EmptyState";
import { SectionHeader } from "../ui/SectionHeader";
import { StatusBadge } from "../ui/StatusBadge";
import type { ClientOverviewSummary } from "../../types";

interface ClientDashboardProps {
  summary: ClientOverviewSummary;
  isMockMode: boolean;
}

function getStatusVariant(status: ClientOverviewSummary["accountStatus"]["status"]) {
  switch (status) {
    case "active":
      return "success";
    case "trial":
    case "paused":
      return "warning";
    case "blocked":
    case "archived":
      return "danger";
    default:
      return "neutral";
  }
}

function getCampaignVariant(status: ClientOverviewSummary["campaignSummaries"][number]["status"]) {
  switch (status) {
    case "ready":
    case "running":
    case "completed":
      return "success";
    case "paused":
      return "warning";
    case "blocked":
    case "failed":
      return "danger";
    default:
      return "neutral";
  }
}

export function ClientDashboard({
  summary,
  isMockMode,
}: ClientDashboardProps) {
  const modeLabel = isMockMode ? "Mock-backed" : "Backend stub";

  return (
    <main className="shell">
      <section className="panel" style={{ display: "grid", gap: 24 }}>
        <SectionHeader
          title="Client Overview"
          description="Client dashboard summary from the frontend API boundary."
          actions={<StatusBadge label={modeLabel} variant="neutral" />}
        />
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <DashboardCard
            title="Campaigns"
            description="Active campaigns reported by the overview summary."
            value={summary.activeCampaigns.toLocaleString()}
            footer="Read through frontend/lib/api.ts."
          />
          <DashboardCard
            title="Emails sent"
            description="Monthly email sends reported for this overview."
            value={summary.monthlyEmailsSent.toLocaleString()}
            footer={`Limit: ${summary.monthlyEmailLimit.toLocaleString()}`}
          />
          <DashboardCard
            title="Monthly limit"
            description="Email limit displayed from the summary payload."
            value={summary.monthlyEmailLimit.toLocaleString()}
            footer="Limit enforcement stays backend-owned."
          />
          <DashboardCard
            title="Blocked sends"
            description="Blocked send attempts reported for this month."
            value={summary.blockedSendsThisMonth.toLocaleString()}
            footer={<StatusBadge label="Overview summary" variant="success" />}
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
            description="Campaigns available through the current client boundary."
          >
            {summary.campaignSummaries.length > 0 ? (
              <div style={{ display: "grid", gap: 12 }}>
                {summary.campaignSummaries.map((campaign) => (
                  <article
                    key={campaign.id}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      display: "grid",
                      gap: 6,
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
                      <strong>{campaign.name}</strong>
                      <StatusBadge
                        label={campaign.status}
                        variant={getCampaignVariant(campaign.status)}
                      />
                    </div>
                    <span style={{ color: "var(--muted)" }}>
                      Last activity: {campaign.lastActivityLabel}
                    </span>
                    <span style={{ color: "var(--muted)" }}>
                      Sent: {campaign.sent.toLocaleString()} / {campaign.limit.toLocaleString()}
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No campaigns found"
                description="The current client endpoint returned no campaign rows."
              />
            )}
          </DashboardCard>

          <DashboardCard
            title="Account status"
            description="Client state resolved through the current client context."
          >
            <div style={{ display: "grid", gap: 12 }}>
              <StatusBadge
                label={summary.accountStatus.label}
                variant={getStatusVariant(summary.accountStatus.status)}
              />
              <p style={{ margin: 0, color: "var(--muted)" }}>
                {summary.accountStatus.note}
              </p>
            </div>
          </DashboardCard>
        </div>

        <DashboardCard
          title="Blocked sends details"
          description="Readable blocked send records returned through the boundary."
        >
          {summary.readableBlockedSends.length > 0 ? (
            <div style={{ display: "grid", gap: 12 }}>
              {summary.readableBlockedSends.map((blockedSend) => (
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
                    <strong>{blockedSend.campaignName}</strong>
                    <span style={{ color: "var(--muted)", fontSize: 13 }}>
                      {blockedSend.createdAtLabel}
                    </span>
                  </div>
                  <span style={{ color: "var(--muted)" }}>
                    {blockedSend.readableReason}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No blocked sends"
              description="The current client endpoint returned no blocked send records."
            />
          )}
        </DashboardCard>
      </section>
    </main>
  );
}
