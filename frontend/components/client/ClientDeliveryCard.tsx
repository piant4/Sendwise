import type { ClientOverviewSummary } from "../../types";
import { ClientSurface } from "./ClientSurface";
import type {
  ClientDashboardCampaignSnapshot,
  ClientDashboardModel,
} from "./dashboardModel";
import { getUsageTypeLabel } from "./dashboardModel";
import { formatOptionalLimit } from "./clientStatus";

interface ClientDeliveryCardProps {
  summary: ClientOverviewSummary;
  model?: ClientDashboardModel;
  snapshots?: ClientDashboardCampaignSnapshot[];
}

export function ClientDeliveryCard({
  summary,
  model,
  snapshots,
}: ClientDeliveryCardProps) {
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
  const campaignSnapshots = snapshots ?? [];
  const recentCampaignsChecked = campaignSnapshots.filter((snapshot) => snapshot.detail)
    .length;
  const activeCapacityFill =
    dashboardModel.capacityRatio === null
      ? "0%"
      : `${Math.min(dashboardModel.capacityRatio * 100, 100)}%`;

  return (
    <div className="client-rail client-dashboard-rail">
      <ClientSurface
        title="Limiti"
        description="Capacità reale del workspace e utilizzo registrato nel periodo corrente."
      >
        <div className="client-progress-panel">
          <div className="client-progress-panel__row">
            <span>Campagne attive</span>
            <strong>
              {typeof summary.limits.maxCampaigns === "number" &&
              summary.limits.maxCampaigns > 0
                ? `${dashboardModel.activeCampaigns.toLocaleString("it-IT")} / ${summary.limits.maxCampaigns.toLocaleString("it-IT")}`
                : dashboardModel.activeCampaigns.toLocaleString("it-IT")}
            </strong>
          </div>
          {dashboardModel.capacityRatio === null ? (
            <div className="client-empty-state client-empty-state--compact">
              Limite campagne non configurato.
            </div>
          ) : (
            <div className="client-limit-gauge">
              <div className="client-progress" aria-hidden="true">
                <div
                  className="client-progress__fill"
                  style={{ width: activeCapacityFill }}
                />
              </div>
              <div className="client-limit-gauge__meta">
                <strong>{dashboardModel.limitStatus.label}</strong>
                <span>{dashboardModel.limitStatus.detail}</span>
              </div>
            </div>
          )}
        </div>

        <div className="client-fact-grid">
          <article className="client-fact-card">
            <span>Campagne massime</span>
            <strong>{formatOptionalLimit(summary.limits.maxCampaigns)}</strong>
          </article>
          <article className="client-fact-card">
            <span>Slot attivi liberi</span>
            <strong>
              {dashboardModel.remainingCampaignSlots === null
                ? "N/D"
                : dashboardModel.remainingCampaignSlots.toLocaleString("it-IT")}
            </strong>
          </article>
          <article className="client-fact-card">
            <span>Limite campagna</span>
            <strong>{formatOptionalLimit(summary.limits.emailLimitPerCampaign)}</strong>
          </article>
        </div>

        {summary.usage.currentPeriodTotals.length > 0 ? (
          <div className="client-metric-list">
            {summary.usage.currentPeriodTotals.map((metric) => (
              <div key={metric.usageType} className="client-metric-item">
                <span>{getUsageTypeLabel(metric.usageType)}</span>
                <strong>{metric.totalQuantity.toLocaleString("it-IT")}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="client-empty-state">Nessun utilizzo registrato nel periodo corrente.</div>
        )}
      </ClientSurface>

      <ClientSurface
        title="Prontezza recenti"
        description="Segnali ricavati solo dalle campagne recenti con dettaglio disponibile."
      >
        {recentCampaignsChecked > 0 ? (
          <div className="client-fact-grid client-fact-grid--dense">
            <article className="client-fact-card">
              <span>Pronte</span>
              <strong>
                {dashboardModel.readinessSummary.readyCount.toLocaleString("it-IT")}
              </strong>
              <p>Campagne con contenuto, destinatari e verifica già pronti.</p>
            </article>
            <article className="client-fact-card">
              <span>Da completare</span>
              <strong>
                {dashboardModel.readinessSummary.needsSetupCount.toLocaleString("it-IT")}
              </strong>
              <p>Campagne recenti senza destinatari idonei o con setup incompleto.</p>
            </article>
            <article className="client-fact-card">
              <span>Con destinatari bloccati</span>
              <strong>
                {dashboardModel.readinessSummary.blockedRecipientsCount.toLocaleString(
                  "it-IT",
                )}
              </strong>
              <p>Campagne recenti con destinatari esclusi dall&apos;invio.</p>
            </article>
            <article className="client-fact-card">
              <span>Eventi provider assenti</span>
              <strong>
                {dashboardModel.readinessSummary.providerEventsUnavailableCount.toLocaleString(
                  "it-IT",
                )}
              </strong>
              <p>Mostrato solo quando la campagna espone segnali utili ma non eventi provider.</p>
            </article>
          </div>
        ) : (
          <div className="client-empty-state">
            Dettagli campagne recenti non disponibili in questo momento.
          </div>
        )}
      </ClientSurface>
    </div>
  );
}
