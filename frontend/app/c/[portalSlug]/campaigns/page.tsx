import { DashboardErrorState } from "../../../../components/dashboard/DashboardErrorState";
import { ClientPageHeader } from "../../../../components/client/ClientPageHeader";
import { ClientSurface } from "../../../../components/client/ClientSurface";
import { formatDateTimeLabel } from "../../../../components/client/clientStatus";
import {
  formatCampaignCount,
  getCampaignLogStatItems,
  getCampaignReadinessLabel,
  getCampaignStatusLabel,
  getCampaignStatusVariant,
  getProviderEventsDetail,
  getProviderEventsLabel,
  getRecipientEmptyState,
  getRecipientSummaryItems,
  getRuntimeSafetyItems,
  getSesPendingWarning,
} from "../../../../components/shared/campaignUi";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import {
  getClientCampaignDetail,
  getClientCampaigns,
  getClientCampaignStats,
} from "../../../../lib/api";
import type {
  Campaign,
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
            : new Error("Dati campagna non disponibili."),
        ] as const;
      }
    }),
  );

  return Object.fromEntries(entries);
}

function renderClientCampaignReadModel(
  detail: CampaignReadModel,
  backendStats: ClientCampaignStatsReadModel,
) {
  const recipientEmptyState = getRecipientEmptyState(detail.recipients);
  const runtimeItems = getRuntimeSafetyItems(detail.runtime).filter(
    (item) => item.label !== "Eventi provider",
  );
  const sesPendingWarning = getSesPendingWarning(detail.runtime);
  const attentionItems = [recipientEmptyState, sesPendingWarning].filter(
    (item): item is string => Boolean(item),
  );

  return (
    <>
      <div className="client-detail-grid">
        <div>
          <span>Prontezza</span>
          <strong>{getCampaignReadinessLabel(detail.campaign)}</strong>
        </div>
        {getRecipientSummaryItems(detail.recipients)
          .filter((item) => ["Totali", "Idonei", "Bloccati"].includes(item.label))
          .map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        <div>
          <span>Eventi provider</span>
          <strong>{getProviderEventsLabel(backendStats.logs)}</strong>
        </div>
      </div>

      <div className="client-detail-grid">
        {runtimeItems.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
        {getCampaignLogStatItems(backendStats.logs).map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
        <div>
          <span>Invii bloccati</span>
          <strong>{formatCampaignCount(backendStats.blockedSends.total)}</strong>
        </div>
      </div>

      {backendStats.logs.providerEventsAvailable ? (
        <p className="client-row__support">
          {getProviderEventsDetail(backendStats.logs)}
        </p>
      ) : null}
      {attentionItems.length > 0 ? (
        <div className="client-row__support">
          <strong>Attenzione</strong>
          <ul>
            {attentionItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
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
          description="Stato, destinatari e metriche disponibili per le tue campagne. Le consegne e gli eventi appaiono solo quando arrivano dati provider."
          actions={<StatusBadge label="Metriche verificate" variant="success" />}
        />

        <section className="client-page-stat-grid" aria-label="Statistiche campagne">
          {[
            { label: "Campagne totali", value: formatCampaignCount(stats.total) },
            { label: "Pronte / in corso", value: formatCampaignCount(stats.active) },
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
          description="Vista cliente con stato, destinatari e metriche disponibili senza ID tecnici o metriche simulate."
          aside={
            <span className="client-surface__eyebrow">
              {formatCampaignCount(result.campaigns.length)} elementi
            </span>
          }
        >
          {result.campaigns.length > 0 ? (
            <div className="client-list">
              {result.campaigns.map((campaign) => {
                const readModel = result.campaignReadModels[campaign.id];

                return (
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

                    {!readModel || readModel instanceof Error ? (
                      <p className="client-row__support">
                        Dati campagna non disponibili:{" "}
                        {readModel?.message ?? "aggiornamento pending"}.
                      </p>
                    ) : (
                      renderClientCampaignReadModel(readModel.detail, readModel.stats)
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
