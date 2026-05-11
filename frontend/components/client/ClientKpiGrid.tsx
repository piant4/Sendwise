import type { ClientOverviewSummary } from "../../types";

interface ClientKpiGridProps {
  summary: ClientOverviewSummary;
}

export function ClientKpiGrid({ summary }: ClientKpiGridProps) {
  const cards = [
    {
      title: "Campagne attive",
      value: summary.campaigns.activeCampaigns.toLocaleString(),
      tone: "campaigns",
      detail: `${summary.campaigns.totalCampaigns.toLocaleString()} campagne totali nel perimetro cliente`,
    },
    {
      title: "Campagne in corso",
      value: summary.campaigns.runningCampaigns.toLocaleString(),
      tone: "sent",
      detail: `${summary.campaigns.statusCounts.ready.toLocaleString()} pronte e ${summary.campaigns.statusCounts.draft.toLocaleString()} bozze`,
    },
    {
      title: "Blocchi nel periodo",
      value: summary.blockedSends.currentPeriodCount.toLocaleString(),
      tone: "blocked",
      detail: "Conteggio del mese corrente registrato dal backend",
    },
    {
      title: "Record utilizzo",
      value: summary.usage.totalRecords.toLocaleString(),
      tone: "limits",
      detail:
        summary.usage.hasData
          ? `${summary.usage.currentPeriodTotals.length.toLocaleString()} tipologie registrate nel periodo`
          : "Nessun utilizzo registrato nel periodo corrente",
    },
  ];

  return (
    <section className="client-kpi-grid" aria-label="Indicatori cliente">
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
