import type { AdminOverviewSummary } from "../../types";
import { AdminSurface } from "./AdminSurface";

interface AdminBlockedSendsCardProps {
  summary: AdminOverviewSummary;
}

function formatDateTimeLabel(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function AdminBlockedSendsCard({
  summary,
}: AdminBlockedSendsCardProps) {
  const recentCriticalEvents = summary.blocks.recentCriticalEvents;

  return (
    <AdminSurface
      title="Eventi critici recenti"
      description="Eventi bloccanti letti da blocked_sends con contesto cliente e campagna."
      aside={
        <span className="admin-surface__eyebrow">
          {recentCriticalEvents.length.toLocaleString()} elementi
        </span>
      }
    >
      {recentCriticalEvents.length > 0 ? (
        <div className="admin-list">
          {recentCriticalEvents.map((event) => (
            <article key={event.id} className="admin-row admin-row--alert">
              <div className="admin-row__header">
                <div className="admin-row__copy">
                  <strong className="admin-row__title">
                    {event.campaignName || "Campagna non disponibile"}
                  </strong>
                  <span className="admin-row__meta">
                    {event.clientName} · {event.clientEmail}
                  </span>
                </div>
                <span className="admin-row__timestamp">
                  {formatDateTimeLabel(event.createdAt)}
                </span>
              </div>
              <p className="admin-row__support">{event.reason}</p>
              <div className="admin-row__footer">
                <span>Decisione: {event.decision}</span>
                <span>Tipo: blocked_send</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="admin-empty-state">
          Nessun evento critico recente trovato nei dati correnti.
        </div>
      )}
    </AdminSurface>
  );
}
