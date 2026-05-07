# Auth Contract V1

Source of truth: `project_handoff_v1.md`.

Status: planned contract only for Milestones 0.9B through 0.9F. Clerk is not implemented in the current repo state, frontend login remains non-production, and backend protected routes still use a placeholder API-key dependency rather than Clerk verification.

## 1. Auth decision

- Clerk is used for identity and session management.
- FastAPI is used for authorization and data access decisions.
- Business PostgreSQL stores Sendwise user, client, and role mapping.
- Clerk is not the business source of truth.
- UI does not decide tenant or `client_id`.
- Backend-resolved role and `client_id` remain authoritative for every protected request.

## 2. Public signup policy

- Public signup is disabled.
- No self-registration is allowed.
- No user may choose their own client.
- New users are created or invited by the Admin Dashboard flow only.
- Restricted signup or invitation-only behavior must be enforced in Clerk configuration during implementation.

## 3. Roles and access model

Canonical planned roles for the Clerk integration milestones:

- `admin_owner`
- `admin_operator`
- `client_owner`
- `client_viewer`

Access rules:

- `admin_owner` and `admin_operator` may access `/admin` and admin APIs.
- `client_owner` and `client_viewer` may access `/client` and client APIs only.
- Client roles must never access admin routes or admin data.
- Admin roles may inspect client data through admin endpoints only.
- Frontend route grouping is not a trust boundary by itself; backend authorization remains authoritative.

## 4. Business DB mapping

Planned table: `client_users`

Minimum fields:

- `id`
- `client_id` nullable for platform admins if needed
- `clerk_user_id`
- `clerk_org_id` nullable
- `email`
- `role`
- `status`
- `created_at`
- `updated_at`

Allowed statuses:

- `invited`
- `active`
- `suspended`
- `archived`

Rules:

- `clerk_user_id` must be unique.
- Client users must have `client_id`.
- Platform admins may have `client_id = null` or a dedicated platform scope.
- Disabled or suspended users cannot access data.
- Backend always resolves `client_id` from DB mapping, never from frontend input.
- No password or password-hash fields are allowed in `client_users`.

## 5. Password and account management

- Clerk owns password management, authentication credentials, session lifecycle, password reset, MFA or security settings, and account security flows.
- Sendwise Business PostgreSQL must never store user passwords, password hashes, password reset tokens, or session secrets.
- Users must be able to modify their password through Clerk-managed account or security UI.
- V1 should expose a protected account settings route such as `/account` or `/user-profile` using Clerk `UserProfile`.
- The user menu may expose a `Manage account` entry through Clerk `UserButton` or `UserProfile`.
- No custom password-change form is included in V1.
- No password is sent to FastAPI.
- No password change endpoint is added to FastAPI for user credentials.
- No password values are logged or returned.

## 6. Token and request flow

Planned runtime flow:

```txt
Browser
  -> Clerk session
  -> Next.js protected route
  -> frontend/lib/api.ts attaches Clerk session token to backend requests
  -> FastAPI verifies token
  -> FastAPI resolves clerk_user_id
  -> FastAPI loads client_users mapping
  -> FastAPI derives role + client_id
  -> service/repository queries are scoped by client_id
  -> response returned to UI
```

Important rules:

- Frontend can send a token.
- Frontend cannot send trusted role or trusted `client_id`.
- Backend ignores `client_id` from frontend for client routes.
- Backend authorization remains the gatekeeper even when the frontend route is already protected.

## 7. Frontend route protection plan

Planned Next.js route policy:

- `/login` is public.
- `/account` or `/user-profile` is protected for authenticated users.
- `/admin` is protected for admin roles.
- `/client` is protected for client roles.
- Unauthenticated users redirect to `/login` or Clerk sign-in.
- Unauthorized role access returns a safe redirect or dedicated error page.

Implementation rule:

- Clerk Next.js routes must be explicitly protected during implementation; route naming alone is not sufficient.

## 8. Backend authorization plan

Planned FastAPI auth helpers:

- `verify_clerk_token`
- `get_current_user`
- `require_admin`
- `require_client`
- `require_client_scope`

Responsibilities:

- `verify_clerk_token` validates the Clerk-issued token and extracts trusted claims.
- `get_current_user` loads the authenticated Sendwise user context from Business PostgreSQL.
- `require_admin` allows only `admin_owner` and `admin_operator`.
- `require_client` allows only `client_owner` and `client_viewer`.
- `require_client_scope` enforces backend-owned `client_id` scoping for client resources.

Rule:

- Every protected backend endpoint must receive an authenticated Sendwise user context.

Current repo note:

- The existing placeholder API-key dependency shows route shape only and is not the long-term auth contract.

## 9. Existing endpoint classification

Public:

- `GET /health`

Admin protected future:

- `GET /admin/clients`
- `GET /admin/campaigns`
- future `POST /admin/clients`
- future client-management endpoints under `/admin/clients/*`
- future admin reporting or system endpoints under `/admin/*`

Client protected future:

- `GET /client/me`
- `GET /client/campaigns`
- `GET /client/usage`
- `GET /client/blocked-sends`

Campaign protected future:

- `POST /campaigns/{campaign_id}/authorize`
- `POST /campaigns/{campaign_id}/send`

Internal or service protected future:

- `POST /events/listmonk`
- `POST /events/provider`
- future background-job endpoints
- future system endpoints

## 10. Admin-created account flow

Planned flow:

```txt
Admin Dashboard
  -> POST /admin/clients/{client_id}/users or POST /admin/users
  -> FastAPI validates admin role
  -> FastAPI creates or invites Clerk user
  -> FastAPI creates client_users mapping
  -> User receives invite and sets access
  -> User logs in through Clerk
  -> Backend resolves role and client_id
```

Rules:

- No public signup.
- No client self-provisioning.
- Invite failure must not create inconsistent DB state.
- Clerk and DB sync needs a transactional or compensating strategy.

Recommended default:

- Finalize the `client_users` row only after the Clerk create or invite action succeeds; if the DB write then fails, run a compensating deactivate or cleanup path and log reconciliation.

## 11. Credential and secret storage contract

User credentials:

- Owned by Clerk.
- Not stored in Sendwise Business DB.
- Not logged by backend or frontend.
- Not accepted by Sendwise backend endpoints.

Business user mapping:

- `client_users` stores mapping, role, status, and client scope only.

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

## 12. Database deployment recommendation

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

## 13. Backend connection priority

Phase 0.9B:

- Install and configure Clerk frontend foundation.
- Protect frontend routes.
- Add an account or profile route for password and security management.
- Prepare `frontend/lib/api.ts` token attachment.
- Keep backend stubs unchanged.
- No DB auth yet.

Phase 0.9C:

- Add backend token verification skeleton.
- Add auth dependencies.
- Keep existing endpoint response shapes.
- Return safe `401` or `403` where appropriate.

Phase 0.9D:

- Add `client_users` data model, migration, and stub repository.
- Map Clerk user to internal user.
- Protect `/admin` and `/client` backend endpoints.

Phase 0.9E:

- Add admin-created user invitation flow.

## 14. Env contract

Planned frontend env vars:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL` if needed
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL` should not be exposed for public signup

Planned backend env vars:

- `CLERK_ISSUER`
- `CLERK_JWKS_URL` or equivalent Clerk JWT verification config
- `CLERK_SECRET_KEY` only if backend needs Clerk API access
- `CLERK_WEBHOOK_SECRET` if webhooks are used later

Planned managed DB or secret env vars:

- `DATABASE_URL` for managed PostgreSQL if used
- `SENDWISE_SECRETS_ENCRYPTION_KEY` only when encrypted `client_secrets` is implemented

Clarification:

- Exact env names may be finalized during implementation based on official Clerk or framework SDK behavior.

## 15. Security invariants

- No public signup.
- No frontend-trusted `client_id`.
- No frontend-trusted role.
- No password storage in Sendwise DB.
- No custom password-change endpoint in FastAPI for Clerk users.
- Backend verifies every protected request.
- Client data is always scoped by backend-resolved `client_id`.
- Admin actions require an admin role.
- listmonk is never called directly from the frontend.
- Business PostgreSQL is never called directly from the frontend.
- Webhooks and internal endpoints must not use user session auth.
- Mailpit remains dev or staging only.

## 16. Non-goals

This contract milestone does not implement or approve:

- Real implementation
- Signup
- Billing
- Enterprise SSO
- Organization-switching UI
- User self-service team management beyond password and account security through Clerk
- Full admin user CRUD
- Clerk webhook sync
- Production secrets setup
- Managed database migration

## 17. Open questions

These do not block the contract. Recommended defaults are included.

- Platform admin scope model: default to `client_id = null` for platform admins unless a dedicated platform tenant becomes necessary for reporting or foreign-key simplicity.
- Clerk organizations: default to deferring real Clerk Organizations usage and keep `clerk_org_id` nullable until multi-org workflows are proven necessary.
- Invitation API flow: default to a backend-owned admin endpoint that calls Clerk invite or create APIs and then writes the DB mapping.
- Backend JWT verification library and config: default to issuer plus JWKS validation with cached keys and explicit claim checks in FastAPI.
- Final `401` or `403` UX: default unauthenticated users to `/login` and authenticated-but-unauthorized users to a safe redirect or dedicated unauthorized page.
- Account route name: default to `/account`; use `/user-profile` only if Clerk component routing is materially simpler.
- Managed PostgreSQL provider choice: default to Neon for pilot speed and reassess Aiven for stronger production operations.

## 18. Recommended implementation milestones

- `0.9B Clerk Frontend Foundation + Account Route`
- `0.9C FastAPI Auth Verification Skeleton`
- `0.9D User Mapping + Protected Backend Stubs`
- `0.9E Admin-created User Flow`
- `0.9F Managed DB / Secrets Planning if needed`
