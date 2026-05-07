import { StatusBadge } from "../ui/StatusBadge";
import type { AdminOverviewSummary, CampaignStatus } from "../../types";
import { AdminSurface } from "./AdminSurface";

interface AdminRecentCampaignsCardProps {
  summary: AdminOverviewSummary;
}

function getCampaignStatusLabel(status: CampaignStatus): string {
  switch (status) {
    case "ready":
      return "Pronta";
    case "running":
      return "In corso";
    case "paused":
      return "In pausa";
    case "blocked":
      return "Bloccata";
    case "draft":
      return "Bozza";
    case "completed":
      return "Completata";
    case "failed":
      return "Errore";
    default:
      return "Stato";
  }
}

function getCampaignStatusVariant(status: CampaignStatus) {
  switch (status) {
    case "ready":
    case "running":
      return "success" as const;
    case "paused":
      return "warning" as const;
    case "blocked":
    case "failed":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

export function AdminRecentCampaignsCard({
  summary,
}: AdminRecentCampaignsCardProps) {
  return (
    <AdminSurface
      title="Campagne recenti"
      description="Ultimi aggiornamenti disponibili nella panoramica admin."
      aside={
        <span className="admin-surface__eyebrow">
          {summary.recentCampaigns.length.toLocaleString()} elementi
        </span>
      }
    >
      {summary.recentCampaigns.length > 0 ? (
        <div className="admin-list">
          {summary.recentCampaigns.map((campaign) => (
            <article key={campaign.id} className="admin-row">
              <div className="admin-row__header">
                <div className="admin-row__copy">
                  <strong className="admin-row__title">
                    {campaign.campaignName}
                  </strong>
                  <span className="admin-row__meta">{campaign.clientName}</span>
                </div>
                <StatusBadge
                  label={getCampaignStatusLabel(campaign.status)}
                  variant={getCampaignStatusVariant(campaign.status)}
                />
              </div>
              <p className="admin-row__support">{campaign.subject}</p>
              <div className="admin-row__footer">
                <span>Aggiornata {campaign.updatedAtLabel}</span>
                <button
                  type="button"
                  className="admin-inline-button"
                  disabled
                >
                  Dettaglio
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="admin-empty-state">
          Nessuna campagna recente disponibile nel dataset corrente.
        </div>
      )}
    </AdminSurface>
  );
}
