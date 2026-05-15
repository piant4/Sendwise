import type { ClientOverviewSummary } from "../../types";

interface ClientKpiGridProps {
  summary: ClientOverviewSummary;
}

export function ClientKpiGrid({ summary }: ClientKpiGridProps) {
  const campaignsNeedingAttention =
    summary.campaigns.statusCounts.blocked + summary.campaigns.statusCounts.failed;
  const pausedCampaigns = summary.campaigns.statusCounts.paused;
  const remainingSlots =
    typeof summary.limits.maxCampaigns === "number" && summary.limits.maxCampaigns > 0
      ? Math.max(summary.limits.maxCampaigns - summary.campaigns.totalCampaigns, 0)
      : null;

  const cards = [
    {
      title: "Campagne attive",
      value: summary.campaigns.activeCampaigns.toLocaleString("it-IT"),
      tone: "campaigns",
      emphasis: "primary",
      detail: `${summary.campaigns.totalCampaigns.toLocaleString("it-IT")} visibili nel workspace`,
    },
    {
      title: "In corso",
      value: summary.campaigns.runningCampaigns.toLocaleString("it-IT"),
      tone: "sent",
      detail: `${summary.campaigns.statusCounts.ready.toLocaleString("it-IT")} pronte e ${summary.campaigns.statusCounts.draft.toLocaleString("it-IT")} bozze`,
    },
    {
      title: "Da seguire",
      value: campaignsNeedingAttention.toLocaleString("it-IT"),
      tone: "blocked",
      detail:
        pausedCampaigns > 0
          ? `${pausedCampaigns.toLocaleString("it-IT")} campagne in pausa`
          : "Nessuna pausa attiva",
    },
    {
      title: "Capacita residua",
      value:
        remainingSlots === null
          ? "n/d"
          : remainingSlots.toLocaleString("it-IT"),
      tone: "limits",
      detail:
        remainingSlots === null
          ? "Campagne massime non configurate"
          : "Slot campagne ancora disponibili",
    },
  ];

  return (
    <section className="client-kpi-grid" aria-label="Indicatori cliente">
      {cards.map((card) => (
        <article
          key={card.title}
          className="client-kpi-card"
          data-tone={card.tone}
          data-emphasis={card.emphasis}
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
