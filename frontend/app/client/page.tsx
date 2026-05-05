import { DashboardCard } from "../../components/ui/DashboardCard";
import { EmptyState } from "../../components/ui/EmptyState";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";

export default function ClientPage() {
  return (
    <main className="shell">
      <section className="panel" style={{ display: "grid", gap: 24 }}>
        <SectionHeader
          title="Client Overview"
          description="Static client dashboard placeholder. This page intentionally does not load campaigns, usage, or blocked-send data."
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
            title="Campaigns"
            description="Reusable card shell for future client metrics."
            value="--"
            footer="No campaign data is requested here."
          />
          <DashboardCard
            title="Usage"
            description="Presentation only, with no API calls."
            value="--"
            footer={<StatusBadge label="Static only" variant="success" />}
          />
        </div>
        <EmptyState
          title="No client dashboard data loaded"
          description="Future sections can reuse this state for campaigns, usage, and blocked sends."
        />
      </section>
    </main>
  );
}
