import { AdminProgressBar } from "./AdminProgressBar";
import type { AdminOverviewSummary } from "../../types";

interface AdminKpiGridProps {
  summary: AdminOverviewSummary;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function AdminKpiGrid({ summary }: AdminKpiGridProps) {
  const activeClientRatio =
    summary.clients.totalClients > 0
      ? summary.clients.activeClients / summary.clients.totalClients
      : 0;
  const runningCampaignRatio =
    summary.campaigns.totalCampaigns > 0
      ? summary.campaigns.runningCampaigns / summary.campaigns.totalCampaigns
      : 0;
  const blockedCampaignRatio =
    summary.campaigns.totalCampaigns > 0
      ? summary.campaigns.blockedCampaigns / summary.campaigns.totalCampaigns
      : 0;
  const configuredLimitsRatio =
    summary.clients.totalClients > 0
      ? summary.limits.configuredLimitsCount / summary.clients.totalClients
      : 0;

  return (
    <section className="admin-kpi-grid" aria-label="Indicatori operativi">
      <article className="admin-kpi-card" data-tone="clients">
        <div className="admin-kpi-card__topline">
          <span className="admin-kpi-card__title">Copertura clienti</span>
          <span className="admin-kpi-card__pulse" aria-hidden="true" />
        </div>
        <strong className="admin-kpi-card__value">
          {summary.clients.activeClients.toLocaleString()}
        </strong>
        <p className="admin-kpi-card__detail">
          Clienti attivi su {summary.clients.totalClients.toLocaleString()} totali.
        </p>
        <AdminProgressBar
          label="Stato attivo"
          valueLabel={formatPercent(activeClientRatio)}
          ratio={activeClientRatio}
          helper={`${summary.clients.invitedOrPendingClients.toLocaleString()} invitati o pending.`}
          tone="success"
        />
      </article>

      <article className="admin-kpi-card" data-tone="campaigns">
        <div className="admin-kpi-card__topline">
          <span className="admin-kpi-card__title">Distribuzione campagne</span>
          <span className="admin-kpi-card__pulse" aria-hidden="true" />
        </div>
        <strong className="admin-kpi-card__value">
          {summary.campaigns.totalCampaigns.toLocaleString()}
        </strong>
        <p className="admin-kpi-card__detail">
          Stato operativo delle campagne registrate nel backend.
        </p>
        <div className="admin-progress-stack">
          <AdminProgressBar
            label="Ready / running"
            valueLabel={`${summary.campaigns.statusCounts.active.toLocaleString()}`}
            ratio={
              summary.campaigns.totalCampaigns > 0
                ? summary.campaigns.statusCounts.active / summary.campaigns.totalCampaigns
                : 0
            }
            tone="success"
          />
          <AdminProgressBar
            label="Running"
            valueLabel={formatPercent(runningCampaignRatio)}
            ratio={runningCampaignRatio}
          />
          <AdminProgressBar
            label="Bloccate"
            valueLabel={formatPercent(blockedCampaignRatio)}
            ratio={blockedCampaignRatio}
            tone="danger"
          />
        </div>
      </article>

      <article className="admin-kpi-card" data-tone="sending">
        <div className="admin-kpi-card__topline">
          <span className="admin-kpi-card__title">Volume email</span>
          <span className="admin-kpi-card__pulse" aria-hidden="true" />
        </div>
        <strong className="admin-kpi-card__value">
          {summary.sending.emailsSentToday.toLocaleString()}
        </strong>
        <p className="admin-kpi-card__detail">
          Email inviate oggi, con storico mensile letto da `email_logs`.
        </p>
        <AdminProgressBar
          label="Mese corrente"
          valueLabel={summary.sending.emailsSentThisMonth.toLocaleString()}
          ratio={1}
          helper={
            summary.sending.topClientsByVolume.length > 0
              ? `${summary.sending.topClientsByVolume[0].clientName} guida il volume corrente.`
              : "Nessun invio registrato nel mese corrente."
          }
          tone="success"
        />
      </article>

      <article className="admin-kpi-card" data-tone="blocked">
        <div className="admin-kpi-card__topline">
          <span className="admin-kpi-card__title">Blocchi e guardrail</span>
          <span className="admin-kpi-card__pulse" aria-hidden="true" />
        </div>
        <strong className="admin-kpi-card__value">
          {summary.blocks.blockedSendsToday.toLocaleString()}
        </strong>
        <p className="admin-kpi-card__detail">
          Invii bloccati oggi con dettagli leggibili dal backend.
        </p>
        <AdminProgressBar
          label="Eventi recenti"
          valueLabel={summary.blocks.recentCriticalEvents.length.toLocaleString()}
          ratio={Math.min(summary.blocks.recentCriticalEvents.length / 5, 1)}
          helper="La card operativa sotto mostra il dettaglio degli ultimi eventi."
          tone="danger"
        />
      </article>

      <article className="admin-kpi-card" data-tone="volume">
        <div className="admin-kpi-card__topline">
          <span className="admin-kpi-card__title">Top clienti per volume</span>
          <span className="admin-kpi-card__pulse" aria-hidden="true" />
        </div>
        <strong className="admin-kpi-card__value">
          {summary.sending.topClientsByVolume[0]?.emailsSent.toLocaleString() ?? "0"}
        </strong>
        <p className="admin-kpi-card__detail">
          Volume del cliente leader nel mese corrente.
        </p>
        <div className="admin-progress-stack">
          {summary.sending.topClientsByVolume.slice(0, 3).map((client, index, items) => {
            const maxVolume = items[0]?.emailsSent ?? client.emailsSent;

            return (
              <AdminProgressBar
                key={client.clientId}
                label={`${index + 1}. ${client.clientName}`}
                valueLabel={client.emailsSent.toLocaleString()}
                ratio={maxVolume > 0 ? client.emailsSent / maxVolume : 0}
              />
            );
          })}
        </div>
      </article>

      <article className="admin-kpi-card" data-tone="limits">
        <div className="admin-kpi-card__topline">
          <span className="admin-kpi-card__title">Capacita e limiti</span>
          <span className="admin-kpi-card__pulse" aria-hidden="true" />
        </div>
        <strong className="admin-kpi-card__value">
          {summary.limits.clientsNearLimit.length.toLocaleString()}
        </strong>
        <p className="admin-kpi-card__detail">
          Clienti sopra l&apos;80% della capacita configurata.
        </p>
        <AdminProgressBar
          label="Limiti configurati"
          valueLabel={formatPercent(configuredLimitsRatio)}
          ratio={configuredLimitsRatio}
          helper={`${summary.limits.unconfiguredLimitsCount.toLocaleString()} clienti restano senza limiti.`}
          tone="warning"
        />
      </article>
    </section>
  );
}
