import test from "node:test";
import assert from "node:assert/strict";

import {
  buildInviteActivationPayload,
  getInviteActivationErrorState,
  getInviteActivationFieldNames,
  getInviteActivationErrorMessage,
  getPasswordMismatchState,
  hasCompleteInviteActivationName,
  INVITE_ACTIVATION_DEFAULT_HELPER_MESSAGE,
  INVITE_ACTIVATION_ERROR_CLASSIFICATION,
  INCOMPLETE_INVITE_DATA_MESSAGE,
  INVITE_ACTIVATION_GENERIC_ERROR_MESSAGE,
  INVITE_PASSWORD_HELPER_MESSAGE,
  isInviteActivationTerminalError,
  isInviteActivationSubmitDisabled,
  isInviteNameRequirementError,
  normalizeInviteActivationContext,
  shouldResetInviteActivationErrorOnPasswordEdit,
} from "./clientInviteActivation.js";

test("invite activation fields stay password-only", () => {
  assert.deepEqual(getInviteActivationFieldNames(), [
    "password",
    "confirm-password",
  ]);
});

test("mismatch only appears after confirm password has content", () => {
  assert.equal(
    getPasswordMismatchState("Password123", "").message,
    null,
  );
  assert.equal(
    getPasswordMismatchState("Password123", "Password321").message,
    "Le password non coincidono.",
  );
});

test("submit stays disabled while passwords mismatch", () => {
  assert.equal(
    isInviteActivationSubmitDisabled({
      password: "Password123",
      confirmPassword: "Password321",
      isBusy: false,
    }),
    true,
  );
  assert.equal(
    isInviteActivationSubmitDisabled({
      password: "Password123",
      confirmPassword: "Password123",
      isBusy: false,
    }),
    false,
  );
});

test("pwned password Clerk errors map to the Italian breach message", () => {
  const errorState = getInviteActivationErrorState({
    errors: [
      {
        code: "form_password_pwned",
        message: "Password has been found in an online data breach.",
      },
    ],
  });

  assert.deepEqual(errorState, {
    classification: INVITE_ACTIVATION_ERROR_CLASSIFICATION.GENERIC_TERMINAL,
    isTerminal: true,
    message:
      "Questa password risulta compromessa in violazioni note. Richiedi una nuova email di accesso e scegli una password diversa, più lunga e non collegata al tuo nome.",
  });
});

test("weak password Clerk errors map to the retryable Italian policy message", () => {
  const errorState = getInviteActivationErrorState({
    errors: [
      {
        code: "form_password_length_too_short",
        message: "Password is too short.",
        meta: { param_name: "password" },
      },
    ],
  });

  assert.deepEqual(errorState, {
    classification:
      INVITE_ACTIVATION_ERROR_CLASSIFICATION.RETRYABLE_PASSWORD_POLICY,
    isTerminal: false,
    message:
      "La password non rispetta i requisiti di sicurezza. Usa almeno 12 caratteri con lettere, numeri e simboli.",
  });
});

test("invalid ticket Clerk errors map to the fresh-invite Italian copy", () => {
  const errorState = getInviteActivationErrorState({
    errors: [
      {
        code: "form_ticket_already_used",
        message: "This ticket has already been used.",
      },
    ],
  });

  assert.deepEqual(errorState, {
    classification:
      INVITE_ACTIVATION_ERROR_CLASSIFICATION.TERMINAL_TICKET_INVALID,
    isTerminal: true,
    message:
      "Questo invito non è più valido. Richiedi una nuova email di accesso.",
  });
});

test("terminal ticket errors disable submit", () => {
  assert.equal(
    isInviteActivationSubmitDisabled({
      password: "Password123!",
      confirmPassword: "Password123!",
      hasTerminalError: true,
      isBusy: false,
    }),
    true,
  );
});

test("editing password clears only retryable activation errors", () => {
  const retryablePasswordError = getInviteActivationErrorState({
    errors: [
      {
        code: "form_password_validation_failed",
        message: "Password does not meet the security requirements.",
      },
    ],
  });
  const terminalTicketError = getInviteActivationErrorState({
    errors: [
      {
        code: "form_ticket_invalid",
        message: "Ticket is invalid.",
      },
    ],
  });

  assert.equal(
    shouldResetInviteActivationErrorOnPasswordEdit(retryablePasswordError),
    true,
  );
  assert.equal(
    shouldResetInviteActivationErrorOnPasswordEdit(terminalTicketError),
    false,
  );
  assert.equal(
    INVITE_ACTIVATION_DEFAULT_HELPER_MESSAGE,
    "Completa qui l'attivazione del tuo accesso Sendwise.",
  );
});

test("unknown Clerk errors fall back to the generic safe message", () => {
  assert.equal(
    getInviteActivationErrorMessage({
      errors: [
        {
          code: "unexpected_clerk_error",
          message: "Unexpected upstream failure.",
          longMessage: "Unexpected upstream failure without supported mapping.",
        },
      ],
    }),
    INVITE_ACTIVATION_GENERIC_ERROR_MESSAGE,
  );
});

test("raw Clerk English messages are never returned to the UI", () => {
  const rawEnglishMessage = "Password has been found in an online data breach.";
  const errorState = getInviteActivationErrorState({
    errors: [
      {
        code: "form_password_pwned",
        message: rawEnglishMessage,
      },
    ],
  });

  assert.equal(errorState.message.includes(rawEnglishMessage), false);
  assert.equal(isInviteActivationTerminalError(errorState), true);
  assert.equal(
    INVITE_PASSWORD_HELPER_MESSAGE,
    "Evita nome, cognome, azienda o password gia usate altrove.",
  );
});

test("ticket activation payload sends password without user-entered names by default", () => {
  assert.deepEqual(
    buildInviteActivationPayload({
      ticket: "ticket_123",
      password: "Password123",
      inviteContext: null,
    }),
    {
      strategy: "ticket",
      ticket: "ticket_123",
      password: "Password123",
    },
  );
});

test("ticket activation payload uses provisioned invite names when available", () => {
  assert.deepEqual(
    buildInviteActivationPayload({
      ticket: "ticket_123",
      password: "Password123",
      inviteContext: {
        firstName: "Giulia",
        lastName: "Bianchi",
      },
    }),
    {
      strategy: "ticket",
      ticket: "ticket_123",
      password: "Password123",
      firstName: "Giulia",
      lastName: "Bianchi",
    },
  );
});

test("missing admin-provisioned names stays detectable for controlled Clerk failures", () => {
  assert.equal(hasCompleteInviteActivationName(null), false);
  assert.equal(
    hasCompleteInviteActivationName(
      normalizeInviteActivationContext({
        first_name: "Giulia",
        last_name: "",
      }),
    ),
    false,
  );
  assert.equal(
    isInviteNameRequirementError({
      errors: [
        {
          code: "form_param_missing",
          message: "First name is required",
          meta: { param_name: "first_name" },
        },
      ],
    }),
    true,
  );
  assert.equal(
    INCOMPLETE_INVITE_DATA_MESSAGE,
    "Dati invito incompleti. Richiedi una nuova email di accesso.",
  );
});
