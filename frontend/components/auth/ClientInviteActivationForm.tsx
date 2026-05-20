"use client";

import { useAuth, useSignUp } from "@clerk/nextjs";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import {
  CheckCircle2,
  Circle,
  Eye,
  EyeOff,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BrandMark } from "@/components/shared/BrandMark";
import { completeClientOnboarding, isApiError } from "@/lib/api";

const LOGIN_REDIRECT_PATH = "/auth/redirect";

type InviteViewState = "form" | "invalid" | "unsupported";
type PasswordRequirement = {
  id: string;
  label: string;
  satisfied: boolean;
};
type PendingTaskKey = "choose-organization" | "reset-password" | "setup-mfa" | "other";

function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    {
      id: "length",
      label: "Almeno 8 caratteri",
      satisfied: password.length >= 8,
    },
    {
      id: "lowercase",
      label: "Una lettera minuscola",
      satisfied: /[a-z]/.test(password),
    },
    {
      id: "uppercase",
      label: "Una lettera maiuscola",
      satisfied: /[A-Z]/.test(password),
    },
    {
      id: "number",
      label: "Un numero",
      satisfied: /\d/.test(password),
    },
    {
      id: "symbol",
      label: "Un simbolo speciale",
      satisfied: /[^A-Za-z0-9]/.test(password),
    },
  ];
}

function getPasswordStrength(password: string) {
  const requirements = getPasswordRequirements(password);
  const score = requirements.filter((requirement) => requirement.satisfied).length;

  if (!password) {
    return {
      label: "Nessuna password inserita",
      compactLabel: "",
      tone: "empty" as const,
      score: 0,
    };
  }

  if (score <= 2) {
    return {
      label: "Password debole",
      compactLabel: "Debole",
      tone: "weak" as const,
      score,
    };
  }

  if (score === 3) {
    return {
      label: "Password media",
      compactLabel: "Media",
      tone: "medium" as const,
      score,
    };
  }

  if (score === 4) {
    return {
      label: "Password buona",
      compactLabel: "Buona",
      tone: "good" as const,
      score,
    };
  }

  return {
    label: "Password robusta",
    compactLabel: "Robusta",
    tone: "strong" as const,
    score,
  };
}

function isPasswordValidationIssue(error: unknown): boolean {
  if (!isClerkAPIResponseError(error)) {
    return false;
  }

  const firstError = error.errors[0];
  const code = firstError?.code ?? "";
  const message = `${firstError?.longMessage ?? ""} ${firstError?.message ?? ""}`
    .toLowerCase()
    .trim();

  return (
    code === "form_password_pwned" ||
    code === "form_password_not_strong_enough" ||
    code === "form_password_length_too_short" ||
    code === "form_password_validation_failed" ||
    code === "form_password_size_in_bytes_exceeded" ||
    message.includes("breached") ||
    message.includes("compromised") ||
    message.includes("password")
  );
}

function getFriendlySessionTaskMessage(taskKey: PendingTaskKey): string {
  switch (taskKey) {
    case "choose-organization":
      return "Il tuo account richiede una scelta organizzativa finale gestita da Clerk prima dell'accesso al portale.";
    case "reset-password":
      return "Clerk richiede un ulteriore reset credenziali prima di completare l'accesso.";
    case "setup-mfa":
      return "Clerk richiede la configurazione di un fattore di sicurezza aggiuntivo prima dell'accesso.";
    default:
      return "Il tuo account richiede un controllo di sicurezza aggiuntivo gestito da Clerk prima di entrare nel portale.";
  }
}

function mapSessionTaskKey(taskKey: string | null | undefined): PendingTaskKey {
  if (taskKey === "choose-organization") {
    return taskKey;
  }

  if (taskKey === "reset-password") {
    return taskKey;
  }

  if (taskKey === "setup-mfa") {
    return taskKey;
  }

  return "other";
}

function getInviteErrorMessage(error: unknown): string {
  if (isClerkAPIResponseError(error)) {
    const firstError = error.errors[0];
    const code = firstError?.code ?? "";
    const message = `${firstError?.longMessage ?? ""} ${firstError?.message ?? ""}`
      .toLowerCase()
      .trim();

    if (code === "form_param_format_invalid" || message.includes("ticket")) {
      return "Questo invito non è più valido oppure è già stato usato.";
    }

    if (
      code === "form_password_pwned" ||
      message.includes("breached") ||
      message.includes("compromised")
    ) {
      return "Questa password è stata trovata in una violazione nota. Scegline una nuova e non riutilizzata.";
    }

    if (
      code === "form_password_not_strong_enough" ||
      code === "form_password_length_too_short" ||
      code === "form_password_validation_failed" ||
      code === "form_password_size_in_bytes_exceeded" ||
      message.includes("password")
    ) {
      if (message.includes("uppercase")) {
        return "Aggiungi almeno una lettera maiuscola alla password.";
      }

      if (message.includes("lowercase")) {
        return "Aggiungi almeno una lettera minuscola alla password.";
      }

      if (message.includes("number")) {
        return "Aggiungi almeno un numero alla password.";
      }

      if (message.includes("special")) {
        return "Aggiungi almeno un simbolo speciale alla password.";
      }

      if (message.includes("8") || message.includes("length")) {
        return "La password deve avere almeno 8 caratteri.";
      }

      return "La password non rispetta i requisiti di sicurezza richiesti da Clerk. Controlla la checklist e riprova.";
    }
  }

  if (isApiError(error)) {
    if (error.status === 401 || error.status === 403) {
      return "L'invito autenticato non è associato a un accesso cliente Sendwise valido.";
    }

    if (error.status === 422) {
      return "Nome e cognome sono obbligatori per completare l'attivazione.";
    }
  }

  return "Non è stato possibile completare l'attivazione dell'account. Riprova.";
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
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [viewState, setViewState] = useState<InviteViewState>("form");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] = useState(false);
  const [hasPasswordInteraction, setHasPasswordInteraction] = useState(false);
  const [hasPasswordValidationError, setHasPasswordValidationError] = useState(false);
  const passwordRequirements = getPasswordRequirements(password);
  const passwordStrength = getPasswordStrength(password);
  const isPasswordValid =
    password.length > 0 && passwordRequirements.every((requirement) => requirement.satisfied);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const passwordMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;
  const showPasswordDetails =
    isPasswordFocused ||
    isConfirmPasswordFocused ||
    (hasPasswordInteraction && password.length > 0 && !isPasswordValid) ||
    hasPasswordValidationError;
  const showCompactPasswordLabel = passwordStrength.compactLabel.length > 0;
  const showCompactMatchIndicator =
    !isConfirmPasswordFocused && !passwordMismatch && !hasPasswordValidationError;

  function moveToFallback(state: InviteViewState, message: string) {
    setViewState(state);
    setErrorMessage(null);
    setFallbackMessage(message);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (fetchStatus === "fetching" || !signUp) {
      setHasPasswordValidationError(false);
      setErrorMessage("Il servizio di attivazione non è ancora pronto. Riprova tra pochi secondi.");
      return;
    }

    if (password !== confirmPassword) {
      setHasPasswordValidationError(false);
      setErrorMessage("Le password non coincidono.");
      return;
    }

    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    if (!normalizedFirstName || !normalizedLastName) {
      setHasPasswordValidationError(false);
      setErrorMessage("Nome e cognome sono obbligatori.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setFallbackMessage(null);
    setHasPasswordValidationError(false);
    setViewState("form");

    try {
      const activationResult = await signUp.create({
        ticket,
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        password,
      });

      if (activationResult.error) {
        setHasPasswordValidationError(isPasswordValidationIssue(activationResult.error));
        setErrorMessage(getInviteErrorMessage(activationResult.error));
        return;
      }

      if (!signUp.createdSessionId || signUp.status !== "complete") {
        const hasMissingRequirements =
          signUp.status === "missing_requirements" &&
          ((signUp.missingFields?.length ?? 0) > 0 ||
            (signUp.unverifiedFields?.length ?? 0) > 0);

        moveToFallback(
          hasMissingRequirements ? "unsupported" : "invalid",
          hasMissingRequirements
            ? "Il tuo invito richiede un passaggio aggiuntivo di verifica o dati extra configurati in Clerk che questa schermata non puo completare in autonomia."
            : "Non è stato possibile completare l'attivazione con questo link. Riprova dall'email di invito oppure richiedi un nuovo invito.",
        );
        return;
      }

      let pendingTaskMessage: string | null = null;
      const finalizeResult = await signUp.finalize({
        navigate: ({ session }) => {
          pendingTaskMessage = session?.currentTask
            ? getFriendlySessionTaskMessage(mapSessionTaskKey(session.currentTask.key))
            : null;
        },
      });
      if (finalizeResult.error) {
        setHasPasswordValidationError(isPasswordValidationIssue(finalizeResult.error));
        setErrorMessage(getInviteErrorMessage(finalizeResult.error));
        return;
      }

      if (pendingTaskMessage) {
        moveToFallback("unsupported", pendingTaskMessage);
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
      const safeMessage = getInviteErrorMessage(error);
      setHasPasswordValidationError(isPasswordValidationIssue(error));

      if (safeMessage.includes("invito non è più valido")) {
        moveToFallback("invalid", safeMessage);
        return;
      }

      setErrorMessage(safeMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleRetry() {
    setViewState("form");
    setErrorMessage(null);
    setFallbackMessage(null);
    setHasPasswordValidationError(false);
  }

  const isInviteUnavailable = viewState !== "form";

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

            {/* <p className="login-lead">
              Nome, cognome e nuova password vengono raccolti in una UI Sendwise,
              mentre la password resta gestita da Clerk.
            </p> */}
          </div>

          <div className="login-note-grid">
            <article className="login-note-card">
              <span className="login-note-card__label">01</span>
              <p className="login-note-card__text">
                Inserisci il tuo nome, cognome e una password sicura.
              </p>
            </article>
            <article className="login-note-card">
              <span className="login-note-card__label">02</span>
              <p className="login-note-card__text">
                Fai click su attiva account
              </p>
            </article>
            <article className="login-note-card">
              <span className="login-note-card__label">03</span>
              <p className="login-note-card__text">
                Verrai reindirizzato automaticamente alla tua area cliente Sendwise.
              </p>
            </article>
          </div>
        </section>

        <section className="login-card" data-step="credentials">
          <div className="login-card__header">
            <p className="login-card__eyebrow">ONBOARDING</p>
            <h2 className="login-card__title">Completa il tuo invito</h2>
          </div>

          {isInviteUnavailable ? (
            <div className="login-state-card" role="alert">
              <div className="login-state-card__icon-shell" data-tone={viewState}>
                <ShieldAlert aria-hidden="true" />
              </div>
              <div className="login-state-card__copy">
                <h3>
                  {viewState === "invalid"
                    ? "Invito non più disponibile"
                    : "Verifica aggiuntiva richiesta"}
                </h3>
                <p>
                  {fallbackMessage ??
                    "Questa attivazione richiede un controllo aggiuntivo prima di entrare nel portale cliente."}
                </p>
              </div>
              <div className="login-state-card__actions">
                <button
                  type="button"
                  className="login-submit login-submit--ghost"
                  onClick={handleRetry}
                >
                  <RotateCcw aria-hidden="true" />
                  Riprova da questa schermata
                </button>
                <Link className="login-submit login-submit--secondary" href="/login">
                  Torna al login
                </Link>
              </div>
              <p className="login-state-card__support">
                Se il problema persiste, richiedi un nuovo invito oppure contatta il supporto
                Sendwise.
              </p>
            </div>
          ) : (
            <form
              aria-label="Attivazione invito cliente"
              className="login-form"
              onSubmit={handleSubmit}
            >
              <div className="login-field">
                <label className="login-field__label" htmlFor="invite-first-name">
                  Nome
                </label>
                <div className="relative">
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
                    onBlur={() => setIsPasswordFocused(false)}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setHasPasswordInteraction(true);
                    }}
                    onFocus={() => setIsPasswordFocused(true)}
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
                    {showPassword ? (
                      <EyeOff aria-hidden="true" />
                    ) : (
                      <Eye aria-hidden="true" />
                    )}
                  </button>
                </div>

                <div
                  className="login-password-meter"
                  data-expanded={showPasswordDetails}
                  aria-live="polite"
                >
                  <div className="login-password-meter__track" aria-hidden="true">
                    <span
                      className="login-password-meter__fill"
                      data-tone={passwordStrength.tone}
                      style={{
                        width: `${Math.max(passwordStrength.score, password ? 1 : 0) * 20}%`,
                      }}
                    />
                  </div>
                  <div className="login-password-meter__meta">
                    {showCompactPasswordLabel ? (
                      <strong>{showPasswordDetails ? passwordStrength.label : passwordStrength.compactLabel}</strong>
                    ) : null}
                    {showPasswordDetails ? (
                      <span>Clerk applica la verifica finale della policy password.</span>
                    ) : null}
                  </div>
                </div>

                {showPasswordDetails ? (
                  <ul className="login-checklist" aria-label="Requisiti password">
                    {passwordRequirements.map((requirement) => (
                      <li
                        key={requirement.id}
                        className="login-checklist__item"
                        data-satisfied={requirement.satisfied}
                      >
                        {requirement.satisfied ? (
                          <CheckCircle2 aria-hidden="true" />
                        ) : (
                          <Circle aria-hidden="true" />
                        )}
                        <span>{requirement.label}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
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
                    onBlur={() => setIsConfirmPasswordFocused(false)}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    onFocus={() => setIsConfirmPasswordFocused(true)}
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
                    onClick={() => setShowConfirmPassword((currentValue) => !currentValue)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff aria-hidden="true" />
                    ) : (
                      <Eye aria-hidden="true" />
                    )}
                  </button>
                </div>
                <div
                  className="login-match-indicator"
                  data-compact={showCompactMatchIndicator}
                  data-match={passwordsMatch}
                  data-invalid={passwordMismatch}
                >
                  {passwordsMatch ? (
                    <>
                      <CheckCircle2 aria-hidden="true" />
                      <span>Le password coincidono.</span>
                    </>
                  ) : passwordMismatch ? (
                    <>
                      <ShieldAlert aria-hidden="true" />
                      <span>Le password non coincidono ancora.</span>
                    </>
                  ) : (
                    <>
                      <Circle aria-hidden="true" />
                      <span>Ripeti la stessa password per confermare.</span>
                    </>
                  )}
                </div>
              </div>

              {fetchStatus === "fetching" ? (
                <p className="login-feedback login-feedback--info" role="status">
                  Verifica del link di invito in corso...
                </p>
              ) : null}

              {errorMessage ? (
                <p className="login-feedback login-feedback--error" role="alert">
                  {errorMessage}
                </p>
              ) : null}

              <button className="login-submit" disabled={isSubmitting} type="submit">
                {isSubmitting ? "Attivazione in corso..." : "Attiva account"}
              </button>

              <div id="clerk-captcha" />
            </form>
          )}

          <div className="login-card__footer">
            <ShieldCheck aria-hidden="true" className="login-card__footer-icon" />
            <div className="login-card__support">
              <strong>Credenziali protette da Clerk</strong>
              <span>Sendwise non salva password e non aggira i controlli di identita.</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
