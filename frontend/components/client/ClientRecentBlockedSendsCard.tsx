import { StatusBadge } from "../ui/StatusBadge";
import type { ClientOverviewSummary } from "../../types";
import { ClientSurface } from "./ClientSurface";
import {
  formatDateTimeLabel,
  getSendDecisionLabel,
  getSendDecisionVariant,
} from "./clientStatus";
import { getReadableBackendReason } from "../shared/campaignUi";

interface ClientRecentBlockedSendsCardProps {
  summary: ClientOverviewSummary;
}

export function ClientRecentBlockedSendsCard({
  summary,
}: ClientRecentBlockedSendsCardProps) {
  return (
    <ClientSurface
      title="Blocchi recenti"
      description="Ultimi stop registrati nel periodo corrente."
      aside={
        <span className="client-surface__eyebrow">
          {summary.blockedSends.currentPeriodCount.toLocaleString("it-IT")} nel periodo
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
                {getReadableBackendReason(blockedSend.reason).label}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="client-empty-state client-empty-state--compact">
          Nessun blocco registrato nel periodo corrente.
        </div>
      )}
    </ClientSurface>
  );
}
