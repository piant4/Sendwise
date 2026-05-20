"use client";

import { useAuth, useSignUp } from "@clerk/nextjs";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { Eye, EyeOff, KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BrandMark } from "@/components/shared/BrandMark";
import { completeClientOnboarding, isApiError } from "@/lib/api";

const LOGIN_REDIRECT_PATH = "/auth/redirect";

function getInviteErrorMessage(error: unknown): string {
  if (isClerkAPIResponseError(error)) {
    const firstError = error.errors[0];
    const code = firstError?.code ?? "";
    const message = `${firstError?.longMessage ?? ""} ${firstError?.message ?? ""}`
      .toLowerCase()
      .trim();

    if (code === "form_param_format_invalid" || message.includes("ticket")) {
      return "Questo invito non e piu valido oppure e gia stato usato.";
    }

    if (
      code === "form_password_not_strong_enough" ||
      code === "form_password_length_too_short" ||
      message.includes("password")
    ) {
      return "La password non rispetta i requisiti di sicurezza richiesti da Clerk.";
    }
  }

  if (isApiError(error)) {
    if (error.status === 401 || error.status === 403) {
      return "L'invito autenticato non e associato a un accesso cliente Sendwise valido.";
    }

    if (error.status === 422) {
      return "Nome e cognome sono obbligatori per completare l'attivazione.";
    }
  }

  return "Non e stato possibile completare l'attivazione dell'account. Riprova.";
}

interface ClientInviteActivationFormProps {
  ticket: string;
}

export function ClientInviteActivationForm({
  ticket,
}: ClientInviteActivationFormProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const { fetchStatus, signUp } = useSignUp();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (fetchStatus === "fetching" || !signUp) {
      setErrorMessage("Il servizio di attivazione non e ancora pronto. Riprova tra pochi secondi.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Le password non coincidono.");
      return;
    }

    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    if (!normalizedFirstName || !normalizedLastName) {
      setErrorMessage("Nome e cognome sono obbligatori.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const activationResult = await signUp.create({
        ticket,
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        password,
      });

      if (activationResult.error) {
        setErrorMessage(getInviteErrorMessage(activationResult.error));
        return;
      }

      if (!signUp.createdSessionId || signUp.status !== "complete") {
        setErrorMessage(
          "Questo invito richiede un passaggio di sicurezza Clerk non supportato in questa UI Sendwise.",
        );
        return;
      }

      const finalizeResult = await signUp.finalize();
      if (finalizeResult.error) {
        setErrorMessage(getInviteErrorMessage(finalizeResult.error));
        return;
      }

      await completeClientOnboarding(
        {
          personal_name: `${normalizedFirstName} ${normalizedLastName}`.trim(),
        },
        await getToken(),
      );

      router.replace(LOGIN_REDIRECT_PATH);
      router.refresh();
    } catch (error) {
      setErrorMessage(getInviteErrorMessage(error));
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
              <span className="login-pill">Attivazione protetta</span>
            </div>
            <h1 className="login-title">Attiva il tuo accesso Sendwise.</h1>
            <p className="login-lead">
              Nome, cognome e nuova password vengono raccolti in una UI Sendwise,
              mentre la password resta gestita da Clerk.
            </p>
          </div>

          <div className="login-note-grid">
            <article className="login-note-card">
              <span className="login-note-card__label">01</span>
              <p className="login-note-card__text">
                Imposti la password dentro il flusso protetto Clerk senza UI grezza.
              </p>
            </article>
            <article className="login-note-card">
              <span className="login-note-card__label">02</span>
              <p className="login-note-card__text">
                Sendwise salva solo il nome completo richiesto per il portale cliente.
              </p>
            </article>
            <article className="login-note-card">
              <span className="login-note-card__label">03</span>
              <p className="login-note-card__text">
                Al termine verrai reindirizzato automaticamente alla tua area cliente.
              </p>
            </article>
          </div>
        </section>

        <section className="login-card" data-step="credentials">
          <div className="login-card__header">
            <p className="login-card__eyebrow">Invito</p>
            <h2 className="login-card__title">Completa il tuo invito</h2>
            <p className="login-card__description">
              Inserisci i dati richiesti per attivare l&apos;account senza uscire
              dall&apos;esperienza Sendwise.
            </p>
          </div>

          <form aria-label="Attivazione invito cliente" className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label className="login-field__label" htmlFor="invite-first-name">
                Nome
              </label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="invite-first-name"
                  type="text"
                  autoComplete="given-name"
                  className="login-input pl-11"
                  disabled={isSubmitting}
                  onChange={(event) => setFirstName(event.target.value)}
                  required
                  value={firstName}
                />
              </div>
            </div>

            <div className="login-field">
              <label className="login-field__label" htmlFor="invite-last-name">
                Cognome
              </label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="invite-last-name"
                  type="text"
                  autoComplete="family-name"
                  className="login-input pl-11"
                  disabled={isSubmitting}
                  onChange={(event) => setLastName(event.target.value)}
                  required
                  value={lastName}
                />
              </div>
            </div>

            <div className="login-field">
              <label className="login-field__label" htmlFor="invite-password">
                Nuova password
              </label>
              <div className="login-password-shell">
                <input
                  id="invite-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className="login-input login-input--password"
                  disabled={isSubmitting}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  value={password}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                  aria-pressed={showPassword}
                  disabled={isSubmitting}
                  onClick={() => setShowPassword((currentValue) => !currentValue)}
                >
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
            </div>

            <div className="login-field">
              <label className="login-field__label" htmlFor="invite-confirm-password">
                Conferma nuova password
              </label>
              <div className="login-password-shell">
                <input
                  id="invite-confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className="login-input login-input--password"
                  disabled={isSubmitting}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  value={confirmPassword}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  aria-label={
                    showConfirmPassword ? "Nascondi conferma password" : "Mostra conferma password"
                  }
                  aria-pressed={showConfirmPassword}
                  disabled={isSubmitting}
                  onClick={() => setShowConfirmPassword((currentValue) => !currentValue)}
                >
                  {showConfirmPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
            </div>

            {errorMessage ? (
              <p className="login-feedback login-feedback--error" role="alert">
                {errorMessage}
              </p>
            ) : null}

            <button className="login-submit" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Attivazione in corso..." : "Attiva account"}
            </button>
          </form>

          <div className="login-card__footer">
            <ShieldCheck aria-hidden="true" className="login-card__footer-icon" />
            <div className="login-card__support">
              <strong>Credenziali protette da Clerk</strong>
              <span>Sendwise non salva password e non aggira i controlli di identita.</span>
            </div>
            <KeyRound aria-hidden="true" className="login-card__footer-accent" />
          </div>
        </section>
      </div>
    </main>
  );
}
