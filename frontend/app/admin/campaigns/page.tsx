import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AdminSurface } from "../../../components/admin/AdminSurface";
import {
  formatCampaignCount,
  getBlockedReasonItems,
  getCampaignLogStatItems,
  getCampaignReadinessItems,
  getCampaignReadinessLabel,
  getCampaignStatusLabel,
  getCampaignStatusVariant,
  getProviderEventsDetail,
  getProviderEventsLabel,
  getRecipientEmptyState,
  getRecipientSummaryItems,
  getRuntimeSafetyItems,
  getSesPendingWarning,
} from "../../../components/shared/campaignUi";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import {
  getAdminCampaigns,
  getAdminCampaignSummary,
  isApiError,
} from "../../../lib/api";
import type {
  AdminCampaignReadinessSummary,
  AdminCampaignSummary,
} from "../../../types";

export const dynamic = "force-dynamic";

function formatDateLabel(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function buildCampaignStats(campaigns: AdminCampaignSummary[]) {
  return {
    total: campaigns.length,
    active: campaigns.filter((campaign) =>
      ["ready", "running"].includes(campaign.status),
    ).length,
    blocked: campaigns.filter((campaign) => campaign.status === "blocked").length,
    missingSubject: campaigns.filter((campaign) => !campaign.subject).length,
  };
}

async function loadCampaignReadiness(
  campaigns: AdminCampaignSummary[],
  accessToken: string | null,
): Promise<Record<string, AdminCampaignReadinessSummary | Error>> {
  const entries = await Promise.all(
    campaigns.map(async (campaign) => {
      try {
        return [
          campaign.id,
          await getAdminCampaignSummary(campaign.id, accessToken),
        ] as const;
      } catch (error) {
        return [
          campaign.id,
          error instanceof Error
            ? error
            : new Error("Read model campagna non disponibile."),
        ] as const;
      }
    }),
  );

  return Object.fromEntries(entries);
}

function renderAdminReadiness(readiness: AdminCampaignReadinessSummary) {
  const blockedReasons = getBlockedReasonItems(readiness.recipients);
  const recipientEmptyState = getRecipientEmptyState(readiness.recipients);
  const sesPendingWarning = getSesPendingWarning(readiness.runtime);
  const backendWarnings = [...readiness.blockingErrors, ...readiness.warnings];

  return (
    <>
      <dl className="admin-record-grid">
        <div>
          <dt>Prontezza</dt>
          <dd>{getCampaignReadinessLabel(readiness.campaign)}</dd>
        </div>
        {getCampaignReadinessItems(readiness.campaign).map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
        <div>
          <dt>Sicurezza invio</dt>
          <dd>
            {readiness.canSend
              ? "Backend consente invio controllato"
              : "Invio bloccato dal backend"}
          </dd>
        </div>
        {getRuntimeSafetyItems(readiness.runtime).map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
        <div>
          <dt>Eventi provider</dt>
          <dd>{getProviderEventsLabel(readiness.logs)}</dd>
        </div>
      </dl>

      <dl className="admin-record-grid">
        {getRecipientSummaryItems(readiness.recipients).map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
        {getCampaignLogStatItems(readiness.logs).map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
        <div>
          <dt>Invii bloccati</dt>
          <dd>{formatCampaignCount(readiness.blockedSends.total)}</dd>
        </div>
      </dl>

      <p className="admin-record-row__note">
        {blockedReasons.length > 0
          ? `Motivi blocco destinatari: ${blockedReasons
              .map((item) => `${item.label.toLowerCase()} ${item.value}`)
              .join(", ")}.`
          : "Nessun blocco destinatario esposto dal backend."}
      </p>
      {recipientEmptyState ? (
        <p className="admin-record-row__note">{recipientEmptyState}</p>
      ) : null}
      <p className="admin-record-row__note">
        {getProviderEventsDetail(readiness.logs)}
      </p>
      {sesPendingWarning ? (
        <p className="admin-record-row__note">{sesPendingWarning}</p>
      ) : null}
      <p className="admin-record-row__note">
        {backendWarnings.length > 0
          ? backendWarnings.join(" / ")
          : "Nessun warning dal backend."}
      </p>
    </>
  );
}

export default async function AdminCampaignsPage() {
  const { getToken } = await auth();
  let result:
    | {
        campaigns: AdminCampaignSummary[];
        campaignReadiness: Record<string, AdminCampaignReadinessSummary | Error>;
      }
    | {
        errorMessage: string;
      };

  try {
    const accessToken = await getToken();
    const campaigns = await getAdminCampaigns(accessToken);
    const campaignReadiness = await loadCampaignReadiness(campaigns, accessToken);

    result = { campaigns, campaignReadiness };
  } catch (error) {
    if (isApiError(error) && [401, 403].includes(error.status ?? 0)) {
      redirect("/auth/redirect");
    }

    result = {
      errorMessage:
        error instanceof Error
          ? error.message
          : "Impossibile caricare la vista campagne admin.",
    };
  }

  const stats = "campaigns" in result ? buildCampaignStats(result.campaigns) : null;

  return (
    <main className="shell">
      <section className="admin-page-shell">
        <header className="admin-page-header">
          <div>
            <p className="admin-surface__eyebrow">Admin</p>
            <h1 className="admin-page-title">Campagne</h1>
            <p className="admin-page-description">
              Vista operativa cross-client letta dal backend business. Nessuna
              campagna viene inventata nel frontend.
            </p>
          </div>
        </header>

        {"errorMessage" in result ? (
          <section className="admin-clients-card">
            <p className="admin-clients-feedback admin-clients-feedback--error">
              {result.errorMessage}
            </p>
          </section>
        ) : (
          <>
            <section className="admin-page-stat-grid" aria-label="Statistiche campagne admin">
              {[
                { label: "Campagne totali", value: stats?.total ?? 0 },
                { label: "Pronte / in corso", value: stats?.active ?? 0 },
                { label: "Bloccate", value: stats?.blocked ?? 0 },
                { label: "Oggetto mancante", value: stats?.missingSubject ?? 0 },
              ].map((stat) => (
                <article key={stat.label} className="admin-page-stat-card">
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </article>
              ))}
            </section>

            <AdminSurface
              title="Panoramica campagne cliente"
              description="Ogni riga mostra proprietario, prontezza, destinatari, sicurezza invio e metriche reali lette dai read model backend."
              aside={
                <span className="admin-surface__eyebrow">
                  {result.campaigns.length.toLocaleString()} elementi
                </span>
              }
            >
              {result.campaigns.length === 0 ? (
                <div className="admin-empty-state">
                  Nessuna campagna presente nel database corrente.
                </div>
              ) : (
                <div className="admin-record-list">
                  {result.campaigns.map((campaign) => {
                    const readiness = result.campaignReadiness[campaign.id];

                    return (
                      <article key={campaign.id} className="admin-record-row">
                        <div className="admin-record-row__primary">
                          <div className="admin-record-row__copy">
                            <strong>{campaign.name}</strong>
                            <span>
                              {campaign.clientName} / {campaign.clientEmail}
                            </span>
                          </div>
                          <StatusBadge
                            label={getCampaignStatusLabel(campaign.status)}
                            variant={getCampaignStatusVariant(campaign.status)}
                          />
                        </div>

                        <dl className="admin-record-grid">
                          <div>
                            <dt>Campaign ID</dt>
                            <dd>{campaign.id}</dd>
                          </div>
                          <div>
                            <dt>Client ID</dt>
                            <dd>{campaign.clientId}</dd>
                          </div>
                          <div>
                            <dt>Oggetto</dt>
                            <dd>
                              {campaign.subject?.trim()
                                ? campaign.subject
                                : "Oggetto non disponibile"}
                            </dd>
                          </div>
                          <div>
                            <dt>Creata</dt>
                            <dd>{formatDateLabel(campaign.createdAt)}</dd>
                          </div>
                          <div>
                            <dt>Aggiornata</dt>
                            <dd>{formatDateLabel(campaign.updatedAt)}</dd>
                          </div>
                          <div>
                            <dt>Blocchi registrati</dt>
                            <dd>{formatCampaignCount(campaign.blockedSendsCount)}</dd>
                          </div>
                        </dl>

                        {!readiness || readiness instanceof Error ? (
                          <p className="admin-record-row__note">
                            Dati campagna non disponibili dal backend:{" "}
                            {readiness?.message ?? "read model pending"}.
                          </p>
                        ) : (
                          renderAdminReadiness(readiness)
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </AdminSurface>
          </>
        )}
      </section>
    </main>
  );
}
