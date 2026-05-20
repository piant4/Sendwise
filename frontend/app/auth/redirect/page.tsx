import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  ApiError,
  getPostLoginRedirectPath,
  isApiError,
} from "../../../lib/api";
import { AccessStateCard } from "../../../components/shared/AccessStateCard";
import { buildPageMetadata } from "../../../components/shared/metadata";
import { ClientInviteActivationForm } from "../../../components/auth/ClientInviteActivationForm";

export const metadata = buildPageMetadata("Login");

function sanitizeAccessErrorDetail(error: ApiError): string {
  if (
    error.detail.includes("Authenticated Clerk user is not mapped to a Sendwise user.")
  ) {
    return "L'account autenticato non e ancora associato a un accesso Sendwise valido.";
  }

  if (error.detail.includes("Client access is not available for this Sendwise account.")) {
    return "L'accesso cliente Sendwise e stato revocato, sospeso o archiviato.";
  }

  if (error.detail.includes("Missing Clerk session token")) {
    return "Sessione Clerk non disponibile per la verifica dell'accesso.";
  }

  return error.detail;
}

function buildAccessErrorContent(error: unknown) {
  if (isApiError(error)) {
    if (error.isNetworkError) {
      return {
        title: "Verifica accesso non disponibile",
        message:
          "Non e stato possibile raggiungere il backend Sendwise per completare la verifica dell'accesso.",
        detail: sanitizeAccessErrorDetail(error),
      };
    }

    if (error.status === 401 || error.status === 403) {
      return {
        title: "Accesso non disponibile",
        message:
          "L'account potrebbe non essere ancora stato associato a Sendwise oppure l'accesso cliente non e disponibile.",
        detail: sanitizeAccessErrorDetail(error),
      };
    }

    return {
      title: "Verifica accesso non disponibile",
      message:
        "Non e stato possibile completare la verifica dell'accesso. Riprova tra poco o contatta il team Sendwise.",
      detail: sanitizeAccessErrorDetail(error),
    };
  }

  return {
    title: "Verifica accesso non disponibile",
    message:
      "Non e stato possibile completare la verifica dell'accesso. Riprova tra poco o contatta il team Sendwise.",
    detail: error instanceof Error ? error.message : null,
  };
}

interface AuthRedirectPageProps {
  searchParams: Promise<{
    __clerk_ticket?: string;
  }>;
}

export default async function AuthRedirectPage({
  searchParams,
}: AuthRedirectPageProps) {
  const { getToken, userId } = await auth();
  const { __clerk_ticket: clerkTicket } = await searchParams;

  if (!userId) {
    if (clerkTicket) {
      return <ClientInviteActivationForm ticket={clerkTicket} />;
    }

    redirect("/login");
  }

  let destinationPath: string;

  try {
    destinationPath = await getPostLoginRedirectPath(await getToken());
  } catch (error) {
    const content = buildAccessErrorContent(error);

    return (
      <AccessStateCard
        eyebrow="Accesso"
        title={content.title}
        message={content.message}
        detail={content.detail}
        retryHref="/auth/redirect"
      />
    );
  }

  redirect(destinationPath);
}
