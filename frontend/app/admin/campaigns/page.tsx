import { auth } from "@clerk/nextjs/server";
import { PlusCircle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminSurface } from "../../../components/admin/AdminSurface";
import {
  formatCampaignCount,
  getCampaignLogStatItems,
  getCampaignReadinessLabel,
  getCampaignStatusLabel,
  getCampaignStatusVariant,
  getProviderEventsLabel,
  getReadableBackendReason,
  getRecipientEmptyState,
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

function getCampaignAttentionItems(readiness: AdminCampaignReadinessSummary) {
  const backendReasons = [...readiness.blockingErrors, ...readiness.warnings].map(
    getReadableBackendReason,
  );
  const readableReasons = backendReasons.map((reason) => reason.label);
  const safetyItems = getRuntimeSafetyItems(readiness.runtime).map(
    (item) => item.value,
  );

  return Array.from(
    new Set(
      [
        getRecipientEmptyState(readiness.recipients),
        getSesPendingWarning(readiness.runtime),
        readiness.logs.providerEventsAvailable
          ? null
          : getProviderEventsLabel(readiness.logs),
        ...safetyItems.filter((item) =>
          [
            "Ambiente Mailpit/dev",
            "SES configurato, validazione live pending",
            "Invio reale disattivato",
          ].includes(item),
        ),
        ...readableReasons,
      ].filter((item): item is string => Boolean(item)),
    ),
  );
}

function renderCampaignReadiness(
  readiness: AdminCampaignReadinessSummary | Error | undefined,
  campaign: AdminCampaignSummary,
) {
  if (!readiness || readiness instanceof Error) {
    return (
      <p className="admin-record-row__note">
        Dati campagna non disponibili: {readiness?.message ?? "aggiornamento pending"}.
      </p>
    );
  }

  const technicalReasons = [...readiness.blockingErrors, ...readiness.warnings].map(
    getReadableBackendReason,
  );
  const attentionItems = getCampaignAttentionItems(readiness);
  const recipientItems = [
    { label: "Totali", value: formatCampaignCount(readiness.recipients.total) },
    { label: "Idonei", value: formatCampaignCount(readiness.recipients.eligible) },
    { label: "Bloccati", value: formatCampaignCount(readiness.recipients.blocked) },
  ];
  const statItems = [
    ...getCampaignLogStatItems(readiness.logs).filter((item) =>
      ["In coda", "Invio tentato", "Bounce", "Disiscritti"].includes(item.label),
    ),
    {
      label: "Bloccati",
      value: formatCampaignCount(readiness.blockedSends.total),
    },
  ];

  return (
    <>
      <dl className="admin-record-grid" aria-label="Sintesi destinatari e metriche">
        {recipientItems.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
        {statItems.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>

      <p className="admin-record-row__note">
        {getCampaignReadinessLabel(readiness.campaign)}.{" "}
        {getProviderEventsLabel(readiness.logs)}. Aggiornata{" "}
        {formatDateLabel(campaign.updatedAt)}.
      </p>

      {attentionItems.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {attentionItems.map((item) => (
            <span key={item} className="admin-record-chip">
              {item}
            </span>
          ))}
        </div>
      ) : null}

      <details className="admin-record-row__note">
        <summary>Dettagli tecnici</summary>
        <dl className="admin-record-grid" style={{ marginTop: 12 }}>
          <div>
            <dt>Campaign ID</dt>
            <dd>{campaign.id}</dd>
          </div>
          <div>
            <dt>Client ID</dt>
            <dd>{campaign.clientId}</dd>
          </div>
          <div>
            <dt>Provider</dt>
            <dd>{readiness.runtime.providerModeLabel}</dd>
          </div>
        </dl>
        {technicalReasons.length > 0 ? (
          <ul>
            {technicalReasons.map((reason) => (
              <li key={reason.raw}>
                {reason.label}
                {reason.isKnown ? "" : `: ${reason.raw}`}
              </li>
            ))}
          </ul>
        ) : null}
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
              Indice operativo delle campagne cliente, letto dal backend business.
            </p>
            <p className="admin-page-description">
              {"campaigns" in result
                ? `${result.campaigns.length.toLocaleString("it-IT")} campagne`
                : "Conteggio campagne non disponibile"}
            </p>
          </div>
          <Button
            asChild
            size="lg"
            className="admin-topbar-action admin-topbar-action--primary"
          >
            <Link href="/admin/campaigns/new">
              <PlusCircle aria-hidden="true" className="admin-topbar-action__icon" />
              Nuova campagna
            </Link>
          </Button>
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
              title="Elenco campagne"
              description="Nome, cliente, prontezza, destinatari e metriche backend-backed in una vista compatta."
              aside={
                <span className="admin-surface__eyebrow">
                  {result.campaigns.length.toLocaleString("it-IT")} elementi
                </span>
              }
            >
              {result.campaigns.length === 0 ? (
                <div className="admin-empty-state">
                  Nessuna campagna presente nel database corrente.
                </div>
              ) : (
                <div className="admin-record-list">
                  {result.campaigns.map((campaign) => (
                    <article key={campaign.id} className="admin-record-row">
                      <div className="admin-record-row__primary">
                        <div className="admin-record-row__copy">
                          <strong>
                            <Link href={`/admin/campaigns/${campaign.id}`}>
                              {campaign.name}
                            </Link>
                          </strong>
                          <span>
                            {campaign.clientName} / {campaign.clientEmail}
                          </span>
                          <span>
                            {campaign.subject?.trim()
                              ? campaign.subject
                              : "Oggetto non disponibile"}
                          </span>
                        </div>
                        <StatusBadge
                          label={getCampaignStatusLabel(campaign.status)}
                          variant={getCampaignStatusVariant(campaign.status)}
                        />
                      </div>

                      {renderCampaignReadiness(
                        result.campaignReadiness[campaign.id],
                        campaign,
                      )}
                    </article>
                  ))}
                </div>
              )}
            </AdminSurface>
          </>
        )}
      </section>
    </main>
  );
}
