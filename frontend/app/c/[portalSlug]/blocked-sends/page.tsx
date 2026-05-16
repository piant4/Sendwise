import { DashboardErrorState } from "../../../../components/dashboard/DashboardErrorState";
import { ClientPageHeader } from "../../../../components/client/ClientPageHeader";
import { ClientSurface } from "../../../../components/client/ClientSurface";
import {
  formatDateTimeLabel,
  getSendDecisionLabel,
  getSendDecisionVariant,
} from "../../../../components/client/clientStatus";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import {
  getClientBlockedSends,
  getClientOverviewSummary,
} from "../../../../lib/api";
import { requireClientPortalRequest } from "../portalPageData";

export const dynamic = "force-dynamic";

interface ClientBlockedSendsPageProps {
  params: Promise<{
    portalSlug: string;
  }>;
}

export default async function ClientBlockedSendsPage({
  params,
}: ClientBlockedSendsPageProps) {
  const { portalSlug } = await params;
  const { accessToken } = await requireClientPortalRequest(portalSlug);

  const result = await Promise.all([
    getClientBlockedSends(accessToken),
    getClientOverviewSummary(accessToken),
  ])
    .then(([items, summary]) => ({ items, summary }))
    .catch((error: unknown) => ({
      errorMessage:
        error instanceof Error
          ? error.message
          : "Impossibile caricare gli invii bloccati.",
    }));

  if ("errorMessage" in result) {
    return (
      <DashboardErrorState
        title="Invii bloccati"
        description=""
        errorMessage={result.errorMessage}
      />
    );
  }

  const affectedCampaigns = new Set(
    result.items.map((item) => item.campaign_id).filter(Boolean),
  ).size;

  return (
    <main className="shell">
      <section className="client-page-shell">
        <ClientPageHeader
          title="Invii bloccati"
          description=""
          actions={<StatusBadge label="Timeline reale" variant="success" />}
        />

        <section className="client-page-stat-grid" aria-label="Statistiche invii bloccati">
          {[
            {
              label: "Record totali",
              value: result.items.length.toLocaleString(),
            },
            {
              label: "Nel periodo corrente",
              value: result.summary.blockedSends.currentPeriodCount.toLocaleString(),
            },
            {
              label: "Campagne coinvolte",
              value: affectedCampaigns.toLocaleString(),
            },
            {
              label: "Periodo aperto dal",
              value: formatDateTimeLabel(
                result.summary.blockedSends.currentPeriodStartedAt,
              ),
            },
          ].map((stat) => (
            <article key={stat.label} className="client-page-stat-card">
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </article>
          ))}
        </section>

        <ClientSurface
          title="Cronologia blocchi"
          description=""
          aside={
            <span className="client-surface__eyebrow">
              {result.items.length.toLocaleString()} elementi
            </span>
          }
        >
          {result.items.length > 0 ? (
            <div className="client-list">
              {result.items.map((item) => (
                <article key={item.id} className="client-row client-row--alert">
                  <div className="client-row__header">
                    <div className="client-row__copy">
                      <strong className="client-row__title">
                        {item.campaign_name?.trim()
                          ? item.campaign_name
                          : "Campagna non disponibile"}
                      </strong>
                      <span className="client-row__meta">
                        Registrato {formatDateTimeLabel(item.created_at)}
                      </span>
                    </div>
                    <StatusBadge
                      label={getSendDecisionLabel(item.decision)}
                      variant={getSendDecisionVariant(item.decision)}
                    />
                  </div>
                  <div className="client-detail-grid">
                    <div>
                      <span>Motivazione</span>
                      <strong>{item.reason}</strong>
                    </div>
                    <div>
                      <span>Decisione</span>
                      <strong>{getSendDecisionLabel(item.decision)}</strong>
                    </div>
                    <div>
                      <span>Creato il</span>
                      <strong>{formatDateTimeLabel(item.created_at)}</strong>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="client-empty-state">
              Nessun <b>invio bloccato</b> registrato per questo workspace nel periodo
              attuale.
            </div>
          )}
        </ClientSurface>
      </section>
    </main>
  );
}
