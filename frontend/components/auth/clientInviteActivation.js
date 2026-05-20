export const INCOMPLETE_INVITE_DATA_MESSAGE =
  "Dati invito incompleti. Richiedi una nuova email di accesso.";

export function getInviteActivationFieldNames() {
  return ["password", "confirm-password"];
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
}) {
  const mismatchState = getPasswordMismatchState(password, confirmPassword);

  return (
    isBusy ||
    password.trim().length === 0 ||
    confirmPassword.trim().length === 0 ||
    mismatchState.isMismatch
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
