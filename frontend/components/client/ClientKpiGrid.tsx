import type { ClientOverviewSummary } from "../../types";
import type { ClientDashboardModel } from "./dashboardModel";

interface ClientKpiGridProps {
  summary: ClientOverviewSummary;
  model?: ClientDashboardModel;
}

export function ClientKpiGrid({ summary, model }: ClientKpiGridProps) {
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
  const cards = [
    {
      title: "Campagne attive",
      value:
        typeof summary.limits.maxCampaigns === "number" && summary.limits.maxCampaigns > 0
          ? `${dashboardModel.activeCampaigns.toLocaleString("it-IT")} / ${summary.limits.maxCampaigns.toLocaleString("it-IT")}`
          : dashboardModel.activeCampaigns.toLocaleString("it-IT"),
      tone: "campaigns",
      detail:
        dashboardModel.remainingCampaignSlots === null
          ? "Conta solo le campagne in corso."
          : dashboardModel.remainingCampaignSlots === 0
            ? "Tutti gli slot attivi risultano occupati."
            : `${dashboardModel.remainingCampaignSlots.toLocaleString("it-IT")} ${dashboardModel.remainingCampaignSlots === 1 ? "slot disponibile" : "slot disponibili"}.`,
      emphasis: dashboardModel.limitStatus.tone === "danger" ? "warning" : undefined,
    },
    {
      title: "Da completare",
      value: dashboardModel.campaignsToComplete.toLocaleString("it-IT"),
      tone: "attention",
      detail:
        dashboardModel.campaignsToComplete > 0
          ? "Bozze o pause ancora da rifinire."
          : "Nessuna campagna incompleta visibile.",
      emphasis: undefined,
    },
    {
      title: "Blocchi nel periodo",
      value: dashboardModel.blockedSendsCount.toLocaleString("it-IT"),
      tone: "blocked",
      detail:
        dashboardModel.blockedSendsCount > 0
          ? "Invii fermati dal backend nel periodo corrente."
          : "Nessun blocco registrato nel periodo corrente.",
      emphasis: undefined,
    },
    {
      title: "Campagne pronte",
      value:
        dashboardModel.readyCampaigns.toLocaleString("it-IT"),
      tone: "limits",
      detail:
        dashboardModel.readyCampaigns > 0
          ? "Pronte da avviare, ma fuori dalla capacità attiva."
          : "Nessuna campagna pronta al momento.",
      emphasis: undefined,
    },
  ];

  return (
    <section className="client-kpi-grid" aria-label="Riepilogo dashboard cliente">
      {cards.map((card) => (
        <article
          key={card.title}
          className="client-kpi-card"
          data-emphasis={card.emphasis}
          data-tone={card.tone}
        >
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
