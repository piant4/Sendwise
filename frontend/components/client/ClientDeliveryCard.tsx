import type { ClientOverviewSummary } from "../../types";
import { ClientSurface } from "./ClientSurface";
import {
  formatDateTimeLabel,
  formatOptionalLimit,
  getClientStatusLabel,
} from "./clientStatus";

interface ClientDeliveryCardProps {
  summary: ClientOverviewSummary;
}

export function ClientDeliveryCard({ summary }: ClientDeliveryCardProps) {
  const usageTotals = summary.usage.currentPeriodTotals;
  const recentUsage = summary.usage.recentUsage;
  const maxCampaigns = summary.limits.maxCampaigns ?? null;
  const campaignsInUseLabel =
    typeof maxCampaigns === "number" && maxCampaigns > 0
      ? `${summary.campaigns.totalCampaigns.toLocaleString()} / ${maxCampaigns.toLocaleString()}`
      : summary.campaigns.totalCampaigns.toLocaleString();

  return (
    <div className="client-rail">
      <ClientSurface
        title="Capacita"
        description="Limiti attivi e campagne oggi visibili."
      >
        <div className="client-fact-grid">
          <article className="client-fact-card">
            <span>Stato account</span>
            <strong>{getClientStatusLabel(summary.client.clientStatus)}</strong>
          </article>
          <article className="client-fact-card">
            <span>Email per campagna</span>
            <strong>{formatOptionalLimit(summary.limits.emailLimitPerCampaign)}</strong>
          </article>
          <article className="client-fact-card">
            <span>Campagne massime</span>
            <strong>{formatOptionalLimit(summary.limits.maxCampaigns)}</strong>
          </article>
          <article className="client-fact-card">
            <span>Campagne visibili</span>
            <strong>{campaignsInUseLabel}</strong>
          </article>
        </div>
      </ClientSurface>

      <ClientSurface
        title="Utilizzo registrato"
        description="Solo record esposti dal backend."
      >
        {usageTotals.length > 0 ? (
          <div className="client-metric-list">
            {usageTotals.map((metric) => (
              <div key={metric.usageType} className="client-metric-item">
                <span>{metric.usageType}</span>
                <strong>{metric.totalQuantity.toLocaleString("it-IT")}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="client-empty-state">
            Nessun utilizzo registrato nel periodo corrente.
          </div>
        )}
        {recentUsage.length > 0 ? (
          <div className="client-list client-list--compact">
            {recentUsage.map((entry) => (
              <article key={entry.id} className="client-row client-row--compact">
                <div className="client-row__header">
                  <div className="client-row__copy">
                    <strong className="client-row__title">{entry.usage_type}</strong>
                    <span className="client-row__meta">
                      {formatDateTimeLabel(entry.created_at)}
                    </span>
                  </div>
                </div>
                <div className="client-row__summary">
                  <span>{entry.quantity.toLocaleString("it-IT")} unita</span>
                  <span>Record periodo corrente</span>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </ClientSurface>
    </div>
  );
}
