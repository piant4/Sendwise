import { DashboardErrorState } from "../../../../components/dashboard/DashboardErrorState";
import { ClientPageHeader } from "../../../../components/client/ClientPageHeader";
import { ClientSurface } from "../../../../components/client/ClientSurface";
import { formatDateTimeLabel } from "../../../../components/client/clientStatus";
import {
  formatCampaignCount,
  getCampaignReadinessShortLabel,
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
  const statusVisualItems = [
    { label: "Pronte", value: stats.ready, tone: "ready" },
    { label: "In corso", value: stats.running, tone: "running" },
    { label: "Bozze / pausa", value: stats.draftOrPaused, tone: "paused" },
    { label: "Bloccate / errore", value: stats.blockedOrFailed, tone: "attention" },
  ].filter((item) => item.value > 0);

  return (
    <main className="shell">
      <section className="client-page-shell">
        <ClientPageHeader
          title="Campagne"
          description="Stato, readiness e uso periodo quando il backend espone dati reali."
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

        {statusVisualItems.length > 0 ? (
          <ClientSurface
            title="Distribuzione stati"
            aside={
              <span className="client-surface__eyebrow">
                {formatCampaignCount(stats.total)} campagne
              </span>
            }
          >
            <div className="client-status-visual">
              <div className="client-status-visual__bar" aria-hidden="true">
                {statusVisualItems.map((item) => (
                  <div
                    key={item.label}
                    className="client-status-visual__segment"
                    data-tone={item.tone}
                    style={{ width: `${(item.value / stats.total) * 100}%` }}
                  />
                ))}
              </div>
              <div className="client-status-visual__legend">
                {statusVisualItems.map((item) => (
                  <article
                    key={item.label}
                    className="client-status-visual__legend-item"
                  >
                    <span>{item.label}</span>
                    <strong>{formatCampaignCount(item.value)}</strong>
                  </article>
                ))}
              </div>
            </div>
          </ClientSurface>
        ) : null}

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

                    {!readModel || readModel instanceof Error ? (
                      <p className="client-row__support client-note--compact">
                        Dettagli campagna non disponibili.
                      </p>
                    ) : (
                      <>
                        <div className="client-row__stats">
                          <div className="client-row__stat">
                            <span>Readiness</span>
                            <strong>
                              {getCampaignReadinessShortLabel(readModel.detail.campaign)}
                            </strong>
                          </div>
                          <div className="client-row__stat">
                            <span>Destinatari</span>
                            <strong>
                              {formatCampaignCount(readModel.detail.recipients.total)} totali
                            </strong>
                          </div>
                          <div className="client-row__stat">
                            <span>Idonei / bloccati</span>
                            <strong>
                              {formatCampaignCount(readModel.detail.recipients.eligible)} /{" "}
                              {formatCampaignCount(readModel.detail.recipients.blocked)}
                            </strong>
                          </div>
                          <div className="client-row__stat">
                            <span>Invii periodo</span>
                            <strong>
                              {readModel.detail.periodUsage.hasRealUsage
                                ? formatCampaignCount(readModel.detail.periodUsage.periodUsed)
                                : "Invii non disponibili"}
                            </strong>
                          </div>
                        </div>
                        {!readModel.detail.periodUsage.hasRealUsage ? (
                          <p className="client-row__support client-note--compact">
                            Invii non disponibili.
                          </p>
                        ) : readModel.detail.periodUsage.periodEmailLimit ? (
                          <p className="client-row__support client-note--compact">
                            Limite periodo {formatCampaignCount(readModel.detail.periodUsage.periodEmailLimit)}.
                          </p>
                        ) : null}
                      </>
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
