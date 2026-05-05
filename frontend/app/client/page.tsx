import { DashboardCard } from "../../components/ui/DashboardCard";
import { EmptyState } from "../../components/ui/EmptyState";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { getClientOverviewSummary } from "../../lib/api";

export default async function ClientPage() {
  const summary = await getClientOverviewSummary();

  return (
    <main className="shell">
      <section className="panel" style={{ display: "grid", gap: 24 }}>
        <SectionHeader
          title="Client Overview"
          description="Client dashboard summary from the frontend API boundary."
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
        <EmptyState
          title="Detailed client sections are not loaded"
          description="This page consumes only the typed overview summary accessor."
        />
      </section>
    </main>
  );
}
