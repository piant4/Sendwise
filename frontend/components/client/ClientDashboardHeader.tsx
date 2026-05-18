import type { ClientOverviewSummary } from "../../types";

interface ClientDashboardHeaderProps {
  summary: ClientOverviewSummary;
}

const GENERIC_GREETING_NAMES = new Set(["cliente"]);

function extractFirstName(value: string | null | undefined): string | null {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  const [firstName] = normalized.split(/\s+/);
  return firstName?.trim() || null;
}

function getGreetingName(summary: ClientOverviewSummary): string {
  const dashboardName = extractFirstName(summary.clientDashboard?.greetingName);

  if (
    dashboardName &&
    !GENERIC_GREETING_NAMES.has(dashboardName.toLocaleLowerCase("it-IT"))
  ) {
    return dashboardName;
  }

  return extractFirstName(summary.client.name) ?? "cliente";
}

export function ClientDashboardHeader({ summary }: ClientDashboardHeaderProps) {
  return (
    <section className="client-hero client-dashboard-hero">
      <span className="client-surface__eyebrow">Dashboard</span>
      <div className="client-dashboard-hero__copy">
        <h1 className="client-hero__title">Bentornato, {getGreetingName(summary)}</h1>
      </div>
    </section>
  );
}
