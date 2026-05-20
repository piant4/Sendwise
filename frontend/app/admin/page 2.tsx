import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { AlertTriangle, MailWarning, RadioTower, ShieldAlert } from "lucide-react";
import { DashboardErrorState } from "../../components/dashboard/DashboardErrorState";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Button } from "../../components/ui/button";
import { getAdminOverviewSummary, isApiError } from "../../lib/api";
import type {
  AdminClientNearLimit,
  AdminOverviewSummary,
  AdminRecentCampaign,
} from "../../types";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function formatDateTimeLabel(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getCampaignAttentionCount(summary: AdminOverviewSummary): number {
  return (
    summary.campaigns.statusCounts.blocked +
    summary.campaigns.statusCounts.paused +
    summary.campaigns.statusCounts.failed
  );
}

function getCampaignAttentionLabel(campaign: AdminRecentCampaign): string {
  if (campaign.status === "blocked" || campaign.status === "failed") {
    return "Richiede intervento";
  }

  if (campaign.status === "paused") {
    return "In pausa";
  }

  if (campaign.status === "draft") {
    return "Bozza";
  }

  if (campaign.status === "running") {
    return "In corso";
  }

  return "Monitorata";
}

function getLimitLabel(client: AdminClientNearLimit): string {
  return client.limitingFactor === "campaign_slots"
    ? "Capacita campagne"
    : "Limite campagne";
}

function EmptyState({ message }: { message: string }) {
  return <div className="campaign-empty-state">{message}</div>;
}

function AdminDashboardContent({ summary }: { summary: AdminOverviewSummary }) {
  const attentionCount = getCampaignAttentionCount(summary);

  return (
    <main className="shell">
      <section className="dashboard-cleanup">
        <header className="admin-page-header">
          <div style={{ display: "grid", gap: 8 }}>
            <p className="admin-surface__eyebrow">Admin</p>
            <h1 className="admin-page-title">Dashboard operativo</h1>
            <p className="admin-page-description">
              Priorita reali: clienti attivi, campagne da seguire, blocchi e stato runtime.
            </p>
          </div>
        </header>

        <section className="dashboard-cleanup__top">
          <article className="dashboard-cleanup__card">
            <div style={{ display: "grid", gap: 10 }}>
              <p className="admin-surface__eyebrow">Panoramica</p>
              <h2 className="admin-clients-card__title" style={{ color: "#0f172a", marginTop: 0 }}>
                Stato piattaforma
              </h2>
              <p className="admin-record-row__note">
                Ultimo riepilogo generato il {formatDateTimeLabel(summary.system.generatedAt)}.
              </p>
            </div>

            <div className="campaign-hero-actions">
              <StatusBadge
                label={summary.system.apiStatus === "ok" ? "Backend raggiungibile" : "Backend degradato"}
                variant={summary.system.apiStatus === "ok" ? "success" : "danger"}
              />
              <StatusBadge
                label={summary.system.dbStatus === "ok" ? "PostgreSQL raggiungibile" : "Database degradato"}
                variant={summary.system.dbStatus === "ok" ? "success" : "danger"}
              />
              <StatusBadge
                label={summary.system.providerModeLabel}
                variant={summary.system.emailSendingEnabled ? "warning" : "neutral"}
              />
            </div>

            <div className="campaign-inline-summary">
              <article>
                <span className="admin-record-row__note">Clienti attivi</span>
                <strong>
                  {summary.clients.activeClients.toLocaleString("it-IT")} /{" "}
                  {summary.clients.totalClients.toLocaleString("it-IT")}
                </strong>
              </article>
              <article>
                <span className="admin-record-row__note">Campagne da attenzionare</span>
                <strong>{attentionCount.toLocaleString("it-IT")}</strong>
              </article>
              <article>
                <span className="admin-record-row__note">Invii bloccati oggi</span>
                <strong>{summary.blocks.blockedSendsToday.toLocaleString("it-IT")}</strong>
              </article>
            </div>
          </article>

          <article className="dashboard-cleanup__card">
            <div className="dashboard-cleanup__metric">
              <span>Invio reale</span>
              <strong>{summary.system.emailSendingEnabled ? "Attivo" : "Disabilitato"}</strong>
            </div>
            <p className="admin-record-row__note">
              {summary.system.realSendAvailable
                ? "Runtime pronto quando il gate backend lo consente."
                : "EMAIL_SENDING_ENABLED resta fail-closed."}
            </p>
            <div className="dashboard-cleanup__list">
              <div className="dashboard-cleanup__list-item">
                <span className="admin-record-row__note">Provider eventi</span>
                <strong style={{ color: "#0f172a" }}>
                  {summary.system.providerEventsAvailable ? "Disponibili" : "Non disponibili"}
                </strong>
              </div>
              <div className="dashboard-cleanup__list-item">
                <span className="admin-record-row__note">SES live validation</span>
                <strong style={{ color: "#0f172a" }}>
                  {summary.system.sesLiveValidationStatus ?? "Pending"}
                </strong>
              </div>
            </div>
          </article>
        </section>

        <section className="dashboard-cleanup__grid">
          <article className="dashboard-cleanup__card">
            <div className="dashboard-cleanup__metric">
              <span>Clienti attivi</span>
              <strong>{summary.clients.activeClients.toLocaleString("it-IT")}</strong>
            </div>
            <p className="admin-record-row__note">
              {summary.clients.invitedOrPendingClients.toLocaleString("it-IT")} invitati o pending.
            </p>
          </article>

          <article className="dashboard-cleanup__card">
            <div className="dashboard-cleanup__metric">
              <span>Campagne in corso</span>
              <strong>{summary.campaigns.runningCampaigns.toLocaleString("it-IT")}</strong>
            </div>
            <p className="admin-record-row__note">
              {summary.campaigns.statusCounts.draft.toLocaleString("it-IT")} bozze e{" "}
              {summary.campaigns.statusCounts.paused.toLocaleString("it-IT")} in pausa.
            </p>
          </article>

          <article className="dashboard-cleanup__card">
            <div className="dashboard-cleanup__metric">
              <span>Limiti configurati</span>
              <strong>{summary.limits.configuredLimitsCount.toLocaleString("it-IT")}</strong>
            </div>
            <p className="admin-record-row__note">
              {summary.limits.unconfiguredLimitsCount.toLocaleString("it-IT")} clienti senza limiti.
            </p>
          </article>
        </section>

        <section className="dashboard-cleanup__stack">
          <article className="dashboard-cleanup__card">
            <div className="admin-clients-card__intro">
              <div>
                <p className="admin-surface__eyebrow">Campagne</p>
                <h2 className="admin-clients-card__title" style={{ color: "#0f172a", marginTop: 0 }}>
                  Da seguire
                </h2>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/campaigns">Apri elenco</Link>
              </Button>
            </div>

            {summary.campaigns.recentCampaigns.length === 0 ? (
              <EmptyState message="Nessuna campagna recente disponibile." />
            ) : (
              <div className="dashboard-cleanup__list">
                {summary.campaigns.recentCampaigns.slice(0, 5).map((campaign) => (
                  <Link
                    key={campaign.id}
                    href={`/admin/campaigns/${campaign.id}`}
                    className="dashboard-cleanup__list-item"
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    <div style={{ alignItems: "start", display: "flex", gap: 10, justifyContent: "space-between" }}>
                      <div style={{ display: "grid", gap: 4 }}>
                        <strong style={{ color: "#0f172a" }}>{campaign.campaignName}</strong>
                        <span className="admin-record-row__note">
                          {campaign.clientName} / {campaign.clientEmail}
                        </span>
                      </div>
                      <StatusBadge
                        label={getCampaignAttentionLabel(campaign)}
                        variant={
                          campaign.status === "blocked" || campaign.status === "failed"
                            ? "danger"
                            : campaign.status === "paused"
                              ? "warning"
                              : "neutral"
                        }
                      />
                    </div>
                    <span className="admin-record-row__note">
                      Aggiornata {formatDateTimeLabel(campaign.updatedAt)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </article>

          <div style={{ display: "grid", gap: 14 }}>
            <article className="dashboard-cleanup__card">
              <div className="admin-clients-card__intro">
                <div>
                  <p className="admin-surface__eyebrow">Blocchi</p>
                  <h2 className="admin-clients-card__title" style={{ color: "#0f172a", marginTop: 0 }}>
                    Invii bloccati
                  </h2>
                </div>
                <ShieldAlert aria-hidden="true" color="#2563eb" size={18} />
              </div>

              {summary.blocks.recentCriticalEvents.length === 0 ? (
                <EmptyState message="Nessun blocco recente esposto dal backend." />
              ) : (
                <div className="dashboard-cleanup__list">
                  {summary.blocks.recentCriticalEvents.slice(0, 4).map((event) => (
                    <div key={event.id} className="dashboard-cleanup__list-item">
                      <strong style={{ color: "#0f172a" }}>
                        {event.campaignName || "Campagna non disponibile"}
                      </strong>
                      <span className="admin-record-row__note">
                        {event.clientName} / {event.clientEmail}
                      </span>
                      <span className="admin-record-row__note">{event.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="dashboard-cleanup__card">
              <div className="admin-clients-card__intro">
                <div>
                  <p className="admin-surface__eyebrow">Runtime</p>
                  <h2 className="admin-clients-card__title" style={{ color: "#0f172a", marginTop: 0 }}>
                    Stato provider
                  </h2>
                </div>
                <RadioTower aria-hidden="true" color="#2563eb" size={18} />
              </div>
              <div className="dashboard-cleanup__list">
                <div className="dashboard-cleanup__list-item">
                  <span className="admin-record-row__note">Provider</span>
                  <strong style={{ color: "#0f172a" }}>{summary.system.emailProvider}</strong>
                </div>
                <div className="dashboard-cleanup__list-item">
                  <span className="admin-record-row__note">Modalita runtime</span>
                  <strong style={{ color: "#0f172a" }}>{summary.system.providerModeLabel}</strong>
                </div>
                <div className="dashboard-cleanup__list-item">
                  <span className="admin-record-row__note">Provider events</span>
                  <strong style={{ color: "#0f172a" }}>
                    {summary.system.providerEventsAvailable ? "Disponibili" : "Assenti"}
                  </strong>
                </div>
              </div>
            </article>

            <article className="dashboard-cleanup__card">
              <div className="admin-clients-card__intro">
                <div>
                  <p className="admin-surface__eyebrow">Limiti</p>
                  <h2 className="admin-clients-card__title" style={{ color: "#0f172a", marginTop: 0 }}>
                    Clienti vicini al limite
                  </h2>
                </div>
                <MailWarning aria-hidden="true" color="#2563eb" size={18} />
              </div>
              {summary.limits.clientsNearLimit.length === 0 ? (
                <EmptyState message="Nessun cliente vicino al limite nei dati correnti." />
              ) : (
                <div className="dashboard-cleanup__list">
                  {summary.limits.clientsNearLimit.slice(0, 4).map((client) => (
                    <div key={client.clientId} className="dashboard-cleanup__list-item">
                      <strong style={{ color: "#0f172a" }}>{client.clientName}</strong>
                      <span className="admin-record-row__note">{client.clientEmail}</span>
                      <span className="admin-record-row__note">
                        {getLimitLabel(client)} / utilizzo {(client.usageRatio * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </div>
        </section>

        {!summary.system.providerEventsAvailable ? (
          <section className="dashboard-cleanup__card">
            <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
              <AlertTriangle aria-hidden="true" color="#b45309" size={18} />
              <strong style={{ color: "#0f172a" }}>Metriche evento non ancora disponibili</strong>
            </div>
            <p className="admin-record-row__note">
              Delivered, open e click restano non esposti finche il provider non fornisce eventi processati.
            </p>
          </section>
        ) : null}
      </section>
    </main>
  );
}

export default async function AdminPage() {
  const { getToken } = await auth();
  const result = await getAdminOverviewSummary(await getToken())
    .then((summary) => ({ summary }))
    .catch((error: unknown) => {
      if (isApiError(error) && [401, 403].includes(error.status ?? 0)) {
        redirect("/auth/redirect");
      }

      return {
        errorMessage:
          error instanceof Error ? error.message : "Unknown dashboard error",
      };
    });

  if ("errorMessage" in result) {
    return (
      <DashboardErrorState
        title="Dashboard admin"
        description="Panoramica operativa letta dal boundary API frontend."
        errorMessage={result.errorMessage}
      />
    );
  }

  return <AdminDashboardContent summary={result.summary} />;
}
