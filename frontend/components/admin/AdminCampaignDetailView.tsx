import { ChevronRight, FileText, PenSquare } from "lucide-react";
import Link from "next/link";
import type {
  AdminCampaignContactsSummary,
  AdminCampaignDetail,
  AdminCampaignReadinessSummary,
} from "../../types";
import {
  formatCampaignCount,
  getCampaignReadinessLabel,
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

export function AdminCampaignDetailView({
  campaign,
  summary,
  contacts,
}: AdminCampaignDetailViewProps) {
  const runtimeItems = summary ? getRuntimeSafetyItems(summary.runtime) : [];
  const reviewReasons = summary
    ? [...summary.blockingErrors, ...summary.warnings].map(getReadableBackendReason)
    : [];

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section className="admin-clients-card campaign-panel">
        <div
          className="admin-clients-card__intro"
          style={{ alignItems: "start", gap: 16, justifyContent: "space-between" }}
        >
          <div>
            <p className="admin-clients-card__description">
              {campaign.clientName} / {campaign.subject?.trim() || "Oggetto email non disponibile"}
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
                Modifica campagna
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
                ? `${formatCampaignCount(summary.recipients.total)} / ${formatCampaignCount(summary.recipients.eligible)} / ${formatCampaignCount(summary.recipients.blocked)}`
                : contacts
                  ? `${formatCampaignCount(contacts.total)} / ${formatCampaignCount(contacts.eligible)} / ${formatCampaignCount(contacts.blocked)}`
                  : "Non disponibili",
            },
            {
              label: "Aggiornata",
              value: formatDateLabel(campaign.updatedAt),
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
              label={getCampaignReadinessLabel(summary.campaign)}
              variant={summary.campaign.reviewReady ? "success" : "warning"}
            />
          </div>

          <dl className="admin-record-grid" style={{ marginTop: 16 }}>
            <div>
              <dt>Invio consentito</dt>
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
              <dt>Review</dt>
              <dd>{summary.campaign.reviewReady ? "Pronto" : "Non pronto"}</dd>
            </div>
            <div>
              <dt>Step operativo</dt>
              <dd>{getCampaignStepLabel(summary.campaign.currentStep)}</dd>
            </div>
            <div>
              <dt>Idonei</dt>
              <dd>{formatCampaignCount(summary.recipients.eligible)}</dd>
            </div>
            <div>
              <dt>Bloccati</dt>
              <dd>{formatCampaignCount(summary.recipients.blocked)}</dd>
            </div>
          </dl>

          <p className="admin-record-row__note" style={{ marginTop: 16 }}>
            {getProviderEventsLabel(summary.logs)}. {getProviderEventsDetail(summary.logs)}
          </p>

          {reviewReasons.length > 0 ? (
            <ul className="admin-record-row__note" style={{ marginTop: 12 }}>
              {reviewReasons.map((reason) => (
                <li key={`${reason.raw}-${reason.label}`}>
                  {reason.label}
                  {reason.isKnown ? "" : `: ${reason.raw}`}
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-record-row__note" style={{ marginTop: 12 }}>
              Nessun warning o errore bloccante restituito dall&apos;ultimo read model disponibile.
            </p>
          )}
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
