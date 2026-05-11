import type { ClientOverviewSummary } from "../../types";
import { ClientSurface } from "./ClientSurface";
import { formatDateTimeLabel } from "./clientStatus";

interface ClientRecentBlockedSendsCardProps {
  summary: ClientOverviewSummary;
}

export function ClientRecentBlockedSendsCard({
  summary,
}: ClientRecentBlockedSendsCardProps) {
  return (
    <ClientSurface
      title="Blocchi recenti"
      description="Eventuali stop registrati per questo cliente nel periodo corrente."
    >
      {summary.blockedSends.recentBlockedSends.length > 0 ? (
        <div className="client-list">
          {summary.blockedSends.recentBlockedSends.map((blockedSend) => (
            <article key={blockedSend.id} className="client-row client-row--alert">
              <div className="client-row__header">
                <div className="client-row__copy">
                  <strong className="client-row__title">
                    {blockedSend.campaign_name?.trim()
                      ? blockedSend.campaign_name
                      : "Campagna non disponibile"}
                  </strong>
                  <span className="client-row__meta">
                    {formatDateTimeLabel(blockedSend.created_at)}
                  </span>
                </div>
              </div>
              <p className="client-row__support">
                {blockedSend.reason} · decisione {blockedSend.decision}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="client-empty-state">
          Nessun blocco registrato per questo cliente nel periodo corrente.
        </div>
      )}
    </ClientSurface>
  );
}
