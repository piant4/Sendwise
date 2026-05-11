import { ClientDashboardHeader } from "../client/ClientDashboardHeader";
import { ClientDeliveryCard } from "../client/ClientDeliveryCard";
import { ClientKpiGrid } from "../client/ClientKpiGrid";
import { ClientRecentBlockedSendsCard } from "../client/ClientRecentBlockedSendsCard";
import { ClientRecentCampaignsCard } from "../client/ClientRecentCampaignsCard";
import type { ClientOverviewSummary } from "../../types";

interface ClientDashboardProps {
  summary: ClientOverviewSummary;
}

export function ClientDashboard({ summary }: ClientDashboardProps) {
  return (
    <main className="shell">
      <section className="client-dashboard">
        <ClientDashboardHeader summary={summary} />
        <div className="client-dashboard__content">
          <div className="client-dashboard__content-wide">
            <ClientKpiGrid summary={summary} />
          </div>
          <div className="client-dashboard__content-wide">
            <ClientDeliveryCard summary={summary} />
          </div>
          <ClientRecentCampaignsCard summary={summary} />
          <ClientRecentBlockedSendsCard summary={summary} />
        </div>
      </section>
    </main>
  );
}
