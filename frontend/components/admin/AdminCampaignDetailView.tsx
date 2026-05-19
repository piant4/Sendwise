import { ChevronRight, FileText, PenSquare, ShieldAlert } from "lucide-react";
import Link from "next/link";
import type {
  AdminCampaignContactsSummary,
  AdminCampaignDetail,
  AdminCampaignReadinessSummary,
  CampaignLogsSummary,
} from "../../types";
import {
  dedupeReviewReasons,
  formatCampaignCount,
  getCampaignReadinessShortLabel,
  getCampaignStatusLabel,
  getCampaignStatusVariant,
  getCampaignStepLabel,
  getProviderEventsDetail,
  getProviderEventsLabel,
  getReadableBackendReason,
  getRuntimeSafetyItems,
} from "../shared/campaignUi";
import { Button } from "../ui/button";
import { StatusBadge } from "../ui/StatusBadge";

interface AdminCampaignDetailViewProps {
  campaign: AdminCampaignDetail;
  summary: AdminCampaignReadinessSummary | null;
  contacts: AdminCampaignContactsSummary | null;
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

function getExcerpt(value?: string | null): string {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";

  if (!normalized) {
    return "Non disponibile";
  }

  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
}

function getProviderMetricValue(value: number, available: boolean): string {
  if (!available) {
    return "Non disponibili";
  }

  return value.toLocaleString("it-IT");
}

function getProviderMetricNote(available: boolean): string {
  return available ? "Eventi provider processati" : "In attesa di eventi provider";
}

function getOperationalSummary(
  summary: AdminCampaignReadinessSummary | null,
  campaign: AdminCampaignDetail,
): {
  badgeLabel: string;
  badgeVariant: "neutral" | "success" | "warning" | "danger";
  title: string;
  detail: string;
} {
  if (!summary) {
    return {
      badgeLabel: getCampaignStatusLabel(campaign.status),
      badgeVariant: getCampaignStatusVariant(campaign.status),
      title: "Read model non disponibile",
      detail: "La campagna resta leggibile, ma il report post-invio non e disponibile.",
    };
  }

  if (summary.logs.failed > 0) {
    return {
      badgeLabel: "Invio con errori",
      badgeVariant: "danger",
      title: "Sono presenti errori operativi",
      detail: `${formatCampaignCount(summary.logs.failed)} invii non sono stati accettati dal sistema di invio.`,
    };
  }

  if (summary.logs.sent > 0) {
    return {
      badgeLabel: "Accettata dal provider",
      badgeVariant: "success",
      title: "La campagna e stata presa in carico",
      detail: "Sent indica accettata dal sistema di invio, non consegnata in inbox.",
    };
  }

  if (summary.logs.queued > 0) {
    return {
      badgeLabel: "Preparata / in coda",
      badgeVariant: "warning",
      title: "La campagna e pronta ma non ancora accettata",
      detail: "I log risultano preparati o in coda e attendono il passaggio successivo.",
    };
  }

  if (summary.campaign.reviewReady) {
    return {
      badgeLabel: "Pronta",
      badgeVariant: "success",
      title: "Pronta per un invio controllato",
      detail: "La review e completa, ma non esiste ancora un'accettazione provider.",
    };
  }

  return {
    badgeLabel: "Da completare",
    badgeVariant: "warning",
    title: "La campagna non e pronta per il post-send reporting",
    detail: "Completa contenuto, destinatari e review prima di aspettarti metriche operative.",
  };
}

function buildOperationalMetrics(summary: AdminCampaignReadinessSummary) {
  return [
    {
      label: "Accettate / sent",
      value: formatCampaignCount(summary.logs.sent),
      note: "Accettate dal sistema di invio. Non indica consegna.",
    },
    {
      label: "Preparate / queued",
      value: formatCampaignCount(summary.logs.queued),
      note: "Preparate ma non ancora accettate dal sistema di invio.",
    },
    {
      label: "Fallite",
      value: formatCampaignCount(summary.logs.failed),
      note: "Tentativi terminati con errore operativo o di dispatch.",
    },
  ];
}

function buildProviderMetrics(logs: CampaignLogsSummary) {
  return [
    { label: "Delivered", value: logs.delivered },
    { label: "Opened", value: logs.opened },
    { label: "Clicked", value: logs.clicked },
    { label: "Bounced", value: logs.bounced },
    { label: "Complained", value: logs.complained },
    { label: "Unsubscribed", value: logs.unsubscribed },
  ];
}

export function AdminCampaignDetailView({
  campaign,
  summary,
  contacts,
}: AdminCampaignDetailViewProps) {
  const runtimeItems = summary ? getRuntimeSafetyItems(summary.runtime) : [];
  const blockingReasons = summary
    ? dedupeReviewReasons(summary.blockingErrors.map(getReadableBackendReason))
    : [];
  const warningReasons = summary
    ? dedupeReviewReasons(summary.warnings.map(getReadableBackendReason))
    : [];
  const operationalSummary = getOperationalSummary(summary, campaign);
  const providerMetrics = summary ? buildProviderMetrics(summary.logs) : [];
  const operationalMetrics = summary ? buildOperationalMetrics(summary) : [];
  const recipientSummary = summary
    ? `${formatCampaignCount(summary.recipients.total)} totali · ${formatCampaignCount(summary.recipients.eligible)} idonei · ${formatCampaignCount(summary.recipients.blocked)} bloccati`
    : contacts
      ? `${formatCampaignCount(contacts.total)} totali · ${formatCampaignCount(contacts.eligible)} idonei · ${formatCampaignCount(contacts.blocked)} bloccati`
      : "Non disponibili";

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
                {campaign.subject?.trim() || "Oggetto email da completare"}
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
                      ? "Eventi provider disponibili"
                      : "Eventi provider in attesa"
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
              <Link href={`/admin/campaigns/${campaign.campaignId}?mode=edit`}>
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
                value: summary
                  ? getCampaignReadinessShortLabel(summary.campaign)
                  : getCampaignReadinessShortLabel(campaign),
              },
              {
                label: "Step operativo",
                value: getCampaignStepLabel(campaign.currentStep),
              },
              {
                label: "Destinatari",
                value: recipientSummary,
              },
              {
                label: "Aggiornata",
                value: formatDateLabel(campaign.updatedAt),
              },
              {
                label: "Limite invii 30 giorni",
                value: campaign.periodEmailLimit.toLocaleString("it-IT"),
              },
              {
                label: "Limite invii giornaliero",
                value: campaign.dailyEmailLimit.toLocaleString("it-IT"),
              },
            ].map((item) => (
              <article key={item.label}>
                <span className="admin-record-row__note">{item.label}</span>
                <strong style={{ color: "#0f172a" }}>{item.value}</strong>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="admin-clients-card">
        <div className="admin-clients-card__intro">
          <div>
            <p className="admin-surface__eyebrow">Contenuto</p>
            <h2 className="admin-clients-card__title" style={{ color: "#0f172a" }}>
              Anteprima email
            </h2>
          </div>
          <FileText aria-hidden="true" color="#2563eb" size={18} />
        </div>
        <div className="campaign-content-grid">
          {[
            {
              label: "Oggetto email",
              title: campaign.subject?.trim() || "Non disponibile",
              detail: null,
            },
            {
              label: "Anteprima email",
              title: getExcerpt(campaign.previewText),
              detail: null,
            },
            {
              label: "HTML email",
              title: campaign.bodyHtml?.trim() ? "Contenuto presente" : "Da completare",
              detail: getExcerpt(campaign.bodyHtml),
            },
            {
              label: "Testo semplice",
              title: campaign.bodyText?.trim() ? "Contenuto presente" : "Da completare",
              detail: getExcerpt(campaign.bodyText),
            },
          ].map((item) => (
            <article key={item.label} className="campaign-content-grid__item">
              <span className="admin-record-row__note">{item.label}</span>
              <strong style={{ color: "#0f172a" }}>{item.title}</strong>
              {item.detail ? <span>{item.detail}</span> : null}
            </article>
          ))}
        </div>
      </section>

      {summary ? (
        <section className="admin-clients-card">
          <div className="admin-clients-card__intro">
            <div>
              <p className="admin-surface__eyebrow">Reporting</p>
              <h2 className="admin-clients-card__title" style={{ color: "#0f172a" }}>
                Report post-send
              </h2>
            </div>
            <StatusBadge
              label={summary.campaign.reviewReady ? "Review pronta" : "Review incompleta"}
              variant={summary.campaign.reviewReady ? "success" : "warning"}
            />
          </div>

          <div className="campaign-reporting-section">
            <div className="campaign-reporting-section__header">
              <div>
                <strong style={{ color: "#0f172a" }}>Stato operativo</strong>
                <p className="admin-record-row__note">
                  Queued, sent e failed descrivono il dispatch. Non misurano l&apos;engagement.
                </p>
              </div>
            </div>
            <div className="campaign-detail-metrics">
              {operationalMetrics.map((item) => (
                <article key={item.label} className="campaign-detail-metrics__item">
                  <span className="campaign-review-overview__label">{item.label}</span>
                  <strong>{item.value}</strong>
                  <p>{item.note}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="campaign-reporting-section">
            <div className="campaign-reporting-section__header">
              <div>
                <strong style={{ color: "#0f172a" }}>Eventi provider</strong>
                <p className="admin-record-row__note">
                  Delivered, opened, clicked, bounced, complained e unsubscribed arrivano solo da eventi provider.
                </p>
              </div>
              <StatusBadge
                label={summary.logs.providerEventsAvailable ? "Disponibili" : "Non disponibili"}
                variant={summary.logs.providerEventsAvailable ? "success" : "neutral"}
              />
            </div>
            <div className="campaign-provider-metrics">
              {providerMetrics.map((item) => (
                <article
                  key={item.label}
                  className="campaign-provider-metrics__item"
                  data-unavailable={!summary.logs.providerEventsAvailable}
                >
                  <span className="campaign-review-overview__label">{item.label}</span>
                  <strong>{getProviderMetricValue(item.value, summary.logs.providerEventsAvailable)}</strong>
                  <p>{getProviderMetricNote(summary.logs.providerEventsAvailable)}</p>
                </article>
              ))}
            </div>
            <p className="admin-record-row__note">
              {getProviderEventsLabel(summary.logs)}. {getProviderEventsDetail(summary.logs)}
            </p>
          </div>

          <dl className="admin-record-grid" style={{ marginTop: 16 }}>
            <div>
              <dt>Invio reale disponibile</dt>
              <dd>{summary.canSend ? "Si" : "No"}</dd>
            </div>
            <div>
              <dt>Contenuto</dt>
              <dd>{summary.campaign.contentReady ? "Pronto" : "Non pronto"}</dd>
            </div>
            <div>
              <dt>Destinatari</dt>
              <dd>{summary.campaign.contactsReady ? "Pronti" : "Non pronti"}</dd>
            </div>
            <div>
              <dt>Verifica</dt>
              <dd>{summary.campaign.reviewReady ? "Pronta" : "Non pronta"}</dd>
            </div>
            <div>
              <dt>Idonei</dt>
              <dd>{formatCampaignCount(summary.recipients.eligible)}</dd>
            </div>
            <div>
              <dt>Bloccati</dt>
              <dd>{formatCampaignCount(summary.recipients.blocked)}</dd>
            </div>
            <div>
              <dt>Invii oggi</dt>
              <dd>
                {summary.dailyUsed.toLocaleString("it-IT")} /{" "}
                {(summary.dailyLimit ?? campaign.dailyEmailLimit).toLocaleString("it-IT")}
              </dd>
            </div>
            <div>
              <dt>Invii periodo</dt>
              <dd>
                {summary.periodUsed.toLocaleString("it-IT")} /{" "}
                {(summary.periodLimit ?? campaign.periodEmailLimit).toLocaleString("it-IT")}
              </dd>
            </div>
            <div>
              <dt>Periodo</dt>
              <dd>
                {summary.periodStartedAt
                  ? `Avviato ${formatDateLabel(summary.periodStartedAt)}`
                  : "Periodo non ancora avviato"}
              </dd>
            </div>
            <div>
              <dt>Residuo oggi</dt>
              <dd>{(summary.dailyRemaining ?? 0).toLocaleString("it-IT")}</dd>
            </div>
            <div>
              <dt>Residuo periodo</dt>
              <dd>{(summary.periodRemaining ?? 0).toLocaleString("it-IT")}</dd>
            </div>
            <div>
              <dt>Runtime provider</dt>
              <dd>{summary.runtime.providerModeLabel}</dd>
            </div>
          </dl>

          {summary.blockedSends.latest.length > 0 ? (
            <div className="campaign-event-feed">
              <div className="campaign-reporting-section__header">
                <div>
                  <strong style={{ color: "#0f172a" }}>Eventi recenti</strong>
                  <p className="admin-record-row__note">
                    Ultimi blocchi o alert backend collegati a questa campagna.
                  </p>
                </div>
                <ShieldAlert aria-hidden="true" color="#2563eb" size={18} />
              </div>
              <div className="campaign-event-feed__list">
                {summary.blockedSends.latest.map((event) => (
                  <article key={event.id} className="campaign-event-feed__item">
                    <strong style={{ color: "#0f172a" }}>
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

          {blockingReasons.length > 0 ? (
            <div className="campaign-detail-notes">
              <strong style={{ color: "#0f172a" }}>Problemi da risolvere</strong>
              <ul className="admin-record-row__note" style={{ margin: 0 }}>
                {blockingReasons.map((reason) => (
                  <li key={`${reason.raw}-${reason.label}`}>{reason.label}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="admin-record-row__note" style={{ marginTop: 16 }}>
              Nessun problema bloccante rilevato nello stato attuale della campagna.
            </p>
          )}

          {warningReasons.length > 0 ? (
            <div className="campaign-detail-notes">
              <strong style={{ color: "#0f172a" }}>Controlli utili</strong>
              <ul className="admin-record-row__note" style={{ margin: 0 }}>
                {warningReasons.map((reason) => (
                  <li key={`${reason.raw}-${reason.label}`}>{reason.label}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

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
    </div>
  );
}
