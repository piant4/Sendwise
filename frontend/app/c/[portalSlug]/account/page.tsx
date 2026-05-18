import { AccessStateCard } from "@/components/shared/AccessStateCard";
import { AccountWorkspace } from "@/components/account/AccountWorkspace";
import { getClientMe, isApiError } from "@/lib/api";
import { requireClientPortalRequest } from "../portalPageData";

export const dynamic = "force-dynamic";

function buildAccountErrorContent(error: unknown) {
  if (isApiError(error)) {
    if (error.status === 401 || error.status === 403) {
      return {
        title: "Account cliente non disponibile",
        message:
          "L'accesso cliente non puo essere confermato in questo momento. Riprova oppure verifica la sessione.",
        detail: error.detail,
      };
    }

    return {
      title: "Account cliente non disponibile",
      message:
        "Non e stato possibile caricare i dati account del portale cliente in questo momento.",
      detail: error.detail,
    };
  }

  return {
    title: "Account cliente non disponibile",
    message:
      "Non e stato possibile caricare i dati account del portale cliente in questo momento.",
    detail: error instanceof Error ? error.message : null,
  };
}

interface ClientAccountPageProps {
  params: Promise<{
    portalSlug: string;
  }>;
}

export default async function ClientAccountPage({
  params,
}: ClientAccountPageProps) {
  const { portalSlug } = await params;
  const { accessToken, authMe } = await requireClientPortalRequest(portalSlug);
  let clientContextResult:
    | { clientContext: Awaited<ReturnType<typeof getClientMe>> }
    | { error: unknown };

  try {
    clientContextResult = { clientContext: await getClientMe(accessToken) };
  } catch (error) {
    clientContextResult = { error };
  }

  if ("error" in clientContextResult) {
    const content = buildAccountErrorContent(clientContextResult.error);

    return (
      <AccessStateCard
        eyebrow="Account cliente"
        title={content.title}
        message={content.message}
        detail={content.detail}
        retryHref={`/c/${portalSlug}/account`}
      />
    );
  }

  const { clientContext } = clientContextResult;

  return (
    <AccountWorkspace
      authState={authMe}
      backHref={`/c/${portalSlug}`}
      backLabel="Torna alla dashboard"
      email={clientContext.user.email || authMe.email}
      personalName={clientContext.client.personal_name}
      companyName={null}
      profileEditSupported={false}
      title="Account cliente"
      description="Gestisci i dati visibili del tuo account cliente Sendwise senza uscire dal portale. Password, email verificata e MFA restano in Clerk."
    />
  );
}
