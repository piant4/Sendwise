export const INCOMPLETE_INVITE_DATA_MESSAGE =
  "Dati invito incompleti. Richiedi una nuova email di accesso.";
export const INVITE_ACTIVATION_GENERIC_ERROR_MESSAGE =
  "Non e stato possibile attivare l'accesso. Riprova oppure richiedi una nuova email di accesso.";
export const INVITE_ACTIVATION_DEFAULT_HELPER_MESSAGE =
  "Completa qui l'attivazione del tuo accesso Sendwise.";
export const INVITE_PASSWORD_HELPER_MESSAGE =
  "Evita nome, cognome, azienda o password gia usate altrove.";
export const INVITE_ACTIVATION_RETRYABLE_PASSWORD_MESSAGE =
  "La password non rispetta i requisiti di sicurezza. Usa almeno 12 caratteri con lettere, numeri e simboli.";
export const INVITE_ACTIVATION_PWNED_PASSWORD_MESSAGE =
  "Questa password risulta compromessa in violazioni note. Richiedi una nuova email di accesso e scegli una password diversa, più lunga e non collegata al tuo nome.";
export const INVITE_ACTIVATION_TERMINAL_TICKET_MESSAGE =
  "Questo invito non è più valido. Richiedi una nuova email di accesso.";

export const INVITE_ACTIVATION_ERROR_CLASSIFICATION = {
  RETRYABLE_PASSWORD_POLICY: "retryable_password_policy",
  TERMINAL_TICKET_INVALID: "terminal_ticket_invalid",
  GENERIC_TERMINAL: "generic_terminal",
};

const TERMINAL_TICKET_ERROR_CODES = new Set([
  "form_identifier_not_found",
  "form_ticket_invalid",
  "form_ticket_expired",
  "form_ticket_already_used",
  "form_param_value_invalid",
]);

const TERMINAL_PASSWORD_ERROR_CODES = new Set([
  "form_password_pwned",
  "form_password_compromised",
]);

const RETRYABLE_PASSWORD_ERROR_CODES = new Set([
  "form_password_length_too_short",
  "form_password_size_in_bytes_exceeded",
  "form_password_validation_failed",
  "form_password_too_short",
  "form_password_not_strong_enough",
  "form_password_invalid",
  "form_password_not_allowed",
]);

export function getInviteActivationFieldNames() {
  return ["password", "confirm-password"];
}

export function getInviteActivationErrorState(error) {
  const genericState = buildInviteActivationErrorState({
    classification: INVITE_ACTIVATION_ERROR_CLASSIFICATION.GENERIC_TERMINAL,
    message: INVITE_ACTIVATION_GENERIC_ERROR_MESSAGE,
  });

  if (!error || typeof error !== "object" || !Array.isArray(error.errors)) {
    return genericState;
  }

  const firstError = error.errors[0];
  const errorCode =
    typeof firstError?.code === "string" ? firstError.code.toLowerCase() : "";
  const longMessage =
    typeof firstError?.longMessage === "string"
      ? firstError.longMessage.toLowerCase()
      : "";
  const shortMessage =
    typeof firstError?.message === "string"
      ? firstError.message.toLowerCase()
      : "";
  const passwordParamName =
    typeof firstError?.meta?.param_name === "string"
      ? firstError.meta.param_name.toLowerCase()
      : "";
  const combinedMessage = `${errorCode} ${longMessage} ${shortMessage}`.trim();

  if (
    isTerminalInviteTicketError({
      errorCode,
      combinedMessage,
    })
  ) {
    return buildInviteActivationErrorState({
      classification:
        INVITE_ACTIVATION_ERROR_CLASSIFICATION.TERMINAL_TICKET_INVALID,
      message: INVITE_ACTIVATION_TERMINAL_TICKET_MESSAGE,
    });
  }

  const passwordState = getInviteActivationPasswordErrorState({
    errorCode,
    combinedMessage,
    passwordParamName,
  });
  if (passwordState) {
    return passwordState;
  }

  if (
    combinedMessage.includes("already exists") ||
    combinedMessage.includes("already in use")
  ) {
    return buildInviteActivationErrorState({
      classification: INVITE_ACTIVATION_ERROR_CLASSIFICATION.GENERIC_TERMINAL,
      message:
        "Questo indirizzo e gia collegato a un account Clerk. Accedi dal pannello Sendwise.",
    });
  }

  if (
    combinedMessage.includes("missing") ||
    combinedMessage.includes("required")
  ) {
    return buildInviteActivationErrorState({
      classification: INVITE_ACTIVATION_ERROR_CLASSIFICATION.GENERIC_TERMINAL,
      message: "Completa tutti i campi richiesti per attivare l'accesso.",
    });
  }

  if (
    combinedMessage.includes("not supported") ||
    combinedMessage.includes("unsupported")
  ) {
    return buildInviteActivationErrorState({
      classification: INVITE_ACTIVATION_ERROR_CLASSIFICATION.GENERIC_TERMINAL,
      message:
        "Questo invito richiede un passaggio di sicurezza non supportato direttamente in Sendwise. Accedi dal pannello oppure chiedi una nuova email di accesso.",
    });
  }

  return genericState;
}

export function getInviteActivationErrorMessage(error) {
  return getInviteActivationErrorState(error).message;
}

export function getPasswordMismatchState(password, confirmPassword) {
  const hasConfirmPassword = confirmPassword.trim().length > 0;
  const isMismatch = hasConfirmPassword && password !== confirmPassword;

  return {
    hasConfirmPassword,
    isMismatch,
    message: isMismatch ? "Le password non coincidono." : null,
  };
}

export function isInviteActivationSubmitDisabled({
  password,
  confirmPassword,
  isBusy,
  hasTerminalError = false,
}) {
  const mismatchState = getPasswordMismatchState(password, confirmPassword);

  return (
    hasTerminalError ||
    isBusy ||
    password.trim().length === 0 ||
    confirmPassword.trim().length === 0 ||
    mismatchState.isMismatch
  );
}

export function isInviteActivationTerminalError(errorState) {
  return Boolean(
    errorState &&
      errorState.classification !==
        INVITE_ACTIVATION_ERROR_CLASSIFICATION.RETRYABLE_PASSWORD_POLICY,
  );
}

export function shouldResetInviteActivationErrorOnPasswordEdit(errorState) {
  return (
    errorState?.classification ===
    INVITE_ACTIVATION_ERROR_CLASSIFICATION.RETRYABLE_PASSWORD_POLICY
  );
}

export function normalizeInviteActivationContext(context) {
  if (!context || typeof context !== "object") {
    return null;
  }

  const firstName = normalizeInviteName(context.first_name);
  const lastName = normalizeInviteName(context.last_name);

  if (!firstName && !lastName) {
    return null;
  }

  return {
    firstName,
    lastName,
  };
}

export function hasCompleteInviteActivationName(context) {
  return Boolean(context?.firstName && context?.lastName);
}

export function buildInviteActivationPayload({
  ticket,
  password,
  inviteContext,
}) {
  const payload = {
    strategy: "ticket",
    ticket,
    password,
  };

  if (inviteContext?.firstName) {
    payload.firstName = inviteContext.firstName;
  }

  if (inviteContext?.lastName) {
    payload.lastName = inviteContext.lastName;
  }

  return payload;
}

export function isInviteNameRequirementError(error) {
  if (!error || typeof error !== "object" || !Array.isArray(error.errors)) {
    return false;
  }

  return error.errors.some((entry) => {
    if (!entry || typeof entry !== "object") {
      return false;
    }

    const message = `${entry.longMessage ?? ""} ${entry.message ?? ""}`.toLowerCase();
    const paramName =
      typeof entry.meta?.param_name === "string"
        ? entry.meta.param_name.toLowerCase()
        : "";

    const targetsNameField =
      paramName === "first_name" ||
      paramName === "last_name" ||
      paramName === "firstname" ||
      paramName === "lastname";

    return (
      (message.includes("first name") || message.includes("last name")) &&
      (message.includes("required") || message.includes("missing"))
    ) || targetsNameField;
  });
}

function normalizeInviteName(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue || null;
}

function buildInviteActivationErrorState({ classification, message }) {
  return {
    classification,
    isTerminal:
      classification !==
      INVITE_ACTIVATION_ERROR_CLASSIFICATION.RETRYABLE_PASSWORD_POLICY,
    message,
  };
}

function isTerminalInviteTicketError({ errorCode, combinedMessage }) {
  if (TERMINAL_TICKET_ERROR_CODES.has(errorCode)) {
    return true;
  }

  return (
    combinedMessage.includes("ticket") ||
    combinedMessage.includes("invitation") ||
    combinedMessage.includes("expired") ||
    combinedMessage.includes("already used") ||
    combinedMessage.includes("not found") ||
    combinedMessage.includes("sign_up") ||
    combinedMessage.includes("sign up")
  );
}

function getInviteActivationPasswordErrorState({
  errorCode,
  combinedMessage,
  passwordParamName,
}) {
  if (TERMINAL_PASSWORD_ERROR_CODES.has(errorCode)) {
    return buildInviteActivationErrorState({
      classification: INVITE_ACTIVATION_ERROR_CLASSIFICATION.GENERIC_TERMINAL,
      message: INVITE_ACTIVATION_PWNED_PASSWORD_MESSAGE,
    });
  }

  if (RETRYABLE_PASSWORD_ERROR_CODES.has(errorCode)) {
    return buildInviteActivationErrorState({
      classification:
        INVITE_ACTIVATION_ERROR_CLASSIFICATION.RETRYABLE_PASSWORD_POLICY,
      message: INVITE_ACTIVATION_RETRYABLE_PASSWORD_MESSAGE,
    });
  }

  const targetsPassword =
    passwordParamName === "password" ||
    errorCode.includes("password") ||
    combinedMessage.includes("password");

  if (!targetsPassword) {
    return null;
  }

  if (
    errorCode.includes("pwned") ||
    errorCode.includes("compromised") ||
    combinedMessage.includes("breach")
  ) {
    return buildInviteActivationErrorState({
      classification: INVITE_ACTIVATION_ERROR_CLASSIFICATION.GENERIC_TERMINAL,
      message: INVITE_ACTIVATION_PWNED_PASSWORD_MESSAGE,
    });
  }

  if (
    errorCode.includes("short") ||
    errorCode.includes("length") ||
    errorCode.includes("invalid") ||
    errorCode.includes("validation") ||
    errorCode.includes("size") ||
    errorCode.includes("strength") ||
    errorCode.includes("complexity") ||
    errorCode.includes("strong") ||
    errorCode.includes("not_allowed") ||
    errorCode.includes("disallowed") ||
    combinedMessage.includes("too short") ||
    combinedMessage.includes("not strong enough") ||
    combinedMessage.includes("invalid password") ||
    combinedMessage.includes("does not meet") ||
    combinedMessage.includes("security requirements")
  ) {
    return buildInviteActivationErrorState({
      classification:
        INVITE_ACTIVATION_ERROR_CLASSIFICATION.RETRYABLE_PASSWORD_POLICY,
      message: INVITE_ACTIVATION_RETRYABLE_PASSWORD_MESSAGE,
    });
  }

  return null;
}
