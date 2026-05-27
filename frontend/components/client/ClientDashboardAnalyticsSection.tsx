"use client";

import { useState } from "react";

import type { ClientDashboardWindowKey, ClientOverviewSummary } from "../../types";
import { ClientKpiGrid } from "./ClientKpiGrid";
import { ClientRecentCampaignsCard } from "./ClientRecentCampaignsCard";
import { ClientRecentBlockedSendsCard } from "./ClientRecentBlockedSendsCard";

interface ClientDashboardAnalyticsSectionProps {
  summary: ClientOverviewSummary;
}

export function ClientDashboardAnalyticsSection({
  summary,
}: ClientDashboardAnalyticsSectionProps) {
  const [selectedWindow, setSelectedWindow] = useState<ClientDashboardWindowKey>(
    summary.clientDashboard?.performanceAnalytics.defaultWindow ?? "7d",
  );

  return (
    <>
      <ClientKpiGrid summary={summary} selectedWindow={selectedWindow} />

      <div className="client-dashboard__content">
        <div className="client-dashboard__content-main">
          <ClientRecentCampaignsCard
            summary={summary}
            selectedWindow={selectedWindow}
            onSelectWindow={setSelectedWindow}
          />
        </div>

        <div className="client-dashboard__content-side">
          <ClientRecentBlockedSendsCard summary={summary} />
          {/* <ClientDeliveryCard summary={summary} /> */}
        </div>
      </div>
    </>
  );
}
