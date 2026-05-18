Branch: develop

1. Current branch
- `develop`

2. Files created
- `backend/app/core/auth.py`
- `backend/app/repositories/auth_users.py`
- `backend/tests/test_clerk_auth.py`
- `frontend/app/account/[[...account]]/page.tsx`
- `frontend/components/shared/AccountUserButton.tsx`
- `frontend/proxy.ts`
- `docs/branch_handoffs/clerk-auth-vertical-slice-0.9B-handoff.md`

Files removed:
- `backend/tests/test_milestone_05_stubs.py`

3. Files modified
- `backend/app/api/admin.py`
- `backend/app/api/campaigns.py`
- `backend/app/api/client.py`
- `backend/app/core/config.py`
- `backend/app/core/security.py`
- `backend/app/schemas/blocked_sends.py`
- `backend/app/schemas/campaigns.py`
- `backend/requirements.txt`
- `.env.example`
- `frontend/app/layout.tsx`
- `frontend/app/login/page.tsx`
- `frontend/components/layout/AppShell.tsx`
- `frontend/components/layout/Sidebar.tsx`
- `frontend/lib/api.ts`
- `frontend/package.json`
- `frontend/package-lock.json`
- `docs/audit_log.md`

4. Packages added
- Frontend: `@clerk/nextjs`
- Backend: `PyJWT[crypto]`

5. Frontend Clerk summary
- Wrapped the Next.js app with `ClerkProvider` in [frontend/app/layout.tsx](/Users/leonardo/Documents/Sendwise/frontend/app/layout.tsx).
- Replaced the temporary local submit flow in [frontend/app/login/page.tsx](/Users/leonardo/Documents/Sendwise/frontend/app/login/page.tsx) with Clerk `SignIn`, forced default post-login navigation to `/admin`, and disabled the sign-up affordance with `withSignUp={false}`.
- Added [frontend/proxy.ts](/Users/leonardo/Documents/Sendwise/frontend/proxy.ts) using Clerk `clerkMiddleware()` plus explicit matchers for `/admin(.*)`, `/client(.*)`, and `/account(.*)`.
- Added a Clerk-backed user control in the existing shell via [frontend/components/shared/AccountUserButton.tsx](/Users/leonardo/Documents/Sendwise/frontend/components/shared/AccountUserButton.tsx), [frontend/components/layout/AppShell.tsx](/Users/leonardo/Documents/Sendwise/frontend/components/layout/AppShell.tsx), and [frontend/components/layout/Sidebar.tsx](/Users/leonardo/Documents/Sendwise/frontend/components/layout/Sidebar.tsx).

6. Backend Clerk verification summary
- Added centralized auth in [backend/app/core/auth.py](/Users/leonardo/Documents/Sendwise/backend/app/core/auth.py).
- Protected requests now require `Authorization: Bearer <token>`.
- Tokens are verified against Clerk JWKS with signature, expiration, issuer, and optional audience checks.
- `clerk_user_id` is derived from the JWT `sub` claim.
- Missing or invalid tokens return `401`.
- Valid tokens without an allowed Sendwise mapping or without sufficient role or active status return `403`.

7. Route protection summary
- Frontend middleware protection is authentication-only for `/admin`, `/client`, and `/account` in 0.9B.
- Role-specific frontend redirects are intentionally deferred; backend role enforcement remains authoritative.
- Backend protection now covers:
- `GET /admin/clients`
- `GET /admin/campaigns`
- `GET /client/me`
- `GET /client/campaigns`
- `GET /client/usage`
- `GET /client/blocked-sends`
- `POST /campaigns`
- `POST /campaigns/{campaign_id}/authorize`
- `POST /campaigns/{campaign_id}/send`

8. Account/password management summary
- Added [frontend/app/account/[[...account]]/page.tsx](/Users/leonardo/Documents/Sendwise/frontend/app/account/[[...account]]/page.tsx) with Clerk `UserProfile`.
- The topbar `UserButton` is set to `userProfileMode="navigation"` and points to `/account`.
- No custom password form, password-reset form, or local auth state was added.

9. API token attachment summary
- [frontend/lib/api.ts](/Users/leonardo/Documents/Sendwise/frontend/lib/api.ts) remains the only frontend fetch boundary.
- In backend mode, it now calls Clerk server-side `auth().getToken()` and attaches `Authorization: Bearer <session_token>`.
- In mock mode, it keeps the existing no-token behavior.

10. User mapping strategy used
- Used a temporary backend-only `AUTH_USER_MAPPINGS_JSON` repository in [backend/app/repositories/auth_users.py](/Users/leonardo/Documents/Sendwise/backend/app/repositories/auth_users.py).
- This is fail-closed.
- Frontend role or `client_id` is never trusted.
- This must be replaced by `client_users` persistence in 0.9D.

11. Endpoint protection result
- `/health` remains public.
- Protected admin and client endpoints reject missing tokens with `401`.
- Role and active-status checks return `403` when the token is valid but the Sendwise mapping is unauthorized.
- Authorized stub responses keep their existing response shapes.

12. Public signup exposure check
- No `SignUpButton` was added.
- No `/sign-up` route was added.
- `SignIn` is configured with `withSignUp={false}`.
- Public signup still must be disabled manually in the Clerk Dashboard; the app does not expose self-registration UI.

13. Tests executed
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`
- `PYTHONPATH=backend python3 -m pytest backend/tests`
- `grep -R "from .*mock-api" frontend/app frontend/components || true`
- `grep -R "fetch(" frontend/app frontend/components frontend/lib || true`
- `grep -R "listmonk\\|postgres\\|database\\|smtp" frontend/app frontend/components frontend/lib || true`
- `grep -R "localStorage\\|sessionStorage\\|document.cookie" frontend/app frontend/components frontend/lib || true`
- `grep -R "SignUpButton\\|sign-up\\|signup" frontend/app frontend/components frontend/lib || true`

14. Tests not executed and why
- Live Clerk browser verification was not executed because no real Clerk credentials or manually configured restricted-signup instance were provided in this turn.
- No authenticated curl/browser test was run against a real local backend because the live Clerk setup values and mapped Clerk user ids were not available.

15. Live Clerk verification status
- Not executed live.
- Code paths for frontend route protection, token attachment, backend JWT verification, role enforcement, and account/profile navigation are implemented and locally verified through builds plus backend tests.

16. Contract changes requested
- None.

17. Risks remaining
- `frontend/app/login/page.tsx` uses Clerk `SignIn` on `/login` without a `[[...login]]` catch-all route because the allowed scope was limited to `frontend/app/login/page.tsx`; standard login works, but complex nested Clerk path flows should be validated live.
- Backend user mapping is temporary env-backed state, not `client_users` persistence.
- Frontend middleware protects by authentication only; role-aware route UX is still deferred to the backend-verified context.
- Compose files were not expanded to pass Clerk env values through containers in this milestone.

18. Suggested next step
- Milestone `0.9D`: replace `AUTH_USER_MAPPINGS_JSON` with a real `client_users` repository boundary and DB-backed role plus `client_id` resolution.

19. Coordinator Handoff
- The first end-to-end Clerk auth slice is implemented across Next.js and FastAPI.
- Frontend signs users in with Clerk, protects dashboard routes, exposes Clerk-managed account/security UI, and attaches a Clerk session token to backend requests.
- FastAPI verifies Clerk JWTs, derives an internal authenticated user context, and protects existing admin/client endpoints without trusting frontend role or `client_id`.
- The only temporary auth shortcut left is backend-only mapping storage via `AUTH_USER_MAPPINGS_JSON`.

20. Confirmation
- No DB secrets were committed.
- No passwords, password hashes, reset tokens, or session secrets were stored in Sendwise.
- No public signup UI or route was added.
- No real listmonk execution, real sending, AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work was implemented.
