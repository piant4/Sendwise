import type { ClientOverviewSummary } from "../../types";
import { ClientSurface } from "./ClientSurface";

interface ClientRecentBlockedSendsCardProps {
  summary: ClientOverviewSummary;
}

export function ClientRecentBlockedSendsCard({
  summary,
}: ClientRecentBlockedSendsCardProps) {
  const items = summary.clientDashboard?.actionsRequired.items ?? [];

  return (
    <ClientSurface
      title="Azioni richieste"
      // description="Solo attività reali emerse dal read model dashboard."
    >
      {items.length > 0 ? (
        <div className="client-action-list">
          {items.map((item) => (
            <article
              key={`${item.label}-${item.severity}`}
              className="client-action-card"
              data-tone={item.severity}
            >
              <div className="client-action-card__count">
                {item.count.toLocaleString("it-IT")}
              </div>
              <div className="client-action-card__copy">
                <strong>{item.label}</strong>
                <span>Richiede verifica nel periodo corrente del dashboard.</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="client-empty-state client-empty-state--compact">
          Nessuna azione urgente nel workspace.
        </div>
      )}
    </ClientSurface>
  );
}
