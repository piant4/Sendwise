import { ClientDashboard } from "../../../components/dashboard/ClientDashboard";
import { DashboardErrorState } from "../../../components/dashboard/DashboardErrorState";
import { getClientOverviewSummary } from "../../../lib/api";
import { requireClientPortalRequest } from "./portalPageData";

export const dynamic = "force-dynamic";

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

  return <ClientDashboard summary={result.summary} />;
}
