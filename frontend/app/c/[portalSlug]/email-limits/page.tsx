import { DashboardErrorState } from "../../../../components/dashboard/DashboardErrorState";
import { ClientPageHeader } from "../../../../components/client/ClientPageHeader";
import { ClientSurface } from "../../../../components/client/ClientSurface";
import {
  formatDateTimeLabel,
  formatOptionalLimit,
} from "../../../../components/client/clientStatus";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import { getClientMe, getClientOverviewSummary } from "../../../../lib/api";
import { requireClientPortalRequest } from "../portalPageData";

export const dynamic = "force-dynamic";

interface ClientEmailLimitsPageProps {
  params: Promise<{
    portalSlug: string;
  }>;
}

function getCapacityVariant(ratio: number | null) {
  if (ratio === null) {
    return "neutral" as const;
  }

  if (ratio >= 1) {
    return "danger" as const;
  }

  if (ratio >= 0.8) {
    return "warning" as const;
  }

  return "success" as const;
}

function getCapacityLabel(totalCampaigns: number, maxCampaigns?: number | null) {
  if (typeof maxCampaigns !== "number" || maxCampaigns <= 0) {
    return "Limite non configurato";
  }

  const remaining = Math.max(maxCampaigns - totalCampaigns, 0);

  if (remaining === 0) {
    return "Capacita piena";
  }

  if (remaining === 1) {
    return "1 slot disponibile";
  }

  return `${remaining.toLocaleString("it-IT")} slot disponibili`;
}

export default async function ClientEmailLimitsPage({
  params,
}: ClientEmailLimitsPageProps) {
  const { portalSlug } = await params;
  const { accessToken } = await requireClientPortalRequest(portalSlug);

  const result = await Promise.all([
    getClientMe(accessToken),
    getClientOverviewSummary(accessToken),
  ])
    .then(([context, summary]) => ({ context, summary }))
    .catch((error: unknown) => ({
      errorMessage:
        error instanceof Error ? error.message : "Impossibile caricare i limiti email.",
    }));

  if ("errorMessage" in result) {
    return (
      <DashboardErrorState
        title="Limiti email"
        description="Limiti cliente."
        errorMessage={result.errorMessage}
      />
    );
  }

  const { context, summary } = result;
  const maxCampaigns = context.client.max_campaigns ?? null;
  const campaignsInUse = summary.campaigns.totalCampaigns;
  const campaignUsageRatio =
    typeof maxCampaigns === "number" && maxCampaigns > 0
      ? campaignsInUse / maxCampaigns
      : null;

  return (
    <main className="shell">
      <section className="client-page-shell">
        <ClientPageHeader
          title="Limiti email"
          description="Capacita attiva e campagne oggi visibili."
          actions={<StatusBadge label="Sola lettura" variant="neutral" />}
        />

        <section className="client-page-stat-grid" aria-label="Riepilogo limiti">
          {[
            {
              label: "Email per campagna",
              value: formatOptionalLimit(context.client.email_limit_per_campaign),
            },
            {
              label: "Campagne massime",
              value: formatOptionalLimit(maxCampaigns),
            },
            {
              label: "Campagne visibili",
              value: campaignsInUse.toLocaleString("it-IT"),
            },
            {
              label: "Ultimo aggiornamento",
              value: formatDateTimeLabel(context.client.updated_at),
            },
          ].map((stat) => (
            <article key={stat.label} className="client-page-stat-card">
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </article>
          ))}
        </section>

        <div className="client-dashboard__content">
          <ClientSurface
            title="Capacita campagne"
            aside={
              <StatusBadge
                label={getCapacityLabel(campaignsInUse, maxCampaigns)}
                variant={getCapacityVariant(campaignUsageRatio)}
              />
            }
          >
            <div className="client-progress-panel">
              <div className="client-progress-panel__row">
                <div>
                  <span>Occupazione slot</span>
                  <strong>
                    {typeof maxCampaigns === "number" && maxCampaigns > 0
                      ? `${campaignsInUse.toLocaleString("it-IT")} / ${maxCampaigns.toLocaleString("it-IT")}`
                      : `${campaignsInUse.toLocaleString("it-IT")} campagne`}
                  </strong>
                </div>
                <span>
                  {campaignUsageRatio !== null
                    ? `${Math.round(Math.min(campaignUsageRatio, 1) * 100)}%`
                    : "n/d"}
                </span>
              </div>
              <div className="client-progress" aria-hidden="true">
                <div
                  className="client-progress__fill"
                  style={{
                    width:
                      campaignUsageRatio !== null
                        ? `${Math.max(8, Math.min(campaignUsageRatio * 100, 100))}%`
                        : "18%",
                  }}
                />
              </div>
            </div>
          </ClientSurface>

          <ClientSurface title="Dettaglio limiti">
            <div className="client-fact-grid">
              <article className="client-fact-card">
                <span>Email per campagna</span>
                <strong>{formatOptionalLimit(context.client.email_limit_per_campaign)}</strong>
              </article>
              <article className="client-fact-card">
                <span>Campagne massime</span>
                <strong>{formatOptionalLimit(maxCampaigns)}</strong>
              </article>
              <article className="client-fact-card">
                <span>Campagne visibili</span>
                <strong>{campaignsInUse.toLocaleString("it-IT")}</strong>
              </article>
              <article className="client-fact-card">
                <span>Ultimo aggiornamento</span>
                <strong>{formatDateTimeLabel(context.client.updated_at)}</strong>
              </article>
            </div>
          </ClientSurface>
        </div>
      </section>
    </main>
  );
}
