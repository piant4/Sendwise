import { DashboardCard } from "../../components/ui/DashboardCard";
import { EmptyState } from "../../components/ui/EmptyState";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { getAdminOverviewSummary } from "../../lib/api";

export default async function AdminPage() {
  const summary = await getAdminOverviewSummary();

  return (
    <main className="shell">
      <section className="panel" style={{ display: "grid", gap: 24 }}>
        <SectionHeader
          title="Admin Overview"
          description="Operator dashboard summary from the frontend API boundary."
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
            footer="Read through frontend/lib/api.ts."
          />
          <DashboardCard
            title="Campaigns"
            description="Active campaigns reported by the overview summary."
            value={summary.activeCampaigns.toLocaleString()}
            footer={<StatusBadge label="Overview summary" variant="success" />}
          />
          <DashboardCard
            title="Blocked sends"
            description="Blocked send attempts reported for today."
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
        <EmptyState
          title="Detailed admin sections are not loaded"
          description="This page consumes only the typed overview summary accessor."
        />
      </section>
    </main>
  );
}
