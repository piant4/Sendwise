import { StatusBadge } from "../ui/StatusBadge";
import type { AdminOverviewSummary } from "../../types";
import { AdminSurface } from "./AdminSurface";

interface AdminBlockedSendsCardProps {
  summary: AdminOverviewSummary;
}

export function AdminBlockedSendsCard({
  summary,
}: AdminBlockedSendsCardProps) {
  return (
    <AdminSurface
      title="Invii bloccati recenti"
      description="Segnalazioni sintetiche per il presidio operativo."
      aside={<StatusBadge label="Controllo manuale" variant="warning" />}
    >
      {summary.recentBlockedSends.length > 0 ? (
        <div className="admin-list">
          {summary.recentBlockedSends.map((blockedSend) => (
            <article key={blockedSend.id} className="admin-row admin-row--alert">
              <div className="admin-row__header">
                <div className="admin-row__copy">
                  <strong className="admin-row__title">
                    {blockedSend.campaignName}
                  </strong>
                  <span className="admin-row__meta">
                    {blockedSend.clientName}
                  </span>
                </div>
                <span className="admin-row__timestamp">
                  {blockedSend.createdAtLabel}
                </span>
              </div>
              <p className="admin-row__support">{blockedSend.reason}</p>
              <div className="admin-row__footer">
                <span>Richiede verifica operativa</span>
                <button
                  type="button"
                  className="admin-inline-button"
                  disabled
                >
                  Apri coda
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="admin-empty-state">
          Nessun blocco recente disponibile nella lettura corrente.
        </div>
      )}
    </AdminSurface>
  );
}
