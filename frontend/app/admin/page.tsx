import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { AlertTriangle, MailWarning, RadioTower, ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { DashboardErrorState } from "../../components/dashboard/DashboardErrorState";
import { formatDateTimeInRome } from "../../components/shared/dateTime";
import { buildPageMetadata } from "../../components/shared/metadata";
import { getReadableBackendReason } from "../../components/shared/campaignUi";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Button } from "../../components/ui/button";
import { getAdminOverviewSummary, isApiError } from "../../lib/api";
import type {
  AdminClientNearLimit,
  AdminOverviewSummary,
  AdminRecentCampaign,
} from "../../types";

export const dynamic = "force-dynamic";
export const metadata = buildPageMetadata("Dashboard Admin");

function formatDateTimeLabel(value: string): string {
  return formatDateTimeInRome(value);
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

  if (campaign.status === "running") {
    return "In corso";
  }

  if (campaign.status === "ready") {
    return "Pronta";
  }

  return "Da completare";
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
  const campaignsReadyOrRunning = summary.campaigns.statusCounts.active;
  const providerEventsState = summary.system.providerEventsAvailable
    ? {
        label: "Disponibili",
        detail: "Gli eventi provider processati possono confermare delivered, opened e clicked.",
        variant: "success" as const,
      }
    : {
        label: "Non disponibili",
        detail: "Delivered, opened e clicked restano in attesa di eventi provider.",
        variant: "neutral" as const,
      };

  return (
    <main className="shell">
      <section className="admin-overview">
        <header className="admin-page-header admin-overview__hero">
          <div style={{ display: "grid", gap: 10 }}>
            <p className="admin-surface__eyebrow">Admin</p>
            <h1 className="admin-page-title">Dashboard operativo</h1>
            <p className="admin-page-description">
              Stato campagne, blocchi, runtime e disponibilita dei provider events senza metriche inventate.
            </p>
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
          </div>

          <div className="admin-overview__hero-meta">
            <article>
              <span className="admin-record-row__note">Ultimo riepilogo</span>
              <strong>{formatDateTimeLabel(summary.system.generatedAt)}</strong>
            </article>
            <article>
              <span className="admin-record-row__note">Invio reale</span>
              <strong>{summary.system.realSendAvailable ? "Disponibile" : "Fail-closed"}</strong>
            </article>
            <article>
              <span className="admin-record-row__note">Provider events</span>
              <strong>{providerEventsState.label}</strong>
            </article>
          </div>
        </header>

        <section className="admin-overview__grid">
          <article className="admin-overview__panel admin-overview__panel--primary">
            <div className="admin-overview__metric-row">
              <div className="admin-overview__metric">
                <span>Campagne ready / running</span>
                <strong>{campaignsReadyOrRunning.toLocaleString("it-IT")}</strong>
                <p>Campagne operative o pronte per la review finale.</p>
              </div>
              <div className="admin-overview__metric">
                <span>Campagne bloccate o in pausa</span>
                <strong>{attentionCount.toLocaleString("it-IT")}</strong>
                <p>Richiedono intervento o follow-up prima di nuovi invii.</p>
              </div>
            </div>
            <div className="campaign-inline-summary">
              {[
                { label: "Bozze", value: summary.campaigns.statusCounts.draft },
                { label: "Ready / running", value: campaignsReadyOrRunning },
                { label: "In pausa", value: summary.campaigns.statusCounts.paused },
                { label: "Bloccate", value: summary.campaigns.statusCounts.blocked },
                { label: "Errore", value: summary.campaigns.statusCounts.failed },
                { label: "Completate", value: summary.campaigns.statusCounts.completed },
              ].map((item) => (
                <article key={item.label}>
                  <span className="admin-record-row__note">{item.label}</span>
                  <strong>{item.value.toLocaleString("it-IT")}</strong>
                </article>
              ))}
            </div>
          </article>

          <article className="admin-overview__panel">
            <div className="admin-clients-card__intro">
              <div>
                <p className="admin-surface__eyebrow">Provider events</p>
                <h2 className="admin-clients-card__title" style={{ color: "#0f172a", marginTop: 0 }}>
                  Disponibilita metriche
                </h2>
              </div>
              <RadioTower aria-hidden="true" color="#2563eb" size={18} />
            </div>
            <StatusBadge label={providerEventsState.label} variant={providerEventsState.variant} />
            <p className="admin-record-row__note">{providerEventsState.detail}</p>
            <div className="admin-overview__list">
              <div className="admin-overview__list-item">
                <span className="admin-record-row__note">Sent</span>
                <strong>Accettata dal sistema di invio</strong>
              </div>
              <div className="admin-overview__list-item">
                <span className="admin-record-row__note">Delivered / opened / clicked</span>
                <strong>
                  {summary.system.providerEventsAvailable
                    ? "Confermabili via eventi provider"
                    : "Non disponibili"}
                </strong>
              </div>
            </div>
          </article>

          <article className="admin-overview__panel">
            <div className="admin-clients-card__intro">
              <div>
                <p className="admin-surface__eyebrow">Clienti</p>
                <h2 className="admin-clients-card__title" style={{ color: "#0f172a", marginTop: 0 }}>
                  Clienti da seguire
                </h2>
              </div>
              <MailWarning aria-hidden="true" color="#2563eb" size={18} />
            </div>
            <div className="campaign-inline-summary">
              <article>
                <span className="admin-record-row__note">Attivi</span>
                <strong>{summary.clients.activeClients.toLocaleString("it-IT")}</strong>
              </article>
              <article>
                <span className="admin-record-row__note">Invitati / pending</span>
                <strong>{summary.clients.invitedOrPendingClients.toLocaleString("it-IT")}</strong>
              </article>
              <article>
                <span className="admin-record-row__note">Archiviati / bloccati</span>
                <strong>{summary.clients.archivedOrBlockedClients.toLocaleString("it-IT")}</strong>
              </article>
              <article>
                <span className="admin-record-row__note">Vicini al limite</span>
                <strong>{summary.limits.clientsNearLimit.length.toLocaleString("it-IT")}</strong>
              </article>
            </div>
          </article>
        </section>

        <section className="admin-overview__stack">
          <article className="admin-overview__panel">
            <div className="admin-clients-card__intro">
              <div>
                <p className="admin-surface__eyebrow">Campagne</p>
                <h2 className="admin-clients-card__title" style={{ color: "#0f172a", marginTop: 0 }}>
                  Attivita recente
                </h2>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/campaigns">Apri elenco</Link>
              </Button>
            </div>

            {summary.campaigns.recentCampaigns.length === 0 ? (
              <EmptyState message="Nessuna campagna recente disponibile." />
            ) : (
              <div className="admin-overview__list">
                {summary.campaigns.recentCampaigns.slice(0, 5).map((campaign) => (
                  <Link
                    key={campaign.id}
                    href={`/admin/campaigns/${campaign.id}`}
                    className="admin-overview__list-item"
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
                              : campaign.status === "running" || campaign.status === "ready"
                                ? "success"
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
            <article className="admin-overview__panel">
              <div className="admin-clients-card__intro">
                <div>
                  <p className="admin-surface__eyebrow">Blocchi</p>
                  <h2 className="admin-clients-card__title" style={{ color: "#0f172a", marginTop: 0 }}>
                    Invii bloccati recenti
                  </h2>
                </div>
                <ShieldAlert aria-hidden="true" color="#2563eb" size={18} />
              </div>
              {summary.blocks.recentCriticalEvents.length === 0 ? (
                <EmptyState message="Nessun blocco recente esposto dal backend." />
              ) : (
                <div className="admin-overview__list">
                  {summary.blocks.recentCriticalEvents.slice(0, 4).map((event) => (
                    <div key={event.id} className="admin-overview__list-item">
                      <strong style={{ color: "#0f172a" }}>
                        {event.campaignName || "Campagna non disponibile"}
                      </strong>
                      <span className="admin-record-row__note">
                        {event.clientName} / {event.clientEmail}
                      </span>
                      <span className="admin-record-row__note">
                        {getReadableBackendReason(event.reason).label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="admin-overview__panel">
              <div className="admin-clients-card__intro">
                <div>
                  <p className="admin-surface__eyebrow">Capacita</p>
                  <h2 className="admin-clients-card__title" style={{ color: "#0f172a", marginTop: 0 }}>
                    Clienti vicini al limite
                  </h2>
                </div>
                <MailWarning aria-hidden="true" color="#2563eb" size={18} />
              </div>
              {summary.limits.clientsNearLimit.length === 0 ? (
                <EmptyState message="Nessun cliente vicino al limite nei dati correnti." />
              ) : (
                <div className="admin-overview__list">
                  {summary.limits.clientsNearLimit.slice(0, 4).map((client) => (
                    <div key={client.clientId} className="admin-overview__list-item">
                      <strong style={{ color: "#0f172a" }}>{client.clientName}</strong>
                      <span className="admin-record-row__note">{client.clientEmail}</span>
                      <span className="admin-record-row__note">
                        {getLimitLabel(client)} / occupazione {(client.usageRatio * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </div>
        </section>

        {!summary.system.providerEventsAvailable ? (
          <section className="admin-overview__notice">
            <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
              <AlertTriangle aria-hidden="true" color="#b45309" size={18} />
              <strong style={{ color: "#0f172a" }}>Metriche provider non ancora confermabili</strong>
            </div>
            <p className="admin-record-row__note">
              La dashboard non mostra zero fittizi per delivered, opened o clicked quando la sorgente eventi non esiste ancora.
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
