import type { ClientDashboardKpiValue, ClientOverviewSummary } from "../../types";

interface ClientKpiGridProps {
  summary: ClientOverviewSummary;
}

function formatMetric(value: ClientDashboardKpiValue, withLimit = false): string {
  if (!value.available || value.value === null) {
    return "Non disponibili";
  }

  if (withLimit && typeof value.limit === "number" && value.limit > 0) {
    return `${value.value.toLocaleString("it-IT")} / ${value.limit.toLocaleString("it-IT")}`;
  }

  return value.value.toLocaleString("it-IT");
}

function formatProviderMetric(
  value: ClientDashboardKpiValue,
  sentValue: ClientDashboardKpiValue | undefined,
): string {
  if (value.available && value.value !== null) {
    return value.value.toLocaleString("it-IT");
  }

  if (sentValue?.available && (sentValue.value ?? 0) > 0) {
    return "In attesa di eventi provider";
  }

  return "Non disponibili";
}

export function ClientKpiGrid({ summary }: ClientKpiGridProps) {
  const dashboard = summary.clientDashboard;
  const cards = [
    {
      title: "Campagne attive",
      value: formatMetric(dashboard?.kpis.activeCampaigns ?? { value: null, available: false }, true),
      tone: "campaigns",
    },
    {
      title: "Mail inviate ultimi 7 gg",
      value: formatMetric(
        dashboard?.kpis.sentLast7d ?? { value: null, limit: null, available: false },
      ),
      tone: "sent",
    },
    {
      title: "Consegnate ultimi 7 gg",
      value: formatProviderMetric(
        dashboard?.kpis.deliveredLast7d ?? { value: null, limit: null, available: false },
        dashboard?.kpis.sentLast7d,
      ),
      tone: "limits",
    },
    {
      title: "Aperture ultimi 7 gg",
      value: formatProviderMetric(
        dashboard?.kpis.openedLast7d ?? { value: null, limit: null, available: false },
        dashboard?.kpis.sentLast7d,
      ),
      tone: "blocked",
    },
    {
      title: "Click ultimi 7 gg",
      value: formatProviderMetric(
        dashboard?.kpis.clickedLast7d ?? { value: null, limit: null, available: false },
        dashboard?.kpis.sentLast7d,
      ),
      tone: "queued",
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
        </article>
      ))}
    </section>
  );
}
