import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type {
  AdminCampaignReadinessSummary,
  AdminCampaignSummary,
} from "../../types";
import {
  formatCampaignCount,
  getCampaignReadinessShortLabel,
  getCampaignStatusLabel,
  getCampaignStatusVariant,
} from "../shared/campaignUi";
import { formatDateTimeInRome } from "../shared/dateTime";
import { StatusBadge } from "../ui/StatusBadge";

interface AdminCampaignCompactCardProps {
  campaign: AdminCampaignSummary;
  readiness?: AdminCampaignReadinessSummary | Error;
}

function formatDateLabel(value: string): string {
  return formatDateTimeInRome(value);
}

export function AdminCampaignCompactCard({
  campaign,
  readiness,
}: AdminCampaignCompactCardProps) {
  const recipients = readiness instanceof Error || !readiness ? null : readiness.recipients;
  const readinessLabel =
    readiness instanceof Error || !readiness
      ? "Verifica non disponibile"
      : getCampaignReadinessShortLabel(readiness.campaign);

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
        </div>
        <div className="campaign-record-link__actions">
          <StatusBadge
            label={getCampaignStatusLabel(campaign.status)}
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
          <strong style={{ color: "#0f172a" }}>{readinessLabel}</strong>
        </div>
        <div>
          <div className="admin-record-row__note">Destinatari</div>
          <strong style={{ color: "#0f172a" }}>
            {recipients
              ? `${formatCampaignCount(recipients.total)} totali / ${formatCampaignCount(recipients.eligible)} idonei`
              : "Conteggi non disponibili"}
          </strong>
        </div>
        <div>
          <div className="admin-record-row__note">Aggiornata</div>
          <strong style={{ color: "#0f172a" }}>{formatDateLabel(campaign.updatedAt)}</strong>
        </div>
      </div>
    </Link>
  );
}
