import { StatusBadge } from "../ui/StatusBadge";
import type { AdminClientNearLimit, AdminOverviewSummary } from "../../types";
import { AdminSurface } from "./AdminSurface";

interface AdminOperationsRailProps {
  summary: AdminOverviewSummary;
}

function formatDateTimeLabel(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
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
                <div className="admin-metric-list">
                  <div className="admin-metric-item">
                    <span>Campagne in uso</span>
                    <strong>
                      {client.maxCampaigns
                        ? `${client.campaignsInUse.toLocaleString()} / ${client.maxCampaigns.toLocaleString()}`
                        : client.campaignsInUse.toLocaleString()}
                    </strong>
                  </div>
                  <div className="admin-metric-item">
                    <span>Campagna con piu invii</span>
                    <strong>
                      {client.highestUsageCampaignName
                        ? `${client.highestUsageCampaignName} · ${client.highestUsageCampaignVolume.toLocaleString()}`
                        : "Nessun invio registrato"}
                    </strong>
                  </div>
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
                <p className="admin-row__support">Email inviate nel mese corrente</p>
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
        description="Check minimi esposti dal backend per capire se il sistema e operativo."
      >
        <div className="admin-system-list">
          <div className="admin-system-item">
            <span>Backend</span>
            <StatusBadge label="OK" variant="success" />
          </div>
          <div className="admin-system-item">
            <span>Database</span>
            <StatusBadge label="OK" variant="success" />
          </div>
          <div className="admin-system-item">
            <span>Invio email</span>
            <StatusBadge
              label={summary.system.emailSendingEnabled ? "Abilitato" : "Disabilitato"}
              variant={summary.system.emailSendingEnabled ? "warning" : "neutral"}
            />
          </div>
        </div>
        <div className="admin-empty-state admin-system-note">
          Ultimo aggiornamento: {formatDateTimeLabel(summary.system.generatedAt)}
        </div>
      </AdminSurface>
    </div>
  );
}
