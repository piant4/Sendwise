# Milestone 0.9E.2 — Clerk Runtime QA with Real Mapped Users

Date: 2026-05-07
Branch: develop

## 1. Current branch

- `develop`

## 2. Files created

- `docs/branch_handoffs/clerk-runtime-qa-0.9E.2-handoff.md`

## 3. Files modified

- `docs/audit_log.md`

## 4. Clerk Dashboard checklist result

- Developer confirmation not available in this workspace for:
- public signup disabled or restricted
- social login disabled if not wanted
- local redirect URLs configured:
- `http://localhost:3000/login`
- `http://localhost:3000/auth/redirect`
- `http://localhost:3000/admin`
- `http://localhost:3000/client`
- `http://localhost:3000/account`
- admin test user exists
- client test user exists
- Clerk user ids copied into `AUTH_USER_MAPPINGS_JSON`
- No Clerk Dashboard change was attempted from code.

## 5. Secret safety result

- `git status --short` was clean before any task output.
- `git diff -- .env .env.local frontend/.env.local backend/.env.local || true` returned no tracked secret diff.
- `git diff --cached -- .env .env.local frontend/.env.local backend/.env.local || true` returned no staged secret diff.
- `frontend/.env.local` exists and contains the expected frontend Clerk keys.
- `backend/.env.local`, repo `.env`, and repo `.env.local` do not exist in this workspace.
- The current shell environment did not contain `CLERK_JWKS_URL`, `CLERK_ISSUER`, or `AUTH_USER_MAPPINGS_JSON`.
- No real secrets were committed or staged during this task.

## 6. Admin user runtime result

- Not executed with a real Clerk-issued admin token.
- Blocking prerequisite:
- backend Clerk runtime env was not present locally:
- `CLERK_JWKS_URL`
- `CLERK_ISSUER`
- `AUTH_USER_MAPPINGS_JSON`
- admin test user credentials or a usable live session were not provided in the workspace.

## 7. Client user runtime result

- Not executed with a real Clerk-issued client token.
- Blocking prerequisite:
- backend Clerk runtime env was not present locally:
- `CLERK_JWKS_URL`
- `CLERK_ISSUER`
- `AUTH_USER_MAPPINGS_JSON`
- client test user credentials or a usable live session were not provided in the workspace.

## 8. Backend `/auth/me` result

- Live negative-path verification passed:
- `GET /auth/me` without auth returned `401` with `{"detail":"Missing bearer token."}`.
- Invalid bearer token did not meet the expected contract because the backend Clerk runtime env was missing:
- `GET /auth/me` with `Authorization: Bearer invalid-token` returned `500` with `{"detail":"Clerk auth is not fully configured on the backend."}`.
- Positive-path verification with real admin or client Clerk tokens was not executable because the required backend Clerk env and mapped runtime users were unavailable.

## 9. 401/403 result

- Live backend checks passed for missing-auth protection:
- `GET /health` returned `200`.
- `GET /auth/me` without auth returned `401`.
- `GET /admin/clients` without auth returned `401`.
- `GET /client/me` without auth returned `401`.
- Automated backend tests passed for protected-role behavior:
- mapped admin can access admin endpoints
- mapped client can access client endpoints
- mapped client is rejected from admin endpoints with `403`
- non-active mappings are rejected with `403`
- Live `403` checks with real Clerk-issued tokens were not executed because the backend Clerk runtime env and live mapped users were unavailable.

## 10. `/account` result

- Signed-out protection was verified live at the frontend edge:
- `HEAD /account` returned `307 Temporary Redirect`
- `location: /login?redirect_url=http%3A%2F%2F127.0.0.1%3A3000%2Faccount`
- Clerk-managed account UI rendering after authentication was not executed because no live signed-in browser session was available.

## 11. Signup/social exposure check

- Live `/login` HTML rendered the custom Sendwise login form with:
- Sendwise branding
- `Accedi` heading
- email field
- password field
- submit button
- No signup link was found in:
- rendered `/login` HTML
- `frontend/app`
- `frontend/components`
- `frontend/lib`
- No social or Google button was found in rendered `/login` HTML.

## 12. Frontend-to-backend token result

- Verified by code inspection:
- `frontend/lib/api.ts` is the only frontend fetch boundary found by grep.
- In backend mode, `frontend/lib/api.ts` calls Clerk `auth().getToken()` and sends `Authorization: Bearer <token>`.
- `frontend/app/auth/redirect/page.tsx` routes through backend-owned `getPostLoginRedirectPath()`.
- `getPostLoginRedirectPath()` resolves `/admin` versus `/client` only from backend `GET /auth/me`.
- Live browser-authenticated token transport was not verified end to end because:
- no live signed-in browser session was available
- backend Clerk runtime env was missing

## 13. Fixes applied, if any

- No application fix was applied.
- No confirmed runtime defect inside the allowed file scope was reproduced independently of the missing local Clerk prerequisites.

## 14. Tests executed

- `git status --short`
- `git diff -- .env .env.local frontend/.env.local backend/.env.local || true`
- `git diff --cached -- .env .env.local frontend/.env.local backend/.env.local || true`
- `PYTHONPATH=backend python3 -m pytest backend/tests`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`
- `grep -R "from .*mock-api" frontend/app frontend/components || true`
- `grep -R "fetch(" frontend/app frontend/components frontend/lib || true`
- `grep -R "listmonk\|postgres\|database\|smtp" frontend/app frontend/components frontend/lib || true`
- `grep -R "localStorage\|sessionStorage\|document.cookie" frontend/app frontend/components frontend/lib || true`
- `grep -R "SignUpButton\|sign-up\|signup" frontend/app frontend/components frontend/lib || true`
- `grep -R "admin_owner\|admin_operator\|client_owner\|client_viewer" backend frontend docs/auth_contract_v1.md docs/data_model_v1.md docs/api_contracts_v1.md || true`
- `grep -R "afterSignInUrl.*admin\|forceRedirectUrl.*admin\|fallbackRedirectUrl.*admin\|router.push('/admin')\|router.replace('/admin')" frontend/app frontend/components frontend/lib || true`
- Live HTTP probes outside the sandbox:
- `curl -i http://127.0.0.1:8000/health`
- `curl -i http://127.0.0.1:8000/auth/me`
- `curl -i http://127.0.0.1:8000/admin/clients`
- `curl -i http://127.0.0.1:8000/client/me`
- `curl -i -H 'Authorization: Bearer invalid-token' http://127.0.0.1:8000/auth/me`
- `curl -I http://127.0.0.1:3000/login`
- `curl -I http://127.0.0.1:3000/admin`
- `curl -I http://127.0.0.1:3000/client`
- `curl -I http://127.0.0.1:3000/account`
- `curl -s http://127.0.0.1:3000/login`

## 15. Tests not executed and why

- Real Clerk-signed admin login flow was not executed because backend Clerk env and mapped live admin credentials were unavailable.
- Real Clerk-signed client login flow was not executed because backend Clerk env and mapped live client credentials were unavailable.
- Unmapped, suspended, and archived live-user runtime probes were not executed because the required backend Clerk env and live negative-case users were unavailable.
- Invalid-credentials browser interaction was not executed in the page itself because the available Playwright browser tooling could not start Chrome on this machine.
- Authenticated visit to `/login`, `/auth/redirect` destination verification, `/account` authenticated rendering, and sign-out return flow were not executed because no live signed-in browser session was available.

## 16. Contract changes requested

- None.

## 17. Risks remaining

- This milestone goal is only partially verified because the real backend Clerk runtime prerequisites were not present locally.
- Backend invalid-token behavior cannot be evaluated against the required `401` contract until real Clerk verification env is supplied.
- Clerk Dashboard restrictions for public signup and social login remain unconfirmed from this workspace.
- End-to-end browser verification remains limited until a usable browser runtime is installed for Playwright or equivalent local browser automation is available.

## 18. Suggested next step

- Provide the real backend Clerk runtime env locally:
- `CLERK_JWKS_URL`
- `CLERK_ISSUER`
- `AUTH_USER_MAPPINGS_JSON`
- Confirm the Clerk Dashboard checklist items and provide real admin and client test-user credentials or a controlled way to obtain live session tokens.
- Rerun this milestone with the existing `/login` frontend and live backend auth mapping to complete the admin, client, `/auth/me`, `/account`, redirect, and sign-out checks end to end.

## 19. Coordinator Handoff

- Repository-level regression checks passed.
- The current frontend contract looks aligned:
- `/login` redirects authenticated users to `/auth/redirect`
- `/auth/redirect` delegates destination selection to backend `GET /auth/me`
- `frontend/lib/api.ts` remains the only frontend fetch boundary and attaches the Clerk bearer token in backend mode
- Live signed-out protection also passed:
- `/admin`, `/client`, and `/account` are protected by Clerk middleware and redirect to `/login`
- The QA pass is blocked from completion by missing backend Clerk env, missing live mapped-user credentials, and unavailable browser automation for interactive sign-in.

## 20. Scope confirmation

- Confirmed: no DB migration, `client_access` persistence, Clerk invitation API, admin invite flow, onboarding endpoint, public signup, custom password form, custom 2FA, real listmonk, real sending, AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase was implemented.
