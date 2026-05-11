import { AdminBlockedSendsList } from "./AdminBlockedSendsList";
import { AdminProgressBar } from "./AdminProgressBar";
import type { AdminOverviewSummary } from "../../types";
import { AdminSurface } from "./AdminSurface";

interface AdminBlockedSendsCardProps {
  summary: AdminOverviewSummary;
}

export function AdminBlockedSendsCard({
  summary,
}: AdminBlockedSendsCardProps) {
  const recentCriticalEvents = summary.blocks.recentCriticalEvents;
  const blockedRatio =
    summary.campaigns.totalCampaigns > 0
      ? summary.blocks.blockedSendsToday / summary.campaigns.totalCampaigns
      : 0;
  const blockedItems = recentCriticalEvents.map((event) => ({
    id: event.id,
    clientId: event.clientId,
    clientName: event.clientName,
    clientEmail: event.clientEmail,
    campaignId: event.campaignId ?? null,
    campaignName: event.campaignName ?? null,
    reason: event.reason,
    decision: event.decision,
    createdAt: event.createdAt,
  }));

  return (
    <AdminSurface
      title="Eventi critici recenti"
      description="Eventi bloccanti letti da blocked_sends con contesto cliente e campagna."
      aside={
        <span className="admin-surface__eyebrow">
          {recentCriticalEvents.length.toLocaleString()} elementi
        </span>
      }
    >
      <div className="admin-progress-stack">
        <AdminProgressBar
          label="Blocchi oggi"
          valueLabel={summary.blocks.blockedSendsToday.toLocaleString()}
          ratio={Math.min(blockedRatio, 1)}
          helper="Indicatore rapportato al numero corrente di campagne registrate."
          tone="danger"
        />
      </div>

      {blockedItems.length > 0 ? (
        <AdminBlockedSendsList items={blockedItems} />
      ) : (
        <div className="admin-empty-state">
          Nessun evento critico recente trovato nei dati correnti.
        </div>
      )}
    </AdminSurface>
  );
}
