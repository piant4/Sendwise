import { auth } from "@clerk/nextjs/server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminCampaignSetupForm } from "../../../../components/admin/AdminCampaignSetupForm";
import { AdminSurface } from "../../../../components/admin/AdminSurface";
import {
  formatCampaignCount,
  getCampaignLogStatItems,
  getCampaignReadinessItems,
  getCampaignReadinessLabel,
  getCampaignStatusLabel,
  getCampaignStatusVariant,
  getProviderEventsDetail,
  getProviderEventsLabel,
  getReadableBackendReason,
  getRecipientSummaryItems,
  getRuntimeSafetyItems,
} from "../../../../components/shared/campaignUi";
import { Button } from "../../../../components/ui/button";
import { StatusBadge } from "../../../../components/ui/StatusBadge";
import {
  getAdminCampaignDetail,
  getAdminCampaignSummary,
  isApiError,
} from "../../../../lib/api";
import type {
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

function getSetupLabel(campaign: AdminCampaignDetail): string {
  return campaign.name.trim() && campaign.subject?.trim()
    ? "Pronta"
    : "Non pronta";
}

function buildAttentionItems(summary: AdminCampaignReadinessSummary): string[] {
  const backendReasons = [...summary.blockingErrors, ...summary.warnings].map(
    getReadableBackendReason,
  );
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
      ...runtimeAttention,
      ...backendReasons.map((reason) => reason.label),
      summary.recipients.total === 0 ? "Nessun contatto associato" : null,
      summary.logs.providerEventsAvailable ? null : getProviderEventsLabel(summary.logs),
    ].filter((item): item is string => Boolean(item))),
  );
}

function renderSummarySections(summary: AdminCampaignReadinessSummary) {
  const checklistItems = [
    {
      label: "Setup",
      value:
        summary.campaign.name.trim() && summary.campaign.subject?.trim()
          ? "Pronta"
          : "Non pronta",
    },
    ...getCampaignReadinessItems(summary.campaign).map((item) => ({
      label: item.label,
      value: item.value === "Pronto" || item.value === "Presenti" || item.value === "Approvata"
        ? "Pronta"
        : "Non pronta",
    })),
  ];
  const runtimeItems = getRuntimeSafetyItems(summary.runtime);
  const attentionItems = buildAttentionItems(summary);
  const technicalReasons = [...summary.blockingErrors, ...summary.warnings].map(
    getReadableBackendReason,
  );

  return (
    <>
      <AdminSurface
        title="Checklist"
        description="Prontezza letta dai campi backend della campagna."
        aside={<StatusBadge label={getCampaignReadinessLabel(summary.campaign)} />}
      >
        <dl className="admin-record-grid">
          {checklistItems.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </AdminSurface>

      <AdminSurface
        title="Destinatari e metriche"
        description="Conteggi disponibili dal modello di lettura operativo."
        aside={<span className="admin-surface__eyebrow">Dati verificati</span>}
      >
        <dl className="admin-record-grid">
          {getRecipientSummaryItems(summary.recipients).map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
          {getCampaignLogStatItems(summary.logs).map((item) => (
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
      </AdminSurface>

      <AdminSurface
        title="Sicurezza invio"
        description="Stato runtime esposto dal backend; nessun invio parte da questa pagina."
        aside={<StatusBadge label={summary.canSend ? "Pronta" : "Non pronta"} />}
      >
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
        <details className="admin-record-row__note">
          <summary>Dettagli tecnici admin</summary>
          <dl className="admin-record-grid" style={{ marginTop: 12 }}>
            <div>
              <dt>Campaign ID</dt>
              <dd>{summary.campaign.id}</dd>
            </div>
            <div>
              <dt>Client ID</dt>
              <dd>{summary.client.id}</dd>
            </div>
            <div>
              <dt>Provider</dt>
              <dd>{summary.runtime.providerModeLabel}</dd>
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
      </AdminSurface>

      <AdminSurface
        title="Azioni non incluse"
        description="Questa schermata resta concentrata sul setup minimo della bozza."
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button className="admin-clients-form__submit" disabled type="button">
            Import contatti non ancora disponibile
          </button>
          <button className="admin-clients-form__submit" disabled type="button">
            Review non ancora disponibile
          </button>
          <span className="admin-record-chip">
            {summary.runtime.emailSendingEnabled
              ? "Invio non gestito da questa schermata"
              : "Invio reale disattivato"}
          </span>
        </div>
      </AdminSurface>
    </>
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

    result = { campaign, summary };
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
                  label: "Setup",
                  value: getSetupLabel(result.campaign),
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

            <div className="admin-record-row">
              <div className="admin-record-row__primary">
                <div className="admin-record-row__copy">
                  <strong>{result.campaign.name}</strong>
                  <span>{result.campaign.clientName}</span>
                  <span>{result.campaign.subject || "Oggetto non disponibile"}</span>
                </div>
                <StatusBadge
                  label={getCampaignStatusLabel(result.campaign.status)}
                  variant={getCampaignStatusVariant(result.campaign.status)}
                />
              </div>
            </div>

            <AdminCampaignSetupForm campaign={result.campaign} />

            {result.summary instanceof Error ? (
              <section className="admin-clients-card">
                <p className="admin-clients-feedback admin-clients-feedback--error">
                  {result.summary.message}
                </p>
              </section>
            ) : (
              renderSummarySections(result.summary)
            )}
          </>
        )}
      </section>
    </main>
  );
}
