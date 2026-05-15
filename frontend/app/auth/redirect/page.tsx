import { SignUp } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import {
  ApiError,
  getPostLoginRedirectPath,
  isApiError,
} from "../../../lib/api";
import { AccessStateCard } from "../../../components/shared/AccessStateCard";
import { BrandMark } from "../../../components/shared/BrandMark";

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
      return (
        <main className="login-page">
          <div className="login-page__glow login-page__glow--mint" />
          <div className="login-page__glow login-page__glow--aqua" />

          <div className="login-layout">
            <section className="login-stage">
              <BrandMark size="lg" />

              <div className="login-copy">
                <div className="login-pills">
                  <span className="login-pill">Invito cliente</span>
                  <span className="login-pill">Accesso protetto</span>
                </div>
                <h1 className="login-title">Completa il tuo invito Sendwise.</h1>
                <p className="login-lead">
                  Crea la password o accedi per continuare. Poi completerai il
                  profilo aziendale nel flusso di onboarding del portale cliente.
                </p>
              </div>

              <div className="login-note-grid">
                <article className="login-note-card">
                  <span className="login-note-card__label">Clerk</span>
                  <p className="login-note-card__text">
                    Password, verifica email e MFA restano nel flusso sicuro di Clerk.
                  </p>
                </article>
                <article className="login-note-card">
                  <span className="login-note-card__label">Sendwise</span>
                  <p className="login-note-card__text">
                    Dopo l&apos;accesso ti reindirizziamo all&apos;onboarding del
                    profilo cliente prima dell&apos;ingresso nel portale.
                  </p>
                </article>
                <article className="login-note-card">
                  <span className="login-note-card__label">Portale</span>
                  <p className="login-note-card__text">
                    L&apos;accesso finale resta verificato dal backend tramite /auth/me
                    e client_access.
                  </p>
                </article>
              </div>
            </section>

            <section className="login-card" data-step="credentials">
              <div className="login-card__header">
                <p className="login-card__eyebrow">Invito</p>
                <h2 className="login-card__title">Completa il tuo invito</h2>
                <p className="login-card__description">
                  Configura l&apos;accesso richiesto dall&apos;invito. Quando Clerk
                  completa la parte di sicurezza, Sendwise ti porta automaticamente
                  all&apos;onboarding cliente.
                </p>
              </div>

              <div className="px-7 pb-7">
                <SignUp
                  path="/auth/redirect"
                  routing="path"
                  signInUrl="/login"
                  forceRedirectUrl="/auth/redirect"
                  fallbackRedirectUrl="/auth/redirect"
                  signInForceRedirectUrl="/auth/redirect"
                  signInFallbackRedirectUrl="/auth/redirect"
                  appearance={{
                    elements: {
                      rootBox: "w-full",
                      card: "w-full border-0 bg-transparent p-0 shadow-none",
                      header: "hidden",
                      headerTitle: "hidden",
                      headerSubtitle: "hidden",
                      socialButtonsBlockButton: "hidden",
                      socialButtonsProviderIcon: "hidden",
                      dividerRow: "hidden",
                      formButtonPrimary:
                        "h-12 rounded-2xl bg-sky-600 text-sm font-semibold text-white shadow-[0_18px_32px_rgba(2,132,199,0.25)] hover:bg-sky-700",
                      formFieldInput:
                        "h-12 rounded-2xl border-slate-200 bg-slate-50 text-slate-950 placeholder:text-slate-400 focus:border-sky-400 focus:ring-sky-200",
                      formFieldLabel: "text-sm font-semibold text-slate-900",
                      formResendCodeLink: "text-sky-700 hover:text-sky-800",
                      footerActionLink: "text-sky-700 hover:text-sky-800",
                      identityPreviewText: "text-slate-500",
                      formFieldHintText: "text-slate-500",
                      alertText: "text-rose-700",
                    },
                  }}
                />
              </div>

              <div className="login-card__footer">
                <ShieldCheck aria-hidden="true" className="login-card__footer-icon" />
                <div className="login-card__support">
                  <strong>Accesso protetto</strong>
                  <span>Il profilo cliente verra completato subito dopo questo passaggio.</span>
                </div>
                <ShieldCheck aria-hidden="true" className="login-card__footer-accent" />
              </div>
            </section>
          </div>
        </main>
      );
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
