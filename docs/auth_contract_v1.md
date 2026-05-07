# Auth Contract V1

Source of truth: `project_handoff_v1.md`.

Status: planned contract only for Milestones `0.9B` through `0.9F`. Clerk is not implemented as the real production auth path in the current repo state, frontend login remains non-production, and backend protected routes still use placeholder auth behavior. This file defines the intended V1 contract only.

## 1. Auth decision

- Clerk is the identity and session provider.
- FastAPI is the authorization gatekeeper and resolves trusted access scope.
- Business PostgreSQL is the business source of truth.
- Public signup is disabled.
- Passwords remain Clerk-owned.
- Sendwise never stores passwords, password hashes, password reset tokens, or session secrets.
- The frontend never decides trusted `client_id`.
- Backend resolves `client_id` from the authenticated Clerk identity mapping.

## 2. V1 access model

V1 supports exactly two access types:

- one platform admin account
- one client account per client

V1 explicitly does not support:

- client companies with sub-users
- customer teams
- multiple logins per client
- role selection
- admin or client type selectors
- client-selected scope

Future multi-user or team support may be added later, but it is outside V1.

## 3. Platform admin model

- There is one internal Sendwise platform admin account in V1.
- The platform admin can access `/admin` and admin APIs only.
- The platform admin can create and manage clients.
- The platform admin can invite, re-invite, revoke, suspend, and reactivate client access.
- The platform admin is not created through the client invitation flow.
- The platform admin is not a client account.
- The platform admin does not have a `client_id`.
- Backend recognition of the platform admin is controlled through secure backend-only configuration or a temporary backend auth mapping until a fuller admin model exists.
- The platform admin is not represented as a selectable role in the UI.

## 4. Client account model

- A Sendwise client is the actual customer profile, person, or account that logs into `/client`.
- Each client has exactly one Clerk-backed login access in V1.
- A client account can access `/client` only.
- A client account can see and manage only its own campaigns, limits, blocked sends, and dashboard data.
- A client account cannot access `/admin`.
- A client account cannot manage sub-users or team members in V1.
- A client account must have a personal name after onboarding.
- A client account may have an optional company, studio, or brand name.

## 5. Business DB contract

Planned V1 split:

- `clients` stores business profile data for the customer profile.
- `client_access` stores Clerk-backed access and invitation mapping for that client.

Rules:

- `clients` is the business profile source of truth.
- `client_access` is the auth and invitation mapping source of truth for client login access.
- Backend resolves `client_id` from `client_access`, never from frontend input.
- V1 has one `client_access` row per client.
- V1 has no `client_users` table.
- V1 has no role field for client access.

## 6. Onboarding and profile contract

During invitation acceptance and onboarding:

- the client sets the password through Clerk
- the client provides `personal_name`
- the client may provide optional `company_name`

Field meaning:

- `personal_name` is a required product profile field for completed onboarding
- `company_name` is an optional product profile field that may represent a company, studio, or brand label

Storage rules:

- Clerk stores and manages passwords and password security state
- Sendwise Business PostgreSQL stores `personal_name` and optional `company_name`
- Sendwise does not store password values or password-management secrets

Account-management rule:

- account, password, and security management remain Clerk-owned through a protected route such as `/account`

## 7. Token and request flow

Planned runtime flow:

```txt
Browser
  -> Clerk session
  -> Next.js protected route
  -> frontend/lib/api.ts attaches Clerk session token to backend requests
  -> FastAPI verifies token
  -> FastAPI resolves Clerk identity
  -> FastAPI checks backend-controlled platform-admin mapping or client_access mapping
  -> FastAPI derives trusted access type
  -> FastAPI derives trusted client_id for client requests only
  -> service/repository queries are scoped by backend-owned client_id
  -> response returned to UI
```

Important rules:

- Frontend may send a Clerk token.
- Frontend must not send trusted `client_id`.
- Frontend must not send trusted access type.
- After Clerk login completes, the frontend must resolve the authenticated Sendwise access context through a backend-owned endpoint such as `GET /auth/me` before choosing `/admin` or `/client`.
- Frontend must not infer `/admin` versus `/client` from local state, Clerk metadata, or user input.
- Backend ignores any frontend attempt to choose client scope.
- Backend authorization remains the gatekeeper even when the frontend route is already protected.

## 8. Frontend route protection plan

Planned Next.js route policy:

- `/login` is public
- `/account` is protected for authenticated users through Clerk-managed account UI
- `/admin` is protected for the platform admin only
- `/client` is protected for invited and active client accounts only
- unauthenticated users redirect to `/login` or Clerk sign-in
- authenticated but unauthorized users get a safe redirect or dedicated unauthorized page

Implementation rule:

- Route naming is not a trust boundary. Clerk route protection and backend authorization must both be enforced during implementation.

## 9. Backend authorization plan

Planned FastAPI auth helpers:

- `verify_clerk_token`
- `get_current_auth_context`
- `require_platform_admin`
- `require_client_account`
- `require_client_scope`

Responsibilities:

- `verify_clerk_token` validates the Clerk-issued token and extracts trusted identity claims
- `get_current_auth_context` loads the authenticated Sendwise auth context from backend-controlled mapping
- `require_platform_admin` allows only the configured platform admin account
- `require_client_account` allows only an active client access mapping
- `require_client_scope` enforces backend-owned `client_id` scoping for client resources

Rule:

- Every protected backend endpoint must receive an authenticated Sendwise auth context.

Current repo note:

- The existing placeholder API-key dependency shows route shape only and is not the long-term auth contract.

## 10. Existing endpoint classification

Public:

- `GET /health`

Platform-admin protected future:

- `GET /admin/clients`
- `POST /admin/clients`
- `GET /admin/clients/{client_id}`
- `PATCH /admin/clients/{client_id}`
- `POST /admin/clients/{client_id}/invite-access`
- `POST /admin/clients/{client_id}/revoke-access`
- `POST /admin/clients/{client_id}/suspend-access`
- `POST /admin/clients/{client_id}/reactivate-access`
- `GET /admin/campaigns`
- `GET /admin/blocked-sends`
- `GET /admin/api-usage`

Client protected future:

- `GET /client/me`
- `GET /client/campaigns`
- `GET /client/usage`
- `GET /client/blocked-sends`
- `POST /client/onboarding/complete`

Campaign protected future:

- `POST /campaigns/{campaign_id}/authorize`
- `POST /campaigns/{campaign_id}/send`

Internal or service protected future:

- `POST /events/listmonk`
- `POST /events/provider`
- future background-job endpoints
- future system endpoints

## 11. Planned client invitation and access flow

Planned future flow:

```txt
Admin Sendwise opens /admin/clients
  -> Admin creates or opens a client profile
  -> Admin enters client email
  -> POST /admin/clients/{client_id}/invite-access
  -> FastAPI verifies platform admin
  -> FastAPI creates Clerk invitation programmatically
  -> FastAPI stores pending client access mapping for that client
  -> Clerk sends invitation email
  -> Client opens invite link
  -> Client lands on Sendwise-controlled onboarding route
  -> Client sets password through Clerk
  -> Client completes Sendwise profile:
       personal_name
       optional company_name
  -> Backend activates access mapping
  -> Client accesses /client
```

Rules:

- no role input
- no user type selector
- no team or sub-user management
- no public signup
- no password set by admin
- client sets and manages password through Clerk
- `personal_name` is required for completed onboarding
- `company_name` is optional
- `client_id` comes from backend path context, not from user input
- one active client access per client in V1

Recommended default:

- finalize the active `client_access` mapping only after the Clerk invitation or acceptance step succeeds and the onboarding profile is complete

## 12. Future admin and client UI notes

Future `/admin/clients` create or edit form should contain:

- client email
- optional initial personal name if known
- optional company, studio, or brand label if known

It should not contain:

- role selector
- admin or client selector
- permission selector
- team member management
- multiple users list in V1

Future `/client` onboarding should collect:

- `personal_name`
- optional `company_name`

Future `/client` behavior:

- the logged-in client account manages only its own campaigns and data

## 13. Password and account management

- Clerk owns password management, authentication credentials, session lifecycle, password reset, MFA or security settings, and account-security flows.
- Users must be able to modify their password through Clerk-managed account or security UI.
- V1 should expose a protected account settings route such as `/account` using Clerk `UserProfile`.
- The user menu may expose a `Manage account` entry through Clerk `UserButton` or equivalent Clerk UI.
- No custom password-change form is included in V1.
- No password is sent to FastAPI.
- No password-change endpoint is added to FastAPI for user credentials.
- No password values are logged or returned.

## 14. Credential and secret storage contract

User credentials:

- Owned by Clerk
- Not stored in Sendwise Business DB
- Not logged by backend or frontend
- Not accepted by Sendwise backend endpoints

Business profile and access mapping:

- `clients` stores business profile data only
- `client_access` stores auth mapping, invitation state, and client scope only

Technical secrets, V1 initial:

- Store global provider secrets in environment variables or deployment secret storage.
- Do not store secrets in application tables unless strictly needed.

Future per-client provider secrets:

If Sendwise later supports per-client SMTP, SES, or API credentials, add encrypted table `client_secrets`.

Minimum fields:

- `id`
- `client_id`
- `provider`
- `secret_type`
- `encrypted_value`
- `key_version`
- `status`
- `last_verified_at`
- `created_at`
- `updated_at`

Rules:

- Never store provider, API, or SMTP secrets in cleartext.
- Never return secret values to frontend.
- Never log secret values.
- Frontend may show metadata only: `provider`, configured or not configured, `last_verified_at`, and `status`.
- Access remains backend-only.
- Encryption keys must come from deployment secret storage, not from the database.

## 15. Database deployment recommendation

Development and local:

- PostgreSQL in Docker Compose remains acceptable.

Pilot and production:

- Use managed PostgreSQL where possible.
- Recommended first option: Neon Postgres for staging and pilot speed.
- Stronger production option: Aiven PostgreSQL.
- Render PostgreSQL is acceptable when the rest of the stack is hosted on Render.

Supabase:

- Not the preferred default because Sendwise already uses Clerk for auth and FastAPI for backend APIs.
- It may be used only as managed PostgreSQL if deliberately chosen.
- V1 must not depend on Supabase Auth, RLS, or generated APIs.

Invariant:

- The application must remain PostgreSQL-compatible and must not depend on provider-specific database features in V1.

## 16. Backend connection priority

Phase `0.9B`:

- install and configure Clerk frontend foundation
- protect frontend routes
- add an account route for password and security management
- prepare `frontend/lib/api.ts` token attachment
- keep backend stubs unchanged
- no DB auth yet

Phase `0.9C`:

- add backend token verification skeleton
- add auth dependencies
- keep existing endpoint response shapes
- return safe `401` or `403` where appropriate

Phase `0.9D`:

- align contracts and planned persistence around `clients` plus `client_access`
- add protected backend stubs that depend on backend-resolved auth context
- defer schema changes and runtime implementation to an explicitly approved implementation milestone

Phase `0.9E`:

- add platform-admin client invitation and access-management flow

## 17. Env contract

Planned frontend env vars:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL` if needed
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL` should not be exposed for public signup

Planned backend env vars:

- `CLERK_ISSUER`
- `CLERK_JWKS_URL` or equivalent Clerk JWT verification config
- `CLERK_SECRET_KEY` only if backend needs Clerk API access
- backend-only platform-admin identifier or mapping env if temporary admin recognition is used
- `CLERK_WEBHOOK_SECRET` if webhooks are used later

Planned managed DB or secret env vars:

- `DATABASE_URL` for managed PostgreSQL if used
- `SENDWISE_SECRETS_ENCRYPTION_KEY` only when encrypted `client_secrets` is implemented

Clarification:

- Exact env names may be finalized during implementation based on official Clerk or framework SDK behavior.

## 18. Security invariants

- No public signup.
- No frontend-trusted `client_id`.
- No frontend-trusted access type.
- No password storage in Sendwise DB.
- No custom password-change endpoint in FastAPI for Clerk users.
- Backend verifies every protected request.
- Client data is always scoped by backend-resolved `client_id`.
- Platform-admin recognition is backend-controlled.
- A client account cannot access admin endpoints.
- Invited, suspended, and archived client access cannot access protected client data.
- listmonk is never called directly from the frontend.
- Business PostgreSQL is never called directly from the frontend.
- Webhooks and internal endpoints must not use user session auth.
- Mailpit remains dev or staging only.

## 19. Non-goals

This contract milestone does not implement or approve:

- real runtime implementation
- public signup
- billing
- enterprise SSO
- organization-switching UI
- client team or sub-user management
- full admin user CRUD beyond the single platform-admin approach
- Clerk webhook sync
- production secrets setup
- managed database migration

## 20. Open questions

These do not block the contract. Recommended defaults are included.

- platform-admin recognition: default to a backend-only configured Clerk user id or temporary secure auth mapping until a fuller admin model exists
- invitation error compensation: default to a backend-owned invite flow that can reconcile Clerk invitation state and pending `client_access` state if one write succeeds and the other fails
- backend JWT verification library and config: default to issuer plus JWKS validation with cached keys and explicit claim checks in FastAPI
- final `401` and `403` UX: default unauthenticated users to `/login` and authenticated-but-unauthorized users to a safe redirect or dedicated unauthorized page
- account route name: default to `/account`
- managed PostgreSQL provider choice: default to Neon for pilot speed and reassess Aiven for stronger production operations

## 21. Recommended implementation milestones

- `0.9B Clerk Frontend Foundation + Account Route`
- `0.9C FastAPI Auth Verification Skeleton`
- `0.9D Auth/Data/API Contract Simplification`
- `0.9E Admin-created Client Access Flow`
- `0.9F Managed DB / Secrets Planning if needed`
