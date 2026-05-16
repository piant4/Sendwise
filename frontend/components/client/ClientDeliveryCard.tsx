import Link from "next/link";
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
      blockedSendsCount: summary.blockedSends.currentPeriodCount,
      campaignsNeedingAttention:
        summary.campaigns.statusCounts.blocked +
        summary.campaigns.statusCounts.failed +
        summary.campaigns.statusCounts.paused,
      campaignsToComplete:
        summary.campaigns.statusCounts.draft + summary.campaigns.statusCounts.paused,
      capacityRatio: null,
      readyCampaigns: summary.campaigns.statusCounts.ready,
      recentProviderEventsCount: 0,
      recentReadyCampaignsCount: 0,
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
  const recentCampaignsChecked = campaignSnapshots.filter(
    (snapshot) => snapshot.detail,
  ).length;

  return (
    <div className="client-rail client-dashboard-rail">
      <ClientSurface
        title="Prontezza invio"
        description="Solo segnali reali ricavati dalle campagne recenti."
      >
        <div className="client-fact-grid">
          <article className="client-fact-card">
            <span>Campagne recenti pronte</span>
            <strong>
              {dashboardModel.recentReadyCampaignsCount.toLocaleString("it-IT")}
            </strong>
            <p>
              {recentCampaignsChecked > 0
                ? `Calcolate su ${recentCampaignsChecked.toLocaleString("it-IT")} campagne recenti con dettaglio disponibile.`
                : "Dettaglio campagne non disponibile in questo momento."}
            </p>
          </article>
          <article className="client-fact-card">
            <span>Destinatari da verificare</span>
            <strong>
              {dashboardModel.recentRecipientIssuesCount.toLocaleString("it-IT")}
            </strong>
            <p>Campagne recenti senza destinatari pronti o con blocchi visibili.</p>
          </article>
          <article className="client-fact-card">
            <span>Eventi provider</span>
            <strong>
              {dashboardModel.recentProviderEventsCount > 0
                ? dashboardModel.recentProviderEventsCount.toLocaleString("it-IT")
                : "Assenti"}
            </strong>
            <p>
              {dashboardModel.recentProviderEventsCount > 0
                ? "Disponibili nelle campagne recenti con dati provider esposti."
                : "Il dashboard non mostra tassi o aperture quando gli eventi non sono esposti."}
            </p>
          </article>
          <article className="client-fact-card">
            <span>Invii bloccati</span>
            <strong>{dashboardModel.blockedSendsCount.toLocaleString("it-IT")}</strong>
            <p>Blocchi registrati nel periodo corrente del workspace.</p>
          </article>
        </div>
      </ClientSurface>

      <ClientSurface title="Limiti e utilizzo" description="Capacità disponibile e utilizzo registrato nel periodo.">
        <div className="client-progress-panel">
          <div className="client-progress-panel__row">
            <span>Capacità campagne</span>
            <strong>
              {typeof summary.limits.maxCampaigns === "number" &&
              summary.limits.maxCampaigns > 0
                ? `${summary.campaigns.totalCampaigns.toLocaleString("it-IT")} / ${summary.limits.maxCampaigns.toLocaleString("it-IT")}`
                : summary.campaigns.totalCampaigns.toLocaleString("it-IT")}
            </strong>
          </div>
          <div className="client-progress" aria-hidden="true">
            <div
              className="client-progress__fill"
              style={{
                width:
                  dashboardModel.capacityRatio === null
                    ? "18%"
                    : `${Math.max(8, Math.min(dashboardModel.capacityRatio * 100, 100))}%`,
              }}
            />
          </div>
        </div>

        <div className="client-fact-grid">
          <article className="client-fact-card">
            <span>Campagne massime</span>
            <strong>{formatOptionalLimit(summary.limits.maxCampaigns)}</strong>
          </article>
          <article className="client-fact-card">
            <span>Email per campagna</span>
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
        title="Prossimo passo"
        description={dashboardModel.recommendation.description}
      >
        <div className="client-next-step">
          <strong className="client-next-step__title">
            {dashboardModel.recommendation.title}
          </strong>
          <Link
            className="client-dashboard-hero__action client-dashboard-hero__action--inline"
            href={dashboardModel.recommendation.href}
          >
            {dashboardModel.recommendation.actionLabel}
          </Link>
        </div>
      </ClientSurface>
    </div>
  );
}
