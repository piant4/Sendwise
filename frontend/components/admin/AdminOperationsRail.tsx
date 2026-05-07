import { StatusBadge } from "../ui/StatusBadge";
import type { AdminOverviewSummary, AdminSystemStatus } from "../../types";
import { AdminSurface } from "./AdminSurface";

interface AdminOperationsRailProps {
  summary: AdminOverviewSummary;
}

const systemStatusLabels: Record<keyof AdminSystemStatus, string> = {
  api: "API frontend",
  mockData: "Origine dati",
  sending: "Invio",
  mailpit: "Mailpit",
};

const systemStatusCopy: Record<
  AdminSystemStatus[keyof AdminSystemStatus],
  string
> = {
  ok: "Operativo",
  warning: "Attenzione",
  enabled: "Locale",
  disabled: "Disattivato",
  dev_only: "Solo sviluppo",
};

function getSystemStatusVariant(
  value: AdminSystemStatus[keyof AdminSystemStatus],
) {
  if (value === "warning") {
    return "warning" as const;
  }

  if (value === "disabled") {
    return "neutral" as const;
  }

  return "success" as const;
}

function getPercentage(value: number, limit: number): number {
  if (limit <= 0) {
    return 0;
  }

  return Math.min((value / limit) * 100, 100);
}

export function AdminOperationsRail({
  summary,
}: AdminOperationsRailProps) {
  const clientRows = [
    { label: "Attivi", value: summary.clientStatusCounts.active },
    { label: "In verifica", value: summary.clientStatusCounts.trial },
    { label: "In pausa", value: summary.clientStatusCounts.paused },
    { label: "Bloccati", value: summary.clientStatusCounts.blocked },
  ];

  const limitRows = [
    {
      label: "Mensile",
      value: summary.emailLimitOverview.monthlySent,
      limit: summary.emailLimitOverview.monthlyLimit,
    },
    {
      label: "Giornaliero",
      value: summary.emailLimitOverview.dailySent,
      limit: summary.emailLimitOverview.dailyLimit,
    },
  ];

  return (
    <div className="admin-rail">
      <AdminSurface
        title="Portafoglio clienti"
        description="Distribuzione degli account esposti dal riepilogo admin."
      >
        <div className="admin-metric-list">
          {clientRows.map((row) => (
            <div key={row.label} className="admin-metric-item">
              <span>{row.label}</span>
              <strong>{row.value.toLocaleString()}</strong>
            </div>
          ))}
        </div>
      </AdminSurface>

      <AdminSurface
        title="Capacita email"
        description="Saturazione mostrata solo per i limiti disponibili."
      >
        <div className="admin-progress-stack">
          {limitRows.map((row) => (
            <div key={row.label} className="admin-progress-block">
              <div className="admin-progress-block__header">
                <span>{row.label}</span>
                <strong>
                  {row.limit > 0
                    ? `${row.value.toLocaleString()} / ${row.limit.toLocaleString()}`
                    : "Non disponibile"}
                </strong>
              </div>
              <div className="admin-progress">
                <div
                  className="admin-progress__fill"
                  style={{ width: `${getPercentage(row.value, row.limit)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </AdminSurface>

      <AdminSurface
        title="Stato sistema"
        description="Quadro compatto dei servizi esposti in questa milestone."
      >
        <div className="admin-system-list">
          {(
            Object.entries(summary.systemStatus) as [
              keyof AdminSystemStatus,
              AdminSystemStatus[keyof AdminSystemStatus],
            ][]
          ).map(([key, value]) => (
            <div key={key} className="admin-system-item">
              <span>{systemStatusLabels[key]}</span>
              <StatusBadge
                label={systemStatusCopy[value]}
                variant={getSystemStatusVariant(value)}
              />
            </div>
          ))}
        </div>
      </AdminSurface>
    </div>
  );
}
