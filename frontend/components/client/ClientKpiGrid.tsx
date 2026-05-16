import type { ClientOverviewSummary } from "../../types";
import type { ClientDashboardModel } from "./dashboardModel";

interface ClientKpiGridProps {
  summary: ClientOverviewSummary;
  model?: ClientDashboardModel;
}

export function ClientKpiGrid({ summary, model }: ClientKpiGridProps) {
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
  const cards = [
    {
      title: "Campagne pronte",
      value: dashboardModel.readyCampaigns.toLocaleString("it-IT"),
      tone: "campaigns",
      detail:
        dashboardModel.readyCampaigns > 0
          ? "Pronte per il prossimo passaggio operativo."
          : "Nessuna campagna pronta in questo momento.",
    },
    {
      title: "Da completare",
      value: dashboardModel.campaignsToComplete.toLocaleString("it-IT"),
      tone: "sent",
      detail:
        dashboardModel.campaignsToComplete > 0
          ? "Bozze o pause ancora da completare."
          : "Nessuna campagna incompleta visibile.",
    },
    {
      title: "Da seguire",
      value: dashboardModel.campaignsNeedingAttention.toLocaleString("it-IT"),
      tone: "blocked",
      detail:
        dashboardModel.campaignsNeedingAttention > 0
          ? "Pause, errori o blocchi da verificare."
          : "Nessuna campagna richiede attenzione immediata.",
    },
    {
      title: "Limite campagne",
      value:
        typeof summary.limits.maxCampaigns === "number" && summary.limits.maxCampaigns > 0
          ? `${summary.campaigns.totalCampaigns.toLocaleString("it-IT")} / ${summary.limits.maxCampaigns.toLocaleString("it-IT")}`
          : "Non configurato",
      tone: "limits",
      detail:
        dashboardModel.remainingCampaignSlots === null
          ? "Capacità massima non definita."
          : `${dashboardModel.remainingCampaignSlots.toLocaleString("it-IT")} slot ancora disponibili.`,
    },
  ];

  return (
    <section className="client-kpi-grid" aria-label="Riepilogo dashboard cliente">
      {cards.map((card) => (
        <article key={card.title} className="client-kpi-card" data-tone={card.tone}>
          <div className="client-kpi-card__topline">
            <span className="client-kpi-card__title">{card.title}</span>
            <span className="client-kpi-card__pulse" aria-hidden="true" />
          </div>
          <strong className="client-kpi-card__value">{card.value}</strong>
          <p className="client-kpi-card__detail">{card.detail}</p>
        </article>
      ))}
    </section>
  );
}
