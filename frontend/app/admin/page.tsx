import { DashboardCard } from "../../components/ui/DashboardCard";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { getAdminOverviewSummary } from "../../lib/api";
import type { AdminSystemStatus } from "../../types";

const systemStatusLabels: Record<keyof AdminSystemStatus, string> = {
  api: "Boundary API frontend",
  mockData: "Dati simulati",
  sending: "Invio",
  mailpit: "Mailpit",
};

const systemStatusCopy: Record<AdminSystemStatus[keyof AdminSystemStatus], string> = {
  ok: "OK",
  warning: "Attenzione",
  enabled: "Attivo",
  disabled: "Disattivato",
  dev_only: "Solo sviluppo",
};

export default async function AdminPage() {
  const summary = await getAdminOverviewSummary();
  const campaignStatuses = [
    { label: "Attive", value: summary.campaignStatusCounts.active },
    { label: "In pausa", value: summary.campaignStatusCounts.paused },
    { label: "Bloccate", value: summary.campaignStatusCounts.blocked },
    { label: "Bozze", value: summary.campaignStatusCounts.draft },
  ];
  const emailLimitRows = [
    {
      label: "Invii mensili",
      value: summary.emailLimitOverview.monthlySent,
      limit: summary.emailLimitOverview.monthlyLimit,
    },
    {
      label: "Invii giornalieri",
      value: summary.emailLimitOverview.dailySent,
      limit: summary.emailLimitOverview.dailyLimit,
    },
  ];
  const systemStatuses = Object.entries(summary.systemStatus) as [
    keyof AdminSystemStatus,
    AdminSystemStatus[keyof AdminSystemStatus],
  ][];

  return (
    <main className="shell">
      <section
        className="panel admin-overview"
        style={{ display: "grid", gap: 24, maxWidth: 1120 }}
      >
        <SectionHeader
          title="Dashboard admin"
          description="Panoramica operativa letta dal boundary API frontend con dati simulati."
          actions={<StatusBadge label="Dati simulati" variant="neutral" />}
        />
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <DashboardCard
            title="Clienti"
            description="Account cliente totali visibili nella panoramica admin."
            value={summary.totalClients.toLocaleString()}
            footer="Lettura tramite frontend/lib/api.ts."
          />
          <DashboardCard
            title="Campagne"
            description="Campagne attive riportate dal riepilogo."
            value={summary.activeCampaigns.toLocaleString()}
            footer={<StatusBadge label="Panoramica" variant="success" />}
          />
          <DashboardCard
            title="Invii bloccati"
            description="Tentativi di invio bloccati oggi da regole backend."
            value={summary.blockedSendsToday.toLocaleString()}
            footer="Solo visualizzazione: le regole di invio restano backend."
          />
          <DashboardCard
            title="Chiamate AI"
            description="Chiamate AI mensili usate nella panoramica."
            value={summary.monthlyAiCallsUsed.toLocaleString()}
            footer="L'enforcement dei consumi resta fuori dalla UI."
          />
        </div>
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          <DashboardCard
            title="Stato campagne"
            description="Sintesi compatta degli stati nella panoramica admin."
          >
            <div style={{ display: "grid", gap: 12 }}>
              {campaignStatuses.map((status) => (
                <div
                  key={status.label}
                  style={{
                    alignItems: "center",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 16,
                  }}
                >
                  <span style={{ color: "var(--muted)" }}>{status.label}</span>
                  <strong>{status.value.toLocaleString()}</strong>
                </div>
              ))}
            </div>
          </DashboardCard>

          <DashboardCard
            title="Limiti email"
            description="Uso dei limiti mostrato dai dati simulati di panoramica."
          >
            <div style={{ display: "grid", gap: 14 }}>
              {emailLimitRows.map((row) => (
                <div key={row.label} style={{ display: "grid", gap: 6 }}>
                  <div
                    style={{
                      alignItems: "center",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 16,
                    }}
                  >
                    <span style={{ color: "var(--muted)" }}>{row.label}</span>
                    <strong>
                      {row.value.toLocaleString()} / {row.limit.toLocaleString()}
                    </strong>
                  </div>
                  <div
                    aria-hidden="true"
                    style={{
                      background: "var(--sw-muted-surface)",
                      borderRadius: 999,
                      height: 8,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        background: "var(--sw-accent)",
                        height: "100%",
                        width: `${Math.min((row.value / row.limit) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>

        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          <DashboardCard
            title="Invii bloccati recenti"
            description="Anteprima dei tentativi bloccati recenti tra i clienti."
          >
            <div style={{ display: "grid", gap: 12 }}>
              {summary.recentBlockedSends.map((blockedSend) => (
                <article
                  key={blockedSend.id}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    display: "grid",
                    gap: 4,
                    paddingBottom: 12,
                  }}
                >
                  <div
                    style={{
                      alignItems: "center",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      justifyContent: "space-between",
                    }}
                  >
                    <strong>{blockedSend.clientName}</strong>
                    <span style={{ color: "var(--muted)", fontSize: 13 }}>
                      {blockedSend.createdAtLabel}
                    </span>
                  </div>
                  <span>{blockedSend.campaignName}</span>
                  <span style={{ color: "var(--muted)" }}>
                    {blockedSend.reason}
                  </span>
                </article>
              ))}
            </div>
          </DashboardCard>

          <DashboardCard
            title="Stato sistema"
            description="Note sui servizi in modalità sviluppo per gli operatori."
          >
            <div style={{ display: "grid", gap: 12 }}>
              {systemStatuses.map(([key, value]) => (
                <div
                  key={key}
                  style={{
                    alignItems: "center",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <span style={{ color: "var(--muted)" }}>
                    {systemStatusLabels[key]}
                  </span>
                  <StatusBadge
                    label={systemStatusCopy[value]}
                    variant={value === "warning" ? "warning" : "neutral"}
                  />
                </div>
              ))}
            </div>
          </DashboardCard>
        </div>
      </section>
    </main>
  );
}
