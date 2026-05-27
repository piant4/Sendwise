"use client";

import type {
  ClientDashboardKpiValue,
  ClientDashboardWindowKey,
  ClientOverviewSummary,
} from "../../types";

interface ClientKpiGridProps {
  summary: ClientOverviewSummary;
  selectedWindow: ClientDashboardWindowKey;
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
    return "Dati Mailgun non ancora collegati";
  }

  return "Non disponibili";
}

const WINDOW_LABELS: Record<ClientDashboardWindowKey, string> = {
  "24h": "24h",
  "7d": "7 gg",
  "14d": "14 gg",
  "30d": "30 gg",
  allTime: "Sempre",
};

function buildWindowMetric(
  value: number | null,
  available: boolean,
): ClientDashboardKpiValue {
  return {
    value,
    available,
  };
}

export function ClientKpiGrid({ summary, selectedWindow }: ClientKpiGridProps) {
  const dashboard = summary.clientDashboard;
  const selectedMetrics = dashboard?.performanceAnalytics.windows[selectedWindow];
  const windowLabel = WINDOW_LABELS[selectedWindow];
  const sentMetric = buildWindowMetric(
    selectedMetrics?.sent ?? null,
    selectedMetrics?.sentAvailable ?? false,
  );

  const cards = [
    {
      title: "Campagne attive",
      value: formatMetric(dashboard?.kpis.activeCampaigns ?? { value: null, available: false }, true),
      tone: "campaigns",
    },
    {
      title: `Mail inviate ${windowLabel}`,
      value: formatMetric(sentMetric),
      tone: "sent",
    },
    {
      title: `Consegnate ${windowLabel}`,
      value: formatProviderMetric(
        buildWindowMetric(
          selectedMetrics?.delivered ?? null,
          selectedMetrics?.deliveredAvailable ?? false,
        ),
        sentMetric,
      ),
      tone: "limits",
    },
    {
      title: `Aperture ${windowLabel}`,
      value: formatProviderMetric(
        buildWindowMetric(
          selectedMetrics?.opened ?? null,
          selectedMetrics?.openedAvailable ?? false,
        ),
        sentMetric,
      ),
      tone: "blocked",
    },
    {
      title: `Click ${windowLabel}`,
      value: formatProviderMetric(
        buildWindowMetric(
          selectedMetrics?.clicked ?? null,
          selectedMetrics?.clickedAvailable ?? false,
        ),
        sentMetric,
      ),
      tone: "queued",
    },
  ];

  const topCards = cards.slice(0, 2);
  const bottomCards = cards.slice(2);

  return (
    <section className="client-kpi-grid" aria-label="Riepilogo dashboard cliente">
      <div className="client-kpi-grid__row client-kpi-grid__row--top">
        {topCards.map((card) => (
          <article key={card.title} className="client-kpi-card" data-tone={card.tone}>
            <div className="client-kpi-card__topline">
              <span className="client-kpi-card__title">{card.title}</span>
              <span className="client-kpi-card__pulse" aria-hidden="true" />
            </div>
            <strong className="client-kpi-card__value">{card.value}</strong>
          </article>
        ))}
      </div>

      <div className="client-kpi-grid__row client-kpi-grid__row--bottom">
        {bottomCards.map((card) => (
          <article key={card.title} className="client-kpi-card" data-tone={card.tone}>
            <div className="client-kpi-card__topline">
              <span className="client-kpi-card__title">{card.title}</span>
              <span className="client-kpi-card__pulse" aria-hidden="true" />
            </div>
            <strong className="client-kpi-card__value">{card.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
