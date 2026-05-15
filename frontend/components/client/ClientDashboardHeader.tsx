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

function getCapacityRatio(totalCampaigns: number, maxCampaigns?: number | null) {
  if (typeof maxCampaigns !== "number" || maxCampaigns <= 0) {
    return null;
  }

  return totalCampaigns / maxCampaigns;
}

export function ClientDashboardHeader({
  summary,
}: ClientDashboardHeaderProps) {
  const capacityRatio = getCapacityRatio(
    summary.campaigns.totalCampaigns,
    summary.limits.maxCampaigns,
  );
  const campaignsNeedingAttention =
    summary.campaigns.statusCounts.blocked + summary.campaigns.statusCounts.failed;
  const visualItems = [
    { label: "Bozze", value: summary.campaigns.statusCounts.draft, tone: "draft" },
    { label: "Pronte", value: summary.campaigns.statusCounts.ready, tone: "ready" },
    { label: "In corso", value: summary.campaigns.statusCounts.running, tone: "running" },
    { label: "In pausa", value: summary.campaigns.statusCounts.paused, tone: "paused" },
    { label: "Da seguire", value: campaignsNeedingAttention, tone: "attention" },
  ].filter((item) => item.value > 0);

  const health =
    summary.client.clientStatus !== "active"
      ? {
          label: getClientStatusLabel(summary.client.clientStatus),
          detail: "Lo stato workspace limita l'operativita.",
          variant: getClientAccountVariant(summary.client.clientStatus),
        }
      : summary.client.accessStatus !== "active"
        ? {
            label: getClientAccessStatusLabel(summary.client.accessStatus),
            detail: "L'accesso va verificato prima di nuove attivita.",
            variant: "warning" as const,
          }
        : summary.blockedSends.currentPeriodCount > 0
          ? {
              label: "Invii bloccati presenti",
              detail: "Sono presenti blocchi nel periodo corrente.",
              variant: "warning" as const,
            }
          : campaignsNeedingAttention > 0
            ? {
                label: "Campagne da seguire",
                detail: "Alcune campagne richiedono una verifica operativa.",
                variant: "warning" as const,
              }
            : {
                label: "Operativita regolare",
                detail: "Nessun blocco critico visibile nel riepilogo.",
                variant: "success" as const,
              };

  return (
    <section className="client-hero">
      <div className="client-hero__copy">
        <div className="client-hero__headline">
          <p className="client-hero__eyebrow">Workspace cliente</p>
          <h2 className="client-hero__title">{summary.client.name}</h2>
          <p className="client-hero__lead">{health.detail}</p>
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
            <strong>{summary.campaigns.activeCampaigns.toLocaleString("it-IT")}</strong>
          </article>
          <article className="client-hero__fact">
            <span>Da seguire</span>
            <strong>{campaignsNeedingAttention.toLocaleString("it-IT")}</strong>
          </article>
          <article className="client-hero__fact">
            <span>Blocchi periodo</span>
            <strong>
              {summary.blockedSends.currentPeriodCount.toLocaleString("it-IT")}
            </strong>
          </article>
          <article className="client-hero__fact">
            <span>Campagne visibili</span>
            <strong>{summary.campaigns.totalCampaigns.toLocaleString("it-IT")}</strong>
          </article>
        </div>
      </div>

      <div className="client-hero__meter">
        <div className="client-hero__meter-header">
          <span>Capacita campagne</span>
          <strong>
            {typeof summary.limits.maxCampaigns === "number" &&
            summary.limits.maxCampaigns > 0
              ? `${summary.campaigns.totalCampaigns.toLocaleString("it-IT")} / ${summary.limits.maxCampaigns.toLocaleString("it-IT")}`
              : summary.campaigns.totalCampaigns.toLocaleString("it-IT")}
          </strong>
        </div>
        <div className="client-progress" aria-hidden="true">
          <div
            className="client-progress__fill"
            style={{
              width:
                capacityRatio !== null
                  ? `${Math.max(8, Math.min(capacityRatio * 100, 100))}%`
                  : "18%",
            }}
          />
        </div>
        <div className="client-fact-grid">
          <article className="client-fact-card">
            <span>Email per campagna</span>
            <strong>{formatOptionalLimit(summary.limits.emailLimitPerCampaign)}</strong>
          </article>
          <article className="client-fact-card">
            <span>Campagne massime</span>
            <strong>{formatOptionalLimit(summary.limits.maxCampaigns)}</strong>
          </article>
        </div>
        {visualItems.length > 0 ? (
          <div className="client-status-visual">
            <div className="client-status-visual__bar" aria-hidden="true">
              {visualItems.map((item) => (
                <div
                  key={item.label}
                  className="client-status-visual__segment"
                  data-tone={item.tone}
                  style={{
                    width: `${(item.value / summary.campaigns.totalCampaigns) * 100}%`,
                  }}
                />
              ))}
            </div>
            <div className="client-status-visual__legend">
              {visualItems.map((item) => (
                <article key={item.label} className="client-status-visual__legend-item">
                  <span>{item.label}</span>
                  <strong>{item.value.toLocaleString("it-IT")}</strong>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
