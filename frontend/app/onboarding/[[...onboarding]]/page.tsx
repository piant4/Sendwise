import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { AccessStateCard } from "../../../components/shared/AccessStateCard";
import { ClientOnboardingForm } from "../../../components/shared/ClientOnboardingForm";
import { getAuthMe, isApiError } from "../../../lib/api";

export const dynamic = "force-dynamic";

function buildOnboardingErrorContent(error: unknown) {
  if (isApiError(error)) {
    if (error.status === 401 || error.status === 403) {
      return {
        title: "Accesso cliente non disponibile",
        message:
          "L'account autenticato non risulta associato a un invito cliente valido oppure l'accesso non e piu disponibile.",
        detail: error.detail,
      };
    }

    return {
      title: "Onboarding non disponibile",
      message:
        "Non e stato possibile verificare lo stato dell'onboarding in questo momento.",
      detail: error.detail,
    };
  }

  return {
    title: "Onboarding non disponibile",
    message:
      "Non e stato possibile verificare lo stato dell'onboarding in questo momento.",
    detail: error instanceof Error ? error.message : null,
  };
}

export default async function OnboardingPage() {
  const { getToken, userId } = await auth();

  if (!userId) {
    redirect("/login");
  }

  let authResult:
    | { authMe: Awaited<ReturnType<typeof getAuthMe>> }
    | {
        error: unknown;
      };

  try {
    authResult = { authMe: await getAuthMe(await getToken()) };
  } catch (error) {
    authResult = { error };
  }

  if ("error" in authResult) {
    const content = buildOnboardingErrorContent(authResult.error);

    return (
      <AccessStateCard
        eyebrow="Onboarding"
        title={content.title}
        message={content.message}
        detail={content.detail}
        retryHref="/onboarding"
      />
    );
  }

  if (authResult.authMe.access_type !== "client") {
    return (
      <AccessStateCard
        eyebrow="Accesso"
        title="Accesso cliente non disponibile"
        message="Questo account autenticato non dispone di un accesso cliente Sendwise da completare."
        retryHref="/onboarding"
      />
    );
  }

  if (
    authResult.authMe.status === "active" &&
    !authResult.authMe.onboarding_required
  ) {
    redirect("/auth/redirect");
  }

  return <ClientOnboardingForm authMe={authResult.authMe} />;
}
