import type { ClientOverviewSummary } from "../../types";
import { ClientSurface } from "./ClientSurface";

interface ClientRecentBlockedSendsCardProps {
  summary: ClientOverviewSummary;
}

export function ClientRecentBlockedSendsCard({
  summary,
}: ClientRecentBlockedSendsCardProps) {
  return (
    <ClientSurface
      title="Blocchi recenti"
      description="Eventuali stop leggibili lato cliente, senza controlli operativi interni."
    >
      {summary.readableBlockedSends.length > 0 ? (
        <div className="client-list">
          {summary.readableBlockedSends.map((blockedSend) => (
            <article key={blockedSend.id} className="client-row client-row--alert">
              <div className="client-row__header">
                <div className="client-row__copy">
                  <strong className="client-row__title">
                    {blockedSend.campaignName}
                  </strong>
                  <span className="client-row__meta">
                    {blockedSend.createdAtLabel}
                  </span>
                </div>
              </div>
              <p className="client-row__support">{blockedSend.readableReason}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="client-empty-state">
          Nessun blocco recente disponibile nella lettura corrente.
        </div>
      )}
    </ClientSurface>
  );
}
