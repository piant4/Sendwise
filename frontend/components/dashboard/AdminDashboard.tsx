import { AdminBlockedSendsCard } from "../admin/AdminBlockedSendsCard";
import { AdminDashboardHeader } from "../admin/AdminDashboardHeader";
import { AdminKpiGrid } from "../admin/AdminKpiGrid";
import { AdminOperationsRail } from "../admin/AdminOperationsRail";
import { AdminRecentCampaignsCard } from "../admin/AdminRecentCampaignsCard";
import type { AdminOverviewSummary } from "../../types";

interface AdminDashboardProps {
  summary: AdminOverviewSummary;
}

export function AdminDashboard({ summary }: AdminDashboardProps) {
  return (
    <main className="shell">
      <section className="admin-dashboard">
        <AdminDashboardHeader summary={summary} />
        <AdminKpiGrid summary={summary} />

        <div className="admin-dashboard__content">
          <AdminRecentCampaignsCard summary={summary} />
          <AdminBlockedSendsCard summary={summary} />
          <div className="admin-dashboard__content-wide">
            <AdminOperationsRail summary={summary} />
          </div>
        </div>
      </section>
    </main>
  );
}
