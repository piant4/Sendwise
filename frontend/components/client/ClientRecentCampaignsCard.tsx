"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  formatProviderEventMetric,
  getProviderEventsAvailabilityLabel,
} from "../shared/campaignUi";
import type {
  CampaignLogsSummary,
  ClientDashboardWindowKey,
  ClientDashboardWindowMetrics,
  ClientOverviewSummary,
} from "../../types";
import { ClientSurface } from "./ClientSurface";

interface ClientRecentCampaignsCardProps {
  summary: ClientOverviewSummary;
  selectedWindow: ClientDashboardWindowKey;
  onSelectWindow: (windowKey: ClientDashboardWindowKey) => void;
}

const WINDOW_LABELS: Record<ClientDashboardWindowKey, string> = {
  "24h": "24h",
  "7d": "7gg",
  "14d": "14gg",
  "30d": "30gg",
  allTime: "Sempre",
};
const WINDOW_KEYS = Object.keys(WINDOW_LABELS) as ClientDashboardWindowKey[];

const METRIC_CONFIG = [
  { key: "sent", label: "Accettate", tone: "sent", providerBacked: false },
  { key: "failed", label: "Fallite", tone: "blocked", providerBacked: false },
  { key: "delivered", label: "Consegnate", tone: "opened", providerBacked: true },
  { key: "opened", label: "Aperte", tone: "limits", providerBacked: true },
  { key: "clicked", label: "Click", tone: "queued", providerBacked: true },
] as const;

function createEmptyWindowMetrics(): ClientDashboardWindowMetrics {
  return {
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
    windowEndedAt: new Date().toISOString(),
  };
}

function getFallbackWindows(): Record<ClientDashboardWindowKey, ClientDashboardWindowMetrics> {
  return Object.fromEntries(
    WINDOW_KEYS.map((windowKey) => [windowKey, createEmptyWindowMetrics()]),
  ) as Record<ClientDashboardWindowKey, ClientDashboardWindowMetrics>;
}

function getNormalizedWindows(
  windows?: Partial<Record<ClientDashboardWindowKey, ClientDashboardWindowMetrics>> | null,
): Record<ClientDashboardWindowKey, ClientDashboardWindowMetrics> {
  if (!windows) {
    return getFallbackWindows();
  }

  return WINDOW_KEYS.reduce<Record<ClientDashboardWindowKey, ClientDashboardWindowMetrics>>(
    (accumulator, windowKey) => {
      accumulator[windowKey] = windows[windowKey] ?? createEmptyWindowMetrics();
      return accumulator;
    },
    getFallbackWindows(),
  );
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

function formatRate(value: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "Non disponibile";
  }

  return `${(value * 100).toLocaleString("it-IT", {
    maximumFractionDigits: value * 100 >= 10 ? 0 : 1,
  })}%`;
}

function getRatioLabel(
  numerator: number | null,
  numeratorAvailable: boolean,
  denominator: number | null,
  denominatorAvailable: boolean,
  suffix: string,
  unavailableLabel = "Non disponibile",
): string {
  if (!numeratorAvailable || !denominatorAvailable) {
    return unavailableLabel;
  }

  if (typeof denominator !== "number" || denominator <= 0) {
    return "Non disponibile";
  }

  return `${formatRate((numerator ?? 0) / denominator)} ${suffix}`;
}

function getMetricEntry(
  metricEntries: Array<{
    key: (typeof METRIC_CONFIG)[number]["key"];
    displayValue: string;
  }>,
  key: (typeof METRIC_CONFIG)[number]["key"],
): string {
  return metricEntries.find((metric) => metric.key === key)?.displayValue ?? "Non disponibili";
}

export function ClientRecentCampaignsCard({
  summary,
  selectedWindow,
  onSelectWindow,
}: ClientRecentCampaignsCardProps) {
  const performance = summary.clientDashboard?.performanceAnalytics;
  const windows = useMemo(
    () => getNormalizedWindows(performance?.windows),
    [performance?.windows],
  );
  const availableWindowKeys = useMemo(
    () =>
      new Set(
        Object.keys(performance?.windows ?? {}).filter(
          (windowKey): windowKey is ClientDashboardWindowKey => windowKey in WINDOW_LABELS,
        ),
      ),
    [performance?.windows],
  );
  const selectedMetrics = windows[selectedWindow];
  const selectedWindowAvailable = availableWindowKeys.has(selectedWindow);
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
  const providerLogs = useMemo(
    () => toProviderMetricLogs(selectedMetrics),
    [selectedMetrics],
  );
  const providerStatusLabel = getProviderEventsAvailabilityLabel(providerLogs);
  const providerStatusTone = providerLogs.providerEventsAvailable
    ? "success"
    : (selectedMetrics.sent ?? 0) > 0
      ? "warning"
      : "neutral";
  const providerUnavailableLabel =
    (selectedMetrics.sent ?? 0) > 0 ? providerStatusLabel : "Non disponibile";
  const maxValue = Math.max(
    ...metricEntries
      .filter((metric) => metric.available && typeof metric.value === "number")
      .map((metric) => metric.value ?? 0),
    0,
  );
  const hasAnyVisibleData = selectedWindowAvailable && metricEntries.some(
    (metric) => metric.available && typeof metric.value === "number",
  );
  const emptyStateMessage = !selectedWindowAvailable
    ? `Il riepilogo ${WINDOW_LABELS[selectedWindow]} non e disponibile in questo momento.`
    : `Nessun dato disponibile per ${WINDOW_LABELS[selectedWindow]}.`;
  const detailedMetricHelpers: Record<(typeof METRIC_CONFIG)[number]["key"], string> = {
    sent: selectedMetrics.sentAvailable ? "Base del periodo selezionato" : "Non disponibile",
    failed: getRatioLabel(
      selectedMetrics.failed,
      selectedMetrics.failedAvailable,
      selectedMetrics.sent,
      selectedMetrics.sentAvailable,
      "delle accettate",
    ),
    delivered: getRatioLabel(
      selectedMetrics.delivered,
      selectedMetrics.deliveredAvailable,
      selectedMetrics.sent,
      selectedMetrics.sentAvailable,
      "delle accettate",
      providerUnavailableLabel,
    ),
    opened: getRatioLabel(
      selectedMetrics.opened,
      selectedMetrics.openedAvailable,
      selectedMetrics.delivered,
      selectedMetrics.deliveredAvailable,
      "delle consegnate",
      providerUnavailableLabel,
    ),
    clicked: getRatioLabel(
      selectedMetrics.clicked,
      selectedMetrics.clickedAvailable,
      selectedMetrics.opened,
      selectedMetrics.openedAvailable,
      "delle aperture",
      providerUnavailableLabel,
    ),
  };
  const funnelSteps = [
    {
      label: "Accettate",
      value: getMetricEntry(metricEntries, "sent"),
      helper: selectedMetrics.sentAvailable ? "Base del funnel" : "Non disponibile",
      accent: "sent",
    },
    {
      label: "Consegnate",
      value: getMetricEntry(metricEntries, "delivered"),
      helper: getRatioLabel(
        selectedMetrics.delivered,
        selectedMetrics.deliveredAvailable,
        selectedMetrics.sent,
        selectedMetrics.sentAvailable,
        "delle accettate",
        providerUnavailableLabel,
      ),
      accent: "opened",
    },
    {
      label: "Aperte",
      value: getMetricEntry(metricEntries, "opened"),
      helper: getRatioLabel(
        selectedMetrics.opened,
        selectedMetrics.openedAvailable,
        selectedMetrics.delivered,
        selectedMetrics.deliveredAvailable,
        "delle consegnate",
        providerUnavailableLabel,
      ),
      accent: "limits",
    },
    {
      label: "Click",
      value: getMetricEntry(metricEntries, "clicked"),
      helper: getRatioLabel(
        selectedMetrics.clicked,
        selectedMetrics.clickedAvailable,
        selectedMetrics.opened,
        selectedMetrics.openedAvailable,
        "delle aperture",
        providerUnavailableLabel,
      ),
      accent: "queued",
    },
  ] as const;
  const campaignsHref =
    summary.clientDashboard?.cta.campaignsHref || `/c/${summary.client.portalSlug}/campaigns`;

  return (
    <ClientSurface
      className="client-surface--performance"
      bodyClassName="client-surface__body--performance"
      title="Trend campagne"
      aside={
        <div className="client-performance-header__aside">
          <div className="client-period-selector" aria-label="Selettore periodo">
            {WINDOW_KEYS.map((windowKey) => (
              <button
                key={windowKey}
                type="button"
                className="client-period-selector__button"
                data-active={selectedWindow === windowKey}
                onClick={() => onSelectWindow(windowKey)}
              >
                {WINDOW_LABELS[windowKey]}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {hasAnyVisibleData ? (
        <>

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
                  <p className="client-performance-chart__helper">
                    {detailedMetricHelpers[metric.key]}
                  </p>
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <p className="client-dashboard-card__empty">{emptyStateMessage}</p>
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
