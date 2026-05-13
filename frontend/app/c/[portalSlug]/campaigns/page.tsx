import { DashboardErrorState } from "../../../../components/dashboard/DashboardErrorState";
import { ClientPageHeader } from "../../../../components/client/ClientPageHeader";
import { ClientSurface } from "../../../../components/client/ClientSurface";
import {
  formatDateTimeLabel,
  getCampaignStatusLabel,
  getCampaignStatusVariant,
} from "../../../../components/client/clientStatus";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import {
  getClientCampaignDetail,
  getClientCampaigns,
  getClientCampaignStats,
} from "../../../../lib/api";
import type {
  Campaign,
  CampaignLogsSummary,
  CampaignReadModel,
  ClientCampaignStatsReadModel,
} from "../../../../types";
import { requireClientPortalRequest } from "../portalPageData";

export const dynamic = "force-dynamic";

interface ClientCampaignsPageProps {
  params: Promise<{
    portalSlug: string;
  }>;
}

function buildCampaignStats(campaigns: Campaign[]) {
  return {
    total: campaigns.length,
    active: campaigns.filter((campaign) =>
      ["ready", "running"].includes(campaign.status),
    ).length,
    running: campaigns.filter((campaign) => campaign.status === "running").length,
    blockedOrFailed: campaigns.filter((campaign) =>
      ["blocked", "failed"].includes(campaign.status),
    ).length,
  };
}

function formatCount(value: number): string {
  return value.toLocaleString("it-IT");
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

  return "Metriche provider non ancora disponibili";
}

async function loadCampaignReadModels(
  campaigns: Campaign[],
  accessToken: string | null,
): Promise<
  Record<
    string,
    { detail: CampaignReadModel; stats: ClientCampaignStatsReadModel } | Error
  >
> {
  const entries = await Promise.all(
    campaigns.map(async (campaign) => {
      try {
        const [detail, stats] = await Promise.all([
          getClientCampaignDetail(campaign.id, accessToken),
          getClientCampaignStats(campaign.id, accessToken),
        ]);
        return [campaign.id, { detail, stats }] as const;
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

export default async function ClientCampaignsPage({
  params,
}: ClientCampaignsPageProps) {
  const { portalSlug } = await params;
  const { accessToken } = await requireClientPortalRequest(portalSlug);

  const result = await getClientCampaigns(accessToken)
    .then(async (campaigns) => ({
      campaigns,
      campaignReadModels: await loadCampaignReadModels(campaigns, accessToken),
    }))
    .catch((error: unknown) => ({
      errorMessage:
        error instanceof Error ? error.message : "Impossibile caricare le campagne.",
    }));

  if ("errorMessage" in result) {
    return (
      <DashboardErrorState
        title="Campagne"
        description="Elenco campagne del cliente letto dal backend applicativo."
        errorMessage={result.errorMessage}
      />
    );
  }

  const stats = buildCampaignStats(result.campaigns);

  return (
    <main className="shell">
      <section className="client-page-shell">
        <ClientPageHeader
          title="Campagne"
          description="Elenco aggiornato delle campagne visibili nel tuo workspace, con stato reale, soggetto e ultime date utili."
          actions={<StatusBadge label="Dati reali" variant="success" />}
        />

        <section className="client-page-stat-grid" aria-label="Statistiche campagne">
          {[
            { label: "Campagne totali", value: stats.total.toLocaleString() },
            { label: "Attive", value: stats.active.toLocaleString() },
            { label: "In corso", value: stats.running.toLocaleString() },
            {
              label: "Bloccate o in errore",
              value: stats.blockedOrFailed.toLocaleString(),
            },
          ].map((stat) => (
            <article key={stat.label} className="client-page-stat-card">
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </article>
          ))}
        </section>

        <ClientSurface
          title="Elenco campagne"
          description="Ogni riga mostra le informazioni operative oggi disponibili per il cliente, senza statistiche inventate."
          aside={
            <span className="client-surface__eyebrow">
              {result.campaigns.length.toLocaleString()} elementi
            </span>
          }
        >
          {result.campaigns.length > 0 ? (
            <div className="client-list">
              {result.campaigns.map((campaign) => (
                <article key={campaign.id} className="client-row">
                  <div className="client-row__header">
                    <div className="client-row__copy">
                      <strong className="client-row__title">{campaign.name}</strong>
                      <span className="client-row__meta">
                        Aggiornata {formatDateTimeLabel(campaign.updated_at)}
                      </span>
                    </div>
                    <StatusBadge
                      label={getCampaignStatusLabel(campaign.status)}
                      variant={getCampaignStatusVariant(campaign.status)}
                    />
                  </div>
                  <div className="client-detail-grid">
                    <div>
                      <span>Soggetto</span>
                      <strong>
                        {campaign.subject?.trim()
                          ? campaign.subject
                          : "Oggetto non disponibile"}
                      </strong>
                    </div>
                    <div>
                      <span>Creata</span>
                      <strong>{formatDateTimeLabel(campaign.created_at)}</strong>
                    </div>
                    <div>
                      <span>Ultimo aggiornamento</span>
                      <strong>{formatDateTimeLabel(campaign.updated_at)}</strong>
                    </div>
                  </div>

                  {(() => {
                    const readModel = result.campaignReadModels[campaign.id];

                    if (!readModel || readModel instanceof Error) {
                      return (
                        <p className="client-row__support">
                          Read model backend non disponibile:{" "}
                          {readModel?.message ?? "pending backend data"}.
                        </p>
                      );
                    }

                    const { detail, stats: backendStats } = readModel;
                    const noContacts = detail.recipients.total === 0;
                    const noEligibleRecipients =
                      detail.recipients.total > 0 && detail.recipients.eligible === 0;
                    const allRecipientsBlocked =
                      detail.recipients.total > 0 &&
                      detail.recipients.blocked === detail.recipients.total;

                    return (
                      <>
                        <div className="client-detail-grid">
                          <div>
                            <span>Readiness</span>
                            <strong>
                              Content {detail.campaign.contentReady ? "ok" : "pending"} ·
                              Contatti {detail.campaign.contactsReady ? "ok" : "pending"} ·
                              Review {detail.campaign.reviewReady ? "ok" : "pending"}
                            </strong>
                          </div>
                          <div>
                            <span>Destinatari</span>
                            <strong>
                              {formatCount(detail.recipients.eligible)} eleggibili /{" "}
                              {formatCount(detail.recipients.total)} totali
                            </strong>
                          </div>
                          <div>
                            <span>Bloccati</span>
                            <strong>
                              {formatCount(detail.recipients.blocked)} totali ·{" "}
                              {formatCount(detail.recipients.suppressed)} soppressi
                            </strong>
                          </div>
                          <div>
                            <span>Provider events</span>
                            <strong>{buildProviderEventsLabel(backendStats.logs)}</strong>
                          </div>
                          <div>
                            <span>Stats backend</span>
                            <strong>
                              queued {formatCount(backendStats.logs.queued)} · sent{" "}
                              {formatCount(backendStats.logs.sent)} · bounce{" "}
                              {formatCount(backendStats.logs.bounced)}
                            </strong>
                          </div>
                          <div>
                            <span>Invii bloccati</span>
                            <strong>
                              {formatCount(backendStats.blockedSends.total)} record
                            </strong>
                          </div>
                        </div>
                        {(noContacts || noEligibleRecipients || allRecipientsBlocked) && (
                          <p className="client-row__support">
                            {noContacts
                              ? "Nessun contatto associato alla campagna."
                              : noEligibleRecipients
                                ? "Nessun destinatario eleggibile nei dati backend."
                                : "Tutti i destinatari risultano bloccati nei dati backend."}
                          </p>
                        )}
                        {!backendStats.logs.providerEventsAvailable && (
                          <p className="client-row__support">
                            Le metriche provider restano vuote finche il backend non
                            registra eventi provider processati.
                          </p>
                        )}
                        {backendStats.blockedSends.latest.length > 0 && (
                          <p className="client-row__support">
                            Ultimo blocco: {backendStats.blockedSends.latest[0].reason}
                          </p>
                        )}
                      </>
                    );
                  })()}
                </article>
              ))}
            </div>
          ) : (
            <div className="client-empty-state">
              Nessuna campagna disponibile in questo momento. Quando il backend
              registrera nuove campagne, le vedrai qui.
            </div>
          )}
        </ClientSurface>
      </section>
    </main>
  );
}
