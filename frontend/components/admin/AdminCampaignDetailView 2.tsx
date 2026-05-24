import { ChevronRight, FileText, PenSquare } from "lucide-react";
import Link from "next/link";
import type {
  AdminCampaignContactsSummary,
  AdminCampaignDetail,
  AdminCampaignReadinessSummary,
} from "../../types";
import {
  dedupeReviewReasons,
  formatCampaignCount,
  getCampaignReadinessShortLabel,
  getCampaignStatusLabel,
  getCampaignStatusVariant,
  getProviderEventsDetail,
  getProviderEventsLabel,
  getReadableBackendReason,
  getRuntimeSafetyItems,
  getCampaignStepLabel,
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

function formatProviderMetric(value: number | null, available: boolean): string {
  if (!available || typeof value !== "number") {
    return "Non disponibili";
  }

  return value.toLocaleString("it-IT");
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
  const operationalCounts = summary
    ? [
        {
          label: "Accettate",
          value: formatCampaignCount(summary.logs.sent ?? 0),
          note: "Accettate dal sistema di invio",
        },
        {
          label: "Preparate / in coda",
          value: formatCampaignCount(summary.logs.queued),
          note: "Preparate ma non ancora accettate",
        },
        {
          label: "Destinatari idonei",
          value: formatCampaignCount(summary.recipients.eligible),
          note: "Base pronta per l'invio",
        },
        {
          label: "Destinatari bloccati",
          value: formatCampaignCount(summary.recipients.blocked),
          note: "Esclusi dall'invio reale",
        },
      ]
    : [];

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section className="admin-clients-card campaign-panel">
        <div
          className="admin-clients-card__intro"
          style={{ alignItems: "start", gap: 16, justifyContent: "space-between" }}
        >
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

        <div
          className="campaign-inline-summary"
          style={{ marginTop: 18 }}
        >
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
              value: summary
                ? `${formatCampaignCount(summary.recipients.total)} totali · ${formatCampaignCount(summary.recipients.eligible)} idonei · ${formatCampaignCount(summary.recipients.blocked)} bloccati`
                : contacts
                  ? `${formatCampaignCount(contacts.total)} totali · ${formatCampaignCount(contacts.eligible)} idonei · ${formatCampaignCount(contacts.blocked)} bloccati`
                  : "Non disponibili",
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
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <article
            style={{
              background: "rgba(248, 250, 252, 0.94)",
              border: "1px solid rgba(226, 232, 240, 0.94)",
              borderRadius: 14,
              display: "grid",
              gap: 6,
              padding: 14,
            }}
          >
            <span className="admin-record-row__note">Oggetto email</span>
            <strong style={{ color: "#0f172a" }}>{campaign.subject?.trim() || "Non disponibile"}</strong>
          </article>
          <article
            style={{
              background: "rgba(248, 250, 252, 0.94)",
              border: "1px solid rgba(226, 232, 240, 0.94)",
              borderRadius: 14,
              display: "grid",
              gap: 6,
              padding: 14,
            }}
          >
            <span className="admin-record-row__note">Anteprima email</span>
            <strong style={{ color: "#0f172a" }}>{getExcerpt(campaign.previewText)}</strong>
          </article>
          <article
            style={{
              background: "rgba(248, 250, 252, 0.94)",
              border: "1px solid rgba(226, 232, 240, 0.94)",
              borderRadius: 14,
              display: "grid",
              gap: 6,
              padding: 14,
            }}
          >
            <span className="admin-record-row__note">HTML email</span>
            <strong style={{ color: "#0f172a" }}>
              {campaign.bodyHtml?.trim() ? "Contenuto presente" : "Da completare"}
            </strong>
            <span>{getExcerpt(campaign.bodyHtml)}</span>
          </article>
          <article
            style={{
              background: "rgba(248, 250, 252, 0.94)",
              border: "1px solid rgba(226, 232, 240, 0.94)",
              borderRadius: 14,
              display: "grid",
              gap: 6,
              padding: 14,
            }}
          >
            <span className="admin-record-row__note">Testo semplice</span>
            <strong style={{ color: "#0f172a" }}>
              {campaign.bodyText?.trim() ? "Contenuto presente" : "Da completare"}
            </strong>
            <span>{getExcerpt(campaign.bodyText)}</span>
          </article>
        </div>
      </section>

      {summary ? (
        <section className="admin-clients-card">
          <div className="admin-clients-card__intro">
            <div>
              <p className="admin-surface__eyebrow">Verifica finale</p>
              <h2 className="admin-clients-card__title" style={{ color: "#0f172a" }}>
                Sintesi operativa
              </h2>
            </div>
            <StatusBadge
              label={summary.campaign.reviewReady ? "Pronta" : "Non pronta"}
              variant={summary.campaign.reviewReady ? "success" : "warning"}
            />
          </div>

          <div className="campaign-detail-metrics" style={{ marginTop: 16 }}>
            {operationalCounts.map((item) => (
              <article key={item.label} className="campaign-detail-metrics__item">
                <span className="campaign-review-overview__label">{item.label}</span>
                <strong>{item.value}</strong>
                <p>{item.note}</p>
              </article>
            ))}
          </div>

          <dl className="admin-record-grid" style={{ marginTop: 16 }}>
            <div>
              <dt>Invio reale disponibile</dt>
              <dd>{summary.canSend ? "Sì" : "No"}</dd>
            </div>
            <div>
              <dt>Contenuto</dt>
              <dd>{summary.campaign.contentReady ? "Pronto" : "Non pronto"}</dd>
            </div>
            <div>
              <dt>Destinatari</dt>
              <dd>{summary.campaign.contactsReady ? "Pronto" : "Non pronto"}</dd>
            </div>
            <div>
              <dt>Verifica</dt>
              <dd>{summary.campaign.reviewReady ? "Pronto" : "Non pronto"}</dd>
            </div>
            <div>
              <dt>Step attuale</dt>
              <dd>{getCampaignStepLabel(summary.campaign.currentStep)}</dd>
            </div>
            <div>
              <dt>Idonei</dt>
              <dd>{formatCampaignCount(summary.recipients.eligible)}</dd>
            </div>
            <div>
              <dt>Preparate / in coda</dt>
              <dd>{formatCampaignCount(summary.logs.queued)}</dd>
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
          </dl>

          <p className="admin-record-row__note" style={{ marginTop: 16 }}>
            Accettate dal sistema di invio: {formatCampaignCount(summary.logs.sent ?? 0)}. Questo valore non indica la consegna in inbox.
          </p>

          <div className="campaign-provider-metrics" style={{ marginTop: 16 }}>
            {[
              { label: "Consegnate", value: summary.logs.delivered },
              { label: "Aperte", value: summary.logs.opened },
              { label: "Clic", value: summary.logs.clicked },
              { label: "Bounce", value: summary.logs.bounced },
              { label: "Reclami", value: summary.logs.complained },
              { label: "Disiscrizioni", value: summary.logs.unsubscribed },
            ].map((item) => (
              <article key={item.label} className="campaign-provider-metrics__item">
                <span className="admin-record-row__note">{item.label}</span>
                <strong style={{ color: "#0f172a" }}>
                  {formatProviderMetric(item.value, summary.logs.providerEventsAvailable)}
                </strong>
                <span className="admin-record-row__note">
                  {summary.logs.providerEventsAvailable
                    ? "Eventi provider processati"
                    : "Non disponibili finché non arrivano eventi provider"}
                </span>
              </article>
            ))}
          </div>

          <p className="admin-record-row__note" style={{ marginTop: 12 }}>
            {getProviderEventsLabel(summary.logs)}. {getProviderEventsDetail(summary.logs)}
          </p>

          {blockingReasons.length > 0 ? (
            <>
              <p className="admin-record-row__note" style={{ marginTop: 12 }}>
                Problemi da risolvere
              </p>
              <ul className="admin-record-row__note" style={{ marginTop: 0 }}>
                {blockingReasons.map((reason) => (
                  <li key={`${reason.raw}-${reason.label}`}>
                    {reason.label}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="admin-record-row__note" style={{ marginTop: 12 }}>
              Nessun problema bloccante rilevato nello stato attuale della campagna.
            </p>
          )}

          {warningReasons.length > 0 ? (
            <>
              <p className="admin-record-row__note" style={{ marginTop: 12 }}>
                Controlli utili
              </p>
              <ul className="admin-record-row__note" style={{ marginTop: 0 }}>
                {warningReasons.map((reason) => (
                  <li key={`${reason.raw}-${reason.label}`}>
                    {reason.label}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}

      <details className="admin-clients-card">
        <summary style={{ alignItems: "center", color: "#2563eb", cursor: "pointer", display: "inline-flex", fontWeight: 700, gap: 8 }}>
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
