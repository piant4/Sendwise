# Milestone 0.9E.2 Completion — Real Clerk Mapped Users Verification

Date: 2026-05-08
Branch: develop

## 1. Current branch

- `develop`

## 2. Files created

- `docs/branch_handoffs/clerk-runtime-qa-complete-0.9E.2-handoff.md`

## 3. Files modified

- `docs/audit_log.md`

## 4. Secret safety result

- `git status --short` was clean before edits.
- `git diff -- .env .env.local frontend/.env.local backend/.env.local || true` returned no tracked secret diff.
- `git diff --cached -- .env .env.local frontend/.env.local backend/.env.local || true` returned no staged secret diff.
- `git check-ignore -v .env frontend/.env.local || true` confirmed `.env` and `frontend/.env.local` are ignored.
- No real secrets were committed or staged.

## 5. Container and env verification result

- `docker compose down`
- `docker compose up -d --build`
- `docker compose ps`
- Backend container env keys were present:
- `CLERK_ISSUER`
- `CLERK_JWKS_URL`
- `AUTH_USER_MAPPINGS_JSON`
- Frontend container env keys were present:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_USE_MOCK_API=false`
- `NEXT_PUBLIC_API_BASE_URL`
- `BACKEND_URL`
- Secret values are intentionally not repeated here.

## 6. Signed-out protection result

- Backend:
- `GET /health` returned `200`.
- `GET /auth/me` without auth returned `401`.
- `GET /admin/clients` without auth returned `401`.
- `GET /client/me` without auth returned `401`.
- Frontend:
- `/login` renders the custom Sendwise login page.
- No old mock login UI rendered.
- No signup link rendered.
- No social or Google login button rendered.
- Signed-out `/admin`, `/client`, and `/account` redirect to `/login`.
- Signed-out `/auth/redirect` returns safe unauthenticated behavior and routes back to `/login`.

## 7. Admin login and runtime result

- Positive backend runtime verification succeeded with a real Clerk-created session for `ernstudio.ai@gmail.com`.
- `GET /auth/me` returned:
- `access_type: "platform_admin"`
- `client_id: null`
- `status: "active"`
- `GET /admin/clients` returned `200`.
- `GET /client/me` returned `403` with `Client access is required for this endpoint.`
- Interactive browser login through `/login` was not completed with credentials or a browser-held Clerk session in this environment.
- Direct frontend page verification with a raw Clerk session cookie still rendered the signed-out login shell, so frontend positive-path browser state remains unverified here.

## 8. Client login and runtime result

- Positive backend runtime verification succeeded with a real Clerk-created session for `leonardo.sampaoli@yahoo.com`.
- `GET /auth/me` returned:
- `access_type: "client"`
- `client_id: "client_demo"`
- `status: "active"`
- `GET /client/me` returned `200`.
- `GET /admin/clients` returned `403` with `Admin access is required for this endpoint.`
- Interactive browser login through `/login` was not completed with credentials or a browser-held Clerk session in this environment.
- Direct frontend page verification with a raw Clerk session cookie still rendered the signed-out login shell, so frontend positive-path browser state remains unverified here.

## 9. Backend `/auth/me` result

- Unauthenticated: `401`.
- Real mapped admin session: `200` with `platform_admin`, `null`, `active`.
- Real mapped client session: `200` with `client`, `client_demo`, `active`.

## 10. 401 and 403 result

- Verified `401` for:
- `/auth/me` without auth
- `/admin/clients` without auth
- `/client/me` without auth
- Verified `403` for:
- admin session on `/client/me`
- client session on `/admin/clients`

## 11. `/account` result

- Signed-out `/account` protects correctly and redirects to `/login`.
- Authenticated `/account` browser rendering was not fully verified because the frontend Clerk dev-instance browser session could not be established from raw HTTP session-cookie injection alone in this environment.

## 12. Signup, social, and mock exposure check

- `/login` rendered the custom Sendwise form.
- No rendered signup link was found.
- No rendered social or Google login button was found.
- Mock leak grep found only the dormant string `Ruolo di sviluppo` in `frontend/components/auth/MockLoginForm.tsx`.
- No old mock UI rendered on the live `/login` page.

## 13. Frontend-to-backend token result

- Verified by live backend runtime and code inspection:
- real Clerk session JWTs authenticate correctly against FastAPI
- `frontend/lib/api.ts` remains the only frontend fetch boundary
- `frontend/lib/api.ts` attaches `Authorization: Bearer <token>` in backend mode through Clerk `auth().getToken()`
- `frontend/app/auth/redirect/page.tsx` routes through backend-owned `getPostLoginRedirectPath()`
- Browser-authenticated `/auth/redirect` completion was not fully verified because the frontend Clerk browser session was not established from the available non-interactive runtime path.

## 14. Fixes applied, if any

- No application fix was applied.
- No confirmed Sendwise code defect inside the allowed file scope required a runtime patch.

## 15. Tests executed

- `git status --short`
- `git diff -- .env .env.local frontend/.env.local backend/.env.local || true`
- `git diff --cached -- .env .env.local frontend/.env.local backend/.env.local || true`
- `git check-ignore -v .env frontend/.env.local || true`
- `docker compose down`
- `docker compose up -d --build`
- `docker compose ps`
- backend and frontend env-key presence checks via `docker compose exec`
- `curl -i http://localhost:8000/health`
- `curl -i http://localhost:8000/auth/me`
- `curl -i http://localhost:8000/admin/clients`
- `curl -i http://localhost:8000/client/me`
- `curl -I http://localhost:3000/login`
- `curl -I http://localhost:3000/admin`
- `curl -I http://localhost:3000/client`
- `curl -I http://localhost:3000/account`
- `curl -I http://localhost:3000/auth/redirect`
- `curl -s http://localhost:3000/login`
- `PYTHONPATH=backend python3 -m pytest backend/tests`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 BACKEND_URL=http://backend:8000 npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`
- boundary and mock-leak grep checks from the milestone request
- Clerk backend SDK session creation for both mapped users
- live backend checks with real Clerk session JWTs for both mapped users

## 16. Tests not executed and why

- Credentialed browser sign-in through the visible `/login` form for the admin account was not completed because no password or interactive verification channel was available in this environment.
- Credentialed browser sign-in through the visible `/login` form for the client account was not completed for the same reason.
- Full browser `/auth/redirect -> /admin` and `/auth/redirect -> /client` verification was not completed because raw HTTP session-cookie injection still resolved as signed out in the Clerk dev-instance frontend flow.
- Authenticated `/account` browser UI and sign-out return flow were not fully verified for the same reason.

## 17. Contract changes requested

- None.

## 18. Risks remaining

- The backend mapping and authorization runtime is verified with real Clerk sessions, but the frontend positive-path browser session remains unverified in this environment.
- Clerk dev-instance protected frontend pages still treat raw HTTP session-cookie injection as signed out, even when backed by a real active Clerk session JWT and a Clerk testing token.
- The dormant `MockLoginForm` still contains a mock-only label string outside the live Clerk path and outside this milestone scope.

## 19. Auth UI TODOs

- `TODO — Login verification step UI polish`
- `/login` additional verification screen works but needs visual refinement.
- The card is too vertical and large.
- Buttons are heavy.
- Copy can be improved.
- `Usa un'altra email` should become a clearer secondary action.
- Keep the custom Sendwise UI.
- Do not use Clerk prebuilt UI.
- Do not add signup or social login.

## 20. Suggested next step

- Complete one real browser-authenticated pass with either:
- the actual test-account credentials and any required verification code channel
- or an approved Clerk-supported browser testing helper that establishes the frontend dev-instance session, not just backend JWT access
- Then re-run `/login`, `/auth/redirect`, `/admin`, `/client`, `/account`, and sign-out in a real browser context.

## 21. Coordinator Handoff

- The first verified divergence is no longer in Sendwise backend auth. FastAPI correctly validates real Clerk JWTs, resolves the mapped admin or client context, and enforces `401` and `403` policy as expected.
- The remaining gap is at the frontend Clerk dev-instance browser-session layer. Raw backend-issued session JWTs are sufficient for FastAPI bearer auth but not sufficient, by themselves, to make the Next.js protected pages appear authenticated in this non-interactive verification path.
- No minimal code fix was justified from the evidence gathered in this run.

## 22. Confirmation of excluded work

- Confirmed: no DB migration, `client_access` persistence, Clerk invitation API, admin invite flow, onboarding endpoint, public signup, custom password form, custom 2FA, real listmonk, real sending, AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase was implemented.
