import Link from "next/link";
import { StatusBadge } from "../ui/StatusBadge";
import type { ClientOverviewSummary } from "../../types";
import type { ClientDashboardModel } from "./dashboardModel";
import {
  getClientAccessStatusLabel,
  getClientAccountVariant,
  getClientStatusLabel,
} from "./clientStatus";

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
    <section className="client-hero client-dashboard-hero">
      <div className="client-dashboard-hero__copy">
        <div className="client-dashboard-hero__headline">
          <p className="client-hero__eyebrow">Dashboard</p>
          <div className="client-dashboard-hero__title-row">
            <h1 className="client-hero__title">{summary.client.name}</h1>
            <span className="client-dashboard-hero__workspace">Workspace cliente</span>
          </div>
          <p className="client-dashboard-hero__lead">
            Vista operativa con campagne visibili, prontezza reale e limiti attivi del
            workspace.
          </p>
        </div>

        <div className="client-dashboard-hero__status">
          <StatusBadge
            label={dashboardModel.workspaceStatus.label}
            variant={dashboardModel.workspaceStatus.variant}
          />
          <StatusBadge
            label={getClientAccessStatusLabel(summary.client.accessStatus)}
            variant={summary.client.accessStatus === "active" ? "success" : "warning"}
          />
          <StatusBadge
            label={getClientStatusLabel(summary.client.clientStatus)}
            variant={getClientAccountVariant(summary.client.clientStatus)}
          />
        </div>

        <div className="client-dashboard-hero__facts">
          <div className="client-dashboard-hero__fact-pill">
            <span>Campagne visibili</span>
            <strong>
              {dashboardModel.recentCampaignsVisible.toLocaleString("it-IT")}
            </strong>
          </div>
          <div className="client-dashboard-hero__fact-pill">
            <span>Campagne pronte</span>
            <strong>{dashboardModel.readyCampaigns.toLocaleString("it-IT")}</strong>
          </div>
        </div>
      </div>

      <div className="client-dashboard-hero__actions">
        <div className="client-dashboard-hero__focus">
          <span className="client-dashboard-hero__focus-label">Contesto operativo</span>
          <strong className="client-dashboard-hero__focus-value">
            {dashboardModel.readyCampaigns > 0
              ? `${dashboardModel.readyCampaigns.toLocaleString("it-IT")} ${dashboardModel.readyCampaigns === 1 ? "campagna pronta" : "campagne pronte"}`
              : dashboardModel.campaignsNeedingAttention > 0
                ? `${dashboardModel.campaignsNeedingAttention.toLocaleString("it-IT")} ${dashboardModel.campaignsNeedingAttention === 1 ? "campagna da seguire" : "campagne da seguire"}`
                : "Nessuna urgenza visibile"}
          </strong>
          <p className="client-dashboard-hero__focus-copy">
            {dashboardModel.workspaceStatus.detail}
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
