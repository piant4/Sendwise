import { AdminBlockedSendsCard } from "../admin/AdminBlockedSendsCard";
import { AdminDashboardHeader } from "../admin/AdminDashboardHeader";
import { AdminKpiGrid } from "../admin/AdminKpiGrid";
import { AdminOperationsRail } from "../admin/AdminOperationsRail";
import { AdminRecentCampaignsCard } from "../admin/AdminRecentCampaignsCard";
import type { AdminOverviewSummary } from "../../types";

interface AdminDashboardProps {
  summary: AdminOverviewSummary;
  isMockMode: boolean;
}

export function AdminDashboard({
  summary,
  isMockMode,
}: AdminDashboardProps) {
  return (
    <main className="shell">
      <section className="admin-dashboard">
        <AdminDashboardHeader summary={summary} isMockMode={isMockMode} />
        <AdminKpiGrid summary={summary} />

        <div className="admin-dashboard__content">
          <div className="admin-dashboard__stack">
            <AdminRecentCampaignsCard summary={summary} />
            <AdminBlockedSendsCard summary={summary} />
          </div>
          <AdminOperationsRail summary={summary} />
        </div>
      </section>
    </main>
  );
}
