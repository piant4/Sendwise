import { AdminDashboard } from "../../components/dashboard/AdminDashboard";
import { DashboardErrorState } from "../../components/dashboard/DashboardErrorState";
import { getAdminOverviewSummary, USE_MOCK_API } from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const result = await getAdminOverviewSummary()
    .then((summary) => ({ summary }))
    .catch((error: unknown) => ({
      errorMessage:
        error instanceof Error ? error.message : "Unknown dashboard error",
    }));

  if ("errorMessage" in result) {
    return (
      <DashboardErrorState
        title="Dashboard admin"
        description="Panoramica operativa letta dal boundary API frontend."
        errorMessage={result.errorMessage}
      />
    );
  }

  return <AdminDashboard summary={result.summary} isMockMode={USE_MOCK_API} />;
}
