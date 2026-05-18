"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type {
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
  { key: "sent", label: "Inviate", tone: "sent" },
  { key: "blocked", label: "Bloccate", tone: "blocked" },
  { key: "opened", label: "Aperte", tone: "opened" },
  { key: "queued", label: "In coda", tone: "queued" },
] as const;

function getFallbackWindows(): Record<ClientDashboardWindowKey, ClientDashboardWindowMetrics> {
  const endedAt = new Date().toISOString();
  const emptyWindow: ClientDashboardWindowMetrics = {
    sent: null,
    queued: null,
    blocked: null,
    opened: null,
    sentAvailable: false,
    queuedAvailable: false,
    blockedAvailable: false,
    openedAvailable: false,
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
    case "blocked":
      return { value: window.blocked, available: window.blockedAvailable };
    case "opened":
      return { value: window.opened, available: window.openedAvailable };
    case "queued":
      return { value: window.queued, available: window.queuedAvailable };
    default:
      return { value: null, available: false };
  }
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
    (metric) => metric.available && typeof metric.value === "number" && metric.value > 0,
  );
  const statusSummary = summary.clientDashboard?.statusSummary;
  const campaignsHref =
    summary.clientDashboard?.cta.campaignsHref || `/c/${summary.client.portalSlug}/campaigns`;

  return (
    <ClientSurface
      className="client-surface--performance"
      bodyClassName="client-surface__body--performance"
      title="Performance campagne"
      description="Risultati reali delle campagne nel periodo selezionato."
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
            <strong>
              {metric.available && typeof metric.value === "number"
                ? metric.value.toLocaleString("it-IT")
                : "Non disponibili"}
            </strong>
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
                  <strong>
                    {metric.available && typeof metric.value === "number"
                      ? metric.value.toLocaleString("it-IT")
                      : "Non disponibili"}
                  </strong>
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
          Avvia la prima campagna per ricevere dati.
        </div>
      )}

      {statusSummary ? (
        <div className="client-status-summary">
          <span>In corso {statusSummary.running.toLocaleString("it-IT")}</span>
          <span>Pronte {statusSummary.ready.toLocaleString("it-IT")}</span>
          <span>Da completare {statusSummary.toComplete.toLocaleString("it-IT")}</span>
          <span>Bloccate {statusSummary.blocked.toLocaleString("it-IT")}</span>
          <span>Completate {statusSummary.completed.toLocaleString("it-IT")}</span>
        </div>
      ) : null}

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
