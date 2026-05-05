import { DashboardCard } from "../../components/ui/DashboardCard";
import { EmptyState } from "../../components/ui/EmptyState";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";

export default function AdminPage() {
  return (
    <main className="shell">
      <section className="panel" style={{ display: "grid", gap: 24 }}>
        <SectionHeader
          title="Admin Overview"
          description="Static operator dashboard placeholder. This page intentionally does not load clients, campaigns, or deliverability data."
          actions={<StatusBadge label="Static shell" variant="neutral" />}
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
            description="Reusable card shell for future admin metrics."
            value="--"
            footer="Data wiring belongs in a later task."
          />
          <DashboardCard
            title="Campaigns"
            description="Presentation only, with no API calls."
            value="--"
            footer={<StatusBadge label="Static only" variant="success" />}
          />
        </div>
        <EmptyState
          title="No admin dashboard data loaded"
          description="Future sections can reuse this state for clients, campaigns, usage, and blocked sends."
        />
      </section>
    </main>
  );
}
