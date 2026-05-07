import { ClientDashboard } from "../../components/dashboard/ClientDashboard";
import { DashboardErrorState } from "../../components/dashboard/DashboardErrorState";
import { getClientOverviewSummary } from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function ClientPage() {
  const result = await getClientOverviewSummary()
    .then((summary) => ({ summary }))
    .catch((error: unknown) => ({
      errorMessage:
        error instanceof Error ? error.message : "Unknown dashboard error",
    }));

  if ("errorMessage" in result) {
    return (
      <DashboardErrorState
        title="Dashboard cliente"
        description="Vista cliente letta dal boundary API frontend."
        errorMessage={result.errorMessage}
      />
    );
  }

  return <ClientDashboard summary={result.summary} />;
}
