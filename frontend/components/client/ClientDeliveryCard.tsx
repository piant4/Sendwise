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
    delivered: usage?.delivered ?? null,
    opened: usage?.opened ?? null,
    clicked: usage?.clicked ?? null,
    bounced: null,
    complained: null,
    unsubscribed: null,
    sentAvailable: typeof usage?.sent === "number",
    failedAvailable: typeof usage?.failed === "number",
    deliveredAvailable: typeof usage?.delivered === "number",
    openedAvailable: typeof usage?.opened === "number",
    clickedAvailable: typeof usage?.clicked === "number",
    bouncedAvailable: false,
    complainedAvailable: false,
    unsubscribedAvailable: false,
    deliveryRate: null,
    openRate: null,
    clickRate: null,
    bounceRate: null,
    complaintRate: null,
    unsubscribeRate: null,
    deliveryRateAvailable: false,
    openRateAvailable: false,
    clickRateAvailable: false,
    bounceRateAvailable: false,
    complaintRateAvailable: false,
    unsubscribeRateAvailable: false,
    providerEventsAvailable:
      typeof usage?.delivered === "number"
      || typeof usage?.opened === "number"
      || typeof usage?.clicked === "number",
  };
}

export function ClientDeliveryCard({ summary }: ClientDeliveryCardProps) {
  const logs = getPeriodLogs(summary);
  const facts = [
    { label: "Accettate", value: formatCampaignCount(logs.sent ?? 0) },
    { label: "Fallite", value: formatCampaignCount(logs.failed) },
    { label: "Consegnate", value: formatProviderEventMetric(logs.delivered, logs) },
    { label: "Aperte", value: formatProviderEventMetric(logs.opened, logs) },
    { label: "Click", value: formatProviderEventMetric(logs.clicked, logs) },
  ];

  return (
    <div className="client-rail client-dashboard-rail">
      <ClientSurface
        title="Stato metriche reali"
      >
        <div className="client-delivery-state">
          <strong>{getProviderEventsAvailabilityLabel(logs)}</strong>
          <span>Disponibilita eventi Mailgun</span>
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
