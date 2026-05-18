Branch: develop

Task completed:
- Milestone 0.7 - Frontend Backend Connection
- Hardened `frontend/lib/api.ts` so mock mode stays on `frontend/lib/mock-api.ts` and backend mode resolves only through the existing FastAPI stub endpoints.
- Moved `/admin` and `/client` onto backend-derived summary accessors through the existing API boundary without adding backend routes or frontend auth behavior.

Files created:
- `docs/branch_handoffs/frontend-backend-connection-0.7-handoff.md`
- `frontend/components/dashboard/AdminDashboard.tsx`
- `frontend/components/dashboard/ClientDashboard.tsx`
- `frontend/components/dashboard/DashboardErrorState.tsx`

Files modified:
- `docs/audit_log.md`
- `frontend/app/admin/page.tsx`
- `frontend/app/client/page.tsx`
- `frontend/lib/api.ts`
- `frontend/types/index.ts`

Backend endpoints connected:
- `GET /admin/clients`
- `GET /admin/campaigns`
- `GET /client/me`
- `GET /client/campaigns`
- `GET /client/usage`
- `GET /client/blocked-sends`

Mock mode status:
- Passed. `NEXT_PUBLIC_USE_MOCK_API=true` still uses `frontend/lib/mock-api.ts`.
- Existing mock summaries and mock dashboard data were preserved.

Backend mode status:
- Passed at build level. `NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build` succeeded.
- `frontend/lib/api.ts` now derives admin/client overview data from the required backend endpoints when mock mode is disabled.
- Live runtime verification against a running backend/frontend stack was not completed, so no claim is made about an end-to-end browser session in backend mode.

API boundary verification:
- No `fetch(` calls exist outside `frontend/lib/api.ts`.
- No page or component imports `mock-api` directly.
- Pages consume dashboard data through `page -> component -> api.ts -> mock-api/backend -> types`.

Tests executed:
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`
- `grep -R "from .*mock-api" frontend/app frontend/components || true`
- `grep -R "fetch(" frontend/app frontend/components frontend/lib || true`
- `grep -R "listmonk\|postgres\|database\|smtp" frontend/app frontend/components frontend/lib || true`
- `grep -R "localStorage\|sessionStorage\|document.cookie" frontend/app frontend/components frontend/lib || true`

Tests not executed and why:
- No live browser/runtime backend-mode verification was completed because the local Docker daemon had to be started during the session and `docker compose up -d` did not finish bringing the stack up before handoff.

Contract changes requested:
- None.

Risks remaining:
- Admin overview fields that do not have matching backend endpoints yet (`blockedSendsToday`, `monthlyAiCallsUsed`, email limit overview, recent blocked sends) are intentionally derived as empty/zero values in backend mode.
- Client overview fields that depend on data not exposed by current stubs (monthly email limit and campaign send limits) are intentionally rendered as zero in backend mode.
- Runtime backend-mode behavior in a live browser session still needs confirmation after the local stack is up.

Suggested next step:
- Bring up the local stack and perform one live `/admin` and `/client` backend-mode browser or HTTP verification with `NEXT_PUBLIC_USE_MOCK_API=false`, then decide whether additional backend summary endpoints are needed or whether the current zero-state placeholders are acceptable for the next milestone.

Coordinator handoff:
- `develop` now has a hardened frontend API boundary that supports both mock mode and backend mode without adding any backend routes or auth/session logic.
- The admin and client dashboards are now thin route files with rendering components and centralized data access.
- Type compatibility remains aligned with the current FastAPI stub contracts; no contract change request is needed from this milestone.
- Remaining work is operational verification of live backend mode and future replacement of backend-unavailable summary fields with real endpoint coverage when approved.
