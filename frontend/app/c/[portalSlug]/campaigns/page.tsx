import { DashboardErrorState } from "../../../../components/dashboard/DashboardErrorState";
import { buildPageMetadata } from "../../../../components/shared/metadata";
import { ClientPageHeader } from "../../../../components/client/ClientPageHeader";
import { ClientSurface } from "../../../../components/client/ClientSurface";
import { formatDateTimeLabel } from "../../../../components/client/clientStatus";
import {
  formatCampaignCount,
  getCampaignStatusLabel,
  getCampaignStatusVariant,
} from "../../../../components/shared/campaignUi";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { getClientCampaigns } from "../../../../lib/api";
import type { Campaign } from "../../../../types";
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

export default async function ClientCampaignsPage({
  params,
}: ClientCampaignsPageProps) {
  const { portalSlug } = await params;
  const { accessToken } = await requireClientPortalRequest(portalSlug);

  const result = await getClientCampaigns(accessToken)
    .then((campaigns) => ({ campaigns }))
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
          description=""
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
              {result.campaigns.map((campaign) => (
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

                  <div className="client-row__summary">
                    <span className="client-row__chip">
                      Oggetto: {campaign.subject?.trim() || "Non disponibile"}
                    </span>
                  </div>

                  <p className="client-row__support client-note--compact">
                    Questa lista mostra solo i dati leggeri disponibili nel riepilogo
                    campagne.
                  </p>
                </article>
              ))}
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
