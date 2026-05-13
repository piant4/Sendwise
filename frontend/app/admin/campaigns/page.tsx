import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AdminSurface } from "../../../components/admin/AdminSurface";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import {
  getAdminCampaigns,
  getAdminCampaignSummary,
  isApiError,
} from "../../../lib/api";
import type {
  AdminCampaignReadinessSummary,
  AdminCampaignSummary,
  CampaignLogsSummary,
  CampaignRecipientsSummary,
  CampaignStatus,
  ProviderRuntimeSummary,
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

function getCampaignStatusLabel(status: CampaignStatus): string {
  switch (status) {
    case "ready":
      return "Pronta";
    case "running":
      return "In corso";
    case "paused":
      return "In pausa";
    case "blocked":
      return "Bloccata";
    case "draft":
      return "Bozza";
    case "completed":
      return "Completata";
    case "failed":
      return "Errore";
    default:
      return "Stato";
  }
}

function getCampaignStatusVariant(status: CampaignStatus) {
  switch (status) {
    case "ready":
    case "running":
      return "success" as const;
    case "paused":
      return "warning" as const;
    case "blocked":
    case "failed":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
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

function formatCount(value: number): string {
  return value.toLocaleString("it-IT");
}

function buildRecipientNotes(recipients: CampaignRecipientsSummary): string[] {
  const notes = [
    recipients.invalid > 0
      ? `${formatCount(recipients.invalid)} email non valide`
      : null,
    recipients.suppressed > 0
      ? `${formatCount(recipients.suppressed)} contatti soppressi`
      : null,
    recipients.blocked > 0 ? `${formatCount(recipients.blocked)} bloccati` : null,
  ].filter((note): note is string => Boolean(note));

  return notes.length > 0 ? notes : ["Nessun blocco destinatario nei dati backend."];
}

function buildProviderEventsLabel(logs: CampaignLogsSummary): string {
  if (logs.providerEventsAvailable) {
    return "Eventi provider disponibili";
  }

  if (
    logs.queued === 0 &&
    logs.sent === 0 &&
    logs.opened === 0 &&
    logs.clicked === 0 &&
    logs.bounced === 0 &&
    logs.complained === 0 &&
    logs.unsubscribed === 0
  ) {
    return "Nessun evento provider ancora registrato";
  }

  return "Eventi provider non disponibili per questa campagna";
}

function buildRuntimeLabel(runtime?: ProviderRuntimeSummary | null): string {
  if (!runtime) {
    return "Provider mode unavailable";
  }

  return runtime.providerModeLabel || "Provider mode unavailable";
}

function buildSesValidationLabel(runtime?: ProviderRuntimeSummary | null): string {
  if (!runtime) {
    return "Provider mode unavailable";
  }

  if (runtime.sesLiveValidationStatus === "pending") {
    return "SES configured but live validation pending";
  }

  return runtime.emailProvider === "ses"
    ? "SES live validation pending"
    : "Non richiesta per il provider corrente";
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
                { label: "Ready / running", value: stats?.active ?? 0 },
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
              description="Ogni riga mostra il cliente proprietario, lo stato reale del record e un piccolo segnale operativo disponibile nel DB."
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
                  {result.campaigns.map((campaign) => (
                    <article key={campaign.id} className="admin-record-row">
                      <div className="admin-record-row__primary">
                        <div className="admin-record-row__copy">
                          <strong>{campaign.name}</strong>
                          <span>{campaign.clientName}</span>
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
                          <dt>Email cliente</dt>
                          <dd>{campaign.clientEmail}</dd>
                        </div>
                        <div>
                          <dt>Invii bloccati</dt>
                          <dd>{campaign.blockedSendsCount.toLocaleString()}</dd>
                        </div>
                        <div>
                          <dt>Creata</dt>
                          <dd>{formatDateLabel(campaign.createdAt)}</dd>
                        </div>
                        <div>
                          <dt>Aggiornata</dt>
                          <dd>{formatDateLabel(campaign.updatedAt)}</dd>
                        </div>
                      </dl>

                      <p className="admin-record-row__note">
                        {campaign.subject ||
                          "Oggetto non disponibile nel record corrente."}
                      </p>

                      {(() => {
                        const readiness = result.campaignReadiness[campaign.id];

                        if (!readiness || readiness instanceof Error) {
                          return (
                            <p className="admin-record-row__note">
                              Read model backend non disponibile:{" "}
                              {readiness?.message ?? "pending backend data"}.
                            </p>
                          );
                        }

                        return (
                          <dl className="admin-record-grid">
                            <div>
                              <dt>Readiness</dt>
                              <dd>
                                Content {readiness.campaign.contentReady ? "ok" : "pending"} ·
                                Contatti {readiness.campaign.contactsReady ? "ok" : "pending"} ·
                                Review {readiness.campaign.reviewReady ? "ok" : "pending"}
                              </dd>
                            </div>
                            <div>
                              <dt>Send safety</dt>
                              <dd>
                                {readiness.canSend
                                  ? "Backend consente invio controllato"
                                  : "Bloccato dal backend"}
                              </dd>
                            </div>
                            <div>
                              <dt>Destinatari</dt>
                              <dd>
                                {formatCount(readiness.recipients.eligible)} eleggibili /{" "}
                                {formatCount(readiness.recipients.total)} totali
                              </dd>
                            </div>
                            <div>
                              <dt>Blocked reasons</dt>
                              <dd>{buildRecipientNotes(readiness.recipients).join(", ")}</dd>
                            </div>
                            <div>
                              <dt>Provider events</dt>
                              <dd>{buildProviderEventsLabel(readiness.logs)}</dd>
                            </div>
                            <div>
                              <dt>Stats backend</dt>
                              <dd>
                                queued {formatCount(readiness.logs.queued)} · sent{" "}
                                {formatCount(readiness.logs.sent)} · bounce{" "}
                                {formatCount(readiness.logs.bounced)} · unsubscribe{" "}
                                {formatCount(readiness.logs.unsubscribed)}
                              </dd>
                            </div>
                            <div>
                              <dt>Email sending</dt>
                              <dd>
                                {readiness.runtime.emailSendingEnabled
                                  ? "Abilitato dal backend"
                                  : "Sending disabled"}
                              </dd>
                            </div>
                            <div>
                              <dt>Provider mode</dt>
                              <dd>{buildRuntimeLabel(readiness.runtime)}</dd>
                            </div>
                            <div>
                              <dt>SES live validation</dt>
                              <dd>{buildSesValidationLabel(readiness.runtime)}</dd>
                            </div>
                            <div>
                              <dt>Warnings</dt>
                              <dd>
                                {[...readiness.blockingErrors, ...readiness.warnings].join(
                                  " · ",
                                ) || "Nessun warning dal backend."}
                              </dd>
                            </div>
                          </dl>
                        );
                      })()}
                    </article>
                  ))}
                </div>
              )}
            </AdminSurface>
          </>
        )}
      </section>
    </main>
  );
}
