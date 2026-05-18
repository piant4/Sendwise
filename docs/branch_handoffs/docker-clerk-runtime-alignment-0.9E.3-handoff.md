# Milestone 0.9E.3 — Docker Clerk Runtime Alignment

Date: 2026-05-08
Branch: develop

## 1. Current branch

- `develop`

## 2. Root cause of stale/mock frontend in container

- Primary root cause: Docker/runtime configuration.
- The frontend container was running a host-style dev workflow instead of a deterministic container build:
- `frontend/Dockerfile` used `npm run dev`.
- The image copied the full frontend workspace, including host `frontend/.next` artifacts and `frontend/.env.local`.
- `docker compose config` showed `NEXT_PUBLIC_USE_MOCK_API` defaulting to `true`, and the Compose file did not pass the Clerk/backend env contract into the frontend build or backend runtime.
- Current source no longer routes `/login` through `MockLoginForm`, but the copied host `.next` tree still contained the old mock login bundle. That is why the container could show old mock UI even though current source had the new custom Clerk login.
- Evidence:
- `frontend/app/login/[[...login]]/page.tsx` renders `LoginContent`, not `MockLoginForm`.
- `frontend/.next` contained old mock-login chunks and strings such as `Accesso di sviluppo`, `Ruolo di sviluppo`, and `Modalità mock: autenticazione frontend / dati simulati`.
- The pre-fix Docker build transferred about `1.35GB` of frontend context.
- The pre-fix frontend container logs showed `next dev` and `Environments: .env.local`.

## 3. Files created

- `frontend/.dockerignore`
- `docs/branch_handoffs/docker-clerk-runtime-alignment-0.9E.3-handoff.md`

## 4. Files modified

- `docker-compose.yml`
- `frontend/Dockerfile`
- `frontend/lib/api.ts`
- `.env.example`
- `docs/audit_log.md`

## 5. Docker/env strategy implemented

- Root `.env` is now the Docker Compose source for runtime variables.
- `frontend/.env.local` remains local-dev-only and is ignored by Git.
- `frontend/.dockerignore` excludes `.env.local`, `.next`, `.clerk`, and `node_modules` from the frontend image context.
- Frontend now builds as a production multi-stage image and runs the standalone Next server instead of `next dev`.
- Compose now passes the required Clerk/backend env into:
- backend runtime:
- `CLERK_ISSUER`
- `CLERK_JWKS_URL`
- `CLERK_AUDIENCE`
- `AUTH_USER_MAPPINGS_JSON`
- frontend build args and runtime env:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL`
- `NEXT_PUBLIC_USE_MOCK_API`
- `NEXT_PUBLIC_API_BASE_URL`
- Frontend server-side requests now use `BACKEND_URL` so container-side Next server code can reach FastAPI at `http://backend:8000` without breaking browser-side `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`.

## 6. Backend container env result

- Present in the backend container after compose up:
- `CLERK_ISSUER`
- `CLERK_JWKS_URL`
- `CLERK_AUDIENCE`
- `AUTH_USER_MAPPINGS_JSON`
- Secret values are not repeated here.

## 7. Frontend container env/build result

- Present in the frontend container after compose up:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL`
- `NEXT_PUBLIC_USE_MOCK_API=false`
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`
- `BACKEND_URL=http://backend:8000`
- Frontend logs now show production startup only:
- `Next.js 16.2.4`
- `Local: http://localhost:3000`
- `Network: http://0.0.0.0:3000`
- No `.env.local` load line.
- No `next dev`.
- No Turbopack dev runtime.

## 8. Mock UI leak result

- Rendered `/login` HTML no longer includes:
- `Accesso di sviluppo`
- `Ruolo di sviluppo`
- `Modalità mock: autenticazione frontend / dati simulati`
- Rendered `/login` HTML now includes the current custom Clerk login strings:
- `Sendwise`
- `Accesso riservato`
- `Accedi`
- Repo grep still finds `Ruolo di sviluppo` in `frontend/components/auth/MockLoginForm.tsx`.
- That file remains as dormant mock-support code and is not routed by the current Docker login flow.

## 9. Container runtime verification result

- `docker compose up -d --build` starts the current stack successfully.
- `docker compose ps` shows frontend, backend, and postgres up; postgres is healthy.
- `GET /health` from host returns `200`.
- `GET /auth/me` from host without auth returns `401`.
- `GET /auth/me` from host with `Authorization: Bearer invalid-token` returns `401`.
- Signed-out host requests redirect as expected:
- `/admin` -> `307` to `/login`
- `/client` -> `307` to `/login`
- `/auth/redirect` -> redirect to `/login` when signed out
- From inside the frontend container:
- `http://backend:8000/health` returns success
- `http://backend:8000/auth/me` returns `401` when unauthenticated
- This proves the server-side internal backend URL path is reachable for `/auth/redirect` and other server-side requests.

## 10. Tests executed

- `docker compose config`
- `git diff --check`
- `PYTHONPATH=backend python3 -m pytest backend/tests`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 BACKEND_URL=http://backend:8000 npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `grep -R "from .*mock-api" frontend/app frontend/components || true`
- `grep -R "fetch(" frontend/app frontend/components frontend/lib || true`
- `grep -R "listmonk\|postgres\|database\|smtp" frontend/app frontend/components frontend/lib || true`
- `grep -R "localStorage\|sessionStorage\|document.cookie" frontend/app frontend/components frontend/lib || true`
- `grep -R "SignUpButton\|sign-up\|signup" frontend/app frontend/components frontend/lib || true`
- `grep -R "Ruolo di sviluppo\|Accesso di sviluppo\|Modalità mock: autenticazione frontend" frontend/app frontend/components || true`
- `docker compose down`
- `docker compose build --no-cache frontend backend`
- `docker compose up -d`
- `docker compose ps`
- `docker compose exec backend printenv | grep -E "^(CLERK|AUTH_USER)"`
- `docker compose exec frontend printenv | grep -E "^(NEXT_PUBLIC_|CLERK_SECRET_KEY|BACKEND_URL)"`
- `docker compose exec frontend sh -lc 'wget -qO- http://backend:8000/health && printf "\\n---\\n" && wget -S -qO- --server-response http://backend:8000/auth/me 2>&1 | sed -n "1,12p"'`
- `curl -i http://127.0.0.1:8000/health`
- `curl -i http://127.0.0.1:8000/auth/me`
- `curl -i -H 'Authorization: Bearer invalid-token' http://127.0.0.1:8000/auth/me`
- `curl -i http://127.0.0.1:3000/login`
- `curl -I http://127.0.0.1:3000/admin`
- `curl -I http://127.0.0.1:3000/client`
- `curl -I http://127.0.0.1:3000/auth/redirect`

## 11. Tests not executed and why

- Live sign-in with a mapped admin user was not executed because real `AUTH_USER_MAPPINGS_JSON` identities and test credentials were not available in tracked repo config.
- Live sign-in with a mapped client user was not executed for the same reason.
- End-to-end positive `/auth/redirect` routing to `/admin` or `/client` after a real Clerk sign-in was therefore not claimed.

## 12. Secret safety result

- No real secrets were committed.
- Local `.env` remains ignored and untracked.
- `frontend/.env.local` remains ignored.
- `git diff -- .env .env.local frontend/.env.local backend/.env.local || true` returned no tracked secret diff.
- `git diff --cached -- .env .env.local frontend/.env.local backend/.env.local || true` returned no staged secret diff.

## 13. Contract changes requested

- None.

## 14. Risks remaining

- Positive-path admin/client auth still depends on providing real local `AUTH_USER_MAPPINGS_JSON` user ids for the actual Clerk instance.
- `MockLoginForm` remains in the repo as dormant mock-support code; it is not active in the current Docker login path.
- The local root `.env` used for verification is intentionally untracked and must be managed outside Git.

## 15. Suggested next step

- Populate the local root `.env` with the real mapped Clerk user ids in `AUTH_USER_MAPPINGS_JSON`, then verify live admin and client sign-in through `/auth/redirect` to confirm `/admin` and `/client` destinations end to end.

## 16. Coordinator Handoff

- The fix stayed inside Docker/env alignment plus the minimal server-side backend URL split needed by Next in containers.
- The stale mock UI issue was caused by container build/runtime drift, not by current login source code.
- Docker now builds from clean frontend source, ignores host artifacts, passes the Clerk env contract into build/runtime, and serves the current custom Clerk login instead of the old mock screen.
- Backend and frontend negative-path auth checks pass from the host and from inside the frontend container.

## 17. Confirmation that no DB migration, `client_access` persistence, Clerk invitation API, admin invite flow, onboarding endpoint, public signup, custom password form, custom 2FA, real listmonk, real sending, AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase was implemented

- Confirmed.
