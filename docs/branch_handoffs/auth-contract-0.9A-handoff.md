Branch: develop

1. Current branch
- `develop`

2. Task completed
- Milestone 0.9A - Clerk Auth Contract + Backend Integration Plan
- Created the Sendwise auth contract for a future Clerk integration without changing frontend runtime code, backend runtime code, DB schema, Docker config, or package state.

3. Files created
- `docs/auth_contract_v1.md`
- `docs/branch_handoffs/auth-contract-0.9A-handoff.md`

4. Files modified
- `docs/architecture_v1.md`
- `docs/data_model_v1.md`
- `docs/audit_checklist_v1.md`
- `docs/audit_log.md`

5. Auth decision summary
- Clerk is the planned identity and session provider.
- FastAPI remains the authorization gatekeeper.
- Business PostgreSQL remains the business source of truth for user, role, and client mapping.
- Frontend routes and tokens are not trusted as business scope by themselves.

6. Signup and account-creation policy
- Public signup is disabled.
- No self-registration is allowed.
- New users are created or invited only from admin-owned flows.
- Users cannot choose their own `client_id`.

7. Password and account-management policy
- Clerk owns passwords, password reset, MFA or security settings, and account-security UI.
- Sendwise must not store passwords, password hashes, password reset tokens, or session secrets.
- V1 should expose a protected `/account` or `/user-profile` route backed by Clerk-managed UI rather than a custom password form.

8. Credential and secret storage policy
- User credentials stay in Clerk only.
- Business PostgreSQL stores only user mapping, role, status, and client scope.
- Global provider secrets stay in env or deployment secret storage first.
- A future `client_secrets` table is planned only for encrypted per-client provider credentials, with backend-only access and no cleartext logging or frontend return.

9. DB deployment recommendation
- Local development may keep PostgreSQL in Docker Compose.
- Neon Postgres is the default recommendation for staging or pilot speed.
- Aiven PostgreSQL is the stronger production recommendation.
- Render PostgreSQL is acceptable when the stack is hosted on Render.
- Supabase is not the default because Clerk and FastAPI already own auth and API responsibilities.

10. Role and access model summary
- Planned roles: `admin_owner`, `admin_operator`, `client_owner`, `client_viewer`.
- Admin roles access `/admin` and admin APIs.
- Client roles access `/client` and client APIs only.
- Client scope is always backend-resolved from the DB mapping, never chosen by the frontend.

11. Backend integration plan
- 0.9C adds Clerk token verification and auth dependencies while preserving current response shapes.
- 0.9D adds `client_users` persistence and resolves role plus `client_id` inside FastAPI.
- Protected backend endpoints should standardize on `verify_clerk_token`, `get_current_user`, `require_admin`, `require_client`, and `require_client_scope`.

12. Frontend integration plan
- 0.9B adds Clerk frontend foundation, protected route policy, an account-management route, and Clerk token attachment in `frontend/lib/api.ts`.
- `/login` stays public.
- `/admin` becomes admin-only, `/client` becomes client-only, and `/account` or `/user-profile` becomes authenticated-only.

13. Data-model mapping plan
- `client_users` is the planned Clerk-to-business mapping table with `clerk_user_id`, optional `clerk_org_id`, role, status, email, timestamps, and nullable `client_id` for platform admins if needed.
- Allowed statuses are `invited`, `active`, `suspended`, and `archived`.
- No password-related fields belong in `client_users`.

14. Existing endpoint protection classification
- Public: `GET /health`
- Admin protected future: `/admin/*`
- Client protected future: `/client/*`
- Campaign protected future: `POST /campaigns/{campaign_id}/authorize`, `POST /campaigns/{campaign_id}/send`
- Internal or service protected future: `POST /events/listmonk`, `POST /events/provider`, future background-job and system endpoints

15. Recommended next milestones
- `0.9B Clerk Frontend Foundation + Account Route`
- `0.9C FastAPI Auth Verification Skeleton`
- `0.9D User Mapping + Protected Backend Stubs`
- `0.9E Admin-created User Flow`
- `0.9F Managed DB / Secrets Planning if needed`

16. Tests executed
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`

17. Tests not executed and why
- Frontend build and lint were not run because no frontend runtime code changed.
- Backend pytest was not run because no backend runtime code or tests changed.

18. Contract changes requested
- Added `docs/auth_contract_v1.md` as the planned auth contract source for Clerk identity, FastAPI authorization, DB mapping, and rollout phases.
- Added non-breaking pointer or planning notes in architecture, data-model, and audit-checklist docs so the new contract does not drift from existing repo guidance.

19. Risks and open questions
- The runtime still uses placeholder auth behavior and mock or stub role values; implementation milestones must align code to the new canonical roles.
- Open decisions remain around platform-admin scoping, Clerk Organizations timing, invitation error-compensation, exact JWT verification config, final `401` or `403` UX, account route naming, and managed PostgreSQL provider choice.

20. Suggested next step
- Start Milestone `0.9B` by wiring Clerk into the frontend only: add Clerk foundation, protected route policy, account-management route, and token attachment preparation while leaving backend auth and DB mapping unchanged.

21. Coordinator handoff
- `develop` now contains the approved auth contract and integration rollout plan only.
- The contract preserves Sendwise architecture: Clerk for identity, FastAPI as gatekeeper, Business PostgreSQL as business truth, listmonk as engine-only, and no frontend trust of `client_id`.
- No runtime implementation was added; the next executor should use `docs/auth_contract_v1.md` as the planning source for Milestones `0.9B` through `0.9F`.

22. Confirmation
- No frontend runtime code, backend runtime code, DB migration, Docker config, Clerk install, real auth, signup, password implementation, token or cookie or storage logic, real listmonk, real sending, AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase was implemented.
