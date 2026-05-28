"use client";

import { useAuth } from "@clerk/nextjs";
import { ChevronRight, Loader2, PenSquare, SendHorizonal, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  getBackendAssetUrl,
  isApiError,
  sendAdminCampaignFollowup,
  simulateAdminCampaignFollowup,
} from "../../lib/api";
import type {
  AdminCampaignDispatchResult,
  AdminCampaignContactsSummary,
  AdminCampaignDetail,
  AdminCampaignReadinessSummary,
  AdminFollowupSimulationResult,
  CampaignLogsSummary,
} from "../../types";
import {
  dedupeReviewReasons,
  formatCampaignCount,
  getCampaignDisplaySubject,
  getCampaignReadinessShortLabel,
  getCampaignStatusLabel,
  getCampaignStatusVariant,
  getCampaignStepLabel,
  getProviderHistoryPolicyUiMeta,
  getProviderEventsDetail,
  getProviderEventsLabel,
  getReadableBackendReason,
  getRuntimeSafetyItems,
  hasSuccessfulPostSendState,
  isDuplicateDispatchReason,
  isPreSendReadinessReason,
} from "../shared/campaignUi";
import { formatDateTimeInRome } from "../shared/dateTime";
import { Button } from "../ui/button";
import { StatusBadge } from "../ui/StatusBadge";

interface AdminCampaignDetailViewProps {
  campaign: AdminCampaignDetail;
  summary: AdminCampaignReadinessSummary | null;
  contacts: AdminCampaignContactsSummary | null;
}

function formatDateLabel(value: string): string {
  return formatDateTimeInRome(value);
}

function stripScripts(value: string): string {
  return value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
}

function normalizePlaceholderValue(value?: string | null): string {
  return (value ?? "").trim();
}

function buildPreviewLogoHtml(logoUrl?: string | null): string {
  const safeLogoUrl = normalizePlaceholderValue(getBackendAssetUrl(logoUrl));
  if (!safeLogoUrl) {
    return "";
  }

  return `<img src="${safeLogoUrl.replaceAll("\"", "&quot;")}" alt="" width="120" style="display:block;max-width:120px;height:auto;border:0;outline:none;text-decoration:none;" />`;
}

function buildPreviewSocialIconsHtml(brand?: AdminCampaignDetail["emailBrand"] | null): string {
  const socialItems = [
    ["website_url", "WEB", "#2563eb"],
    ["linkedin_url", "in", "#0a66c2"],
    ["instagram_url", "ig", "#d946ef"],
    ["facebook_url", "f", "#1877f2"],
    ["x_url", "x", "#111827"],
  ] as const;

  const iconCells = socialItems
    .map(([key, label, backgroundColor]) => {
      const socialUrl = normalizePlaceholderValue(brand?.[key]);
      if (!socialUrl) {
        return "";
      }

      return `<td style="padding-right:8px;"><a href="${socialUrl.replaceAll("\"", "&quot;")}" style="display:inline-block;text-decoration:none;"><span style="display:inline-block;min-width:32px;padding:8px 10px;border-radius:999px;background:${backgroundColor};color:#ffffff;font-size:12px;line-height:1;font-weight:700;text-align:center;text-transform:uppercase;">${label}</span></a></td>`;
    })
    .filter(Boolean)
    .join("");

  if (!iconCells) {
    return "";
  }

  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>${iconCells}</tr></table>`;
}

function renderLocalPreviewTemplate(campaign: AdminCampaignDetail): string {
  const replacements: Record<string, string> = {
    nome: "Nome",
    cognome: "Cognome",
    email: "contatto@example.test",
    campaign_name: campaign.name,
    unsubscribe_url: "#unsubscribe",
    current_year: String(new Date().getUTCFullYear()),
    company_name: normalizePlaceholderValue(campaign.emailBrand?.company_name),
    sender_name:
      normalizePlaceholderValue(campaign.emailBrand?.sender_name) ||
      normalizePlaceholderValue(campaign.emailBrand?.company_name) ||
      "Sendwise",
    logo: buildPreviewLogoHtml(campaign.emailBrand?.logo_url),
    social_icons: buildPreviewSocialIconsHtml(campaign.emailBrand),
    website_url: normalizePlaceholderValue(campaign.emailBrand?.website_url),
    linkedin_url: normalizePlaceholderValue(campaign.emailBrand?.linkedin_url),
    instagram_url: normalizePlaceholderValue(campaign.emailBrand?.instagram_url),
    facebook_url: normalizePlaceholderValue(campaign.emailBrand?.facebook_url),
    x_url: normalizePlaceholderValue(campaign.emailBrand?.x_url),
    preview_text: normalizePlaceholderValue(campaign.previewText),
  };

  return stripScripts(campaign.bodyHtml ?? "").replace(/{{\s*([A-Za-z0-9_]+)\s*}}/g, (match, key) => {
    const normalizedKey = key.trim().toLowerCase();
    return normalizedKey in replacements ? replacements[normalizedKey] ?? "" : match;
  });
}

function buildPreviewDocument(value: string): string {
  const cleanedValue = stripScripts(value).trim();
  const content =
    cleanedValue.length > 0
      ? cleanedValue
      : '<div class="sw-preview-empty">Nessun contenuto HTML da mostrare.</div>';

  return `<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src https: http: data: blob:; style-src 'unsafe-inline'; font-src data:; form-action 'none'; frame-ancestors 'none'; base-uri 'none'"
    />
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background: #ffffff;
        color: #0f172a;
        padding: 24px;
      }
      img { height: auto; max-width: 100%; }
      .sw-preview-empty {
        border: 1px dashed rgba(148, 163, 184, 0.4);
        border-radius: 16px;
        color: #64748b;
        padding: 20px;
      }
    </style>
  </head>
  <body>${content}</body>
</html>`;
}

function getProviderMetricValue(value: number | null, available: boolean): string {
  return available && typeof value === "number"
    ? value.toLocaleString("it-IT")
    : "Non disponibili";
}

function getProviderMetricNote(available: boolean): string {
  return available ? "Eventi provider processati" : "In attesa di eventi provider";
}

function getOperationalSummary(
  summary: AdminCampaignReadinessSummary | null,
  campaign: AdminCampaignDetail,
) {
  if (!summary) {
    return {
      badgeLabel: getCampaignStatusLabel(campaign.status),
      badgeVariant: getCampaignStatusVariant(campaign.status),
      title: "Read model non disponibile",
      detail: "La campagna resta leggibile, ma il report post-send non e disponibile.",
    };
  }

  if (summary.logs.deliveredAvailable && (summary.logs.delivered ?? 0) > 0) {
    return {
      badgeLabel: "Consegnata",
      badgeVariant: "success" as const,
      title: "Campagna consegnata",
      detail: "Delivered e' confermato dagli eventi provider processati.",
    };
  }

  if (summary.logs.failed > 0) {
    return {
      badgeLabel: "Invio con errori",
      badgeVariant: "danger" as const,
      title: "Sono presenti errori operativi",
      detail: `${formatCampaignCount(summary.logs.failed)} invii non sono stati accettati dal sistema di invio.`,
    };
  }

  if (campaign.status === "failed" || campaign.status === "blocked") {
    return {
      badgeLabel: campaign.status === "failed" ? "Invio fallito" : "Campagna bloccata",
      badgeVariant: "danger" as const,
      title:
        campaign.status === "failed"
          ? "La campagna richiede intervento"
          : "La campagna e bloccata",
      detail: "Lo stato operativo richiede una verifica prima di un nuovo invio.",
    };
  }

  if (summary.logs.sentAvailable && (summary.logs.sent ?? 0) > 0) {
    return {
      badgeLabel: "Accettata / avviata",
      badgeVariant: "success" as const,
      title: "La campagna e stata presa in carico",
      detail: "Sent significa accettata o avviata dal sistema Listmonk, non consegnata in inbox.",
    };
  }

  if (summary.logs.queued > 0) {
    return {
      badgeLabel: "Preparata / in coda",
      badgeVariant: "warning" as const,
      title: "La campagna e preparata ma non ancora accettata",
      detail: "Queued descrive una preparazione operativa, non un recapito inbox.",
    };
  }

  return {
    badgeLabel: "Da completare",
    badgeVariant: "warning" as const,
    title: "La campagna non e pronta per il post-send reporting",
    detail: "Completa contenuto, destinatari e review prima di aspettarti metriche operative.",
  };
}

function buildProviderMetrics(logs: CampaignLogsSummary) {
  return [
    { label: "Delivered", value: logs.delivered },
    { label: "Opened", value: logs.opened },
    { label: "Clicked", value: logs.clicked },
  ];
}

function getSafeFollowupErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.isNetworkError) {
      return "Il browser non riesce a raggiungere il backend Sendwise.";
    }
    if (error.status === 401 || error.status === 403) {
      return "La sessione admin non e valida per questa azione.";
    }
    if (error.detail.trim()) {
      return error.detail;
    }
  }

  return "Non e stato possibile completare l'azione follow-up.";
}

export function AdminCampaignDetailView({
  campaign,
  summary,
  contacts,
}: AdminCampaignDetailViewProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const [isSimulatingFollowup, setIsSimulatingFollowup] = useState(false);
  const [isSendingFollowup, setIsSendingFollowup] = useState(false);
  const [followupSimulationResult, setFollowupSimulationResult] =
    useState<AdminFollowupSimulationResult | null>(null);
  const [followupSendResult, setFollowupSendResult] = useState<AdminCampaignDispatchResult | null>(
    null,
  );
  const [followupError, setFollowupError] = useState<string | null>(null);
  const [isFollowupConfirmOpen, setIsFollowupConfirmOpen] = useState(false);
  const runtimeItems = summary ? getRuntimeSafetyItems(summary.runtime) : [];
  const hasPostSendSuccess = summary ? hasSuccessfulPostSendState(summary.logs) : false;
  const blockingReasons = summary
    ? dedupeReviewReasons(
        summary.blockingErrors
          .filter((reason) =>
            hasPostSendSuccess
              ? !isDuplicateDispatchReason(reason) && !isPreSendReadinessReason(reason)
              : true,
          )
          .map(getReadableBackendReason),
      )
    : [];
  const warningReasons = summary
    ? dedupeReviewReasons(
        summary.warnings
          .filter((reason) => (hasPostSendSuccess ? !isPreSendReadinessReason(reason) : true))
          .map(getReadableBackendReason),
      )
    : [];
  const duplicateProtectionReasons =
    summary && hasPostSendSuccess
      ? dedupeReviewReasons(
          summary.blockingErrors
            .filter(isDuplicateDispatchReason)
            .map(getReadableBackendReason),
        )
      : [];
  const providerHistoryPolicy = summary?.policyState?.providerHistory ?? [];
  const operationalSummary = getOperationalSummary(summary, campaign);
  const recipientSummary = summary
    ? `${formatCampaignCount(summary.recipients.total)} totali · ${formatCampaignCount(summary.recipients.eligible)} idonei · ${formatCampaignCount(summary.recipients.blocked)} bloccati`
    : contacts
      ? `${formatCampaignCount(contacts.total)} totali · ${formatCampaignCount(contacts.eligible)} idonei · ${formatCampaignCount(contacts.blocked)} bloccati`
      : "Non disponibili";
  const providerMetrics = summary ? buildProviderMetrics(summary.logs) : [];
  const previewHtml = renderLocalPreviewTemplate(campaign);
  const subjectDisplay = getCampaignDisplaySubject(
    summary?.campaign ?? campaign,
    "Non disponibile",
  );
  const followupSimulationAvailable = campaign.followupEnabled;
  const followupRealSendEnabled =
    campaign.followupEnabled &&
    campaign.followupContentReady &&
    Boolean(summary?.runtime.realSendAvailable);

  async function handleFollowupSimulation() {
    if (isSimulatingFollowup) {
      return;
    }

    setIsSimulatingFollowup(true);
    setFollowupError(null);

    try {
      const token = await getToken();
      const result = await simulateAdminCampaignFollowup(campaign.campaignId, token);
      setFollowupSimulationResult(result);
      router.refresh();
    } catch (error) {
      setFollowupError(getSafeFollowupErrorMessage(error));
    } finally {
      setIsSimulatingFollowup(false);
    }
  }

  async function handleFollowupSend() {
    if (isSendingFollowup || !followupRealSendEnabled) {
      return;
    }

    setIsSendingFollowup(true);
    setFollowupError(null);

    try {
      const token = await getToken();
      const result = await sendAdminCampaignFollowup(campaign.campaignId, token);
      setFollowupSendResult(result);
      setIsFollowupConfirmOpen(false);
      router.refresh();
    } catch (error) {
      setFollowupError(getSafeFollowupErrorMessage(error));
    } finally {
      setIsSendingFollowup(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section className="admin-clients-card campaign-panel campaign-status-panel">
        <div
          className="admin-clients-card__intro"
          style={{ alignItems: "start", gap: 16, justifyContent: "space-between" }}
        >
          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <p className="admin-clients-card__description" style={{ margin: 0 }}>
                {campaign.clientName}
              </p>
              <p className="admin-record-row__note" style={{ marginTop: 6 }}>
                {subjectDisplay}
              </p>
            </div>
            <div className="campaign-hero-actions">
              <StatusBadge
                label={getCampaignStatusLabel(campaign.status)}
                variant={getCampaignStatusVariant(campaign.status)}
              />
              <StatusBadge
                label={operationalSummary.badgeLabel}
                variant={operationalSummary.badgeVariant}
              />
              {summary ? (
                <StatusBadge
                  label={
                    summary.logs.providerEventsAvailable
                      ? "Eventi Mailgun disponibili"
                      : "Dati Mailgun non ancora collegati"
                  }
                  variant={summary.logs.providerEventsAvailable ? "success" : "neutral"}
                />
              ) : null}
            </div>
          </div>

          <div className="campaign-hero-actions">
            <Button
              asChild
              variant="outline"
              size="default"
              className="admin-topbar-action campaign-action campaign-action--secondary"
            >
              <Link href={`/admin/campaigns/${campaign.campaignId}?mode=edit&step=review`}>
                Verifica
              </Link>
            </Button>
            <Button
              asChild
              size="default"
              className="admin-topbar-action campaign-action campaign-action--primary"
            >
              <Link href={`/admin/campaigns/${campaign.campaignId}?mode=edit&step=editor`}>
                <PenSquare aria-hidden="true" className="admin-topbar-action__icon" />
                Modifica
              </Link>
            </Button>
          </div>
        </div>

        <div className="campaign-status-panel__grid">
          <article className="campaign-status-panel__primary">
            <span className="campaign-review-overview__label">Stato post-send</span>
            <strong>{operationalSummary.title}</strong>
            <p>{operationalSummary.detail}</p>
          </article>

          <div className="campaign-inline-summary campaign-status-panel__facts">
            {[
              {
                label: "Stato operativo",
                value: hasPostSendSuccess
                  ? "Report post-send disponibile"
                  : summary
                  ? getCampaignReadinessShortLabel(summary.campaign)
                  : getCampaignReadinessShortLabel(campaign),
              },
              {
                label: "Step operativo",
                value: hasPostSendSuccess
                  ? "Post-send"
                  : getCampaignStepLabel(campaign.currentStep),
              },
              { label: "Destinatari", value: recipientSummary },
              { label: "Aggiornata", value: formatDateLabel(campaign.updatedAt) },
              {
                label: "Limite invii 30 giorni",
                value: campaign.periodEmailLimit.toLocaleString("it-IT"),
              },
              {
                label: "Limite invii giornaliero",
                value: campaign.dailyEmailLimit.toLocaleString("it-IT"),
              },
              {
                label: "Follow-up",
                value: campaign.followupEnabled
                  ? `${campaign.followupDailyLimit?.toLocaleString("it-IT") ?? "-"} / giorno · ${campaign.followupMonthlyLimit?.toLocaleString("it-IT") ?? "-"} / mese`
                  : "Disabilitati",
              },
              {
                label: "Ritardo follow-up",
                value: `${campaign.followupDelayValue.toLocaleString("it-IT")} ${campaign.followupDelayUnit === "hours" ? "ore" : "giorni"}`,
              },
            ].map((item) => (
              <article key={item.label}>
                <span className="admin-record-row__note">{item.label}</span>
                <strong style={{ color: "var(--sw-olive)" }}>{item.value}</strong>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="admin-clients-card campaign-panel">
        <div className="admin-clients-card__intro">
          <div>
            <p className="admin-surface__eyebrow">Follow-up manuale</p>
            <h2 className="admin-clients-card__title" style={{ color: "var(--sw-olive)" }}>
              Readiness e invio dedicato
            </h2>
            <p className="admin-clients-card__description" style={{ marginTop: 8 }}>
              Il follow-up reale usa contenuto dedicato e raggiunge solo i destinatari ancora idonei.
            </p>
          </div>
          <StatusBadge
            label={
              campaign.followupEnabled
                ? campaign.followupContentReady
                  ? "Contenuto configurato"
                  : "Contenuto da completare"
                : "Follow-up disabilitato"
            }
            variant={
              !campaign.followupEnabled
                ? "neutral"
                : campaign.followupContentReady
                  ? "success"
                  : "warning"
            }
          />
        </div>

        {followupError ? (
          <p className="admin-clients-feedback admin-clients-feedback--error" role="alert">
            {followupError}
          </p>
        ) : null}

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <article className="campaign-callout" style={{ minHeight: 0 }}>
            <span className="admin-record-row__note">Follow-up</span>
            <strong style={{ color: "var(--sw-olive)" }}>
              {campaign.followupEnabled ? "Abilitato" : "Disabilitato"}
            </strong>
          </article>
          <article className="campaign-callout" style={{ minHeight: 0 }}>
            <span className="admin-record-row__note">Limiti dedicati</span>
            <strong style={{ color: "var(--sw-olive)" }}>
              {(campaign.followupDailyLimit ?? 0).toLocaleString("it-IT")} / giorno · {(campaign.followupMonthlyLimit ?? 0).toLocaleString("it-IT")} / mese
            </strong>
          </article>
          <article className="campaign-callout" style={{ minHeight: 0 }}>
            <span className="admin-record-row__note">Ritardo</span>
            <strong style={{ color: "var(--sw-olive)" }}>
              {campaign.followupDelayValue.toLocaleString("it-IT")} {campaign.followupDelayUnit === "hours" ? "ore" : "giorni"}
            </strong>
          </article>
          <article className="campaign-callout" style={{ minHeight: 0 }}>
            <span className="admin-record-row__note">Contenuto dedicato</span>
            <strong style={{ color: "var(--sw-olive)" }}>
              {campaign.followupContentReady ? "Pronto" : "Non pronto"}
            </strong>
            <p className="campaign-field__helper" style={{ margin: "6px 0 0" }}>
              {campaign.followupContentReason ?? "Oggetto e HTML dedicati salvati."}
            </p>
          </article>
        </div>

        <div className="campaign-action-row" style={{ marginTop: 20 }}>
          <Button
            type="button"
            variant="outline"
            className="admin-topbar-action campaign-action campaign-action--secondary"
            disabled={!followupSimulationAvailable || isSimulatingFollowup}
            onClick={handleFollowupSimulation}
            style={{ minWidth: 190 }}
          >
            {isSimulatingFollowup ? (
              <Loader2 aria-hidden="true" className="admin-topbar-action__icon" />
            ) : null}
            {isSimulatingFollowup ? "Simulazione..." : "Simula follow-up"}
          </Button>
          <Button
            type="button"
            className="admin-topbar-action campaign-action campaign-action--primary"
            disabled={!followupRealSendEnabled || isSendingFollowup}
            onClick={() => setIsFollowupConfirmOpen(true)}
            style={{ minWidth: 220 }}
          >
            {isSendingFollowup ? (
              <Loader2 aria-hidden="true" className="admin-topbar-action__icon" />
            ) : (
              <SendHorizonal aria-hidden="true" className="admin-topbar-action__icon" />
            )}
            {isSendingFollowup ? "Invio..." : "Invia follow-up reale"}
          </Button>
        </div>
        <p className="campaign-field__helper" style={{ margin: 0 }}>
          Il pulsante reale invia un follow-up vero; solo i destinatari ancora idonei lo ricevono.
        </p>

        {followupSimulationResult ? (
          <article className="campaign-callout" style={{ marginTop: 18, minHeight: 0 }}>
            <span className="admin-record-row__note">Ultima simulazione follow-up</span>
            <strong style={{ color: "var(--sw-olive)" }}>{followupSimulationResult.reason}</strong>
            <p className="campaign-field__helper" style={{ margin: "6px 0 0" }}>
              {followupSimulationResult.eligibleCount.toLocaleString("it-IT")} idonei ·{" "}
              {followupSimulationResult.blockedCount.toLocaleString("it-IT")} bloccati
            </p>
          </article>
        ) : null}
        {followupSendResult ? (
          <article className="campaign-callout" style={{ marginTop: 18, minHeight: 0 }}>
            <span className="admin-record-row__note">Ultimo invio follow-up</span>
            <strong style={{ color: "var(--sw-olive)" }}>{followupSendResult.reason}</strong>
            <p className="campaign-field__helper" style={{ margin: "6px 0 0" }}>
              {followupSendResult.eligibleContactCount.toLocaleString("it-IT")} idonei ·{" "}
              {followupSendResult.blockedContactCount.toLocaleString("it-IT")} bloccati
            </p>
          </article>
        ) : null}
      </section>

      {blockingReasons.length > 0 ? (
        <section
          className="admin-clients-card"
          style={{
            background: "var(--sw-danger-surface)",
            border: "1px solid var(--sw-danger-border)",
          }}
        >
          <div className="admin-clients-card__intro">
            <div>
              <p className="admin-surface__eyebrow">Problemi</p>
              <h2 className="admin-clients-card__title" style={{ color: "var(--sw-olive)" }}>
                Problemi da risolvere
              </h2>
            </div>
          </div>
          <ul className="admin-record-row__note" style={{ margin: 0, paddingLeft: 18 }}>
            {blockingReasons.map((reason) => (
              <li key={`${reason.raw}-${reason.label}`}>{reason.label}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {summary ? (
        <section className="admin-clients-card">
          <div className="admin-clients-card__intro">
            <div>
              <p className="admin-surface__eyebrow">Reporting</p>
              <h2 className="admin-clients-card__title" style={{ color: "var(--sw-olive)" }}>
                Report post-send
              </h2>
            </div>
            <StatusBadge
              label={
                hasPostSendSuccess
                  ? "Report finale"
                  : summary.campaign.reviewReady
                    ? "Review pronta"
                    : "Review incompleta"
              }
              variant={
                hasPostSendSuccess || summary.campaign.reviewReady ? "success" : "warning"
              }
            />
          </div>

          <div
            style={{
              display: "grid",
              gap: 14,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            <article className="campaign-callout">
              <span className="admin-record-row__note">Accepted / started by system</span>
              <strong style={{ color: "var(--sw-olive)" }}>{formatCampaignCount(summary.logs.sent ?? 0)}</strong>
              <span>Accettate o avviate da Listmonk. Non indica delivered.</span>
            </article>
            <article className="campaign-callout">
              <span className="admin-record-row__note">Prepared / queued</span>
              <strong style={{ color: "var(--sw-olive)" }}>{formatCampaignCount(summary.logs.queued)}</strong>
              <span>Preparate ma non ancora accettate dal sistema di invio.</span>
            </article>
            <article className="campaign-callout">
              <span className="admin-record-row__note">Failed</span>
              <strong style={{ color: "var(--sw-olive)" }}>{formatCampaignCount(summary.logs.failed)}</strong>
              <span>Errori operativi o di dispatch registrati dal backend.</span>
            </article>
            <article className="campaign-callout">
              <span className="admin-record-row__note">Eventi Mailgun</span>
              <strong style={{ color: "var(--sw-olive)" }}>
                {summary.logs.providerEventsAvailable ? "Disponibili" : "Non disponibili"}
              </strong>
              <span>{getProviderEventsDetail(summary.logs)}</span>
            </article>
          </div>

          {summary.logs.providerEventsAvailable ? (
            <div className="campaign-provider-metrics" style={{ marginTop: 18 }}>
              {providerMetrics.map((item) => (
                <article key={item.label} className="campaign-provider-metrics__item">
                  <span className="campaign-review-overview__label">{item.label}</span>
                  <strong>{getProviderMetricValue(item.value, true)}</strong>
                  <p>{getProviderMetricNote(true)}</p>
                </article>
              ))}
            </div>
          ) : null}

          <p className="admin-record-row__note" style={{ marginTop: 16 }}>
            {getProviderEventsLabel(summary.logs)}. `provider_message_id` puo restare vuoto negli invii campagna attuali.
          </p>

          {summary.blockedSends.latest.length > 0 ? (
            <div className="campaign-event-feed">
              <div className="campaign-reporting-section__header">
                <div>
                  <strong style={{ color: "var(--sw-olive)" }}>Eventi recenti</strong>
                  <p className="admin-record-row__note">
                    Ultimi blocchi o alert backend collegati a questa campagna.
                  </p>
                </div>
                <ShieldAlert aria-hidden="true" color="#2563eb" size={18} />
              </div>
              <div className="campaign-event-feed__list">
                {summary.blockedSends.latest.map((event) => (
                  <article key={event.id} className="campaign-event-feed__item">
                    <strong style={{ color: "var(--sw-olive)" }}>
                      {getReadableBackendReason(event.reason).label}
                    </strong>
                    <span className="admin-record-row__note">
                      Registrato il {formatDateLabel(event.created_at)}
                    </span>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {duplicateProtectionReasons.length > 0 ? (
            <div className="campaign-detail-notes" style={{ marginTop: 16 }}>
              <strong style={{ color: "var(--sw-olive)" }}>Protezione duplicati</strong>
              <ul className="admin-record-row__note" style={{ margin: 0 }}>
                {duplicateProtectionReasons.map((reason) => (
                  <li key={`${reason.raw}-${reason.label}`}>{reason.label}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {providerHistoryPolicy.length > 0 ? (
            <div className="campaign-detail-notes" style={{ marginTop: 16 }}>
              <strong style={{ color: "var(--sw-olive)" }}>Deliverability provider</strong>
              <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                {providerHistoryPolicy.map((item) => {
                  const meta = getProviderHistoryPolicyUiMeta(item);

                  return (
                    <article
                      key={`${item.code}-${item.metric}-${item.band}`}
                      className="campaign-callout"
                      style={{ minHeight: 0 }}
                    >
                      <div className="campaign-review-checklist__header">
                        <strong className="campaign-review-checklist__title">
                          {meta.title}
                        </strong>
                        <StatusBadge label={meta.badgeLabel} variant={meta.badgeVariant} />
                      </div>
                      <p className="campaign-review-checklist__reason">{meta.detail}</p>
                      {meta.rateLabel || meta.domainLabel ? (
                        <p className="admin-record-row__note" style={{ margin: 0 }}>
                          {[meta.rateLabel, meta.domainLabel].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}

          {warningReasons.length > 0 ? (
            <div className="campaign-detail-notes" style={{ marginTop: 16 }}>
              <strong style={{ color: "var(--sw-olive)" }}>Controlli utili</strong>
              <ul className="admin-record-row__note" style={{ margin: 0 }}>
                {warningReasons.map((reason) => (
                  <li key={`${reason.raw}-${reason.label}`}>{reason.label}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="admin-clients-card">
        <div className="admin-clients-card__intro">
          <div>
            <p className="admin-surface__eyebrow">Anteprima</p>
            <h2 className="admin-clients-card__title" style={{ color: "var(--sw-olive)" }}>
              Email formattata
            </h2>
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            marginBottom: 18,
          }}
        >
          <article className="campaign-callout">
            <span className="admin-record-row__note">Oggetto</span>
            <strong style={{ color: "var(--sw-olive)" }}>
              {subjectDisplay}
            </strong>
          </article>
          <article className="campaign-callout">
            <span className="admin-record-row__note">Preview text</span>
            <strong style={{ color: "var(--sw-olive)" }}>
              {normalizePlaceholderValue(campaign.previewText) || "Non disponibile"}
            </strong>
          </article>
        </div>
        <iframe
          className="campaign-email-preview-frame campaign-email-preview-frame--editor"
          sandbox=""
          srcDoc={buildPreviewDocument(previewHtml)}
          style={{ height: 900 }}
          title="Anteprima formattata email"
        />
      </section>

      <details className="admin-clients-card">
        <summary
          style={{
            alignItems: "center",
            color: "#2563eb",
            cursor: "pointer",
            display: "inline-flex",
            fontWeight: 700,
            gap: 8,
          }}
        >
          Dettagli tecnici <ChevronRight aria-hidden="true" size={16} />
        </summary>
        <div style={{ display: "grid", gap: 18, marginTop: 18 }}>
          <dl className="admin-record-grid">
            <div>
              <dt>Campaign ID</dt>
              <dd>{campaign.campaignId}</dd>
            </div>
            <div>
              <dt>Client ID</dt>
              <dd>{campaign.clientId}</dd>
            </div>
            <div>
              <dt>Creata</dt>
              <dd>{formatDateLabel(campaign.createdAt)}</dd>
            </div>
            <div>
              <dt>Slot</dt>
              <dd>{campaign.campaignSlotId || "Non assegnato"}</dd>
            </div>
          </dl>
          {runtimeItems.length > 0 ? (
            <dl className="admin-record-grid">
              {runtimeItems.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </details>

      {isFollowupConfirmOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!isSendingFollowup) {
              setIsFollowupConfirmOpen(false);
            }
          }}
        >
          <div
            className="invite-modal campaign-contact-remove-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-followup-send-title"
            aria-describedby="campaign-followup-send-message"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="invite-modal__header">
              <div>
                <p className="invite-modal__eyebrow">Follow-up reale</p>
                <h3 id="campaign-followup-send-title" className="invite-modal__title">
                  Confermi l&apos;invio del follow-up?
                </h3>
              </div>
            </div>
            <p id="campaign-followup-send-message" className="invite-modal__message">
              Questa azione invia un follow-up reale. Solo i destinatari ancora idonei lo riceveranno.
            </p>
            <div className="invite-modal__actions" style={{ marginTop: 18 }}>
              <button
                type="button"
                className="invite-modal__button invite-modal__button--secondary"
                disabled={isSendingFollowup}
                onClick={() => setIsFollowupConfirmOpen(false)}
              >
                Annulla
              </button>
              <button
                type="button"
                className="invite-modal__button invite-modal__button--primary"
                disabled={isSendingFollowup}
                onClick={handleFollowupSend}
              >
                {isSendingFollowup ? "Invio..." : "Conferma follow-up reale"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
