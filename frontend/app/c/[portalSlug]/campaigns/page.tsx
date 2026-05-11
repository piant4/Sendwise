import { DashboardErrorState } from "../../../../components/dashboard/DashboardErrorState";
import { ClientPageHeader } from "../../../../components/client/ClientPageHeader";
import { ClientSurface } from "../../../../components/client/ClientSurface";
import {
  formatDateTimeLabel,
  getCampaignStatusLabel,
  getCampaignStatusVariant,
} from "../../../../components/client/clientStatus";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { getClientCampaigns } from "../../../../lib/api";
import type { Campaign } from "../../../../types";
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
