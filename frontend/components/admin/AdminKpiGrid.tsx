import type { AdminOverviewSummary } from "../../types";

interface AdminKpiGridProps {
  summary: AdminOverviewSummary;
}

export function AdminKpiGrid({ summary }: AdminKpiGridProps) {
  const cards = [
    {
      title: "Clienti attivi",
      value: `${summary.clients.activeClients.toLocaleString()} / ${summary.clients.totalClients.toLocaleString()}`,
      tone: "clients",
      detail: `${summary.clients.invitedOrPendingClients.toLocaleString()} invitati o pending · ${summary.clients.archivedOrBlockedClients.toLocaleString()} archiviati o bloccati`,
    },
    {
      title: "Campagne in corso",
      value: summary.campaigns.runningCampaigns.toLocaleString(),
      tone: "campaigns",
      detail: `${summary.campaigns.pausedCampaigns.toLocaleString()} in pausa · ${summary.campaigns.blockedCampaigns.toLocaleString()} bloccate`,
    },
    {
      title: "Email inviate oggi",
      value: summary.sending.emailsSentToday.toLocaleString(),
      tone: "sending",
      detail: `${summary.sending.emailsSentThisMonth.toLocaleString()} nel mese corrente`,
    },
    {
      title: "Blocchi oggi",
      value: summary.blocks.blockedSendsToday.toLocaleString(),
      tone: "blocked",
      detail: `${summary.blocks.recentCriticalEvents.length.toLocaleString()} eventi critici recenti`,
    },
    {
      title: "Email inviate questo mese",
      value: summary.sending.emailsSentThisMonth.toLocaleString(),
      tone: "volume",
      detail:
        summary.sending.topClientsByVolume.length > 0
          ? `${summary.sending.topClientsByVolume[0].clientName} guida il volume corrente`
          : "Nessun invio registrato nel mese corrente",
    },
    {
      title: "Clienti vicini al limite",
      value: summary.limits.clientsNearLimit.length.toLocaleString(),
      tone: "limits",
      detail: `${summary.limits.configuredLimitsCount.toLocaleString()} clienti con limiti configurati · ${summary.limits.unconfiguredLimitsCount.toLocaleString()} senza limiti`,
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
        </article>
      ))}
    </section>
  );
}
