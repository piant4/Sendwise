Branch: develop

Task completed:
- Milestone 0.7.2 - Browser Backend Mode Smoke Check
- Ran a real browser-level smoke check for `/login`, `/admin`, and `/client` with `NEXT_PUBLIC_USE_MOCK_API=false` and `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`.
- Confirmed backend-mode rendering on `/admin` and `/client`.
- Applied one minimal frontend-only fix for a mobile navigation dialog accessibility/runtime warning.

Files created:
- `docs/branch_handoffs/browser-backend-mode-smoke-0.7.2-handoff.md`

Files modified:
- `docs/audit_log.md`
- `frontend/components/layout/MobileNav.tsx`

Services started/stopped:
- Started with `docker compose up -d backend`, which brought up `postgres`, `listmonk`, and `backend`.
- Started the frontend dev server from `frontend/` with `NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev`.
- Stopped the frontend dev server after verification.
- Stopped the compose stack with `docker compose down`.

Backend endpoints verified:
- `GET /health` -> `200 OK`
- `GET /admin/clients` -> `200 OK`
- `GET /admin/campaigns` -> `200 OK`
- `GET /client/me` -> `200 OK`
- `GET /client/campaigns` -> `200 OK`
- `GET /client/usage` -> `200 OK`
- `GET /client/blocked-sends` -> `200 OK`

Browser routes verified:
- `/login` rendered in the browser with no crash page or overlay.
- `/admin` rendered in the browser with backend-mode summary data and the `Backend stub` badge.
- `/client` rendered in the browser with backend-mode summary data and the `Backend stub` badge.

Runtime/browser errors found:
- Initial verification exposed a browser warning when opening the mobile navigation sheet: `Missing Description or aria-describedby={undefined} for {DialogContent}.`
- No crash page, no framework error overlay, and no unhandled runtime errors were present on the verified routes.

Fixes applied:
- Added a `SheetDescription` to `frontend/components/layout/MobileNav.tsx` so the sheet dialog exposes a description and stops emitting the Radix dialog warning.

Mock mode status:
- Disabled during the browser verification run.
- `/admin` showed `Dati simulati: Disattivo`.
- `/client` rendered backend-derived values that differ from the mock fixture, confirming mock mode was not serving those pages.
- `/login` still presents a mock frontend-only development login by design; no real auth behavior was added.

Backend mode status:
- Enabled and verified in both build and browser runtime.
- The frontend continued to fetch backend data only through `frontend/lib/api.ts`.

API boundary verification:
- No direct `mock-api` imports in `frontend/app` or `frontend/components`.
- `fetch(` remains confined to `frontend/lib/api.ts`.
- No frontend `listmonk`, PostgreSQL, database, or SMTP access detected.
- No token, cookie, `localStorage`, or `sessionStorage` auth behavior detected.

Tests executed:
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`
- `curl -sS -i http://localhost:8000/health`
- `curl -sS -i http://localhost:8000/admin/clients`
- `curl -sS -i http://localhost:8000/admin/campaigns`
- `curl -sS -i http://localhost:8000/client/me`
- `curl -sS -i http://localhost:8000/client/campaigns`
- `curl -sS -i http://localhost:8000/client/usage`
- `curl -sS -i http://localhost:8000/client/blocked-sends`
- `grep -R "from .*mock-api" frontend/app frontend/components || true`
- `grep -R "fetch(" frontend/app frontend/components frontend/lib || true`
- `grep -R "listmonk\|postgres\|database\|smtp" frontend/app frontend/components frontend/lib || true`
- `grep -R "localStorage\|sessionStorage\|document.cookie" frontend/app frontend/components frontend/lib || true`
- Real browser verification on `http://localhost:3000/login`
- Real browser verification on `http://localhost:3000/admin`
- Real browser verification on `http://localhost:3000/client`

Tests not executed and why:
- None.

Contract changes requested:
- None.

Risks remaining:
- `/login` remains intentionally mock-only until a separate approved auth milestone changes that contract.
- `/admin` and `/client` still display zero/empty overview fields where the current backend stub does not expose richer limit or aggregate data.

Suggested next step:
- Add this backend-mode browser smoke path to CI or a repeatable local e2e script so `/login`, `/admin`, and `/client` keep coverage beyond manual runtime verification.

Coordinator handoff:
- `develop` now has browser-level backend-mode verification for `/login`, `/admin`, and `/client`.
- The frontend/backend boundary remains intact: backend calls stay centralized in `frontend/lib/api.ts`, and no direct mock imports or auth/storage shortcuts were introduced.
- One minimal frontend component fix was applied in `MobileNav` to remove a runtime accessibility warning without changing backend logic, Docker config, or feature scope.
- No backend, DB, Docker config, real auth, real listmonk, real email sending, AI generation, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work was implemented.
