import { AdminProgressBar } from "./AdminProgressBar";
import { AdminSystemHealthPanel } from "./AdminSystemHealthPanel";
import { StatusBadge } from "../ui/StatusBadge";
import type { AdminClientNearLimit, AdminOverviewSummary } from "../../types";
import { AdminSurface } from "./AdminSurface";

interface AdminOperationsRailProps {
  summary: AdminOverviewSummary;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function getLimitFactorLabel(limit: AdminClientNearLimit["limitingFactor"]): string {
  switch (limit) {
    case "campaign_slots":
      return "Saturazione campagne";
    case "email_limit_per_campaign":
      return "Volume per campagna";
    case "both":
      return "Campagne e volume";
    default:
      return "Limite";
  }
}

export function AdminOperationsRail({
  summary,
}: AdminOperationsRailProps) {
  const topClientVolume = summary.sending.topClientsByVolume[0]?.emailsSent ?? 0;

  return (
    <div className="admin-rail">
      <AdminSurface
        title="Clienti vicini al limite"
        description="Clienti sopra l'80% della capacita configurata, calcolata dai limiti reali e dall'utilizzo registrato."
      >
        {summary.limits.clientsNearLimit.length > 0 ? (
          <div className="admin-list">
            {summary.limits.clientsNearLimit.map((client) => (
              <article key={client.clientId} className="admin-row">
                <div className="admin-row__header">
                  <div className="admin-row__copy">
                    <strong className="admin-row__title">{client.clientName}</strong>
                    <span className="admin-row__meta">{client.clientEmail}</span>
                  </div>
                  <StatusBadge
                    label={formatPercent(client.usageRatio)}
                    variant="warning"
                  />
                </div>
                <p className="admin-row__support">
                  {getLimitFactorLabel(client.limitingFactor)}
                </p>
                <div className="admin-progress-stack">
                  <AdminProgressBar
                    label="Campagne in uso"
                    valueLabel={
                      client.maxCampaigns
                        ? `${client.campaignsInUse.toLocaleString()} / ${client.maxCampaigns.toLocaleString()}`
                        : client.campaignsInUse.toLocaleString()
                    }
                    ratio={client.maxCampaignsRatio ?? 0}
                    tone="warning"
                  />
                  <AdminProgressBar
                    label="Volume campagna leader"
                    valueLabel={
                      client.emailLimitPerCampaign
                        ? `${client.highestUsageCampaignVolume.toLocaleString()} / ${client.emailLimitPerCampaign.toLocaleString()}`
                        : client.highestUsageCampaignVolume.toLocaleString()
                    }
                    ratio={client.emailLimitRatio ?? 0}
                    helper={
                      client.highestUsageCampaignName
                        ? client.highestUsageCampaignName
                        : "Nessun invio registrato"
                    }
                    tone="danger"
                  />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="admin-empty-state">
            Nessun cliente ha superato la soglia operativa dell&apos;80% nei dati
            correnti.
          </div>
        )}
      </AdminSurface>

      <AdminSurface
        title="Top clienti per volume"
        description="Classifica degli invii registrati in email_logs nel mese corrente."
      >
        {summary.sending.topClientsByVolume.length > 0 ? (
          <div className="admin-list">
            {summary.sending.topClientsByVolume.map((client, index) => (
              <article key={client.clientId} className="admin-row">
                <div className="admin-row__header">
                  <div className="admin-row__copy">
                    <strong className="admin-row__title">
                      {index + 1}. {client.clientName}
                    </strong>
                    <span className="admin-row__meta">{client.clientEmail}</span>
                  </div>
                  <strong className="admin-row__stat">
                    {client.emailsSent.toLocaleString()}
                  </strong>
                </div>
                <div className="admin-progress-stack">
                  <AdminProgressBar
                    label="Peso sul leader"
                    valueLabel={
                      topClientVolume > 0
                        ? formatPercent(client.emailsSent / topClientVolume)
                        : "0%"
                    }
                    ratio={topClientVolume > 0 ? client.emailsSent / topClientVolume : 0}
                  />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="admin-empty-state">
            Nessun invio registrato nel mese corrente.
          </div>
        )}
      </AdminSurface>

      <AdminSurface
        title="Stato sistema"
        description="Check backend reali e flag di configurazione esposti in forma sicura."
      >
        <AdminSystemHealthPanel status={summary.system} />
      </AdminSurface>
    </div>
  );
}
