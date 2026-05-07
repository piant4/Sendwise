import { StatusBadge } from "../ui/StatusBadge";
import type { ClientOverviewSummary } from "../../types";
import {
  formatLimitValue,
  getClientAccountVariant,
} from "./clientStatus";

interface ClientDashboardHeaderProps {
  summary: ClientOverviewSummary;
}

function getUsagePercentage(sent: number, limit: number) {
  if (limit <= 0) {
    return 0;
  }

  return Math.min((sent / limit) * 100, 100);
}

export function ClientDashboardHeader({
  summary,
}: ClientDashboardHeaderProps) {
  const usagePercentage = getUsagePercentage(
    summary.monthlyEmailsSent,
    summary.monthlyEmailLimit,
  );

  return (
    <section className="client-hero">
      <div className="client-hero__copy">
        <p className="client-hero__eyebrow">Vista cliente</p>
        <div className="client-hero__headline">
          <h2 className="client-hero__title">Monitoraggio essenziale dell&apos;account</h2>
          <p className="client-hero__lead">
            Stato account, campagne recenti, volumi email e blocchi visibili in
            una dashboard piu compatta della vista operativa interna.
          </p>
        </div>
        <div className="client-hero__status-row">
          <StatusBadge
            label={summary.accountStatus.label}
            variant={getClientAccountVariant(summary.accountStatus.status)}
          />
          <StatusBadge label="Accesso cliente" variant="neutral" />
        </div>
      </div>

      <div className="client-hero__meter">
        <div className="client-hero__meter-header">
          <span>Limite email mensile</span>
          <strong>{formatLimitValue(summary.monthlyEmailLimit)}</strong>
        </div>
        <div className="client-progress" aria-hidden="true">
          <div
            className="client-progress__fill"
            style={{ width: `${usagePercentage}%` }}
          />
        </div>
        <div className="client-hero__meter-footer">
          <span>{summary.monthlyEmailsSent.toLocaleString()} email inviate</span>
          <span>
            {summary.monthlyEmailLimit > 0
              ? `${Math.round(usagePercentage)}% del limite`
              : "Capienza disponibile in attesa di esposizione"}
          </span>
        </div>
      </div>
    </section>
  );
}
