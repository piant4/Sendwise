import {
  formatCampaignCount,
  getProviderEventsAvailabilityLabel,
  formatProviderEventMetric,
} from "../shared/campaignUi";
import type { CampaignLogsSummary, ClientOverviewSummary } from "../../types";
import { ClientSurface } from "./ClientSurface";

interface ClientDeliveryCardProps {
  summary: ClientOverviewSummary;
}

function getPeriodLogs(summary: ClientOverviewSummary): CampaignLogsSummary {
  const usage = summary.clientDashboard?.periodUsage;

  return {
    simulated: 0,
    queued: 0,
    sent: usage?.sent ?? 0,
    failed: usage?.failed ?? 0,
    delivered: usage?.delivered ?? 0,
    opened: usage?.opened ?? 0,
    clicked: usage?.clicked ?? 0,
    bounced: 0,
    complained: 0,
    unsubscribed: 0,
    providerEventsAvailable:
      typeof usage?.delivered === "number"
      || typeof usage?.opened === "number"
      || typeof usage?.clicked === "number",
  };
}

export function ClientDeliveryCard({ summary }: ClientDeliveryCardProps) {
  const logs = getPeriodLogs(summary);
  const facts = [
    { label: "Accettate", value: formatCampaignCount(logs.sent) },
    { label: "Fallite", value: formatCampaignCount(logs.failed) },
    { label: "Consegnate", value: formatProviderEventMetric(logs.delivered, logs) },
    { label: "Aperte", value: formatProviderEventMetric(logs.opened, logs) },
    { label: "Click", value: formatProviderEventMetric(logs.clicked, logs) },
  ];

  return (
    <div className="client-rail client-dashboard-rail">
      <ClientSurface
        title="Stato metriche reali"
        description="I volumi di invio arrivano dal backend. Le metriche provider compaiono solo dopo eventi reali."
      >
        <div className="client-delivery-state">
          <strong>{getProviderEventsAvailabilityLabel(logs)}</strong>
          <span>Disponibilita eventi provider</span>
        </div>
        <div className="client-metric-stack client-metric-stack--single-column">
          {facts.map((fact) => (
            <article key={fact.label} className="client-metric-stack__item">
              <span>{fact.label}</span>
              <strong>{fact.value}</strong>
            </article>
          ))}
        </div>
      </ClientSurface>
    </div>
  );
}
