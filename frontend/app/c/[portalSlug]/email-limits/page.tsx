import { DashboardErrorState } from "../../../../components/dashboard/DashboardErrorState";
import { ClientPageHeader } from "../../../../components/client/ClientPageHeader";
import { ClientSurface } from "../../../../components/client/ClientSurface";
import {
  formatDateTimeLabel,
  formatOptionalLimit,
} from "../../../../components/client/clientStatus";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import {
  getClientMe,
  getClientOverviewSummary,
} from "../../../../lib/api";
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
    return "Capacita non configurata";
  }

  const remaining = Math.max(maxCampaigns - totalCampaigns, 0);

  if (remaining === 0) {
    return "Capacita piena";
  }

  if (remaining === 1) {
    return "Resta 1 slot campagna";
  }

  return `Restano ${remaining.toLocaleString()} slot campagna`;
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
        description="Limiti attivi del cliente letti dal backend applicativo."
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
          description="Questa vista mostra in sola lettura i limiti attualmente configurati per il tuo workspace e come si riflettono sulle campagne visibili."
          actions={<StatusBadge label="Sola lettura" variant="neutral" />}
        />

        <section className="client-page-stat-grid" aria-label="Riepilogo limiti">
          {[
            {
              label: "email_limit_per_campaign",
              value: formatOptionalLimit(context.client.email_limit_per_campaign),
            },
            {
              label: "max_campaigns",
              value: formatOptionalLimit(maxCampaigns),
            },
            {
              label: "Campagne visibili",
              value: campaignsInUse.toLocaleString(),
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
            title="Regole attive"
            description="I limiti vengono applicati dal backend Sendwise. Se ti serve una modifica, va richiesta al team amministrativo."
          >
            <div className="client-fact-grid">
              <article className="client-fact-card">
                <span>Limite email per campagna</span>
                <strong>{formatOptionalLimit(context.client.email_limit_per_campaign)}</strong>
                <p>
                  Numero massimo di email configurato per una singola campagna,
                  quando presente.
                </p>
              </article>
              <article className="client-fact-card">
                <span>Massimo campagne</span>
                <strong>{formatOptionalLimit(maxCampaigns)}</strong>
                <p>
                  Limite di campagne contemporaneamente presenti nel workspace
                  cliente, quando configurato.
                </p>
              </article>
            </div>
          </ClientSurface>

          <ClientSurface
            title="Situazione attuale"
            description="Confronto tra il numero di campagne oggi visibili e la capacita configurata."
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
                  <span>Slot campagne occupati</span>
                  <strong>
                    {typeof maxCampaigns === "number" && maxCampaigns > 0
                      ? `${campaignsInUse.toLocaleString()} / ${maxCampaigns.toLocaleString()}`
                      : `${campaignsInUse.toLocaleString()} campagne`}
                  </strong>
                </div>
                {campaignUsageRatio !== null ? (
                  <span>{Math.round(Math.min(campaignUsageRatio, 1) * 100)}%</span>
                ) : (
                  <span>n/d</span>
                )}
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
              <p className="client-note">
                {campaignUsageRatio === null
                  ? "Il limite massimo campagne non e configurato, quindi questa vista mostra solo il numero di campagne oggi disponibili."
                  : campaignUsageRatio >= 0.8
                    ? "Il numero di campagne visibili e vicino al limite configurato."
                    : "La capacita campagne disponibile e ancora sotto soglia di attenzione."}
              </p>
            </div>
          </ClientSurface>
        </div>
      </section>
    </main>
  );
}
