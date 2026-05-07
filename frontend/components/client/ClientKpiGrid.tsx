import type { ClientOverviewSummary } from "../../types";
import { formatLimitValue } from "./clientStatus";

interface ClientKpiGridProps {
  summary: ClientOverviewSummary;
}

export function ClientKpiGrid({ summary }: ClientKpiGridProps) {
  const cards = [
    {
      title: "Campagne attive",
      value: summary.activeCampaigns.toLocaleString(),
      tone: "campaigns",
      detail: `${summary.campaignSummaries.length.toLocaleString()} campagne nel riepilogo corrente`,
    },
    {
      title: "Invii bloccati",
      value: summary.blockedSendsThisMonth.toLocaleString(),
      tone: "blocked",
      detail: "Segnali recenti che richiedono attenzione lato cliente",
    },
    {
      title: "Email inviate",
      value: summary.monthlyEmailsSent.toLocaleString(),
      tone: "sent",
      detail: "Volume mensile mostrato dal boundary frontend corrente",
    },
    {
      title: "Limite mensile",
      value: formatLimitValue(summary.monthlyEmailLimit),
      tone: "limits",
      detail:
        summary.monthlyEmailLimit > 0
          ? "Capienza disponibile per il mese in corso"
          : "Valore non ancora esposto dal dataset attuale",
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
