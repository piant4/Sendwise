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

  return (
    <div className="client-rail">
      <ClientSurface
        title="Stato account"
        description="Stato backend dell'account e limiti attivi del workspace cliente."
      >
        <div className="client-account-card">
          <strong>{getClientStatusLabel(summary.client.clientStatus)}</strong>
          <p>
            Limite email per campagna {formatOptionalLimit(summary.limits.emailLimitPerCampaign)}
            {" · "}
            max campagne {formatOptionalLimit(summary.limits.maxCampaigns)}
          </p>
        </div>
      </ClientSurface>

      <ClientSurface
        title="Utilizzo registrato"
        description="Riepilogo onesto dei record `api_usage` visibili al cliente."
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
                  <span>ID {entry.id}</span>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </ClientSurface>
    </div>
  );
}
