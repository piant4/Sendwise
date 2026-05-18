# Milestone 0.9E.1 — Clerk Redirect Alignment

## 1. Current branch

- `develop`

## 2. Audit findings

- `frontend/app/login/LoginContent.tsx:10` and `:333-337` previously hard-coded the successful Clerk login redirect to `/admin`.
- `frontend/app/login/[[...login]]/page.tsx:8-9` previously redirected every authenticated visit to `/admin`.
- `frontend/app/layout.tsx:21-22` still contains `signInFallbackRedirectUrl="/admin"` and `signInForceRedirectUrl="/admin"`.
- `frontend/proxy.ts:3-18` only protects `/admin`, `/client`, and `/account` by authentication and does not choose access type, so it was not the failing hop.
- `frontend/lib/api.ts` previously had no backend-owned auth-context helper for post-login redirect routing.
- backend runtime auth already resolved trusted `access_type` and trusted `client_id` from `AUTH_USER_MAPPINGS_JSON`, but no minimal `GET /auth/me` endpoint exposed that result to the frontend.

## 3. Flow audited

- Expected contract:
- Clerk authenticates the user.
- FastAPI resolves trusted `access_type` and trusted `client_id`.
- The frontend redirects to `/admin` for `platform_admin` and `/client` for `client` only after backend resolution.
- Observed behavior before fix:
- the custom login completion path redirected straight to `/admin`
- authenticated revisits to `/login` also redirected straight to `/admin`
- First divergence point:
- frontend post-login routing in `frontend/app/login/LoginContent.tsx` and `frontend/app/login/[[...login]]/page.tsx`
- Primary root cause:
- frontend redirect handling was hard-coded before the backend auth context was consulted
- Category:
- frontend API client

## 4. Anti-monolith result

- Verdict: OK
- Touched layers:
- frontend page
- frontend component
- frontend API client
- backend API router
- backend schema
- backend tests
- Boundary check:
- the backend remains the access-type gatekeeper
- no frontend-local role or `client_id` trust was introduced
- no DB or invitation logic was added

## 5. Files created

- `backend/app/api/auth.py`
- `backend/app/schemas/auth.py`
- `frontend/app/auth/redirect/page.tsx`
- `docs/branch_handoffs/clerk-redirect-alignment-0.9E.1-handoff.md`

## 6. Files modified

- `backend/app/api/client.py`
- `backend/tests/test_clerk_auth.py`
- `frontend/app/login/LoginContent.tsx`
- `frontend/app/login/[[...login]]/page.tsx`
- `frontend/lib/api.ts`
- `docs/api_contracts_v1.md`
- `docs/auth_contract_v1.md`
- `docs/audit_log.md`

## 7. Implemented behavior

- `GET /auth/me` now returns the authenticated Sendwise access context with:
  - `access_type`
  - `client_id`
  - `email`
  - `status`
- successful custom Clerk login now routes to `/auth/redirect`
- authenticated revisits to `/login` now route to `/auth/redirect`
- `/auth/redirect` now calls the backend through `frontend/lib/api.ts` and redirects:
  - `platform_admin` -> `/admin`
  - `client` -> `/client`
- post-login redirect resolution now fails closed when backend API mode is not enabled

## 8. Tests executed

- `PYTHONPATH=backend python3 -m pytest backend/tests`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`

## 9. Remaining risks

- `frontend/app/layout.tsx` still hard-codes Clerk fallback and force redirect props to `/admin`. The current custom login flow no longer relies on those props, but a future Clerk-managed redirect path would still need cleanup.
- post-login redirect resolution intentionally fails closed when `NEXT_PUBLIC_USE_MOCK_API=true`; this is correct for the contract but means Clerk login is not compatible with mock-only frontend mode.
- auth context still comes from temporary backend env mapping rather than persisted `client_access` data.

## 10. Scope confirmation

- No DB migration was implemented.
- No `client_access` persistence was implemented.
- No Clerk invitation API was implemented.
- No admin invite flow was implemented.
- No onboarding completion endpoint was implemented.
- No public signup was implemented.
- No custom password form was implemented.
- No custom 2FA was implemented.
- No real listmonk or real sending was implemented.
- No AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase was implemented.
