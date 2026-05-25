"use client";

import { useClerk, useSignIn } from "@clerk/nextjs";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { BrandMark } from "@/components/shared/BrandMark";

const LOGIN_REDIRECT_PATH = "/auth/redirect";

type ResetStep = "request" | "verify" | "success";

function getItalianResetErrorMessage(error: unknown) {
  if (isClerkAPIResponseError(error)) {
    const firstError = error.errors[0];
    const errorCode = firstError?.code ?? "";
    const longMessage = firstError?.longMessage?.toLowerCase() ?? "";
    const shortMessage = firstError?.message?.toLowerCase() ?? "";
    const combinedMessage = `${longMessage} ${shortMessage}`.trim();

    if (
      errorCode === "form_identifier_not_found" ||
      combinedMessage.includes("identifier not found") ||
      combinedMessage.includes("not found")
    ) {
      return "Account non trovato. Verifica l'email e riprova.";
    }

    if (
      errorCode === "form_param_format_invalid" ||
      combinedMessage.includes("email address") ||
      combinedMessage.includes("valid email")
    ) {
      return "Inserisci un indirizzo email valido.";
    }

    if (
      errorCode === "form_code_incorrect" ||
      combinedMessage.includes("invalid code") ||
      combinedMessage.includes("incorrect code")
    ) {
      return "Codice non valido. Controlla e riprova.";
    }

    if (
      errorCode === "verification_expired" ||
      combinedMessage.includes("expired")
    ) {
      return "Codice scaduto. Richiedine uno nuovo e riprova.";
    }

    if (
      errorCode === "form_password_pwned" ||
      errorCode === "form_password_length_too_short" ||
      errorCode === "form_password_size_in_bytes_exceeded" ||
      combinedMessage.includes("password")
    ) {
      return "La nuova password non rispetta i requisiti di sicurezza richiesti.";
    }

    if (
      errorCode === "too_many_requests" ||
      combinedMessage.includes("too many requests")
    ) {
      return "Troppi tentativi ravvicinati. Attendi qualche minuto e riprova.";
    }

    if (
      combinedMessage.includes("network") ||
      combinedMessage.includes("timed out") ||
      combinedMessage.includes("unavailable") ||
      combinedMessage.includes("failed to fetch")
    ) {
      return "Servizio di recupero temporaneamente non disponibile. Riprova tra poco.";
    }
  }

  if (error instanceof Error && error.message.toLowerCase().includes("network")) {
    return "Servizio di recupero temporaneamente non disponibile. Riprova tra poco.";
  }

  return "Recupero password non riuscito. Riprova o contatta il supporto Sendwise.";
}

export function ClerkForgotPasswordShell() {
  const clerk = useClerk();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { fetchStatus, signIn } = useSignIn();
  const [step, setStep] = useState<ResetStep>("request");
  const [email, setEmail] = useState(() => searchParams.get("identifier") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [helperMessage, setHelperMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function activateSessionAndRedirect(createdSessionId?: string | null) {
    const nextSessionId = createdSessionId ?? signIn.createdSessionId;

    if (!nextSessionId) {
      setStep("success");
      setHelperMessage("Password aggiornata. Reindirizzamento in corso...");
      router.replace(LOGIN_REDIRECT_PATH);
      router.refresh();
      return;
    }

    await clerk.setActive({
      session: nextSessionId,
      navigate: async () => {
        setStep("success");
        setHelperMessage("Password aggiornata. Reindirizzamento in corso...");
        router.replace(LOGIN_REDIRECT_PATH);
        router.refresh();
      },
    });
  }

  async function handleRequestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setHelperMessage(null);

    if (fetchStatus === "fetching") {
      setErrorMessage(
        "Il servizio di recupero non e ancora pronto. Riprova tra qualche secondo.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const createResult = await signIn.create({
        identifier: email.trim(),
      });

      if (createResult.error) {
        setErrorMessage(getItalianResetErrorMessage(createResult.error));
        return;
      }

      const result = await signIn.resetPasswordEmailCode.sendCode();

      if (result.error) {
        setErrorMessage(getItalianResetErrorMessage(result.error));
        return;
      }

      setStep("verify");
      setCode("");
      setPassword("");
      setConfirmPassword("");
      setHelperMessage(
        "Se l'account esiste, Clerk inviera un codice di recupero a questa email.",
      );
    } catch (error) {
      setErrorMessage(getItalianResetErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password !== confirmPassword) {
      setErrorMessage("Le password non coincidono.");
      return;
    }

    setErrorMessage(null);
    setHelperMessage(null);
    setIsSubmitting(true);

    try {
      const verifyResult = await signIn.resetPasswordEmailCode.verifyCode({
        code: code.trim(),
      });

      if (verifyResult.error) {
        setErrorMessage(getItalianResetErrorMessage(verifyResult.error));
        return;
      }

      const passwordResult = await signIn.resetPasswordEmailCode.submitPassword({
        password,
      });

      if (passwordResult.error) {
        setErrorMessage(getItalianResetErrorMessage(passwordResult.error));
        return;
      }

      const createdSessionId =
        "createdSessionId" in passwordResult
          ? typeof passwordResult.createdSessionId === "string"
            ? passwordResult.createdSessionId
            : null
          : null;

      await activateSessionAndRedirect(createdSessionId);
    } catch (error) {
      setErrorMessage(getItalianResetErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendCode() {
    setErrorMessage(null);
    setHelperMessage(null);
    setIsSubmitting(true);

    try {
      const result = await signIn.resetPasswordEmailCode.sendCode();

      if (result.error) {
        setErrorMessage(getItalianResetErrorMessage(result.error));
        return;
      }

      setHelperMessage("Abbiamo richiesto un nuovo codice di recupero.");
    } catch (error) {
      setErrorMessage(getItalianResetErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleUseDifferentEmail() {
    setStep("request");
    setCode("");
    setPassword("");
    setConfirmPassword("");
    setErrorMessage(null);
    setHelperMessage(null);
  }

  function handleBackToLogin() {
    router.push("/login");
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
              <span className="login-pill">Recupero accesso</span>
            </div>
            <h1 className="login-title">Reimposta la password Sendwise.</h1>
            <p className="login-lead">
              Il recupero passa da Clerk con codice di verifica e nuova password,
              senza chiedere la password corrente.
            </p>
          </div>
        </section>

        <section
          className="login-card"
          data-step={step === "request" ? "credentials" : "verification"}
        >
          <div className="login-card__header">
            <h2 className="login-card__title">
              {step === "request"
                ? "Recupero password"
                : step === "verify"
                  ? "Inserisci codice e nuova password"
                  : "Password aggiornata"}
            </h2>
            <p className="login-card__description">
              {step === "request"
                ? "Inserisci l'email del tuo account per richiedere il codice di recupero."
                : step === "verify"
                  ? "Conferma il codice ricevuto e scegli la nuova password."
                  : "Reindirizzamento verso il flusso di accesso Sendwise in corso."}
            </p>
          </div>

          {step === "request" ? (
            <form
              aria-label="Richiesta codice recupero password"
              className="login-form"
              onSubmit={handleRequestCode}
            >
              <div className="login-field">
                <label className="login-field__label" htmlFor="reset-email">
                  Email
                </label>
                <input
                  id="reset-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  className="login-input"
                  disabled={isSubmitting}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nome@example.com"
                  required
                  value={email}
                />
              </div>

              {helperMessage ? (
                <p className="login-feedback login-feedback--info" role="status">
                  {helperMessage}
                </p>
              ) : null}

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
                {isSubmitting
                  ? "Invio del codice in corso..."
                  : "Invia codice di recupero"}
              </button>

              <button
                className="login-reset-action"
                disabled={isSubmitting}
                onClick={handleBackToLogin}
                type="button"
              >
                Torna al login
              </button>
            </form>
          ) : null}

          {step === "verify" ? (
            <form
              aria-label="Reimpostazione password con codice"
              className="login-form"
              onSubmit={handleResetPassword}
            >
              <p className="login-helper" role="status">
                Codice richiesto per <strong>{email}</strong>.
              </p>

              <div className="login-field">
                <label className="login-field__label" htmlFor="reset-code">
                  Codice di reset
                </label>
                <input
                  id="reset-code"
                  name="code"
                  type="text"
                  autoComplete="one-time-code"
                  className="login-input"
                  disabled={isSubmitting}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="Inserisci il codice ricevuto"
                  required
                  value={code}
                />
              </div>

              <div className="login-field">
                <label className="login-field__label" htmlFor="reset-password">
                  Nuova password
                </label>
                <div className="login-password-shell">
                  <input
                    id="reset-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className="login-input login-input--password"
                    disabled={isSubmitting}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Inserisci la nuova password"
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
                <label
                  className="login-field__label"
                  htmlFor="reset-password-confirm"
                >
                  Conferma nuova password
                </label>
                <div className="login-password-shell">
                  <input
                    id="reset-password-confirm"
                    name="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className="login-input login-input--password"
                    disabled={isSubmitting}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Ripeti la nuova password"
                    required
                    value={confirmPassword}
                  />
                  <button
                    type="button"
                    className="login-password-toggle"
                    aria-label={
                      showConfirmPassword
                        ? "Nascondi conferma password"
                        : "Mostra conferma password"
                    }
                    aria-pressed={showConfirmPassword}
                    disabled={isSubmitting}
                    onClick={() =>
                      setShowConfirmPassword((currentValue) => !currentValue)
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff aria-hidden="true" />
                    ) : (
                      <Eye aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {helperMessage ? (
                <p className="login-feedback login-feedback--info" role="status">
                  {helperMessage}
                </p>
              ) : null}

              {errorMessage ? (
                <p className="login-feedback login-feedback--error" role="alert">
                  {errorMessage}
                </p>
              ) : null}

              <div className="login-actions">
                <button className="login-submit" disabled={isSubmitting} type="submit">
                  {isSubmitting ? "Reimpostazione in corso..." : "Reimposta password"}
                </button>
                <button
                  className="login-submit login-submit--secondary"
                  disabled={isSubmitting}
                  onClick={handleResendCode}
                  type="button"
                >
                  Invia di nuovo il codice
                </button>
                <button
                  className="login-reset-action"
                  disabled={isSubmitting}
                  onClick={handleUseDifferentEmail}
                  type="button"
                >
                  Cambia email
                </button>
                <button
                  className="login-reset-action"
                  disabled={isSubmitting}
                  onClick={handleBackToLogin}
                  type="button"
                >
                  Torna al login
                </button>
              </div>
            </form>
          ) : null}

          {step === "success" ? (
            <div className="login-form">
              <p className="login-feedback login-feedback--info" role="status">
                {helperMessage ?? "Password aggiornata correttamente."}
              </p>
              <button className="login-submit" onClick={handleBackToLogin} type="button">
                Vai al login
              </button>
            </div>
          ) : null}

          <div className="login-card__footer">
            <ShieldCheck aria-hidden="true" className="login-card__footer-icon" />
            <div className="login-card__support">
              <strong>Recupero account gestito da Clerk.</strong>
              <span>
                Dopo il reset, il rientro continua sul flusso Sendwise esistente.
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
