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
          <StatusBadge label="Backend raggiungibile" variant="success" />
          <StatusBadge label="PostgreSQL raggiungibile" variant="success" />
          <StatusBadge
            label={
              summary.system.emailSendingEnabled
                ? "Invio email attivo"
                : "Invio email disattivato"
            }
            variant={summary.system.emailSendingEnabled ? "warning" : "neutral"}
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
          <span>Generata</span>
          <strong>{formatDateTimeLabel(summary.system.generatedAt)}</strong>
        </div>
      </div>
    </section>
  );
}
