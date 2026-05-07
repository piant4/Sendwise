"use client";

import { useSignIn } from "@clerk/nextjs";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { LifeBuoy, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BrandMark } from "../../components/shared/BrandMark";

const LOGIN_REDIRECT_PATH = "/admin";

function getItalianLoginErrorMessage(error: unknown) {
  if (isClerkAPIResponseError(error)) {
    const firstError = error.errors[0];
    const errorCode = firstError?.code ?? "";
    const longMessage = firstError?.longMessage?.toLowerCase() ?? "";

    if (
      errorCode === "form_password_incorrect" ||
      errorCode === "form_identifier_not_found" ||
      longMessage.includes("incorrect") ||
      longMessage.includes("invalid password") ||
      longMessage.includes("not found")
    ) {
      return "Email o password non validi.";
    }

    if (
      longMessage.includes("password") &&
      (longMessage.includes("not enabled") || longMessage.includes("not supported"))
    ) {
      return "L'accesso email e password non è abilitato per questo ambiente.";
    }

    if (errorCode === "too_many_requests") {
      return "Troppi tentativi di accesso. Attendi qualche minuto e riprova.";
    }
  }

  return "Accesso non riuscito. Verifica le credenziali o contatta il team Sendwise.";
}

function getIncompleteFlowMessage(status: string) {
  if (status === "needs_second_factor") {
    return "Per questo account è richiesta una verifica aggiuntiva non ancora esposta nella UI Sendwise.";
  }

  if (status === "needs_new_password") {
    return "Per questo account è richiesto un aggiornamento credenziali gestito dal sistema di identità.";
  }

  if (status === "needs_first_factor") {
    return "Questo ambiente non consente di completare l'accesso diretto con email e password.";
  }

  return "Accesso non completato. Contatta il team Sendwise se il problema persiste.";
}

export function LoginContent() {
  const router = useRouter();
  const { fetchStatus, signIn } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (fetchStatus === "fetching") {
      setErrorMessage(
        "Il servizio di accesso non è ancora pronto. Riprova tra qualche secondo.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await signIn.create({
        identifier: email.trim(),
        password,
      });

      if (result.error) {
        setErrorMessage(getItalianLoginErrorMessage(result.error));
        return;
      }

      if (signIn.status === "complete" && signIn.createdSessionId) {
        await signIn.finalize({
          navigate: async () => {
            router.replace(LOGIN_REDIRECT_PATH);
            router.refresh();
          },
        });
        return;
      }

      setErrorMessage(getIncompleteFlowMessage(signIn.status));
    } catch (error) {
      setErrorMessage(getItalianLoginErrorMessage(error));
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
              <span className="login-pill">Accesso riservato</span>
            </div>
            <h1 className="login-title">
              Campagne email, AI e controllo operativo nello stesso
              workspace.
            </h1>
            <p className="login-lead">
              Spazio riservato per coordinare volumi, stato campagne e presidio
              delle attivita essenziali Sendwise.
            </p>
          </div>
        </section>

        <section className="login-card">
          <div className="login-card__header">
            <h2 className="login-card__title">Accedi</h2>
          </div>

          <form
            aria-label="Modulo di accesso Sendwise"
            className="login-form"
            onSubmit={handleSubmit}
          >
            <div className="login-field">
              <label className="login-field__label" htmlFor="login-email">
                Email
              </label>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                autoCapitalize="none"
                className="login-input"
                disabled={isSubmitting}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nome@azienda.it"
                required
                value={email}
              />
            </div>

            <div className="login-field">
              <label className="login-field__label" htmlFor="login-password">
                Password
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                className="login-input"
                disabled={isSubmitting}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Inserisci la password"
                required
                value={password}
              />
            </div>

            {errorMessage ? (
              <p className="login-feedback login-feedback--error" role="alert">
                {errorMessage}
              </p>
            ) : null}

            <button
              className="login-submit"
              disabled={fetchStatus === "fetching" || isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Accesso in corso..." : "Accedi"}
            </button>
          </form>

          <div className="login-card__footer">
            <ShieldCheck aria-hidden="true" className="login-card__footer-icon" />
            <div className="login-card__support">
              <strong>Accesso riservato agli utenti autorizzati.</strong>
              <span>
                Abilitazione account e supporto operativo gestiti dal team
                Sendwise.
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
