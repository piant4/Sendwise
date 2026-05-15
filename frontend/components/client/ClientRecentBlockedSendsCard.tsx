import { StatusBadge } from "../ui/StatusBadge";
import type { ClientOverviewSummary } from "../../types";
import { ClientSurface } from "./ClientSurface";
import {
  formatDateTimeLabel,
  getSendDecisionLabel,
  getSendDecisionVariant,
} from "./clientStatus";

interface ClientRecentBlockedSendsCardProps {
  summary: ClientOverviewSummary;
}

export function ClientRecentBlockedSendsCard({
  summary,
}: ClientRecentBlockedSendsCardProps) {
  return (
    <ClientSurface
      title="Blocchi recenti"
      description="Ultimi stop registrati nel periodo."
      aside={
        <span className="client-surface__eyebrow">
          {summary.blockedSends.recentBlockedSends.length.toLocaleString("it-IT")} elementi
        </span>
      }
    >
      {summary.blockedSends.recentBlockedSends.length > 0 ? (
        <div className="client-list client-list--compact">
          {summary.blockedSends.recentBlockedSends.map((blockedSend) => (
            <article
              key={blockedSend.id}
              className="client-row client-row--alert client-row--compact"
            >
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
                <StatusBadge
                  label={getSendDecisionLabel(blockedSend.decision)}
                  variant={getSendDecisionVariant(blockedSend.decision)}
                />
              </div>
              <p className="client-row__support client-note--compact">
                {blockedSend.reason}
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
