import { DashboardCard } from "../../components/ui/DashboardCard";
import { SectionHeader } from "../../components/ui/SectionHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { getClientOverviewSummary } from "../../lib/api";
import type {
  ClientAccountStatus,
  ClientCampaignSummaryStatus,
} from "../../types";

type BadgeVariant = "neutral" | "success" | "warning" | "danger";

const responsiveGrid = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
};

const listStyle = {
  display: "grid",
  gap: 12,
};

const previewStyle = {
  border: "1px solid var(--border)",
  borderRadius: 8,
  display: "grid",
  gap: 10,
  padding: 14,
};

const splitRowStyle = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 12,
  justifyContent: "space-between",
};

function statusVariant(
  status: ClientCampaignSummaryStatus | ClientAccountStatus["status"],
): BadgeVariant {
  if (status === "active" || status === "trial" || status === "completed") {
    return "success";
  }

  if (status === "draft" || status === "paused") {
    return "warning";
  }

  if (status === "blocked" || status === "archived") {
    return "danger";
  }

  return "neutral";
}

function statusLabel(
  status: ClientCampaignSummaryStatus | ClientAccountStatus["status"],
) {
  const labels: Record<
    ClientCampaignSummaryStatus | ClientAccountStatus["status"],
    string
  > = {
    active: "Attiva",
    archived: "Archiviata",
    blocked: "Bloccata",
    completed: "Completata",
    draft: "Bozza",
    paused: "In pausa",
    trial: "In prova",
  };

  return labels[status];
}

function progressPercent(used: number, limit: number) {
  if (limit <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((used / limit) * 100));
}

function MeterBar({ value }: { value: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        background: "#D6E5E3",
        borderRadius: 999,
        height: 8,
        overflow: "hidden",
        width: "100%",
      }}
    >
      <div
        style={{
          background: "#517664",
          height: "100%",
          width: `${value}%`,
        }}
      />
    </div>
  );
}

function MeterRow({
  label,
  limit,
  used,
}: {
  label: string;
  limit: number;
  used: number;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={splitRowStyle}>
        <strong>{label}</strong>
        <span>
          {used.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <MeterBar value={progressPercent(used, limit)} />
    </div>
  );
}

export default async function ClientPage() {
  const summary = await getClientOverviewSummary();

  return (
    <main className="shell">
      <section className="panel" style={{ display: "grid", gap: 24 }}>
        <SectionHeader
          title="Panoramica cliente"
          description="Riepilogo operativo mock per il cliente corrente."
          actions={<StatusBadge label="Dati simulati" variant="neutral" />}
        />

        <div style={responsiveGrid}>
          <DashboardCard
            title="Campagne"
            description="Campagne attive riportate dal riepilogo."
            value={summary.activeCampaigns.toLocaleString()}
            footer="Lettura tramite frontend/lib/api.ts."
          />
          <DashboardCard
            title="Email mensili"
            description="Email inviate nel mese per questo riepilogo."
            value={summary.monthlyEmailsSent.toLocaleString()}
            footer={`Limite mensile: ${summary.monthlyEmailLimit.toLocaleString()}`}
          />
          <DashboardCard
            title="Limite mensile"
            description="Limite email mostrato dal payload di riepilogo."
            value={summary.monthlyEmailLimit.toLocaleString()}
            footer="Il limite di invio è controllato dalla dashboard admin."
          />
          <DashboardCard
            title="Invii bloccati"
            description="Tentativi di invio bloccati riportati per questo mese."
            value={summary.blockedSendsThisMonth.toLocaleString()}
            footer={<StatusBadge label="Riepilogo cliente" variant="success" />}
          />
        </div>

        <DashboardCard
          title="Stato account"
          description="Stato account mostrato dal payload di riepilogo."
          footer="Lo stato è solo presentato nel frontend."
        >
          <div style={{ display: "grid", gap: 10 }}>
            <StatusBadge
              label={summary.accountStatus.label}
              variant={statusVariant(summary.accountStatus.status)}
            />
            <p style={{ margin: 0 }}>{summary.accountStatus.note}</p>
          </div>
        </DashboardCard>

        <div style={responsiveGrid}>
          <DashboardCard
            title="Uso email"
            description="Email inviate rispetto ai limiti disponibili."
          >
            <div style={{ display: "grid", gap: 18 }}>
              <MeterRow
                label="Email mensili"
                used={summary.limitOverview.monthlyEmailsSent}
                limit={summary.limitOverview.monthlyEmailLimit}
              />
              <MeterRow
                label="Email giornaliere"
                used={summary.limitOverview.dailyEmailsSent}
                limit={summary.limitOverview.dailyEmailLimit}
              />
            </div>
          </DashboardCard>

          <DashboardCard
            title="Limiti email"
            description="Volume di invio mostrato senza enforcement frontend."
            footer="Nessuna azione reale disponibile in questa fase."
          >
            <p style={{ margin: 0 }}>
              Il limite di invio è controllato dalla dashboard admin.
            </p>
          </DashboardCard>
        </div>

        <div style={responsiveGrid}>
          <DashboardCard
            title="Campagne"
            description="Anteprima compatta delle campagne del cliente."
          >
            <div style={listStyle}>
              {summary.campaignSummaries.map((campaign) => (
                <article key={campaign.id} style={previewStyle}>
                  <div style={splitRowStyle}>
                    <strong>{campaign.name}</strong>
                    <StatusBadge
                      label={statusLabel(campaign.status)}
                      variant={statusVariant(campaign.status)}
                    />
                  </div>
                  <div style={{ ...splitRowStyle, color: "var(--muted)" }}>
                    <span>
                      {campaign.sent.toLocaleString()} /{" "}
                      {campaign.limit.toLocaleString()} email inviate
                    </span>
                    <span>{campaign.lastActivityLabel}</span>
                  </div>
                  <MeterBar
                    value={progressPercent(campaign.sent, campaign.limit)}
                  />
                </article>
              ))}
            </div>
          </DashboardCard>

          <DashboardCard
            title="Invii bloccati"
            description="Anteprima leggibile dei tentativi bloccati recenti."
            footer="L'autorizzazione backend resta la fonte di verità."
          >
            <div style={listStyle}>
              {summary.readableBlockedSends.map((blockedSend) => (
                <article key={blockedSend.id} style={previewStyle}>
                  <div style={splitRowStyle}>
                    <strong>{blockedSend.campaignName}</strong>
                    <span style={{ color: "var(--muted)" }}>
                      {blockedSend.createdAtLabel}
                    </span>
                  </div>
                  <p style={{ margin: 0 }}>{blockedSend.readableReason}</p>
                  <span style={{ color: "var(--muted)", fontSize: 14 }}>
                    Codice motivo: {blockedSend.reason}
                  </span>
                </article>
              ))}
            </div>
          </DashboardCard>
        </div>
      </section>
    </main>
  );
}
