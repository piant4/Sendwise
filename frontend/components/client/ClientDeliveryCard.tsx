import type { ClientDashboardPeriodUsage, ClientOverviewSummary } from "../../types";
import { ClientSurface } from "./ClientSurface";

interface ClientDeliveryCardProps {
  summary: ClientOverviewSummary;
}

function getUsage(summary: ClientOverviewSummary): ClientDashboardPeriodUsage {
  return (
    summary.clientDashboard?.periodUsage ?? {
      hasRealUsage: false,
      sent: null,
      queued: null,
      blocked: null,
      opened: null,
    }
  );
}

function formatMetric(value: number | null): string {
  return typeof value === "number" ? value.toLocaleString("it-IT") : "Non disponibili";
}

export function ClientDeliveryCard({ summary }: ClientDeliveryCardProps) {
  const usage = getUsage(summary);
  const facts = [
    { label: "Inviate", value: usage.sent },
    { label: "In coda", value: usage.queued },
    { label: "Bloccate", value: usage.blocked },
    { label: "Aperte", value: usage.opened },
  ];

  return (
    <div className="client-rail client-dashboard-rail">
      <ClientSurface
        title="Invii periodo"
        description="Conteggi backend del periodo predefinito del dashboard."
      >
        {usage.hasRealUsage ? (
          <div className="client-metric-stack">
            {facts.map((fact) => (
              <article key={fact.label} className="client-metric-stack__item">
                <span>{fact.label}</span>
                <strong>{formatMetric(fact.value)}</strong>
              </article>
            ))}
          </div>
        ) : (
          <div className="client-empty-state">Avvia la prima campagna per ricevere dati.</div>
        )}
      </ClientSurface>
    </div>
  );
}
