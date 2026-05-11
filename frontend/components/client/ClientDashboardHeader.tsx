import { StatusBadge } from "../ui/StatusBadge";
import type { ClientOverviewSummary } from "../../types";
import {
  formatOptionalLimit,
  getClientAccessStatusLabel,
  getClientAccountVariant,
  getClientStatusLabel,
} from "./clientStatus";

interface ClientDashboardHeaderProps {
  summary: ClientOverviewSummary;
}

export function ClientDashboardHeader({
  summary,
}: ClientDashboardHeaderProps) {
  return (
    <section className="client-hero">
      <div className="client-hero__copy">
        <p className="client-hero__eyebrow">Portale cliente</p>
        <div className="client-hero__headline">
          <h2 className="client-hero__title">{summary.client.name}</h2>
          <p className="client-hero__lead">
            {summary.client.email} · slug portale {summary.client.portalSlug}
          </p>
        </div>
        <div className="client-hero__status-row">
          <StatusBadge
            label={getClientStatusLabel(summary.client.clientStatus)}
            variant={getClientAccountVariant(summary.client.clientStatus)}
          />
          <StatusBadge
            label={getClientAccessStatusLabel(summary.client.accessStatus)}
            variant="neutral"
          />
        </div>
      </div>

      <div className="client-hero__meter">
        <div className="client-hero__meter-header">
          <span>Limiti correnti</span>
          <strong>{formatOptionalLimit(summary.limits.emailLimitPerCampaign)}</strong>
        </div>
        <div className="client-progress" aria-hidden="true">
          <div
            className="client-progress__fill"
            style={{
              width: summary.campaigns.totalCampaigns > 0 ? "100%" : "18%",
            }}
          />
        </div>
        <div className="client-hero__meter-footer">
          <span>
            {summary.campaigns.totalCampaigns.toLocaleString()} campagne visibili
          </span>
          <span>
            max campagne {formatOptionalLimit(summary.limits.maxCampaigns)}
          </span>
        </div>
      </div>
    </section>
  );
}
