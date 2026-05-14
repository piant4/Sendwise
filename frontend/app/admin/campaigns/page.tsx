import { auth } from "@clerk/nextjs/server";
import { PlusCircle } from "lucide-react";
import { redirect } from "next/navigation";
import { AdminSurface } from "../../../components/admin/AdminSurface";
import {
  formatCampaignCount,
  getBlockedReasonItems,
  getCampaignLogStatItems,
  getCampaignReadinessItems,
  getCampaignReadinessLabel,
  getCampaignStatusLabel,
  getCampaignStatusVariant,
  getProviderEventsDetail,
  getProviderEventsLabel,
  getRecipientEmptyState,
  getRecipientSummaryItems,
  getRuntimeSafetyItems,
  getSesPendingWarning,
} from "../../../components/shared/campaignUi";
import { Button } from "../../../components/ui/button";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import {
  getAdminCampaigns,
  getAdminCampaignSummary,
  isApiError,
} from "../../../lib/api";
import type {
  AdminCampaignReadinessSummary,
  AdminCampaignSummary,
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

function renderAdminReadiness(readiness: AdminCampaignReadinessSummary) {
  const blockedReasons = getBlockedReasonItems(readiness.recipients);
  const recipientEmptyState = getRecipientEmptyState(readiness.recipients);
  const sesPendingWarning = getSesPendingWarning(readiness.runtime);
  const backendWarnings = [...readiness.blockingErrors, ...readiness.warnings];
  const runtimeItems = getRuntimeSafetyItems(readiness.runtime);
  const attentionItems = [
    recipientEmptyState,
    sesPendingWarning,
    readiness.logs.providerEventsAvailable
      ? null
      : getProviderEventsDetail(readiness.logs),
    ...backendWarnings,
  ].filter((item): item is string => Boolean(item));

  return (
    <>
      <dl className="admin-record-grid">
        <div>
          <dt>Prontezza</dt>
          <dd>{getCampaignReadinessLabel(readiness.campaign)}</dd>
        </div>
        <div>
          <dt>Sicurezza invio</dt>
          <dd>
            {readiness.canSend
              ? "Invio controllato consentito"
              : "Invio bloccato"}
          </dd>
        </div>
        {runtimeItems.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
        <div>
          <dt>Eventi provider</dt>
          <dd>{getProviderEventsLabel(readiness.logs)}</dd>
        </div>
      </dl>

      <dl className="admin-record-grid">
        {getRecipientSummaryItems(readiness.recipients)
          .filter((item) => ["Totali", "Idonei", "Bloccati"].includes(item.label))
          .map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
      </dl>

      <dl className="admin-record-grid">
        {getCampaignLogStatItems(readiness.logs).map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
        <div>
          <dt>Invii bloccati</dt>
          <dd>{formatCampaignCount(readiness.blockedSends.total)}</dd>
        </div>
      </dl>

      <p className="admin-record-row__note">
        Prontezza:{" "}
        {getCampaignReadinessItems(readiness.campaign)
          .map((item) => `${item.label.toLowerCase()} ${item.value.toLowerCase()}`)
          .join(", ")}
        .
      </p>

      {blockedReasons.length > 0 ? (
        <dl className="admin-record-grid">
          {blockedReasons.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {attentionItems.length > 0 ? (
        <div className="admin-record-row__note">
          <strong>Attenzione</strong>
          <ul>
            {attentionItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="admin-record-row__note">Nessun avviso operativo.</p>
      )}
    </>
  );
}

function renderCampaignBasics(campaign: AdminCampaignSummary) {
  return (
    <>
      <p className="admin-record-row__note">
        {campaign.subject?.trim()
          ? `Oggetto: ${campaign.subject}.`
          : "Oggetto non disponibile."}{" "}
        Aggiornata {formatDateLabel(campaign.updatedAt)}. Creata{" "}
        {formatDateLabel(campaign.createdAt)}.
      </p>
      <details className="admin-record-row__note">
        <summary>Dettagli tecnici</summary>
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
            <dt>Blocchi registrati</dt>
            <dd>{formatCampaignCount(campaign.blockedSendsCount)}</dd>
          </div>
        </dl>
      </details>
    </>
  );
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
        <header
          className="admin-page-header"
          style={{
            alignItems: "start",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <div>
            <p className="admin-surface__eyebrow">Admin</p>
            <h1 className="admin-page-title">Campagne</h1>
            <p className="admin-page-description">
              Vista operativa cross-client letta dal backend business. Nessuna
              campagna viene inventata nel frontend.
            </p>
          </div>
          <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
            <Button
              type="button"
              size="lg"
              className="admin-topbar-action admin-topbar-action--primary"
              disabled
              title="Creazione campagna non ancora disponibile"
            >
              <PlusCircle aria-hidden="true" className="admin-topbar-action__icon" />
              Nuova campagna
            </Button>
            <span className="admin-page-description" style={{ margin: 0 }}>
              Creazione campagna non ancora disponibile
            </span>
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
                { label: "Pronte / in corso", value: stats?.active ?? 0 },
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
              description="Ogni scheda mostra proprietario, prontezza, destinatari, sicurezza invio e metriche disponibili senza stimare consegne."
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
                  {result.campaigns.map((campaign) => {
                    const readiness = result.campaignReadiness[campaign.id];

                    return (
                      <article key={campaign.id} className="admin-record-row">
                        <div className="admin-record-row__primary">
                          <div className="admin-record-row__copy">
                            <strong>{campaign.name}</strong>
                            <span>
                              {campaign.clientName} / {campaign.clientEmail} /{" "}
                              Aggiornata {formatDateLabel(campaign.updatedAt)}
                            </span>
                          </div>
                          <StatusBadge
                            label={getCampaignStatusLabel(campaign.status)}
                            variant={getCampaignStatusVariant(campaign.status)}
                          />
                        </div>

                        {renderCampaignBasics(campaign)}

                        {!readiness || readiness instanceof Error ? (
                          <p className="admin-record-row__note">
                            Dati campagna non disponibili:{" "}
                            {readiness?.message ?? "aggiornamento pending"}.
                          </p>
                        ) : (
                          renderAdminReadiness(readiness)
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </AdminSurface>
          </>
        )}
      </section>
    </main>
  );
}
