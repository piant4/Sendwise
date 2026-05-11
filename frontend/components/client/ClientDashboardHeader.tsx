import { StatusBadge } from "../ui/StatusBadge";
import type { ClientOverviewSummary } from "../../types";
import {
  formatOptionalLimit,
  getClientAccessStatusLabel,
  getClientAccountVariant,
  getClientStatusLabel,
} from "./clientStatus";

interface ClientDashboardHeaderProps {
  summary: ClientOverviewSummary;
}

export function ClientDashboardHeader({
  summary,
}: ClientDashboardHeaderProps) {
  const campaignCapacityRatio =
    typeof summary.limits.maxCampaigns === "number" && summary.limits.maxCampaigns > 0
      ? summary.campaigns.totalCampaigns / summary.limits.maxCampaigns
      : null;

  const health =
    summary.client.clientStatus !== "active"
      ? {
          label: "Operativita limitata",
          description:
            "Lo stato account richiede attenzione prima di aumentare il volume operativo.",
          variant: getClientAccountVariant(summary.client.clientStatus),
        }
      : summary.client.accessStatus !== "active"
        ? {
            label: "Accesso da verificare",
            description:
              "L'accesso cliente non risulta pienamente attivo e va verificato prima di nuove operazioni.",
            variant: "warning" as const,
          }
        : summary.blockedSends.currentPeriodCount > 0
          ? {
              label: "Attenzione sui blocchi",
              description:
                "Sono presenti invii bloccati nel periodo corrente e conviene controllare le ultime segnalazioni.",
              variant: "warning" as const,
            }
          : campaignCapacityRatio !== null && campaignCapacityRatio >= 0.8
            ? {
                label: "Vicino al limite campagne",
                description:
                  "Il numero di campagne visibili e vicino alla capacita configurata per il workspace.",
                variant: "warning" as const,
              }
            : {
                label: "Operativita regolare",
                description:
                  "Lo stato attuale non mostra blocchi critici e la capacita campagne resta sotto controllo.",
                variant: "success" as const,
              };

  return (
    <section className="client-hero">
      <div className="client-hero__copy">
        <div className="client-hero__headline">
          <p className="client-hero__eyebrow">Riepilogo operativo</p>
          <h2 className="client-hero__title">{health.label}</h2>
          <p className="client-hero__lead">
            {summary.client.name} e il contatto {summary.client.email}. Oggi vedi
            campagne attive, blocchi rilevati e limiti configurati senza dettagli
            interni superflui.
          </p>
        </div>
        <div className="client-hero__status-row">
          <StatusBadge
            label={getClientStatusLabel(summary.client.clientStatus)}
            variant={getClientAccountVariant(summary.client.clientStatus)}
          />
          <StatusBadge
            label={getClientAccessStatusLabel(summary.client.accessStatus)}
            variant="neutral"
          />
          <StatusBadge label={health.label} variant={health.variant} />
        </div>
        <div className="client-hero__facts">
          <article className="client-hero__fact">
            <span>Campagne attive</span>
            <strong>{summary.campaigns.activeCampaigns.toLocaleString()}</strong>
          </article>
          <article className="client-hero__fact">
            <span>In corso ora</span>
            <strong>{summary.campaigns.runningCampaigns.toLocaleString()}</strong>
          </article>
          <article className="client-hero__fact">
            <span>Blocchi nel periodo</span>
            <strong>{summary.blockedSends.currentPeriodCount.toLocaleString()}</strong>
          </article>
          <article className="client-hero__fact">
            <span>Slot campagne</span>
            <strong>
              {typeof summary.limits.maxCampaigns === "number" &&
              summary.limits.maxCampaigns > 0
                ? `${summary.campaigns.totalCampaigns.toLocaleString()} / ${summary.limits.maxCampaigns.toLocaleString()}`
                : summary.campaigns.totalCampaigns.toLocaleString()}
            </strong>
          </article>
        </div>
      </div>

      <div className="client-hero__meter">
        <div className="client-hero__meter-header">
          <span>Capacita campagne</span>
          <strong>
            {typeof summary.limits.maxCampaigns === "number" &&
            summary.limits.maxCampaigns > 0
              ? `${Math.round(Math.min(campaignCapacityRatio ?? 0, 1) * 100)}%`
              : "n/d"}
          </strong>
        </div>
        <div className="client-progress" aria-hidden="true">
          <div
            className="client-progress__fill"
            style={{
              width:
                campaignCapacityRatio !== null
                  ? `${Math.max(8, Math.min(campaignCapacityRatio * 100, 100))}%`
                  : "18%",
            }}
          />
        </div>
        <p className="client-hero__summary">{health.description}</p>
        <div className="client-fact-grid">
          <article className="client-fact-card">
            <span>email_limit_per_campaign</span>
            <strong>{formatOptionalLimit(summary.limits.emailLimitPerCampaign)}</strong>
            <p>Soglia letta in sola visualizzazione dal backend.</p>
          </article>
          <article className="client-fact-card">
            <span>max_campaigns</span>
            <strong>{formatOptionalLimit(summary.limits.maxCampaigns)}</strong>
            <p>Numero massimo di campagne configurato per il workspace.</p>
          </article>
        </div>
        <div className="client-hero__meter-footer">
          <span>
            {summary.campaigns.totalCampaigns.toLocaleString()} campagne visibili
          </span>
          <span>
            {summary.usage.hasData
              ? `${summary.usage.totalRecords.toLocaleString()} record utilizzo disponibili`
              : "Nessun utilizzo registrato nel periodo"}
          </span>
        </div>
      </div>
    </section>
  );
}
