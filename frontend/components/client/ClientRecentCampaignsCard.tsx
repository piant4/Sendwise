"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatProviderEventMetric } from "../shared/campaignUi";
import type {
  CampaignLogsSummary,
  ClientDashboardWindowKey,
  ClientDashboardWindowMetrics,
  ClientOverviewSummary,
} from "../../types";
import { ClientSurface } from "./ClientSurface";

interface ClientRecentCampaignsCardProps {
  summary: ClientOverviewSummary;
}

const WINDOW_LABELS: Record<ClientDashboardWindowKey, string> = {
  "24h": "24h",
  "7d": "7gg",
  "14d": "14gg",
  "30d": "30gg",
  allTime: "Sempre",
};

const METRIC_CONFIG = [
  { key: "sent", label: "Accettate", tone: "sent", providerBacked: false },
  { key: "failed", label: "Fallite", tone: "blocked", providerBacked: false },
  { key: "delivered", label: "Consegnate", tone: "opened", providerBacked: true },
  { key: "opened", label: "Aperte", tone: "limits", providerBacked: true },
  { key: "clicked", label: "Click", tone: "queued", providerBacked: true },
] as const;

function getFallbackWindows(): Record<ClientDashboardWindowKey, ClientDashboardWindowMetrics> {
  const endedAt = new Date().toISOString();
  const emptyWindow: ClientDashboardWindowMetrics = {
    sent: null,
    failed: null,
    delivered: null,
    opened: null,
    clicked: null,
    sentAvailable: false,
    failedAvailable: false,
    deliveredAvailable: false,
    openedAvailable: false,
    clickedAvailable: false,
    deliveryRate: null,
    openRate: null,
    clickRate: null,
    deliveryRateAvailable: false,
    openRateAvailable: false,
    clickRateAvailable: false,
    windowStartedAt: null,
    windowEndedAt: endedAt,
  };

  return {
    "24h": emptyWindow,
    "7d": emptyWindow,
    "14d": emptyWindow,
    "30d": emptyWindow,
    allTime: emptyWindow,
  };
}

function getValue(window: ClientDashboardWindowMetrics, key: (typeof METRIC_CONFIG)[number]["key"]) {
  switch (key) {
    case "sent":
      return { value: window.sent, available: window.sentAvailable };
    case "failed":
      return { value: window.failed, available: window.failedAvailable };
    case "delivered":
      return { value: window.delivered, available: window.deliveredAvailable };
    case "opened":
      return { value: window.opened, available: window.openedAvailable };
    case "clicked":
      return { value: window.clicked, available: window.clickedAvailable };
    default:
      return { value: null, available: false };
  }
}

function toProviderMetricLogs(window: ClientDashboardWindowMetrics): CampaignLogsSummary {
  return {
    simulated: 0,
    queued: 0,
    sent: window.sent ?? 0,
    failed: window.failed ?? 0,
    delivered: window.delivered,
    opened: window.opened,
    clicked: window.clicked,
    bounced: null,
    complained: null,
    unsubscribed: null,
    sentAvailable: window.sentAvailable,
    failedAvailable: window.failedAvailable,
    deliveredAvailable: window.deliveredAvailable,
    openedAvailable: window.openedAvailable,
    clickedAvailable: window.clickedAvailable,
    bouncedAvailable: false,
    complainedAvailable: false,
    unsubscribedAvailable: false,
    deliveryRate: window.deliveryRate,
    openRate: window.openRate,
    clickRate: window.clickRate,
    bounceRate: null,
    complaintRate: null,
    unsubscribeRate: null,
    deliveryRateAvailable: window.deliveryRateAvailable,
    openRateAvailable: window.openRateAvailable,
    clickRateAvailable: window.clickRateAvailable,
    bounceRateAvailable: false,
    complaintRateAvailable: false,
    unsubscribeRateAvailable: false,
    providerEventsAvailable:
      window.deliveredAvailable || window.openedAvailable || window.clickedAvailable,
  };
}

function getMetricDisplayValue(
  window: ClientDashboardWindowMetrics,
  metric: (typeof METRIC_CONFIG)[number],
  value: number | null,
  available: boolean,
): string {
  if (metric.providerBacked) {
    if (typeof value === "number") {
      return formatProviderEventMetric(value, toProviderMetricLogs(window));
    }

    return (window.sent ?? 0) > 0
      ? "Dati Mailgun non ancora collegati"
      : "Non disponibili";
  }

  if (available && typeof value === "number") {
    return value.toLocaleString("it-IT");
  }

  return "Non disponibili";
}

export function ClientRecentCampaignsCard({
  summary,
}: ClientRecentCampaignsCardProps) {
  const performance = summary.clientDashboard?.performanceAnalytics;
  const windows = performance?.windows ?? getFallbackWindows();
  const [selectedWindow, setSelectedWindow] = useState<ClientDashboardWindowKey>(
    performance?.defaultWindow ?? "7d",
  );
  const selectedMetrics = windows[selectedWindow] ?? windows["7d"];
  const metricEntries = useMemo(
    () =>
      METRIC_CONFIG.map((metric) => {
        const data = getValue(selectedMetrics, metric.key);
        return {
          ...metric,
          available: data.available,
          value: data.value,
          displayValue: getMetricDisplayValue(
            selectedMetrics,
            metric,
            data.value,
            data.available,
          ),
        };
      }),
    [selectedMetrics],
  );
  const maxValue = Math.max(
    ...metricEntries
      .filter((metric) => metric.available && typeof metric.value === "number")
      .map((metric) => metric.value ?? 0),
    0,
  );
  const hasAnyVisibleData = metricEntries.some(
    (metric) => metric.available && typeof metric.value === "number",
  );
  const campaignsHref =
    summary.clientDashboard?.cta.campaignsHref || `/c/${summary.client.portalSlug}/campaigns`;

  return (
    <ClientSurface
      className="client-surface--performance"
      bodyClassName="client-surface__body--performance"
      title="Trend invii e segnali Mailgun"
      // description="Mail inviate = accettate dal sistema. Consegne, aperture e click arrivano solo da eventi provider."
      aside={
        <div className="client-period-selector" aria-label="Selettore periodo">
          {(Object.keys(WINDOW_LABELS) as ClientDashboardWindowKey[]).map((windowKey) => (
            <button
              key={windowKey}
              type="button"
              className="client-period-selector__button"
              data-active={selectedWindow === windowKey}
              onClick={() => setSelectedWindow(windowKey)}
            >
              {WINDOW_LABELS[windowKey]}
            </button>
          ))}
        </div>
      }
    >
      <div className="client-performance-summary">
        {metricEntries.map((metric) => (
          <article key={metric.label} className="client-performance-summary__item">
            <span>{metric.label}</span>
            <strong>{metric.displayValue}</strong>
          </article>
        ))}
      </div>

      {hasAnyVisibleData ? (
        <div className="client-performance-chart" aria-label="Performance campagne nel periodo">
          {metricEntries.map((metric) => {
            const width =
              metric.available && typeof metric.value === "number" && maxValue > 0
                ? `${Math.max((metric.value / maxValue) * 100, metric.value > 0 ? 16 : 0)}%`
                : "0%";

            return (
              <article key={metric.label} className="client-performance-chart__row">
                <div className="client-performance-chart__summary">
                  <span>{metric.label}</span>
                  <strong>{metric.displayValue}</strong>
                </div>
                <div className="client-performance-chart__track" aria-hidden="true">
                  <span
                    className="client-performance-chart__fill"
                    data-tone={metric.tone}
                    style={{ width }}
                  />
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="client-empty-state client-empty-state--compact">
          Nessun volume reale disponibile nel periodo selezionato.
        </div>
      )}

      <div className="client-dashboard-card__footer">
        <Link
          className="client-dashboard-hero__action client-dashboard-hero__action--inline"
          href={campaignsHref}
        >
          Vai alla pagina campagne
        </Link>
      </div>
    </ClientSurface>
  );
}
