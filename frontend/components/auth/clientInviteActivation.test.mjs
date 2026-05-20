import test from "node:test";
import assert from "node:assert/strict";

import {
  buildInviteActivationPayload,
  getInviteActivationFieldNames,
  getPasswordMismatchState,
  hasCompleteInviteActivationName,
  INCOMPLETE_INVITE_DATA_MESSAGE,
  isInviteActivationSubmitDisabled,
  isInviteNameRequirementError,
  normalizeInviteActivationContext,
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
