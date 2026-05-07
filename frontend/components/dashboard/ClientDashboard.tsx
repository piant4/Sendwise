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
        <ClientKpiGrid summary={summary} />

        <div className="client-dashboard__content">
          <div className="client-dashboard__stack">
            <ClientRecentCampaignsCard summary={summary} />
            <ClientRecentBlockedSendsCard summary={summary} />
          </div>
          <ClientDeliveryCard summary={summary} />
        </div>
      </section>
    </main>
  );
}
