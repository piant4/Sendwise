import { DashboardErrorState } from "../../../../components/dashboard/DashboardErrorState";
import { buildPageMetadata } from "../../../../components/shared/metadata";
import { ClientPageHeader } from "../../../../components/client/ClientPageHeader";
import { ClientSurface } from "../../../../components/client/ClientSurface";
import { formatDateTimeLabel } from "../../../../components/client/clientStatus";
import {
  formatCampaignCount,
  formatProviderEventMetric,
  getCampaignOperationalSendState,
  getCampaignReadinessShortLabel,
  getProviderEventsAvailabilityLabel,
  getCampaignStatusLabel,
  getCampaignStatusVariant,
} from "../../../../components/shared/campaignUi";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import {
  getClientCampaignDetail,
  getClientCampaigns,
} from "../../../../lib/api";
import type { Campaign, CampaignReadModel } from "../../../../types";
import { requireClientPortalRequest } from "../portalPageData";

export const dynamic = "force-dynamic";
export const metadata = buildPageMetadata("Campagne");

interface ClientCampaignsPageProps {
  params: Promise<{
    portalSlug: string;
  }>;
}

interface CampaignStatusSummary {
  total: number;
  ready: number;
  running: number;
  blockedOrFailed: number;
  draftOrPaused: number;
}

function buildCampaignStats(campaigns: Campaign[]): CampaignStatusSummary {
  return {
    total: campaigns.length,
    ready: campaigns.filter((campaign) => campaign.status === "ready").length,
    running: campaigns.filter((campaign) => campaign.status === "running").length,
    blockedOrFailed: campaigns.filter((campaign) =>
      ["blocked", "failed"].includes(campaign.status),
    ).length,
    draftOrPaused: campaigns.filter((campaign) =>
      ["draft", "paused"].includes(campaign.status),
    ).length,
  };
}

async function loadCampaignReadModels(
  campaigns: Campaign[],
  accessToken: string | null,
): Promise<Record<string, { detail: CampaignReadModel } | Error>> {
  const entries = await Promise.all(
    campaigns.map(async (campaign) => {
      try {
        const detail = await getClientCampaignDetail(campaign.id, accessToken);
        return [campaign.id, { detail }] as const;
      } catch (error) {
        return [
          campaign.id,
          error instanceof Error
            ? error
            : new Error("Dati campagna non disponibili."),
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
        description="Elenco campagne cliente."
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
          description="Stato campagna, invii accettati dal sistema e metriche provider solo quando esistono eventi reali."
        />

        <section className="client-page-stat-grid" aria-label="Riepilogo campagne">
          {[
            { label: "Campagne totali", value: formatCampaignCount(stats.total) },
            { label: "Pronte", value: formatCampaignCount(stats.ready) },
            { label: "In corso", value: formatCampaignCount(stats.running) },
            {
              label: "Bloccate o in errore",
              value: formatCampaignCount(stats.blockedOrFailed),
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
          aside={
            <span className="client-surface__eyebrow">
              {formatCampaignCount(result.campaigns.length)} elementi
            </span>
          }
        >
          {result.campaigns.length > 0 ? (
            <div className="client-list client-list--compact">
              {result.campaigns.map((campaign) => {
                const readModel = result.campaignReadModels[campaign.id];

                return (
                  <article key={campaign.id} className="client-row client-row--compact">
                    {!readModel || readModel instanceof Error ? (
                      <>
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
                        <p className="client-row__support client-note--compact">
                          Dettagli campagna non disponibili.
                        </p>
                      </>
                    ) : (
                      (() => {
                        const detail = readModel.detail;
                        const sendState = getCampaignOperationalSendState(detail.logs);
                        const providerEventsLabel = getProviderEventsAvailabilityLabel(
                          detail.logs,
                        );

                        return (
                          <>
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

                            <div className="client-row__summary">
                              <span className="client-row__chip">
                                Operativo: {sendState.label}
                              </span>
                              <span className="client-row__chip">
                                Readiness:{" "}
                                {getCampaignReadinessShortLabel(detail.campaign)}
                              </span>
                              <span className="client-row__chip">
                                Eventi provider: {providerEventsLabel}
                              </span>
                            </div>

                            <div className="client-row__stats">
                              <div className="client-row__stat">
                                <span>Accettate dal sistema</span>
                                <strong>{formatCampaignCount(detail.logs.sent ?? 0)}</strong>
                              </div>
                              <div className="client-row__stat">
                                <span>Errori invio</span>
                                <strong>{formatCampaignCount(detail.logs.failed)}</strong>
                              </div>
                              <div className="client-row__stat">
                                <span>Consegnate</span>
                                <strong>
                                  {formatProviderEventMetric(
                                    detail.logs.delivered,
                                    detail.logs,
                                  )}
                                </strong>
                              </div>
                              <div className="client-row__stat">
                                <span>Aperte</span>
                                <strong>
                                  {formatProviderEventMetric(
                                    detail.logs.opened,
                                    detail.logs,
                                  )}
                                </strong>
                              </div>
                              <div className="client-row__stat">
                                <span>Click</span>
                                <strong>
                                  {formatProviderEventMetric(
                                    detail.logs.clicked,
                                    detail.logs,
                                  )}
                                </strong>
                              </div>
                              <div className="client-row__stat">
                                <span>Uso periodo</span>
                                <strong>
                                  {detail.periodUsage.hasRealUsage
                                    ? formatCampaignCount(detail.periodUsage.periodUsed)
                                    : "Non disponibile"}
                                </strong>
                              </div>
                              <div className="client-row__stat">
                                <span>Destinatari idonei</span>
                                <strong>
                                  {formatCampaignCount(detail.recipients.eligible)} /{" "}
                                  {formatCampaignCount(detail.recipients.total)}
                                </strong>
                              </div>
                              <div className="client-row__stat">
                                <span>Destinatari bloccati</span>
                                <strong>
                                  {formatCampaignCount(detail.recipients.blocked)}
                                </strong>
                              </div>
                            </div>

                            <p className="client-row__support client-note--compact">
                              {sendState.detail}
                              {detail.periodUsage.periodEmailLimit
                                ? ` Limite periodo ${formatCampaignCount(detail.periodUsage.periodEmailLimit)}.`
                                : ""}
                            </p>
                          </>
                        );
                      })()
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="client-empty-state">
              Nessuna campagna disponibile in questo momento.
            </div>
          )}
        </ClientSurface>
      </section>
    </main>
  );
}
