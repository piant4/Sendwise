import type { AdminOverviewSummary } from "../../types";

interface AdminKpiGridProps {
  summary: AdminOverviewSummary;
}

function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

export function AdminKpiGrid({ summary }: AdminKpiGridProps) {
  const configuredClients = summary.emailLimitOverview.configuredClients;
  const totalClients = summary.totalClients;
  const configuredCoverage =
    totalClients > 0
      ? Math.min((configuredClients / totalClients) * 100, 100)
      : 0;

  const cards = [
    {
      title: "Clienti totali",
      value: summary.totalClients.toLocaleString(),
      tone: "clients",
      detail: `${summary.clientStatusCounts.active.toLocaleString()} attivi · ${summary.clientStatusCounts.trial.toLocaleString()} in verifica`,
      note: "Portafoglio gestito dal pannello operativo.",
    },
    {
      title: "Campagne attive / running",
      value: summary.activeCampaigns.toLocaleString(),
      tone: "campaigns",
      detail: `${summary.campaignStatusCounts.paused.toLocaleString()} in pausa · ${summary.campaignStatusCounts.blocked.toLocaleString()} bloccate`,
      note: "Conta gli stati pronti o in esecuzione.",
    },
    {
      title: "Invii bloccati",
      value: summary.blockedSendsToday.toLocaleString(),
      tone: "blocked",
      detail: `${summary.recentBlockedSends.length.toLocaleString()} eventi recenti visibili`,
      note: "Le decisioni di invio restano presidiate dal backend.",
    },
    {
      title: "Limiti email configurati",
      value: `${formatPercentage(configuredCoverage)}`,
      tone: "limits",
      detail: `${configuredClients.toLocaleString()} / ${totalClients.toLocaleString()} clienti con limiti attivi`,
      note: `${summary.emailLimitOverview.totalMaxCampaigns.toLocaleString()} campagne massime aggregate disponibili.`,
    },
  ];

  return (
    <section className="admin-kpi-grid" aria-label="Indicatori operativi">
      {cards.map((card) => (
        <article
          key={card.title}
          className="admin-kpi-card"
          data-tone={card.tone}
        >
          <div className="admin-kpi-card__topline">
            <span className="admin-kpi-card__title">{card.title}</span>
            <span className="admin-kpi-card__pulse" aria-hidden="true" />
          </div>
          <strong className="admin-kpi-card__value">{card.value}</strong>
          <p className="admin-kpi-card__detail">{card.detail}</p>
          <span className="admin-kpi-card__note">{card.note}</span>
        </article>
      ))}
    </section>
  );
}
