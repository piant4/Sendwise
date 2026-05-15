import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AccessStateCard } from "../../../components/shared/AccessStateCard";
import { AccountWorkspace } from "../../../components/account/AccountWorkspace";
import { getAuthMe, isApiError } from "../../../lib/api";

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
  let authStateResult:
    | { authState: Awaited<ReturnType<typeof getAuthMe>> }
    | { error: unknown };

  try {
    authStateResult = { authState: await getAuthMe(accessToken) };
  } catch (error) {
    authStateResult = { error };
  }

  if ("error" in authStateResult) {
    if (
      isApiError(authStateResult.error) &&
      [401, 403].includes(authStateResult.error.status ?? 0)
    ) {
      redirect("/auth/redirect");
    }

    return (
      <AccessStateCard
        eyebrow="Account"
        title="Account non disponibile"
        message="Non e stato possibile verificare il tipo di accesso necessario per questa area."
        detail={
          authStateResult.error instanceof Error ? authStateResult.error.message : null
        }
        retryHref="/account"
      />
    );
  }

  const { authState } = authStateResult;

  if (authState.access_type === "client") {
    if (authState.status === "invited" || authState.onboarding_required) {
      redirect("/onboarding");
    }

    if (authState.portal_slug) {
      redirect(`/c/${authState.portal_slug}/account`);
    }

    redirect("/auth/redirect");
  }

  return (
    <AccountWorkspace
      authState={authState}
      backHref="/admin"
      backLabel="Torna alla dashboard admin"
      email={authState.email}
      personalName={null}
      companyName={null}
      profileEditSupported={false}
      title="Account piattaforma"
      description="Area account amministratore Sendwise. I dati amministratore sono gestiti da Clerk e la sicurezza resta nel pannello protetto."
    />
  );
}
