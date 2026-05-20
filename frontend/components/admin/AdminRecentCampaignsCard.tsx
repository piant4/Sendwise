import { AdminProgressBar } from "./AdminProgressBar";
import { formatDateTimeInRome } from "../shared/dateTime";
import { StatusBadge } from "../ui/StatusBadge";
import type { AdminOverviewSummary, CampaignStatus } from "../../types";
import { AdminSurface } from "./AdminSurface";

interface AdminRecentCampaignsCardProps {
  summary: AdminOverviewSummary;
}

function formatDateTimeLabel(value: string): string {
  return formatDateTimeInRome(value, {
    dateStyle: "short",
    timeStyle: "short",
  });
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
  const recentCampaigns = summary.campaigns.recentCampaigns;
  const statusDistribution = [
    {
      label: "Ready / running",
      count: summary.campaigns.statusCounts.active,
      tone: "success" as const,
    },
    {
      label: "In pausa",
      count: summary.campaigns.statusCounts.paused,
      tone: "warning" as const,
    },
    {
      label: "Bloccate",
      count: summary.campaigns.statusCounts.blocked,
      tone: "danger" as const,
    },
    {
      label: "Bozze",
      count: summary.campaigns.statusCounts.draft,
      tone: "default" as const,
    },
  ];

  return (
    <AdminSurface
      title="Campagne recenti"
      description="Ultime campagne aggiornate con contesto cliente reale."
      aside={
        <span className="admin-surface__eyebrow">
          {recentCampaigns.length.toLocaleString()} elementi
        </span>
      }
    >
      <div className="admin-progress-stack">
        {statusDistribution.map((item) => (
          <AdminProgressBar
            key={item.label}
            label={item.label}
            valueLabel={item.count.toLocaleString()}
            ratio={
              summary.campaigns.totalCampaigns > 0
                ? item.count / summary.campaigns.totalCampaigns
                : 0
            }
            tone={item.tone}
          />
        ))}
      </div>

      {recentCampaigns.length > 0 ? (
        <div className="admin-list">
          {recentCampaigns.map((campaign) => (
            <article key={campaign.id} className="admin-row">
              <div className="admin-row__header">
                <div className="admin-row__copy">
                  <strong className="admin-row__title">
                    {campaign.campaignName}
                  </strong>
                  <span className="admin-row__meta">
                    {campaign.clientName} | {campaign.clientEmail}
                  </span>
                </div>
                <StatusBadge
                  label={getCampaignStatusLabel(campaign.status)}
                  variant={getCampaignStatusVariant(campaign.status)}
                />
              </div>
              <p className="admin-row__support">
                {campaign.subject || "Nessun oggetto disponibile per questa campagna."}
              </p>
              <div className="admin-row__footer">
                <span>Aggiornata {formatDateTimeLabel(campaign.updatedAt)}</span>
                <span>Creata {formatDateTimeLabel(campaign.createdAt)}</span>
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
