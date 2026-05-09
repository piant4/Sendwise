import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AccountOverviewPanel } from "../../../components/shared/AccountOverviewPanel";
import { getAuthMe, type AuthMeResponse } from "../../../lib/api";

interface AccountPageProps {
  params: Promise<{
    account?: string[];
  }>;
}

export default async function AccountPage({ params }: AccountPageProps) {
  const { getToken, userId } = await auth();
  const { account: accountSegments = [] } = await params;

  if (!userId) {
    redirect("/login");
  }

  if (accountSegments.length > 0) {
    redirect("/account");
  }

  const accessToken = await getToken();

  let backHref = "/auth/redirect";
  let authState: AuthMeResponse | null = null;

  try {
    authState = await getAuthMe(accessToken);

    if (authState.access_type === "platform_admin") {
      backHref = "/admin";
    } else if (
      authState.status === "active" &&
      !authState.onboarding_required &&
      authState.portal_slug
    ) {
      backHref = `/c/${authState.portal_slug}`;
    }
  } catch {
    backHref = "/auth/redirect";
  }

  return (
    <main className="account-page">
      <div className="account-page__glow account-page__glow--mint" />
      <div className="account-page__glow account-page__glow--aqua" />

      <div className="account-layout">
        <AccountOverviewPanel
          authState={authState}
          backHref={backHref}
        />
      </div>
    </main>
  );
}
