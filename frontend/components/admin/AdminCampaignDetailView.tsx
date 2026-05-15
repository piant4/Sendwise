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
      <section
        className="admin-clients-card"
        style={{
          background:
            "linear-gradient(180deg, rgba(248, 252, 255, 0.98), rgba(240, 247, 255, 0.94))",
          border: "1px solid rgba(59, 130, 246, 0.16)",
          boxShadow: "0 24px 60px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div
          className="admin-clients-card__intro"
          style={{ alignItems: "start", gap: 16, justifyContent: "space-between" }}
        >
          <div>
            <p className="admin-surface__eyebrow">Dettaglio campagna</p>
            <h2 className="admin-clients-card__title" style={{ color: "#0f172a" }}>
              {campaign.name}
            </h2>
            <p className="admin-clients-card__description">
              {campaign.clientName} / {campaign.subject?.trim() || "Oggetto email non disponibile"}
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
            <StatusBadge
              label={getCampaignStatusLabel(campaign.status)}
              variant={getCampaignStatusVariant(campaign.status)}
            />
            <Button
              asChild
              size="lg"
              className="admin-topbar-action admin-topbar-action--primary"
              style={{
                background: "linear-gradient(135deg, #2563eb, #0ea5e9)",
                border: "1px solid rgba(37, 99, 235, 0.18)",
                boxShadow: "0 16px 34px rgba(37, 99, 235, 0.24)",
                color: "#f8fbff",
              }}
            >
              <Link href={`/admin/campaigns/${campaign.campaignId}?mode=edit`}>
                <PenSquare aria-hidden="true" className="admin-topbar-action__icon" />
                Modifica campagna
              </Link>
            </Button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            marginTop: 20,
          }}
        >
          {[
            {
              label: "Readiness",
              value: summary
                ? getCampaignReadinessShortLabel(summary.campaign)
                : getCampaignReadinessShortLabel(campaign),
            },
            {
              label: "Step backend",
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
            <article
              key={item.label}
              style={{
                background: "rgba(255, 255, 255, 0.78)",
                border: "1px solid rgba(148, 163, 184, 0.22)",
                borderRadius: 18,
                display: "grid",
                gap: 6,
                padding: 16,
              }}
            >
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
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <article
            style={{
              background: "rgba(239, 246, 255, 0.62)",
              border: "1px solid rgba(96, 165, 250, 0.18)",
              borderRadius: 18,
              display: "grid",
              gap: 6,
              padding: 16,
            }}
          >
            <span className="admin-record-row__note">Oggetto email</span>
            <strong style={{ color: "#0f172a" }}>{campaign.subject?.trim() || "Non disponibile"}</strong>
          </article>
          <article
            style={{
              background: "rgba(239, 246, 255, 0.62)",
              border: "1px solid rgba(96, 165, 250, 0.18)",
              borderRadius: 18,
              display: "grid",
              gap: 6,
              padding: 16,
            }}
          >
            <span className="admin-record-row__note">Preview text</span>
            <strong style={{ color: "#0f172a" }}>{getExcerpt(campaign.previewText)}</strong>
          </article>
          <article
            style={{
              background: "rgba(239, 246, 255, 0.62)",
              border: "1px solid rgba(96, 165, 250, 0.18)",
              borderRadius: 18,
              display: "grid",
              gap: 6,
              padding: 16,
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
              background: "rgba(239, 246, 255, 0.62)",
              border: "1px solid rgba(96, 165, 250, 0.18)",
              borderRadius: 18,
              display: "grid",
              gap: 6,
              padding: 16,
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
              <p className="admin-clients-card__description">
                Stato backend, senza invio e senza metriche simulate.
              </p>
            </div>
            <StatusBadge
              label={getCampaignReadinessLabel(summary.campaign)}
              variant={summary.campaign.reviewReady ? "success" : "neutral"}
            />
          </div>

          <dl className="admin-record-grid" style={{ marginTop: 16 }}>
            <div>
              <dt>allowed_to_send</dt>
              <dd>{summary.canSend ? "true" : "false"}</dd>
            </div>
            <div>
              <dt>content_ready</dt>
              <dd>{summary.campaign.contentReady ? "true" : "false"}</dd>
            </div>
            <div>
              <dt>contacts_ready</dt>
              <dd>{summary.campaign.contactsReady ? "true" : "false"}</dd>
            </div>
            <div>
              <dt>review_ready</dt>
              <dd>{summary.campaign.reviewReady ? "true" : "false"}</dd>
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
