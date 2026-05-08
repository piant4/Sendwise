import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  ApiError,
  getPostLoginRedirectPath,
  isApiError,
} from "../../../lib/api";
import { AccessStateCard } from "../../../components/shared/AccessStateCard";

function sanitizeAccessErrorDetail(error: ApiError): string {
  if (
    error.detail.includes("Authenticated Clerk user is not mapped to a Sendwise user.")
  ) {
    return "L'account autenticato non e ancora associato a un accesso Sendwise valido.";
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
          "L'account potrebbe non essere ancora stato associato a Sendwise oppure l'invito non e stato completato.",
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

export default async function AuthRedirectPage() {
  const { getToken, userId } = await auth();

  if (!userId) {
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
