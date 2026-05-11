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
        title="Capacita e limiti"
        description="Stato account, limiti attivi e spazio campagne oggi disponibile nel workspace cliente."
      >
        <div className="client-fact-grid">
          <article className="client-fact-card">
            <span>Stato account</span>
            <strong>{getClientStatusLabel(summary.client.clientStatus)}</strong>
            <p>Lo stato operativo del workspace e governato dal backend.</p>
          </article>
          <article className="client-fact-card">
            <span>email_limit_per_campaign</span>
            <strong>{formatOptionalLimit(summary.limits.emailLimitPerCampaign)}</strong>
            <p>Limite per singola campagna, quando configurato.</p>
          </article>
          <article className="client-fact-card">
            <span>max_campaigns</span>
            <strong>{formatOptionalLimit(summary.limits.maxCampaigns)}</strong>
            <p>Massimo numero di campagne disponibili per il cliente.</p>
          </article>
          <article className="client-fact-card">
            <span>Campagne oggi visibili</span>
            <strong>{campaignsInUseLabel}</strong>
            <p>Confronto diretto tra campagne presenti e capacita configurata.</p>
          </article>
        </div>
      </ClientSurface>

      <ClientSurface
        title="Utilizzo registrato"
        description="Riepilogo onesto dei record di utilizzo visibili al cliente nel periodo corrente."
      >
        {usageTotals.length > 0 ? (
          <div className="client-metric-list">
            {usageTotals.map((metric) => (
              <div key={metric.usageType} className="client-metric-item">
                <span>{metric.usageType}</span>
                <strong>{metric.totalQuantity.toLocaleString()}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="client-empty-state">
            Nessun utilizzo registrato nel periodo corrente.
          </div>
        )}
        {recentUsage.length > 0 ? (
          <div className="client-list">
            {recentUsage.map((entry) => (
              <article key={entry.id} className="client-row">
                <div className="client-row__header">
                  <div className="client-row__copy">
                    <strong className="client-row__title">{entry.usage_type}</strong>
                    <span className="client-row__meta">
                      {formatDateTimeLabel(entry.created_at)}
                    </span>
                  </div>
                </div>
                <div className="client-row__footer">
                  <span>{entry.quantity.toLocaleString()} unita</span>
                  <span>Registrazione backend</span>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </ClientSurface>
    </div>
  );
}
