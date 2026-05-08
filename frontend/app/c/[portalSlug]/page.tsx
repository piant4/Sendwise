import { redirect } from "next/navigation";
import { ClientDashboard } from "../../../components/dashboard/ClientDashboard";
import { DashboardErrorState } from "../../../components/dashboard/DashboardErrorState";
import { getAuthMe, getClientOverviewSummary } from "../../../lib/api";

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

  let authMe;

  try {
    authMe = await getAuthMe();
  } catch {
    redirect("/login");
  }

  if (
    authMe.access_type !== "client" ||
    !authMe.portal_slug ||
    authMe.portal_slug !== portalSlug
  ) {
    redirect("/login");
  }

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
