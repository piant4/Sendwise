import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ClientDashboard } from "../../../components/dashboard/ClientDashboard";
import { DashboardErrorState } from "../../../components/dashboard/DashboardErrorState";
import { getAuthMe, getClientOverviewSummary, isApiError } from "../../../lib/api";

export const dynamic = "force-dynamic";

interface ClientPortalPageProps {
  params: Promise<{
    portalSlug: string;
  }>;
}

export default async function ClientPortalPage({
  params,
}: ClientPortalPageProps) {
  const { getToken } = await auth();
  const { portalSlug } = await params;
  const accessToken = await getToken();

  let authMe;

  try {
    authMe = await getAuthMe(accessToken);
  } catch (error) {
    if (isApiError(error) && [401, 403].includes(error.status ?? 0)) {
      redirect("/auth/redirect");
    }

    redirect("/login");
  }

  if (authMe.access_type !== "client") {
    redirect("/login");
  }

  if (authMe.status === "invited" || authMe.onboarding_required) {
    redirect("/onboarding");
  }

  if (!authMe.portal_slug || authMe.portal_slug !== portalSlug) {
    redirect("/auth/redirect");
  }

  const result = await getClientOverviewSummary(accessToken)
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
