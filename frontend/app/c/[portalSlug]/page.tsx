import { DashboardErrorState } from "../../../components/dashboard/DashboardErrorState";
import { ClientDashboardHeader } from "../../../components/client/ClientDashboardHeader";
import { ClientDeliveryCard } from "../../../components/client/ClientDeliveryCard";
import { ClientKpiGrid } from "../../../components/client/ClientKpiGrid";
import { ClientRecentBlockedSendsCard } from "../../../components/client/ClientRecentBlockedSendsCard";
import { ClientRecentCampaignsCard } from "../../../components/client/ClientRecentCampaignsCard";
import {
  buildClientDashboardModel,
  type ClientDashboardCampaignSnapshot,
} from "../../../components/client/dashboardModel";
import {
  getClientCampaignDetail,
  getClientCampaignStats,
  getClientOverviewSummary,
} from "../../../lib/api";
import type { Campaign } from "../../../types";
import { requireClientPortalRequest } from "./portalPageData";

export const dynamic = "force-dynamic";

interface ClientPortalPageProps {
  params: Promise<{
    portalSlug: string;
  }>;
}

async function loadRecentCampaignSnapshots(
  campaigns: Campaign[],
  accessToken: string | null,
): Promise<ClientDashboardCampaignSnapshot[]> {
  const snapshots = await Promise.all(
    campaigns.map(async (campaign) => {
      try {
        const [detail, stats] = await Promise.all([
          getClientCampaignDetail(campaign.id, accessToken),
          getClientCampaignStats(campaign.id, accessToken),
        ]);

        return {
          campaign,
          detail,
          stats,
        };
      } catch {
        return {
          campaign,
          detail: null,
          stats: null,
        };
      }
    }),
  );

  return snapshots;
}

export default async function ClientPortalPage({
  params,
}: ClientPortalPageProps) {
  const { portalSlug } = await params;
  const { accessToken } = await requireClientPortalRequest(portalSlug);

  const result = await getClientOverviewSummary(accessToken)
    .then(async (summary) => ({
      summary,
      snapshots: await loadRecentCampaignSnapshots(
        summary.campaigns.recentCampaigns,
        accessToken,
      ),
    }))
    .catch((error: unknown) => ({
      errorMessage:
        error instanceof Error ? error.message : "Unknown dashboard error",
    }));

  if ("errorMessage" in result) {
    return (
      <DashboardErrorState
        title="Dashboard"
        description="Riepilogo operativo del cliente basato sui dati applicativi."
        errorMessage={result.errorMessage}
      />
    );
  }

  const model = buildClientDashboardModel(result.summary, result.snapshots);

  return (
    <main className="shell">
      <section className="client-dashboard">
        <ClientDashboardHeader summary={result.summary} model={model} />
        <ClientKpiGrid summary={result.summary} model={model} />

        <div className="client-dashboard__content">
          <div className="client-dashboard__content-main">
            <ClientRecentCampaignsCard
              summary={result.summary}
              model={model}
              snapshots={result.snapshots}
            />
          </div>

          <div className="client-dashboard__content-side">
            <ClientRecentBlockedSendsCard summary={result.summary} model={model} />
            <ClientDeliveryCard
              summary={result.summary}
              model={model}
              snapshots={result.snapshots}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
