import { auth } from "@clerk/nextjs/server";
import { AdminDashboard } from "../../components/dashboard/AdminDashboard";
import { DashboardErrorState } from "../../components/dashboard/DashboardErrorState";
import { getAdminOverviewSummary, isApiError } from "../../lib/api";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { getToken } = await auth();
  const result = await getAdminOverviewSummary(await getToken())
    .then((summary) => ({ summary }))
    .catch((error: unknown) => {
      if (isApiError(error) && [401, 403].includes(error.status ?? 0)) {
        redirect("/auth/redirect");
      }

      return {
        errorMessage:
          error instanceof Error ? error.message : "Unknown dashboard error",
      };
    });

  if ("errorMessage" in result) {
    return (
      <DashboardErrorState
        title="Dashboard admin"
        description="Panoramica operativa letta dal boundary API frontend."
        errorMessage={result.errorMessage}
      />
    );
  }

  return <AdminDashboard summary={result.summary} />;
}
