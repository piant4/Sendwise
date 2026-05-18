"use client";

import { useAuth } from "@clerk/nextjs";
import { Building2, ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
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
  const [personalName, setPersonalName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

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
    } catch (error) {
      setErrorMessage(getSafeOnboardingErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
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
              gestite da Clerk. In questo passaggio confermi solo i dati profilo che
              Sendwise usa per il portale cliente.
            </p>
          </div>

          <div className="login-note-grid">
            <article className="login-note-card">
              <span className="login-note-card__label">01</span>
              <p className="login-note-card__text">
                Conferma il tuo nome personale per attivare l&apos;accesso.
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
              Crea la password o accedi per continuare. Poi completerai il profilo
              aziendale.
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
              <label className="login-field__label" htmlFor="onboarding-personal-name">
                Nome personale
              </label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="onboarding-personal-name"
                  type="text"
                  autoComplete="name"
                  className="login-input pl-11"
                  disabled={isSubmitting}
                  onChange={(event) => setPersonalName(event.target.value)}
                  placeholder="Mario Rossi"
                  required
                  value={personalName}
                />
              </div>
            </div>

            <div className="login-field">
              <label className="login-field__label" htmlFor="onboarding-company-name">
                Nome azienda
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="onboarding-company-name"
                  type="text"
                  autoComplete="organization"
                  className="login-input pl-11"
                  disabled
                  placeholder="Sarà disponibile quando il backend cliente supporterà questo campo"
                  value=""
                  readOnly
                />
              </div>
              <span className="login-field__hint">
                Il backend V1 verificato non espone ancora un campo cliente aggiornabile
                per il nome azienda, quindi questa pagina non simula un salvataggio non supportato.
              </span>
            </div>

            {errorMessage ? (
              <p className="login-feedback login-feedback--error" role="alert">
                {errorMessage}
              </p>
            ) : null}

            <button type="submit" className="login-submit" disabled={isSubmitting}>
              {isSubmitting ? "Attivazione in corso..." : "Continua al portale"}
            </button>
          </form>

          <div className="login-card__footer">
            <ShieldCheck aria-hidden="true" className="login-card__footer-icon" />
            <div className="login-card__support">
              <strong>Sicurezza gestita da Clerk</strong>
              <span>Sendwise salva solo dati profilo e autorizzazione del portale.</span>
            </div>
            <ShieldCheck aria-hidden="true" className="login-card__footer-accent" />
          </div>
        </section>
      </div>
    </main>
  );
}
