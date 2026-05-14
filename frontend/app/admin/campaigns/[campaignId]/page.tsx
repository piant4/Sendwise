import { auth } from "@clerk/nextjs/server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminCampaignContactsPanel } from "../../../../components/admin/AdminCampaignContactsPanel";
import { AdminCampaignReviewPanel } from "../../../../components/admin/AdminCampaignReviewPanel";
import { AdminCampaignSetupForm } from "../../../../components/admin/AdminCampaignSetupForm";
import { AdminCampaignSetupProgress } from "../../../../components/admin/AdminCampaignSetupProgress";
import {
  formatCampaignCount,
  getCampaignReadinessLabel,
  getCampaignStatusLabel,
  getCampaignStatusVariant,
  getProviderEventsDetail,
  getProviderEventsLabel,
  getReadableBackendReason,
  getRecipientEmptyState,
  getRecipientSummaryItems,
  getRuntimeSafetyItems,
} from "../../../../components/shared/campaignUi";
import { Button } from "../../../../components/ui/button";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import {
  getAdminCampaignDetail,
  getAdminCampaignContacts,
  getAdminCampaignSummary,
  isApiError,
} from "../../../../lib/api";
import type {
  AdminCampaignContactsSummary,
  AdminCampaignDetail,
  AdminCampaignReadinessSummary,
} from "../../../../types";

export const dynamic = "force-dynamic";

interface AdminCampaignDetailPageProps {
  params: Promise<{
    campaignId: string;
  }>;
}

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

function getStepLabel(step: string): string {
  switch (step) {
    case "setup":
      return "Configurazione";
    case "content":
      return "Contenuto";
    case "recipients":
      return "Destinatari";
    case "review":
      return "Review";
    case "send":
      return "Invio";
    default:
      return step || "Configurazione";
  }
}

function buildAttentionItems(
  campaign: AdminCampaignDetail,
  summary: AdminCampaignReadinessSummary,
): string[] {
  const backendReasons = [...summary.blockingErrors, ...summary.warnings].map(
    getReadableBackendReason,
  );
  const recipientState = getRecipientEmptyState(summary.recipients);
  const runtimeAttention = getRuntimeSafetyItems(summary.runtime)
    .map((item) => item.value)
    .filter((item) =>
      [
        "Ambiente Mailpit/dev",
        "SES configurato, validazione live pending",
        "Invio reale disattivato",
        "Invio reale non disponibile",
      ].includes(item),
    );

  return Array.from(
    new Set([
      campaign.contentReady ? null : "Contenuto non ancora pronto",
      campaign.contactsReady ? null : "Destinatari non ancora pronti",
      campaign.reviewReady ? null : "Review non pronta",
      recipientState,
      ...runtimeAttention,
      ...backendReasons.map((reason) => reason.label),
      summary.logs.providerEventsAvailable ? null : getProviderEventsLabel(summary.logs),
    ].filter((item): item is string => Boolean(item))),
  );
}

function renderSummaryStrip(
  campaign: AdminCampaignDetail,
  summary: AdminCampaignReadinessSummary,
) {
  const runtimeItems = getRuntimeSafetyItems(summary.runtime);
  const runtimeLabel = runtimeItems.map((item) => item.value).join(" / ");
  const attentionItems = buildAttentionItems(campaign, summary);

  return (
    <section className="admin-clients-card" aria-label="Sintesi campagna">
      <div className="admin-clients-card__intro">
        <div>
          <p className="admin-surface__eyebrow">Sintesi operativa</p>
          <h2 className="admin-clients-card__title">Prontezza setup</h2>
        </div>
        <StatusBadge
          label={getCampaignReadinessLabel(summary.campaign)}
          variant={summary.canSend ? "success" : "neutral"}
        />
      </div>
      <dl className="admin-record-grid" style={{ marginTop: 18 }}>
        <div>
          <dt>Readiness</dt>
          <dd>{getCampaignReadinessLabel(summary.campaign)}</dd>
        </div>
        <div>
          <dt>Destinatari idonei</dt>
          <dd>{formatCampaignCount(summary.recipients.eligible)}</dd>
        </div>
        <div>
          <dt>Destinatari bloccati</dt>
          <dd>{formatCampaignCount(summary.recipients.blocked)}</dd>
        </div>
        <div>
          <dt>Sicurezza runtime</dt>
          <dd>{runtimeLabel || "Non disponibile"}</dd>
        </div>
      </dl>
      {attentionItems.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
          {attentionItems.map((item) => (
            <span key={item} className="admin-record-chip">
              {item}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function renderTechnicalDetails(summary: AdminCampaignReadinessSummary) {
  const checklistItems = [
    {
      label: "Setup",
      value: summary.campaign.currentStep === "setup" ? "Step attuale" : "Base presente",
    },
    {
      label: "Contenuto",
      value: summary.campaign.contentReady ? "Pronto" : "Non pronto",
    },
    {
      label: "Destinatari",
      value: summary.campaign.contactsReady ? "Pronti" : "Non pronti",
    },
    {
      label: "Review",
      value: summary.campaign.reviewReady ? "Pronta" : "In attesa",
    },
  ];
  const runtimeItems = getRuntimeSafetyItems(summary.runtime);
  const technicalReasons = [...summary.blockingErrors, ...summary.warnings].map(
    getReadableBackendReason,
  );

  return (
    <details className="admin-clients-card">
      <summary>
        <span className="admin-surface__eyebrow">Dettagli tecnici admin</span>
      </summary>
      <div style={{ display: "grid", gap: 18, marginTop: 18 }}>
        <dl className="admin-record-grid">
          {checklistItems.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>

        <dl className="admin-record-grid">
          {getRecipientSummaryItems(summary.recipients).map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
          <div>
            <dt>Invii bloccati</dt>
            <dd>{formatCampaignCount(summary.blockedSends.total)}</dd>
          </div>
        </dl>
        <p className="admin-record-row__note">
          {getProviderEventsLabel(summary.logs)}. {getProviderEventsDetail(summary.logs)}
        </p>

        <dl className="admin-record-grid">
          {runtimeItems.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
          <div>
            <dt>Review backend</dt>
            <dd>{summary.campaign.reviewReady ? "Pronta" : "Non pronta"}</dd>
          </div>
          <div>
            <dt>Campaign ID</dt>
            <dd>{summary.campaign.id}</dd>
          </div>
          <div>
            <dt>Client ID</dt>
            <dd>{summary.client.id}</dd>
          </div>
        </dl>
        {technicalReasons.length > 0 ? (
          <ul className="admin-record-row__note">
            {technicalReasons.map((reason) => (
              <li key={reason.raw}>
                {reason.label}
                {reason.isKnown ? "" : `: ${reason.raw}`}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  );
}

export default async function AdminCampaignDetailPage({
  params,
}: AdminCampaignDetailPageProps) {
  const { campaignId } = await params;
  const { getToken } = await auth();
  let result:
    | {
        campaign: AdminCampaignDetail;
        summary: AdminCampaignReadinessSummary | Error;
        contacts: AdminCampaignContactsSummary | Error;
      }
    | {
        errorMessage: string;
      };

  try {
    const accessToken = await getToken();
    const campaign = await getAdminCampaignDetail(campaignId, accessToken);
    const summary = await getAdminCampaignSummary(campaignId, accessToken).catch(
      (error) =>
        error instanceof Error
          ? error
          : new Error("Sintesi campagna non disponibile."),
    );
    const contacts = await getAdminCampaignContacts(campaignId, accessToken).catch(
      (error) =>
        error instanceof Error
          ? error
          : new Error("Destinatari campagna non disponibili."),
    );

    result = { campaign, summary, contacts };
  } catch (error) {
    if (isApiError(error) && [401, 403].includes(error.status ?? 0)) {
      redirect("/auth/redirect");
    }

    result = {
      errorMessage:
        error instanceof Error
          ? error.message
          : "Impossibile caricare la campagna admin.",
    };
  }

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
            <p className="admin-surface__eyebrow">Admin / Campagne</p>
            <h1 className="admin-page-title">
              {"campaign" in result ? result.campaign.name : "Campagna"}
            </h1>
            <p className="admin-page-description">
              {"campaign" in result
                ? `${result.campaign.clientName} / ${result.campaign.subject?.trim() || "Oggetto non disponibile"}`
                : "Dettaglio campagna non disponibile"}
            </p>
          </div>
          <div
            style={{
              alignItems: "center",
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              justifyContent: "flex-end",
            }}
          >
            {"campaign" in result ? (
              <StatusBadge
                label={getCampaignStatusLabel(result.campaign.status)}
                variant={getCampaignStatusVariant(result.campaign.status)}
              />
            ) : null}
            <Button
              asChild
              variant="outline"
              size="lg"
              className="admin-topbar-action admin-topbar-action--secondary"
            >
              <Link href="/admin/campaigns">
                <ArrowLeft aria-hidden="true" className="admin-topbar-action__icon" />
                Torna alle campagne
              </Link>
            </Button>
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
            <section className="admin-page-stat-grid" aria-label="Stato campagna">
              {[
                {
                  label: "Stato",
                  value: getCampaignStatusLabel(result.campaign.status),
                },
                {
                  label: "Step",
                  value: getStepLabel(result.campaign.currentStep),
                },
                {
                  label: "Cliente",
                  value: result.campaign.clientName,
                },
                {
                  label: "Aggiornata",
                  value: formatDateLabel(result.campaign.updatedAt),
                },
              ].map((stat) => (
                <article key={stat.label} className="admin-page-stat-card">
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </article>
              ))}
            </section>

            {result.summary instanceof Error ? null : (
              renderSummaryStrip(result.campaign, result.summary)
            )}

            <div
              style={{
                alignItems: "start",
                display: "flex",
                flexWrap: "wrap",
                gap: 20,
              }}
            >
              <div style={{ flex: "1 1 260px", minWidth: 0 }}>
                <AdminCampaignSetupProgress
                  campaign={result.campaign}
                  contacts={result.contacts instanceof Error ? null : result.contacts}
                  summary={result.summary instanceof Error ? null : result.summary}
                />
              </div>
              <div style={{ display: "grid", flex: "999 1 520px", gap: 20, minWidth: 0 }}>
                <AdminCampaignSetupForm campaign={result.campaign} />

                <AdminCampaignContactsPanel
                  campaignId={result.campaign.campaignId}
                  contacts={result.contacts instanceof Error ? null : result.contacts}
                  errorMessage={
                    result.contacts instanceof Error ? result.contacts.message : null
                  }
                />

                <AdminCampaignReviewPanel
                  campaign={result.campaign}
                  summary={result.summary instanceof Error ? null : result.summary}
                  errorMessage={
                    result.summary instanceof Error ? result.summary.message : null
                  }
                />
              </div>
            </div>

            {result.summary instanceof Error ? (
              <section className="admin-clients-card">
                <p className="admin-clients-feedback admin-clients-feedback--error">
                  {result.summary.message}
                </p>
              </section>
            ) : (
              renderTechnicalDetails(result.summary)
            )}
          </>
        )}
      </section>
    </main>
  );
}
