"use client";

import { useClerk, useSignIn } from "@clerk/nextjs";
import { isClerkAPIResponseError } from "@clerk/nextjs/errors";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useState } from "react";
import { BrandMark } from "../../components/shared/BrandMark";

const LOGIN_REDIRECT_PATH = "/auth/redirect";

type FlowStep = "credentials" | "first_factor" | "second_factor";

type SupportedFactor = {
  strategy: string;
  emailAddressId?: string;
  phoneNumberId?: string;
  safeIdentifier?: string;
};

type VerificationChoice = {
  key: string;
  strategy: "email_code" | "phone_code" | "totp" | "backup_code";
  label: string;
  hint: string;
  emailAddressId?: string;
  phoneNumberId?: string;
  requiresCodeSend: boolean;
};

type FirstFactorChoice = {
  key: string;
  strategy: "email_code" | "phone_code";
  label: string;
  hint: string;
  emailAddressId?: string;
  phoneNumberId?: string;
  requiresCodeSend: true;
};

type SecondFactorChoice = VerificationChoice;

function getItalianAuthErrorMessage(error: unknown) {
  if (isClerkAPIResponseError(error)) {
    const firstError = error.errors[0];
    const errorCode = firstError?.code ?? "";
    const longMessage = firstError?.longMessage?.toLowerCase() ?? "";
    const shortMessage = firstError?.message?.toLowerCase() ?? "";
    const combinedMessage = `${longMessage} ${shortMessage}`.trim();

    if (
      errorCode === "form_password_incorrect" ||
      errorCode === "form_identifier_not_found" ||
      combinedMessage.includes("incorrect password") ||
      combinedMessage.includes("invalid password") ||
      combinedMessage.includes("identifier not found") ||
      combinedMessage.includes("not found")
    ) {
      return "Email o password non validi.";
    }

    if (
      errorCode === "form_code_incorrect" ||
      errorCode === "verification_failed" ||
      combinedMessage.includes("invalid code") ||
      combinedMessage.includes("incorrect code") ||
      combinedMessage.includes("invalid verification code") ||
      combinedMessage.includes("invalid totp") ||
      combinedMessage.includes("invalid backup code")
    ) {
      return "Codice non valido. Controlla e riprova.";
    }

    if (
      errorCode === "verification_expired" ||
      combinedMessage.includes("expired") ||
      combinedMessage.includes("has expired")
    ) {
      return "Codice scaduto. Richiedi un nuovo codice e riprova.";
    }

    if (
      combinedMessage.includes("strategy") &&
      (combinedMessage.includes("not supported") ||
        combinedMessage.includes("not enabled") ||
        combinedMessage.includes("unsupported"))
    ) {
      return "Questo metodo di verifica non e supportato nella UI Sendwise. Contatta il supporto.";
    }

    if (
      errorCode === "too_many_requests" ||
      combinedMessage.includes("too many requests")
    ) {
      return "Troppi tentativi di accesso. Attendi qualche minuto e riprova.";
    }

    if (
      combinedMessage.includes("network") ||
      combinedMessage.includes("timed out") ||
      combinedMessage.includes("unavailable") ||
      combinedMessage.includes("failed to fetch")
    ) {
      return "Servizio di accesso temporaneamente non disponibile. Riprova tra poco.";
    }
  }

  if (error instanceof Error && error.message.toLowerCase().includes("network")) {
    return "Servizio di accesso temporaneamente non disponibile. Riprova tra poco.";
  }

  return "Accesso non riuscito. Verifica le credenziali o contatta il team Sendwise.";
}

function hasPasswordFirstFactor(factors: SupportedFactor[] | null | undefined) {
  return (factors ?? []).some((factor) => factor.strategy === "password");
}

function getSupportedFirstFactorChoices(
  factors: SupportedFactor[] | null | undefined,
) {
  const choices: FirstFactorChoice[] = [];

  for (const factor of factors ?? []) {
    if (factor.strategy === "email_code" && factor.emailAddressId) {
      choices.push({
        key: `first-email:${factor.emailAddressId}`,
        strategy: "email_code",
        label: "Codice via email",
        hint: `Inserisci il codice inviato a ${factor.safeIdentifier ?? "questa email"}.`,
        emailAddressId: factor.emailAddressId,
        requiresCodeSend: true,
      });
    }

    if (factor.strategy === "phone_code" && factor.phoneNumberId) {
      choices.push({
        key: `first-phone:${factor.phoneNumberId}`,
        strategy: "phone_code",
        label: "Codice via telefono",
        hint: `Inserisci il codice inviato a ${factor.safeIdentifier ?? "questo numero"}.`,
        phoneNumberId: factor.phoneNumberId,
        requiresCodeSend: true,
      });
    }
  }

  return choices.sort((left, right) => {
    const priority = { email_code: 0, phone_code: 1 } as const;
    return priority[left.strategy] - priority[right.strategy];
  });
}

function getSupportedSecondFactorChoices(
  factors: SupportedFactor[] | null | undefined,
) {
  const choices: SecondFactorChoice[] = [];

  for (const factor of factors ?? []) {
    if (factor.strategy === "totp") {
      choices.push({
        key: "second-totp",
        strategy: "totp",
        label: "App di autenticazione",
        hint: "Inserisci il codice generato dalla tua app di autenticazione.",
        requiresCodeSend: false,
      });
    }

    if (factor.strategy === "phone_code") {
      choices.push({
        key: "second-phone",
        strategy: "phone_code",
        label: "Codice via telefono",
        hint: `Inserisci il codice inviato a ${factor.safeIdentifier ?? "questo numero"}.`,
        phoneNumberId: factor.phoneNumberId,
        requiresCodeSend: true,
      });
    }

    if (factor.strategy === "email_code") {
      choices.push({
        key: "second-email",
        strategy: "email_code",
        label: "Codice via email",
        hint: `Inserisci il codice inviato a ${factor.safeIdentifier ?? "questa email"}.`,
        emailAddressId: factor.emailAddressId,
        requiresCodeSend: true,
      });
    }

    if (factor.strategy === "backup_code") {
      choices.push({
        key: "second-backup",
        strategy: "backup_code",
        label: "Codice di recupero",
        hint: "Inserisci uno dei codici di recupero associati al tuo account.",
        requiresCodeSend: false,
      });
    }
  }

  return choices.sort((left, right) => {
    const priority = {
      totp: 0,
      phone_code: 1,
      email_code: 2,
      backup_code: 3,
    } as const;

    return priority[left.strategy] - priority[right.strategy];
  });
}

function getUnsupportedFlowMessage(step: FlowStep) {
  if (step === "second_factor") {
    return "Questo account richiede una verifica aggiuntiva non supportata nella UI Sendwise. Contatta il supporto.";
  }

  return "Questo account richiede un metodo di accesso non supportato nella UI Sendwise. Contatta il supporto.";
}

function getStatusMessage(status: string | null) {
  if (status === "needs_new_password") {
    return "Per questo account e richiesto un aggiornamento credenziali gestito dal sistema di identita.";
  }

  if (status === "needs_client_trust") {
    return "Questo accesso richiede una verifica del browser o del dispositivo non supportata nella UI Sendwise. Contatta il supporto.";
  }

  return "Accesso non completato. Contatta il team Sendwise se il problema persiste.";
}

function getCodeSentMessage(choice: VerificationChoice, resend: boolean) {
  if (choice.strategy === "totp" || choice.strategy === "backup_code") {
    return choice.hint;
  }

  if (resend) {
    return `Abbiamo inviato un nuovo codice. ${choice.hint}`;
  }

  return `Abbiamo inviato un codice. ${choice.hint}`;
}

function getCardTitle(step: FlowStep, choice: VerificationChoice | null) {
  if (step === "second_factor") {
    return "Verifica aggiuntiva";
  }

  if (step === "first_factor") {
    if (choice?.strategy === "phone_code") {
      return "Verifica telefono";
    }

    return "Verifica email";
  }

  return "Accedi";
}

function getCardDescription(step: FlowStep, choice: VerificationChoice | null) {
  if (step === "second_factor") {
    return "Inserisci il codice richiesto per completare l'accesso.";
  }

  if (step === "first_factor") {
    return choice?.hint ?? "Completa la verifica del tuo account.";
  }

  return "Accedi con il tuo account Sendwise.";
}

function getVerificationLabel(choice: VerificationChoice | null) {
  if (choice?.strategy === "totp") {
    return "Codice autenticatore";
  }

  if (choice?.strategy === "backup_code") {
    return "Codice di recupero";
  }

  return "Codice";
}

function getVerificationButtonLabel(choice: VerificationChoice | null) {
  if (choice?.strategy === "backup_code") {
    return "Verifica codice di recupero";
  }

  return "Verifica codice";
}

export function LoginContent() {
  const clerk = useClerk();
  const router = useRouter();
  const { fetchStatus, signIn } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [flowStep, setFlowStep] = useState<FlowStep>("credentials");
  const [selectedFactorKey, setSelectedFactorKey] = useState("");
  const [preparedFactorKey, setPreparedFactorKey] = useState<string | null>(null);
  const [helperMessage, setHelperMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const availableChoices =
    flowStep === "first_factor"
      ? getSupportedFirstFactorChoices(
          signIn.supportedFirstFactors as SupportedFactor[] | null | undefined,
        )
      : flowStep === "second_factor"
        ? getSupportedSecondFactorChoices(
            signIn.supportedSecondFactors as SupportedFactor[] | null | undefined,
          )
        : [];

  const selectedChoice =
    availableChoices.find((choice) => choice.key === selectedFactorKey) ??
    availableChoices[0] ??
    null;

  async function completeSignIn() {
    if (!signIn.createdSessionId) {
      setErrorMessage(
        "Accesso completato senza sessione attiva. Contatta il supporto Sendwise.",
      );
      return;
    }

    await clerk.setActive({
      session: signIn.createdSessionId,
      navigate: async () => {
        router.replace(LOGIN_REDIRECT_PATH);
        router.refresh();
      },
    });
  }

  async function sendCodeForChoice(
    step: FlowStep,
    choice: VerificationChoice,
    options?: {
      manageSubmittingState?: boolean;
      resend?: boolean;
    },
  ) {
    const manageSubmittingState = options?.manageSubmittingState ?? true;
    const resend = options?.resend ?? false;

    if (manageSubmittingState) {
      setIsSubmitting(true);
    }

    setErrorMessage(null);

    try {
      if (step === "first_factor") {
        const result =
          choice.strategy === "email_code"
            ? await signIn.emailCode.sendCode(
                choice.emailAddressId
                  ? { emailAddressId: choice.emailAddressId }
                  : undefined,
              )
            : await signIn.phoneCode.sendCode(
                choice.phoneNumberId
                  ? { phoneNumberId: choice.phoneNumberId }
                  : undefined,
              );

        if (result.error) {
          setErrorMessage(getItalianAuthErrorMessage(result.error));
          return;
        }
      }

      if (step === "second_factor") {
        const result =
          choice.strategy === "phone_code"
            ? await signIn.mfa.sendPhoneCode()
            : await signIn.mfa.sendEmailCode();

        if (result.error) {
          setErrorMessage(getItalianAuthErrorMessage(result.error));
          return;
        }
      }

      setPreparedFactorKey(choice.key);
      setHelperMessage(getCodeSentMessage(choice, resend));
    } catch (error) {
      setErrorMessage(getItalianAuthErrorMessage(error));
    } finally {
      if (manageSubmittingState) {
        setIsSubmitting(false);
      }
    }
  }

  async function moveToVerificationStep(nextStep: Extract<FlowStep, "first_factor" | "second_factor">) {
    const nextChoices =
      nextStep === "first_factor"
        ? getSupportedFirstFactorChoices(
            signIn.supportedFirstFactors as SupportedFactor[] | null | undefined,
          )
        : getSupportedSecondFactorChoices(
            signIn.supportedSecondFactors as SupportedFactor[] | null | undefined,
          );

    const currentChoice = nextChoices.find(
      (choice) => choice.key === selectedFactorKey,
    );
    const nextChoice = currentChoice ?? nextChoices[0] ?? null;

    setFlowStep(nextStep);
    setSelectedFactorKey(nextChoice?.key ?? "");
    setVerificationCode("");
    setPreparedFactorKey(null);

    if (!nextChoice) {
      setHelperMessage(null);
      setErrorMessage(getUnsupportedFlowMessage(nextStep));
      return;
    }

    setErrorMessage(null);

    if (!nextChoice.requiresCodeSend) {
      setPreparedFactorKey(nextChoice.key);
      setHelperMessage(nextChoice.hint);
      return;
    }

    await sendCodeForChoice(nextStep, nextChoice, {
      manageSubmittingState: false,
      resend: false,
    });
  }

  async function continueSignInFlow() {
    if (signIn.status === "complete") {
      await completeSignIn();
      return;
    }

    if (signIn.status === "needs_first_factor") {
      await moveToVerificationStep("first_factor");
      return;
    }

    if (signIn.status === "needs_second_factor") {
      await moveToVerificationStep("second_factor");
      return;
    }

    setHelperMessage(null);
    setFlowStep("credentials");
    setPreparedFactorKey(null);
    setErrorMessage(getStatusMessage(signIn.status));
  }

  async function handleCredentialSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setHelperMessage(null);

    if (fetchStatus === "fetching") {
      setErrorMessage(
        "Il servizio di accesso non e ancora pronto. Riprova tra qualche secondo.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const identifyResult = await signIn.create({
        identifier: email.trim(),
      });

      if (identifyResult.error) {
        setErrorMessage(getItalianAuthErrorMessage(identifyResult.error));
        return;
      }

      if (
        signIn.status === "needs_first_factor" &&
        hasPasswordFirstFactor(
          signIn.supportedFirstFactors as SupportedFactor[] | null | undefined,
        )
      ) {
        const passwordResult = await signIn.password({
          identifier: email.trim(),
          password,
        });

        if (passwordResult.error) {
          setErrorMessage(getItalianAuthErrorMessage(passwordResult.error));
          return;
        }
      }

      await continueSignInFlow();
    } catch (error) {
      setErrorMessage(getItalianAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerificationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedChoice) {
      setErrorMessage(getUnsupportedFlowMessage(flowStep));
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      let result: { error: unknown | null } | null = null;
      const code = verificationCode.trim();

      if (flowStep === "first_factor") {
        result =
          selectedChoice.strategy === "email_code"
            ? await signIn.emailCode.verifyCode({ code })
            : await signIn.phoneCode.verifyCode({ code });
      }

      if (flowStep === "second_factor") {
        if (selectedChoice.strategy === "totp") {
          result = await signIn.mfa.verifyTOTP({ code });
        }

        if (selectedChoice.strategy === "phone_code") {
          result = await signIn.mfa.verifyPhoneCode({ code });
        }

        if (selectedChoice.strategy === "email_code") {
          result = await signIn.mfa.verifyEmailCode({ code });
        }

        if (selectedChoice.strategy === "backup_code") {
          result = await signIn.mfa.verifyBackupCode({ code });
        }
      }

      if (result?.error) {
        setErrorMessage(getItalianAuthErrorMessage(result.error));
        return;
      }

      await continueSignInFlow();
    } catch (error) {
      setErrorMessage(getItalianAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleFactorChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextKey = event.target.value;
    const nextChoice =
      availableChoices.find((choice) => choice.key === nextKey) ?? null;

    setSelectedFactorKey(nextKey);
    setVerificationCode("");
    setPreparedFactorKey(null);
    setHelperMessage(nextChoice?.hint ?? null);
    setErrorMessage(null);

    if (!nextChoice?.requiresCodeSend) {
      return;
    }

    await sendCodeForChoice(flowStep, nextChoice, { resend: false });
  }

  async function handleResendCode() {
    if (!selectedChoice || !selectedChoice.requiresCodeSend) {
      return;
    }

    await sendCodeForChoice(flowStep, selectedChoice, { resend: true });
  }

  async function handleResetFlow() {
    setErrorMessage(null);
    setHelperMessage(null);
    setIsSubmitting(true);

    try {
      const result = await signIn.reset();

      if (result.error) {
        setErrorMessage(getItalianAuthErrorMessage(result.error));
        return;
      }

      setFlowStep("credentials");
      setSelectedFactorKey("");
      setPreparedFactorKey(null);
      setVerificationCode("");
      setHelperMessage(null);
    } catch (error) {
      setErrorMessage(getItalianAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  const showCredentialFields = flowStep === "credentials";
  const showVerificationFields = flowStep !== "credentials" && selectedChoice;
  const showFactorSelector = flowStep !== "credentials" && availableChoices.length > 1;
  const showResendButton =
    !!selectedChoice?.requiresCodeSend &&
    preparedFactorKey === selectedChoice.key;
  const isVerificationStep = flowStep !== "credentials";

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

        <section
          className="login-card"
          data-step={isVerificationStep ? "verification" : "credentials"}
        >
          <div className="login-card__header">
            <h2 className="login-card__title">
              {getCardTitle(flowStep, selectedChoice)}
            </h2>
            <p className="login-card__description">
              {getCardDescription(flowStep, selectedChoice)}
            </p>
          </div>

          <form
            aria-label="Modulo di accesso Sendwise"
            className="login-form"
            onSubmit={
              showCredentialFields ? handleCredentialSubmit : handleVerificationSubmit
            }
          >
            {showCredentialFields ? (
              <>
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
                  <div className="login-password-shell">
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      className="login-input login-input--password"
                      disabled={isSubmitting}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Inserisci la password"
                      required
                      value={password}
                    />
                    <button
                      type="button"
                      className="login-password-toggle"
                      aria-label={
                        showPassword ? "Nascondi password" : "Mostra password"
                      }
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
                </div>
              </>
            ) : null}

            {showFactorSelector ? (
              <div className="login-field">
                <label className="login-field__label" htmlFor="login-factor">
                  Metodo di verifica
                </label>
                <select
                  id="login-factor"
                  className="login-input login-select"
                  disabled={isSubmitting}
                  onChange={handleFactorChange}
                  value={selectedChoice?.key ?? ""}
                >
                  {availableChoices.map((choice) => (
                    <option key={choice.key} value={choice.key}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {helperMessage ? (
              <p className="login-helper" role="status">
                {helperMessage}
              </p>
            ) : null}

            {showVerificationFields ? (
              <div className="login-verification-stack">
                <div className="login-field">
                  <label className="login-field__label" htmlFor="login-code">
                    {getVerificationLabel(selectedChoice)}
                  </label>
                  <input
                    id="login-code"
                    name="code"
                    type="text"
                    autoComplete="one-time-code"
                    className="login-input"
                    disabled={isSubmitting}
                    onChange={(event) => setVerificationCode(event.target.value)}
                    placeholder="Inserisci il codice"
                    required
                    value={verificationCode}
                  />
                </div>
              </div>
            ) : null}

            {errorMessage ? (
              <p className="login-feedback login-feedback--error" role="alert">
                {errorMessage}
              </p>
            ) : null}

            {showCredentialFields ? (
              <button
                className="login-submit"
                disabled={fetchStatus === "fetching" || isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Accesso in corso..." : "Accedi"}
              </button>
            ) : showVerificationFields ? (
              <div className="login-actions">
                <button className="login-submit" disabled={isSubmitting} type="submit">
                  {isSubmitting
                    ? "Verifica in corso..."
                    : getVerificationButtonLabel(selectedChoice)}
                </button>

                {showResendButton ? (
                  <button
                    className="login-submit login-submit--secondary"
                    disabled={isSubmitting}
                    onClick={handleResendCode}
                    type="button"
                  >
                    Invia di nuovo il codice
                  </button>
                ) : null}
              </div>
            ) : null}

            {flowStep !== "credentials" ? (
              <button
                className="login-reset-action"
                disabled={isSubmitting}
                onClick={handleResetFlow}
                type="button"
              >
                Usa un&apos;altra email
              </button>
            ) : null}
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
