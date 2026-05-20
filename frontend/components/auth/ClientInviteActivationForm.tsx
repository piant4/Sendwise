"use client";

import Link from "next/link";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { useClerk, useSignUp, useUser } from "@clerk/nextjs";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { BrandMark } from "@/components/shared/BrandMark";
import { getInviteActivationContext } from "@/lib/api";
import {
  buildInviteActivationPayload,
  getInviteActivationErrorState,
  getPasswordMismatchState,
  hasCompleteInviteActivationName,
  INVITE_ACTIVATION_DEFAULT_HELPER_MESSAGE,
  INCOMPLETE_INVITE_DATA_MESSAGE,
  INVITE_PASSWORD_HELPER_MESSAGE,
  isInviteActivationTerminalError,
  isInviteActivationSubmitDisabled,
  isInviteNameRequirementError,
  normalizeInviteActivationContext,
  shouldResetInviteActivationErrorOnPasswordEdit,
} from "./clientInviteActivation";

const LOGIN_REDIRECT_PATH = "/auth/redirect";

interface ClientInviteActivationFormProps {
  ticket: string;
}

function getInviteErrorMessage(error: unknown) {
  if (!isClerkAPIResponseError(error)) {
    return getInviteActivationErrorState(null);
  }

  return getInviteActivationErrorState(error);
}

export function ClientInviteActivationForm({
  ticket,
}: ClientInviteActivationFormProps) {
  const clerk = useClerk();
  const router = useRouter();
  const { isSignedIn } = useUser();
  const { fetchStatus, signUp } = useSignUp();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [activationError, setActivationError] = useState<{
    classification: string;
    isTerminal: boolean;
    message: string;
  } | null>(null);
  const [helperMessage, setHelperMessage] = useState<string | null>(
    INVITE_ACTIVATION_DEFAULT_HELPER_MESSAGE,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInviteContextLoading, setIsInviteContextLoading] = useState(false);
  const [inviteContext, setInviteContext] = useState<{
    firstName: string | null;
    lastName: string | null;
  } | null>(null);

  useEffect(() => {
    if (!isSignedIn) {
      return;
    }

    router.replace(LOGIN_REDIRECT_PATH);
    router.refresh();
  }, [isSignedIn, router]);

  useEffect(() => {
    let isActive = true;

    async function loadInviteContext() {
      if (!ticket.trim()) {
        return;
      }

      setIsInviteContextLoading(true);

      try {
        const context = await getInviteActivationContext(ticket);
        if (!isActive) {
          return;
        }

        setInviteContext(normalizeInviteActivationContext(context));
      } catch {
        if (!isActive) {
          return;
        }

        setInviteContext(null);
      } finally {
        if (isActive) {
          setIsInviteContextLoading(false);
        }
      }
    }

    void loadInviteContext();

    return () => {
      isActive = false;
    };
  }, [ticket]);

  const mismatchState = getPasswordMismatchState(password, confirmPassword);
  const hasTerminalActivationError = isInviteActivationTerminalError(
    activationError,
  );
  const isBusy =
    fetchStatus === "fetching" || isSubmitting || isInviteContextLoading;
  const isSubmitDisabled = isInviteActivationSubmitDisabled({
    password,
    confirmPassword,
    isBusy,
    hasTerminalError: hasTerminalActivationError,
  });

  function handlePasswordChange(nextPassword: string) {
    setPassword(nextPassword);

    if (shouldResetInviteActivationErrorOnPasswordEdit(activationError)) {
      setActivationError(null);
      setHelperMessage(INVITE_ACTIVATION_DEFAULT_HELPER_MESSAGE);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActivationError(null);

    if (!ticket.trim()) {
      setActivationError(
        getInviteActivationErrorState({
          errors: [{ code: "form_ticket_invalid" }],
        }),
      );
      setHelperMessage(null);
      return;
    }

    if (mismatchState.isMismatch) {
      setActivationError({
        classification: "retryable_password_policy",
        isTerminal: false,
        message: mismatchState.message ?? "",
      });
      return;
    }

    setIsSubmitting(true);
    setHelperMessage("Attivazione accesso in corso...");

    try {
      if (!signUp) {
        setActivationError(getInviteActivationErrorState(null));
        setHelperMessage(null);
        return;
      }

      const activationPayload = buildInviteActivationPayload({
        ticket,
        password,
        inviteContext,
      }) as Parameters<typeof signUp.create>[0];
      const result = await signUp.create(activationPayload);

      if (result.error) {
        if (
          isInviteNameRequirementError(result.error) &&
          !hasCompleteInviteActivationName(inviteContext)
        ) {
          setActivationError({
            classification: "generic_terminal",
            isTerminal: true,
            message: INCOMPLETE_INVITE_DATA_MESSAGE,
          });
          setHelperMessage(null);
          return;
        }

        setActivationError(getInviteErrorMessage(result.error));
        setHelperMessage(null);
        return;
      }

      if (signUp.status !== "complete" || !signUp.createdSessionId) {
        setActivationError(
          getInviteActivationErrorState({
            errors: [{ code: "unsupported_clerk_ticket_flow" }],
          }),
        );
        setHelperMessage(null);
        return;
      }

      await clerk.setActive({
        session: signUp.createdSessionId,
        navigate: async () => {
          router.replace(LOGIN_REDIRECT_PATH);
          router.refresh();
        },
      });
    } catch (error) {
      if (
        isInviteNameRequirementError(error) &&
        !hasCompleteInviteActivationName(inviteContext)
      ) {
        setActivationError({
          classification: "generic_terminal",
          isTerminal: true,
          message: INCOMPLETE_INVITE_DATA_MESSAGE,
        });
        setHelperMessage(null);
        return;
      }

      setActivationError(getInviteErrorMessage(error));
      setHelperMessage(null);
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
              <span className="login-pill">Accesso cliente</span>
              <span className="login-pill">Invito protetto</span>
            </div>
            <h1 className="login-title">Attiva il tuo accesso Sendwise.</h1>
            <p className="login-lead">
              Imposta solo la password del tuo account senza uscire dal flusso
              Sendwise.
            </p>
          </div>
        </section>

        <section className="login-card" data-step="credentials">
          <div className="login-card__header">
            <p className="login-card__eyebrow">Invito</p>
            <h2 className="login-card__title">Completa l&apos;attivazione</h2>
            <p className="login-card__description">
              Clerk continua a gestire identita, password e sessione. Sendwise
              usa questo passaggio solo per riportarti al portale corretto.
            </p>
          </div>

          <form
            aria-label="Modulo di attivazione invito cliente"
            className="login-form"
            onSubmit={handleSubmit}
          >
            <div className="login-field">
              <label className="login-field__label" htmlFor="invite-password">
                Password
              </label>
              <div className="login-password-shell">
                <input
                  id="invite-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className="login-input login-input--password"
                  disabled={isBusy}
                  onChange={(event) => handlePasswordChange(event.target.value)}
                  placeholder="Scegli la password"
                  required
                  value={password}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  aria-label={showPassword ? "Nascondi password" : "Mostra password"}
                  aria-pressed={showPassword}
                  disabled={isBusy}
                  onClick={() => setShowPassword((currentValue) => !currentValue)}
                >
                  {showPassword ? (
                    <EyeOff aria-hidden="true" />
                  ) : (
                    <Eye aria-hidden="true" />
                  )}
                </button>
              </div>
              <p className="login-field__hint">{INVITE_PASSWORD_HELPER_MESSAGE}</p>
            </div>

            <div className="login-field">
              <label className="login-field__label" htmlFor="invite-confirm-password">
                Conferma password
              </label>
              <div className="login-password-shell">
                <input
                  id="invite-confirm-password"
                  name="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  className="login-input login-input--password"
                  disabled={isBusy}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Ripeti la password"
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
                  disabled={isBusy}
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

            {mismatchState.isMismatch ? (
              <p className="login-feedback login-feedback--error" role="alert">
                {mismatchState.message}
              </p>
            ) : null}

            {helperMessage ? (
              <p className="login-helper" role="status">
                {isInviteContextLoading
                  ? "Verifica invito protetto in corso..."
                  : helperMessage}
              </p>
            ) : null}

            {activationError ? (
              <p className="login-feedback login-feedback--error" role="alert">
                {activationError.message}
              </p>
            ) : null}

            <div className="login-actions">
              <button
                className="login-submit"
                disabled={isSubmitDisabled}
                type="submit"
              >
                {isSubmitting ? "Attivazione in corso..." : "Attiva accesso"}
              </button>
              <Link
                href="/login"
                className={`login-submit login-submit--secondary${hasTerminalActivationError ? " login-submit--secondary-urgent" : ""}`}
              >
                Torna al login
              </Link>
            </div>
          </form>

          <div className="login-card__footer">
            <ShieldCheck aria-hidden="true" className="login-card__footer-icon" />
            <div className="login-card__support">
              <strong>Accesso protetto.</strong>
              <span>
                Sendwise non mostra, non registra e non salva password o token
                di invito.
              </span>
            </div>
            <ShieldCheck aria-hidden="true" className="login-card__footer-accent" />
          </div>
        </section>
      </div>
    </main>
  );
}
