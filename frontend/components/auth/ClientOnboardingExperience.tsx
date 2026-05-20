"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/shared/BrandMark";
import {
  completeClientOnboarding,
  isApiError,
  type AuthMeResponse,
} from "@/lib/api";

interface ClientOnboardingExperienceProps {
  authMe: AuthMeResponse;
}

function getSafeOnboardingErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.status === 401 || error.status === 403) {
      return "Non e stato possibile associare questo account a un accesso cliente Sendwise.";
    }

    if (error.status === 422) {
      return "Inserisci il nome personale richiesto prima di continuare.";
    }

    if (error.status && error.status >= 500) {
      return "Il servizio di onboarding non e disponibile in questo momento. Riprova tra poco.";
    }
  }

  return "Non e stato possibile completare l'onboarding. Riprova.";
}

export function ClientOnboardingExperience({
  authMe,
}: ClientOnboardingExperienceProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const { isLoaded, isSignedIn, user } = useUser();
  const [firstNameDraft, setFirstNameDraft] = useState<string | null>(null);
  const [lastNameDraft, setLastNameDraft] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoCompleting, setIsAutoCompleting] = useState(false);
  const autoCompletionAttemptedRef = useRef(false);
  const submitOnboardingRef = useRef<typeof submitOnboarding | null>(null);

  const clerkFirstName = user?.firstName?.trim() ?? "";
  const clerkLastName = user?.lastName?.trim() ?? "";
  const firstName = firstNameDraft ?? clerkFirstName;
  const lastName = lastNameDraft ?? clerkLastName;

  const submitOnboarding = useCallback(async (
    personalName: string,
    options?: {
      auto?: boolean;
    },
  ) => {
    if (options?.auto) {
      setIsAutoCompleting(true);
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const token = await getToken();

      await completeClientOnboarding(
        {
          personal_name: personalName,
        },
        token,
      );

      router.replace("/auth/redirect");
      router.refresh();
      return true;
    } catch (error) {
      setErrorMessage(getSafeOnboardingErrorMessage(error));
      return false;
    } finally {
      setIsSubmitting(false);
      if (options?.auto) {
        setIsAutoCompleting(false);
      }
    }
  }, [getToken, router]);

  useEffect(() => {
    submitOnboardingRef.current = submitOnboarding;
  }, [submitOnboarding]);

  useEffect(() => {
    if (autoCompletionAttemptedRef.current) {
      return;
    }

    if (!isLoaded || !isSignedIn || !user || !authMe.onboarding_required) {
      return;
    }

    const normalizedPersonalName = `${clerkFirstName} ${clerkLastName}`.trim();
    if (!clerkFirstName || !clerkLastName || !normalizedPersonalName) {
      return;
    }

    autoCompletionAttemptedRef.current = true;
    const timerId = window.setTimeout(() => {
      if (!submitOnboardingRef.current) {
        return;
      }

      void submitOnboardingRef.current(normalizedPersonalName, { auto: true });
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [
    authMe.onboarding_required,
    clerkFirstName,
    clerkLastName,
    isLoaded,
    isSignedIn,
    user,
  ]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();

    await submitOnboarding(`${normalizedFirstName} ${normalizedLastName}`.trim());
  }

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
              <span className="login-pill">Onboarding Sendwise</span>
            </div>
            <h1 className="login-title">Completa il tuo profilo e entra nel portale cliente.</h1>
            <p className="login-lead">
              La password, la verifica email e la sicurezza dell&apos;account restano
              gestite nel flusso di accesso protetto. Se l&apos;invito ha gia raccolto
              nome e cognome, Sendwise prova a completare questo passaggio in automatico.
            </p>
          </div>

            <div className="login-note-grid">
              <article className="login-note-card">
                <span className="login-note-card__label">01</span>
                <p className="login-note-card__text">
                  Completa nome e cognome usati nel portale cliente.
                </p>
              </article>
            <article className="login-note-card">
              <span className="login-note-card__label">02</span>
              <p className="login-note-card__text">
                Il profilo aziendale verra completato quando il dato sara supportato
                dal backend cliente verificato.
              </p>
            </article>
            <article className="login-note-card">
              <span className="login-note-card__label">03</span>
              <p className="login-note-card__text">
                Dopo il salvataggio verrai reindirizzato al tuo portale /c.
              </p>
            </article>
          </div>
        </section>

        <section className="login-card" data-step="credentials">
          <div className="login-card__header">
            <p className="login-card__eyebrow">Onboarding</p>
            <h2 className="login-card__title">Completa il tuo invito</h2>
            <p className="login-card__description">
              L&apos;invito e gia autenticato. Sendwise usa questi dati profilo per
              aprire il portale cliente dopo la conferma finale.
            </p>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-helper">
              <strong className="block text-sm font-semibold text-slate-900">
                Email invitata
              </strong>
              <span className="mt-1 block break-all text-sm text-slate-600">
                {authMe.email ?? "Email non disponibile"}
              </span>
            </div>

            <div className="login-field">
              <label className="login-field__label" htmlFor="onboarding-first-name">
                Nome
              </label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="onboarding-first-name"
                  type="text"
                  autoComplete="given-name"
                  className="login-input pl-11"
                  disabled={isSubmitting}
                  onChange={(event) => setFirstNameDraft(event.target.value)}
                  placeholder="Mario"
                  required
                  value={firstName}
                />
              </div>
            </div>

            <div className="login-field">
              <label className="login-field__label" htmlFor="onboarding-last-name">
                Cognome
              </label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="onboarding-last-name"
                  type="text"
                  autoComplete="family-name"
                  className="login-input pl-11"
                  disabled={isSubmitting}
                  onChange={(event) => setLastNameDraft(event.target.value)}
                  placeholder="Rossi"
                  required
                  value={lastName}
                />
              </div>
              <span className="login-field__hint">
                Sendwise salva il nome completo visibile nel portale, mentre
                password e sicurezza restano gestite nel sistema di accesso protetto.
              </span>
            </div>

            {errorMessage ? (
              <p className="login-feedback login-feedback--error" role="alert">
                {errorMessage}
              </p>
            ) : null}

            {isAutoCompleting ? (
              <p className="login-feedback login-feedback--info" role="status">
                Stiamo completando il profilo con i dati gia confermati nell&apos;invito.
              </p>
            ) : null}

            <button type="submit" className="login-submit" disabled={isSubmitting}>
              {isSubmitting ? "Completamento in corso..." : "Continua al portale"}
            </button>
          </form>

          <div className="login-card__footer">
            <ShieldCheck aria-hidden="true" className="login-card__footer-icon" />
            <div className="login-card__support">
              <strong>Sicurezza gestita nel flusso di accesso</strong>
              <span>Sendwise salva solo dati profilo e autorizzazione del portale.</span>
            </div>
            <ShieldCheck aria-hidden="true" className="login-card__footer-accent" />
          </div>
        </section>
      </div>
    </main>
  );
}
