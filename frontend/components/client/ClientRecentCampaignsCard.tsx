import { StatusBadge } from "../ui/StatusBadge";
import type { ClientOverviewSummary } from "../../types";
import { ClientSurface } from "./ClientSurface";
import {
  formatDateTimeLabel,
  getCampaignStatusLabel,
  getCampaignStatusVariant,
} from "./clientStatus";

interface ClientRecentCampaignsCardProps {
  summary: ClientOverviewSummary;
}

export function ClientRecentCampaignsCard({
  summary,
}: ClientRecentCampaignsCardProps) {
  return (
    <ClientSurface
      title="Campagne recenti"
      description="Ultimi aggiornamenti visibili."
      aside={
        <span className="client-surface__eyebrow">
          {summary.campaigns.recentCampaigns.length.toLocaleString("it-IT")} elementi
        </span>
      }
    >
      {summary.campaigns.recentCampaigns.length > 0 ? (
        <div className="client-list client-list--compact">
          {summary.campaigns.recentCampaigns.map((campaign) => (
            <article key={campaign.id} className="client-row client-row--compact">
              <div className="client-row__header">
                <div className="client-row__copy">
                  <strong className="client-row__title">{campaign.name}</strong>
                  <span className="client-row__meta">
                    Ultimo aggiornamento {formatDateTimeLabel(campaign.updated_at)}
                  </span>
                </div>
                <StatusBadge
                  label={getCampaignStatusLabel(campaign.status)}
                  variant={getCampaignStatusVariant(campaign.status)}
                />
              </div>
              <div className="client-row__summary">
                <span>
                  {campaign.subject?.trim() ? campaign.subject : "Oggetto non disponibile"}
                </span>
                <span>Creata {formatDateTimeLabel(campaign.created_at)}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="client-empty-state">
          Nessuna campagna disponibile per questo cliente in questo momento.
        </div>
      )}
    </ClientSurface>
  );
}
