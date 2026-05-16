import Link from "next/link";
import { StatusBadge } from "../ui/StatusBadge";
import type { ClientOverviewSummary } from "../../types";
import type { ClientDashboardModel } from "./dashboardModel";

interface ClientDashboardHeaderProps {
  summary: ClientOverviewSummary;
  model?: ClientDashboardModel;
}

export function ClientDashboardHeader({
  summary,
  model,
}: ClientDashboardHeaderProps) {
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

  return (
    <section className="client-hero client-dashboard-hero">
      <div className="client-dashboard-hero__copy">
        <div className="client-dashboard-hero__headline">
          <p className="client-hero__eyebrow">Dashboard cliente</p>
          <h1 className="client-hero__title">{summary.client.name}</h1>
          <p className="client-dashboard-hero__lead">
            Vista operativa del workspace con campagne, limiti e blocchi realmente
            registrati.
          </p>
        </div>

        <div className="client-dashboard-hero__status">
          <StatusBadge
            label={dashboardModel.workspaceStatus.label}
            variant={dashboardModel.workspaceStatus.variant}
          />
          <span className="client-dashboard-hero__status-detail">
            {dashboardModel.workspaceStatus.detail}
          </span>
        </div>
      </div>

      <div className="client-dashboard-hero__actions">
        <div className="client-dashboard-hero__focus">
          <span className="client-dashboard-hero__focus-label">Stato attuale</span>
          <strong className="client-dashboard-hero__focus-value">
            {dashboardModel.readyCampaigns > 0
              ? `${dashboardModel.readyCampaigns.toLocaleString("it-IT")} campagne pronte`
              : dashboardModel.campaignsNeedingAttention > 0
                ? `${dashboardModel.campaignsNeedingAttention.toLocaleString("it-IT")} campagne da seguire`
                : "Nessuna urgenza visibile"}
          </strong>
          <p className="client-dashboard-hero__focus-copy">
            {summary.blockedSends.currentPeriodCount > 0
              ? `Sono presenti ${summary.blockedSends.currentPeriodCount.toLocaleString("it-IT")} blocchi nel periodo corrente.`
              : "Usa l'elenco campagne per seguire i prossimi passaggi del workspace."}
          </p>
        </div>

        <Link
          className="client-dashboard-hero__action"
          href={`/c/${summary.client.portalSlug}/campaigns`}
        >
          Vai alle campagne
        </Link>
      </div>
    </section>
  );
}
