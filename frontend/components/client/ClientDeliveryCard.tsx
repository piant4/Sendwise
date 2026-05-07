import type { ClientOverviewSummary } from "../../types";
import { ClientSurface } from "./ClientSurface";

interface ClientDeliveryCardProps {
  summary: ClientOverviewSummary;
}

export function ClientDeliveryCard({ summary }: ClientDeliveryCardProps) {
  const metrics = [
    {
      label: "Aperture",
      value: summary.deliveryOverview.opened.toLocaleString(),
    },
    {
      label: "Spam",
      value: summary.deliveryOverview.spam.toLocaleString(),
    },
    {
      label: "Rimbalzate",
      value: summary.deliveryOverview.bounced.toLocaleString(),
    },
    {
      label: "Invii bloccati",
      value: summary.deliveryOverview.blocked.toLocaleString(),
    },
  ];

  return (
    <div className="client-rail">
      <ClientSurface
        title="Stato account"
        description="Presidio sintetico della posizione cliente nel workspace corrente."
      >
        <div className="client-account-card">
          <strong>{summary.accountStatus.label}</strong>
          <p>
            Visibilita dedicata a campagne, volumi email e blocchi recenti del
            workspace corrente.
          </p>
        </div>
      </ClientSurface>

      <ClientSurface
        title="Prestazioni email"
        description="Volumi leggibili della consegna corrente."
      >
        <div className="client-metric-list">
          {metrics.map((metric) => (
            <div key={metric.label} className="client-metric-item">
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>
      </ClientSurface>
    </div>
  );
}
