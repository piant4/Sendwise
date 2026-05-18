import { StatusBadge } from "../ui/StatusBadge";
import type { ClientOverviewSummary } from "../../types";
import { ClientSurface } from "./ClientSurface";
import type {
  ClientDashboardCampaignSnapshot,
  ClientDashboardModel,
} from "./dashboardModel";
import { buildCampaignProgress } from "./dashboardModel";
import {
  formatCampaignCount,
  getCampaignReadinessShortLabel,
  getCampaignStatusLabel,
  getCampaignStatusVariant,
} from "../shared/campaignUi";

interface ClientRecentCampaignsCardProps {
  summary: ClientOverviewSummary;
  model?: ClientDashboardModel;
  snapshots?: ClientDashboardCampaignSnapshot[];
}

export function ClientRecentCampaignsCard({
  summary,
  model,
  snapshots,
}: ClientRecentCampaignsCardProps) {
  const fallbackModel =
    model ?? {
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
  const dashboardModel = model ?? fallbackModel;
  const campaignSnapshots =
    snapshots ??
    summary.campaigns.recentCampaigns.map((campaign) => ({
      campaign,
      detail: null,
      stats: null,
    }));
  const totalCampaigns = Math.max(summary.campaigns.totalCampaigns, 1);
  const toneStops: Record<string, string> = {
    attention: "#dc2626",
    completed: "#94a3b8",
    paused: "#f59e0b",
    ready: "#60a5fa",
    running: "#2563eb",
  };
  let accumulated = 0;
  const chartGradient =
    dashboardModel.statusSegments.length > 0
      ? `conic-gradient(${dashboardModel.statusSegments
          .map((segment) => {
            const start = accumulated;
            const end = accumulated + (segment.value / totalCampaigns) * 100;
            accumulated = end;
            return `${toneStops[segment.tone]} ${start}% ${end}%`;
          })
          .join(", ")})`
      : undefined;

  return (
    <ClientSurface
      title="Panoramica campagne"
      description="Stati reali del workspace e ultimi elementi operativi esposti dal backend."
      aside={
        <span className="client-surface__eyebrow">
          {summary.campaigns.totalCampaigns.toLocaleString("it-IT")} campagne totali
        </span>
      }
    >
      {dashboardModel.statusSegments.length > 0 ? (
        <div className="client-status-overview">
          <div className="client-status-ring-card">
            <div
              aria-hidden="true"
              className="client-status-ring"
              style={{ backgroundImage: chartGradient }}
            >
              <div className="client-status-ring__center">
                <span>Totale</span>
                <strong>{formatCampaignCount(summary.campaigns.totalCampaigns)}</strong>
              </div>
            </div>
          </div>
          <div className="client-status-visual client-status-visual--dense">
            {dashboardModel.statusSegments.map((segment) => (
              <article key={segment.label} className="client-status-visual__legend-item">
                <span>{segment.label}</span>
                <strong>{formatCampaignCount(segment.value)}</strong>
                <small>
                  {Math.round((segment.value / totalCampaigns) * 100).toLocaleString(
                    "it-IT",
                  )}
                  %
                </small>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {campaignSnapshots.length > 0 ? (
        <div className="client-list client-list--compact">
          {campaignSnapshots.map((snapshot) => (
            <article key={snapshot.campaign.id} className="client-row client-row--minimal">
              <div className="client-row__header">
                <strong className="client-row__title">{snapshot.campaign.name}</strong>
                <StatusBadge
                  label={getCampaignStatusLabel(snapshot.campaign.status)}
                  variant={getCampaignStatusVariant(snapshot.campaign.status)}
                />
              </div>

              {snapshot.detail ? (
                <>
                  <div className="client-row__chips">
                    <span className="client-row__chip">
                      Prontezza: {getCampaignReadinessShortLabel(snapshot.detail.campaign)}
                    </span>
                    <span className="client-row__chip">
                      {formatCampaignCount(snapshot.detail.recipients.eligible)} destinatari
                      idonei
                    </span>
                    {snapshot.detail.recipients.blocked > 0 ? (
                      <span className="client-row__chip client-row__chip--warning">
                        {formatCampaignCount(snapshot.detail.recipients.blocked)} bloccati
                      </span>
                    ) : null}
                    {(snapshot.stats?.logs ?? snapshot.detail.logs)
                      .providerEventsAvailable ? (
                      <span className="client-row__chip">Eventi provider disponibili</span>
                    ) : null}
                  </div>

                  {(() => {
                    const progress = buildCampaignProgress(
                      snapshot,
                      summary.limits.emailLimitPerCampaign,
                    );

                    if (!progress) {
                      return (
                        <div className="client-row__progress client-row__progress--muted">
                          <div className="client-row__progress-header">
                            <span>Limite per campagna</span>
                            <strong>Non disponibile</strong>
                          </div>
                          <p className="client-row__support client-note--compact">
                            Nessun limite esposto per questa campagna.
                          </p>
                        </div>
                      );
                    }

                    return (
                      <div className="client-row__progress">
                        <div className="client-row__progress-header">
                          <span>{progress.label}</span>
                          <strong>
                            {formatCampaignCount(progress.current)} /{" "}
                            {formatCampaignCount(progress.limit)}
                          </strong>
                        </div>
                        <div className="client-progress" aria-hidden="true">
                          <div
                            className="client-progress__fill"
                            style={{
                              width: `${Math.max(
                                6,
                                Math.min(progress.ratio * 100, 100),
                              )}%`,
                            }}
                          />
                        </div>
                        <p className="client-row__support client-note--compact">
                          {progress.detail}
                        </p>
                      </div>
                    );
                  })()}
                </>
              ) : (
                <p className="client-row__support client-note--compact">
                  Dettagli campagna non disponibili.
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="client-empty-state">
          Nessuna campagna recente disponibile in questo momento.
        </div>
      )}
    </ClientSurface>
  );
}
