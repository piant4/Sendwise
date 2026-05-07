import { StatusBadge } from "../ui/StatusBadge";
import type { ClientOverviewSummary } from "../../types";
import { ClientSurface } from "./ClientSurface";
import {
  formatLimitValue,
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
      description="Righe compatte per stato, ultima attivita e volume inviato."
      aside={
        <span className="client-surface__eyebrow">
          {summary.campaignSummaries.length.toLocaleString()} elementi
        </span>
      }
    >
      {summary.campaignSummaries.length > 0 ? (
        <div className="client-list">
          {summary.campaignSummaries.map((campaign) => (
            <article key={campaign.id} className="client-row">
              <div className="client-row__header">
                <div className="client-row__copy">
                  <strong className="client-row__title">{campaign.name}</strong>
                  <span className="client-row__meta">
                    Ultima attivita {campaign.lastActivityLabel}
                  </span>
                </div>
                <StatusBadge
                  label={getCampaignStatusLabel(campaign.status)}
                  variant={getCampaignStatusVariant(campaign.status)}
                />
              </div>
              <div className="client-row__footer">
                <span>{campaign.sent.toLocaleString()} email inviate</span>
                <span>Capienza campagna {formatLimitValue(campaign.limit)}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="client-empty-state">
          Nessuna campagna recente disponibile nel riepilogo corrente.
        </div>
      )}
    </ClientSurface>
  );
}
