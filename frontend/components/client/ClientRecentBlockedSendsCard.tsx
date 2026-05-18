import Link from "next/link";
import type { ClientOverviewSummary } from "../../types";
import { ClientSurface } from "./ClientSurface";
import type { ClientDashboardModel } from "./dashboardModel";

interface ClientRecentBlockedSendsCardProps {
  summary: ClientOverviewSummary;
  model?: ClientDashboardModel;
}

export function ClientRecentBlockedSendsCard({
  summary,
  model,
}: ClientRecentBlockedSendsCardProps) {
  const dashboardModel =
    model ?? {
      activeCampaigns: summary.campaigns.statusCounts.running,
      actionItems: [],
      blockedSendsCount: summary.blockedSends.currentPeriodCount,
      campaignsNeedingAttention:
        summary.campaigns.statusCounts.blocked +
        summary.campaigns.statusCounts.failed +
        summary.campaigns.statusCounts.paused,
      campaignsToComplete:
        summary.campaigns.statusCounts.draft + summary.campaigns.statusCounts.paused,
      capacityRatio: null,
      limitStatus: {
        detail: "Capacità campagne non disponibile.",
        label: "Limiti",
        tone: "neutral" as const,
      },
      readyCampaigns: summary.campaigns.statusCounts.ready,
      recentCampaignsVisible: summary.campaigns.recentCampaigns.length,
      recentProviderEventsCount: 0,
      readinessSummary: {
        withDetailsCount: 0,
        readyCount: 0,
        needsSetupCount: 0,
        blockedRecipientsCount: 0,
        providerEventsUnavailableCount: 0,
      },
      recentRecipientIssuesCount: 0,
      remainingCampaignSlots: null,
      statusSegments: [],
      totalCampaigns: summary.campaigns.totalCampaigns,
      workspaceStatus: {
        detail: "Riepilogo operativo disponibile.",
        label: "Workspace",
        variant: "neutral" as const,
      },
      recommendation: {
        title: "Vai alle campagne",
        description: "Apri l'elenco campagne per i dettagli operativi.",
        href: `/c/${summary.client.portalSlug}/campaigns`,
        actionLabel: "Vai alle campagne",
      },
    };

  return (
    <ClientSurface
      title="Azioni richieste"
      description="Solo attività reali emerse da campagne, blocchi e disponibilità eventi."
    >
      {dashboardModel.actionItems.length > 0 ? (
        <div className="client-action-list">
          {dashboardModel.actionItems.map((item) => (
            <Link
              key={`${item.title}-${item.href}`}
              className="client-action-card"
              data-tone={item.tone}
              href={item.href}
            >
              <div className="client-action-card__count">
                {item.count.toLocaleString("it-IT")}
              </div>
              <div className="client-action-card__copy">
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="client-empty-state client-empty-state--compact">
          Nessuna azione urgente nel workspace.
        </div>
      )}
    </ClientSurface>
  );
}
