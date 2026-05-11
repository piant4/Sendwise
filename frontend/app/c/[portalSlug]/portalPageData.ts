import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getAuthMe,
  isApiError,
  type AuthMeResponse,
} from "../../../lib/api";

export interface ClientPortalRequestContext {
  accessToken: string | null;
  authMe: AuthMeResponse;
  portalSlug: string;
}

export async function requireClientPortalRequest(
  portalSlug: string,
): Promise<ClientPortalRequestContext> {
  const { getToken } = await auth();
  const accessToken = await getToken();

  let authMe: AuthMeResponse;

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

  return {
    accessToken,
    authMe,
    portalSlug,
  };
}
