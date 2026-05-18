"use client";

import { useAuth } from "@clerk/nextjs";
import { UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import {
  completeClientOnboarding,
  isApiError,
  type AuthMeResponse,
} from "../../lib/api";

interface ClientOnboardingFormProps {
  authMe: AuthMeResponse;
}

function getSafeOnboardingErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error.status === 401 || error.status === 403) {
      return "Non e stato possibile associare questo account a un accesso cliente Sendwise.";
    }

    if (error.status === 422) {
      return "Inserisci il tuo nome e cognome prima di continuare.";
    }

    if (error.status && error.status >= 500) {
      return "Il servizio di onboarding non e disponibile in questo momento. Riprova tra poco.";
    }
  }

  return "Non e stato possibile completare l'onboarding. Riprova.";
}

export function ClientOnboardingForm({
  authMe,
}: ClientOnboardingFormProps) {
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
    <main className="onboarding-page">
      <section className="onboarding-card">
        <div className="onboarding-card__header">
          <p className="onboarding-card__eyebrow">Onboarding</p>
          <h1 className="onboarding-card__title">Completa il tuo accesso</h1>
          <p className="onboarding-card__message">
            Prima di entrare nel portale cliente, completa i dati essenziali del
            tuo profilo Sendwise.
          </p>
        </div>

        <div className="onboarding-card__identity">
          <span>Email invitata</span>
          <strong>{authMe.email ?? "Email non disponibile"}</strong>
        </div>

        <form className="onboarding-form" onSubmit={handleSubmit}>
          <label className="onboarding-form__field" htmlFor="onboarding-personal-name">
            <span>Nome e cognome</span>
            <div className="onboarding-form__input-shell">
              <UserRound aria-hidden="true" />
              <input
                id="onboarding-personal-name"
                type="text"
                autoComplete="name"
                className="onboarding-form__input"
                disabled={isSubmitting}
                onChange={(event) => setPersonalName(event.target.value)}
                placeholder="Mario Rossi"
                required
                value={personalName}
              />
            </div>
          </label>

          <p className="onboarding-form__note">
            Password e sessione restano gestite da Clerk. Sendwise salva solo i
            dati profilo e l&apos;autorizzazione del portale.
          </p>

          {errorMessage ? (
            <p className="onboarding-form__error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            className="onboarding-form__submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Salvataggio in corso..." : "Continua al portale"}
          </button>
        </form>
      </section>
    </main>
  );
}
