import { DashboardErrorState } from "../../../components/dashboard/DashboardErrorState";
import { buildPageMetadata } from "../../../components/shared/metadata";
import { ClientDashboardAnalyticsSection } from "../../../components/client/ClientDashboardAnalyticsSection";
import { ClientDashboardHeader } from "../../../components/client/ClientDashboardHeader";
import { getClientOverviewSummary } from "../../../lib/api";
import { requireClientPortalRequest } from "./portalPageData";

export const dynamic = "force-dynamic";
export const metadata = buildPageMetadata("Dashboard");

interface ClientPortalPageProps {
  params: Promise<{
    portalSlug: string;
  }>;
}

export default async function ClientPortalPage({
  params,
}: ClientPortalPageProps) {
  const { portalSlug } = await params;
  const { accessToken } = await requireClientPortalRequest(portalSlug);

  const result = await getClientOverviewSummary(accessToken)
    .then((summary) => ({ summary }))
    .catch((error: unknown) => ({
      errorMessage:
        error instanceof Error ? error.message : "Unknown dashboard error",
    }));

  if ("errorMessage" in result) {
    return (
      <DashboardErrorState
        title="Dashboard"
        description="Riepilogo operativo del cliente basato sui dati applicativi."
        errorMessage={result.errorMessage}
      />
    );
  }

  return (
    <main className="shell">
      <section className="client-dashboard">
        <ClientDashboardHeader summary={result.summary} />
        <ClientDashboardAnalyticsSection summary={result.summary} />
      </section>
    </main>
  );
}
