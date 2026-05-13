import { AdminProgressBar } from "./AdminProgressBar";
import { StatusBadge } from "../ui/StatusBadge";
import type { AdminOverviewSummary } from "../../types";

interface AdminDashboardHeaderProps {
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

export function AdminDashboardHeader({
  summary,
}: AdminDashboardHeaderProps) {
  const activeClientRatio =
    summary.clients.totalClients > 0
      ? summary.clients.activeClients / summary.clients.totalClients
      : 0;
  const configuredLimitsRatio =
    summary.clients.totalClients > 0
      ? summary.limits.configuredLimitsCount / summary.clients.totalClients
      : 0;
  const backendBadge =
    summary.system.apiStatus === "ok"
      ? { label: "Backend raggiungibile", variant: "success" as const }
      : { label: "Backend degradato", variant: "danger" as const };
  const databaseBadge =
    summary.system.dbStatus === "ok"
      ? { label: "PostgreSQL raggiungibile", variant: "success" as const }
      : { label: "Database degradato", variant: "danger" as const };

  return (
    <section className="admin-hero">
      <div className="admin-hero__copy">
        <p className="admin-hero__eyebrow">Riepilogo operativo</p>
        <div className="admin-hero__headline">
          <h2 className="admin-hero__title">Controllo operativo reale</h2>
          <p className="admin-hero__lead">
            Tutti i numeri arrivano dal backend e da PostgreSQL: clienti,
            campagne, invii, blocchi e limiti vengono letti senza riepiloghi
            inventati dal frontend.
          </p>
        </div>
        <div className="admin-hero__status-row">
          <StatusBadge label={backendBadge.label} variant={backendBadge.variant} />
          <StatusBadge label={databaseBadge.label} variant={databaseBadge.variant} />
          <StatusBadge
            label={summary.system.providerModeLabel}
            variant={summary.system.emailSendingEnabled ? "warning" : "neutral"}
          />
        </div>
        <div className="admin-progress-stack">
          <AdminProgressBar
            label="Clienti attivi"
            valueLabel={`${summary.clients.activeClients.toLocaleString()} / ${summary.clients.totalClients.toLocaleString()}`}
            ratio={activeClientRatio}
            helper={`${summary.clients.invitedOrPendingClients.toLocaleString()} invitati o pending, ${summary.clients.archivedOrBlockedClients.toLocaleString()} archiviati o bloccati.`}
            tone="success"
          />
          <AdminProgressBar
            label="Limiti configurati"
            valueLabel={`${summary.limits.configuredLimitsCount.toLocaleString()} / ${summary.clients.totalClients.toLocaleString()}`}
            ratio={configuredLimitsRatio}
            helper={`${summary.limits.unconfiguredLimitsCount.toLocaleString()} clienti restano senza limiti configurati.`}
          />
        </div>
      </div>

      <div className="admin-hero__summary" aria-label="Sintesi operativa">
        <div className="admin-hero__summary-item">
          <span>Clienti attivi</span>
          <strong>
            {summary.clients.activeClients.toLocaleString()} /{" "}
            {summary.clients.totalClients.toLocaleString()}
          </strong>
        </div>
        <div className="admin-hero__summary-item">
          <span>Campagne in corso</span>
          <strong>{summary.campaigns.runningCampaigns.toLocaleString()}</strong>
        </div>
        <div className="admin-hero__summary-item">
          <span>Blocchi oggi</span>
          <strong>{summary.blocks.blockedSendsToday.toLocaleString()}</strong>
        </div>
        <div className="admin-hero__summary-item">
          <span>Generata</span>
          <strong>{formatDateTimeLabel(summary.system.generatedAt)}</strong>
        </div>
      </div>
    </section>
  );
}
