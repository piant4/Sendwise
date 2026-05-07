import { StatusBadge } from "../ui/StatusBadge";
import type { AdminOverviewSummary } from "../../types";

interface AdminDashboardHeaderProps {
  summary: AdminOverviewSummary;
  isMockMode: boolean;
}

export function AdminDashboardHeader({
  summary,
  isMockMode,
}: AdminDashboardHeaderProps) {
  const environmentLabel = isMockMode ? "Ambiente locale" : "API frontend";
  const summaryItems = [
    {
      label: "Clienti attivi",
      value: summary.clientStatusCounts.active.toLocaleString(),
    },
    {
      label: "Campagne presidiate",
      value: summary.activeCampaigns.toLocaleString(),
    },
    {
      label: "Blocchi odierni",
      value: summary.blockedSendsToday.toLocaleString(),
    },
  ];

  return (
    <section className="admin-hero">
      <div className="admin-hero__copy">
        <p className="admin-hero__eyebrow">Riepilogo operativo</p>
        <div className="admin-hero__headline">
          <h2 className="admin-hero__title">Quadro compatto della giornata</h2>
          <p className="admin-hero__lead">
            Vista interna per monitorare clienti, campagne, limiti e segnali di
            blocco con una gerarchia piu rapida da leggere.
          </p>
        </div>
        <div className="admin-hero__status-row">
          <StatusBadge label={environmentLabel} variant="neutral" />
          <StatusBadge label="Accesso interno" variant="success" />
          <span className="admin-hero__helper">
            Nessuna azione di scrittura attiva in questa milestone.
          </span>
        </div>
      </div>

      <div className="admin-hero__summary" aria-label="Sintesi operativa">
        {summaryItems.map((item) => (
          <div key={item.label} className="admin-hero__summary-item">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
