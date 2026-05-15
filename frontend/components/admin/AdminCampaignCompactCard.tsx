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
import { Button } from "../ui/button";
import { StatusBadge } from "../ui/StatusBadge";

interface AdminCampaignCompactCardProps {
  campaign: AdminCampaignSummary;
  readiness?: AdminCampaignReadinessSummary | Error;
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
    <article className="admin-record-row">
      <div
        style={{
          alignItems: "start",
          display: "flex",
          gap: 16,
          justifyContent: "space-between",
        }}
      >
        <div className="admin-record-row__copy" style={{ gap: 8 }}>
          <strong style={{ color: "#0f172a", fontSize: "1.05rem" }}>{campaign.name}</strong>
          <span>
            {campaign.clientName} / {campaign.clientEmail}
          </span>
        </div>
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <StatusBadge
            label={getCampaignStatusLabel(campaign.status)}
            variant={getCampaignStatusVariant(campaign.status)}
          />
          <Button
            asChild
            variant="outline"
            size="sm"
            className="admin-topbar-action campaign-action campaign-action--secondary"
          >
            <Link href={`/admin/campaigns/${campaign.id}`}>
              Apri
              <ChevronRight aria-hidden="true" className="admin-topbar-action__icon" />
            </Link>
          </Button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          marginTop: 14,
        }}
      >
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
    </article>
  );
}
