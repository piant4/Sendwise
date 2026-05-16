import { StatusBadge } from "../ui/StatusBadge";
import type { ClientOverviewSummary } from "../../types";
import { ClientSurface } from "./ClientSurface";
import type {
  ClientDashboardCampaignSnapshot,
  ClientDashboardModel,
} from "./dashboardModel";
import { formatDateTimeLabel } from "./clientStatus";
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
  const campaignSnapshots =
    snapshots ??
    summary.campaigns.recentCampaigns.map((campaign) => ({
      campaign,
      detail: null,
      stats: null,
    }));

  return (
    <ClientSurface
      title="Panoramica campagne"
      description="Distribuzione stati e attività recente del workspace."
      aside={
        <span className="client-surface__eyebrow">
          {summary.campaigns.totalCampaigns.toLocaleString("it-IT")} campagne
        </span>
      }
    >
      {dashboardModel.statusSegments.length > 0 ? (
        <div className="client-status-visual client-status-visual--panel">
          <div className="client-progress-panel__row">
            <span>Stato campagne</span>
            <strong>{formatCampaignCount(summary.campaigns.totalCampaigns)}</strong>
          </div>
          <div className="client-status-visual__bar" aria-hidden="true">
            {dashboardModel.statusSegments.map((segment) => (
              <div
                key={segment.label}
                className="client-status-visual__segment"
                data-tone={segment.tone}
                style={{
                  width: `${(segment.value / summary.campaigns.totalCampaigns) * 100}%`,
                }}
              />
            ))}
          </div>
          <div className="client-status-visual__legend">
            {dashboardModel.statusSegments.map((segment) => (
              <article key={segment.label} className="client-status-visual__legend-item">
                <span>{segment.label}</span>
                <strong>{formatCampaignCount(segment.value)}</strong>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {campaignSnapshots.length > 0 ? (
        <div className="client-list client-list--compact">
          {campaignSnapshots.map((snapshot) => (
            <article key={snapshot.campaign.id} className="client-row client-row--compact">
              <div className="client-row__header">
                <div className="client-row__copy">
                  <strong className="client-row__title">{snapshot.campaign.name}</strong>
                  <span className="client-row__meta">
                    Aggiornata {formatDateTimeLabel(snapshot.campaign.updated_at)}
                  </span>
                </div>
                <StatusBadge
                  label={getCampaignStatusLabel(snapshot.campaign.status)}
                  variant={getCampaignStatusVariant(snapshot.campaign.status)}
                />
              </div>

              {snapshot.detail ? (
                <div className="client-row__stats">
                  <div className="client-row__stat">
                    <span>Prontezza</span>
                    <strong>
                      {getCampaignReadinessShortLabel(snapshot.detail.campaign)}
                    </strong>
                  </div>
                  <div className="client-row__stat">
                    <span>Destinatari</span>
                    <strong>
                      {formatCampaignCount(snapshot.detail.recipients.eligible)} idonei
                    </strong>
                  </div>
                  <div className="client-row__stat">
                    <span>Blocchi destinatari</span>
                    <strong>
                      {formatCampaignCount(snapshot.detail.recipients.blocked)}
                    </strong>
                  </div>
                  <div className="client-row__stat">
                    <span>Eventi provider</span>
                    <strong>
                      {snapshot.stats?.logs.providerEventsAvailable
                        ? "Disponibili"
                        : "Non disponibili"}
                    </strong>
                  </div>
                </div>
              ) : (
                <p className="client-row__support client-note--compact">
                  Dettagli campagna non disponibili.
                </p>
              )}

              <div className="client-row__summary">
                <span>
                  {snapshot.campaign.subject?.trim()
                    ? snapshot.campaign.subject
                    : "Oggetto non disponibile"}
                </span>
                <span>Creata {formatDateTimeLabel(snapshot.campaign.created_at)}</span>
              </div>
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
