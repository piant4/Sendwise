import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { AdminCampaignSummary } from "../../types";
import {
  getCampaignSubjectDisplay,
  getCampaignStatusLabel,
  getCampaignStatusVariant,
} from "../shared/campaignUi";
import { formatDateTimeInRome } from "../shared/dateTime";
import { StatusBadge } from "../ui/StatusBadge";

interface AdminCampaignCompactCardProps {
  campaign: AdminCampaignSummary;
}

function formatDateLabel(value: string): string {
  return formatDateTimeInRome(value);
}

function getLightweightReadinessLabel(campaign: AdminCampaignSummary): string {
  if (campaign.status === "ready") {
    return "Stato pronto";
  }

  if (campaign.status === "running" || campaign.status === "completed") {
    return "Apri dettagli per readiness";
  }

  return "Da verificare";
}

export function AdminCampaignCompactCard({ campaign }: AdminCampaignCompactCardProps) {
  const readinessLabel = getLightweightReadinessLabel(campaign);
  const statusLabel = getCampaignStatusLabel(campaign.status);
  const blockedSendsLabel =
    campaign.blockedSendsCount > 0
      ? `${campaign.blockedSendsCount.toLocaleString("it-IT")} blocchi registrati`
      : "Nessun blocco registrato";

  return (
    <Link
      href={`/admin/campaigns/${campaign.id}`}
      className="admin-record-row campaign-record-link"
      aria-label={`Apri campagna ${campaign.name}`}
    >
      <div className="campaign-record-link__header">
        <div className="admin-record-row__copy campaign-record-link__copy">
          <strong className="campaign-record-link__title">{campaign.name}</strong>
          <span className="campaign-record-link__client">{campaign.clientName}</span>
          <span className="admin-record-row__note">
            {getCampaignSubjectDisplay(campaign.subject, "Oggetto email da definire")}
          </span>
        </div>
        <div className="campaign-record-link__actions">
          <StatusBadge
            label={statusLabel}
            variant={getCampaignStatusVariant(campaign.status)}
          />
          <span className="campaign-record-link__open">
            Apri
            <ChevronRight aria-hidden="true" className="admin-topbar-action__icon" />
          </span>
        </div>
      </div>

      <div className="campaign-record-link__summary">
        <div>
          <div className="admin-record-row__note">Readiness</div>
          <strong style={{ color: "var(--sw-olive)" }}>{readinessLabel}</strong>
        </div>
        <div>
          <div className="admin-record-row__note">Stato lista</div>
          <strong style={{ color: "var(--sw-olive)" }}>{statusLabel}</strong>
        </div>
        <div>
          <div className="admin-record-row__note">Segnali</div>
          <strong style={{ color: "var(--sw-olive)" }}>{blockedSendsLabel}</strong>
        </div>
        <div>
          <div className="admin-record-row__note">Aggiornata</div>
          <strong style={{ color: "var(--sw-olive)" }}>{formatDateLabel(campaign.updatedAt)}</strong>
        </div>
      </div>
    </Link>
  );
}
