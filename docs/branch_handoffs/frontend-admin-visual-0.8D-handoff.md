Branch: develop

Task completed:
- Milestone 0.8D — Admin Visual Dashboard + Login Official Cleanup
- Restyled `/admin` into the primary Sendwise operational dashboard using the current frontend API boundary.
- Cleaned `/login` so it presents the official Sendwise access screen without demo/mock framing.

Files created:
- `docs/branch_handoffs/frontend-admin-visual-0.8D-handoff.md`
- `frontend/components/admin/AdminBlockedSendsCard.tsx`
- `frontend/components/admin/AdminDashboardHeader.tsx`
- `frontend/components/admin/AdminKpiGrid.tsx`
- `frontend/components/admin/AdminOperationsRail.tsx`
- `frontend/components/admin/AdminRecentCampaignsCard.tsx`
- `frontend/components/admin/AdminSurface.tsx`

Files modified:
- `docs/audit_log.md`
- `frontend/app/globals.css`
- `frontend/app/login/page.tsx`
- `frontend/components/dashboard/AdminDashboard.tsx`
- `frontend/lib/api.ts`
- `frontend/lib/mock-api.ts`
- `frontend/types/index.ts`

Admin visual summary:
- Replaced the previous stub-like admin overview with a structured product dashboard composed of a control header, KPI grid, recent campaigns panel, recent blocked sends panel, and compact operational side rail.
- Kept the page architecture intact: `page -> AdminDashboard -> admin components -> api.ts -> mock-api/backend -> types`.
- Added only display-ready admin summary fields needed by the current page: client status distribution and recent campaigns.
- Preserved the approved Sendwise palette and Italian operational copy.
- Any visible actions are disabled placeholders and do not introduce writes or business logic.

Login cleanup summary:
- Removed all visible demo/mock framing from `/login`.
- Removed the role selector entirely.
- Kept the Sendwise wordmark and premium split-screen login layout.
- Rewrote the visible copy in Italian to present an official reserved-access screen with no public registration posture.

Temporary login behavior preserved:
- Submit still routes locally only.
- The temporary access flow is now a single neutral internal entry path to `/admin`.
- No auth implementation, signup flow, password reset, token, cookie, storage, or backend login call was added.

API/security boundary status:
- Passed.
- No `fetch(` was added outside `frontend/lib/api.ts`.
- No direct `frontend/lib/mock-api.ts` imports exist in `frontend/app` or `frontend/components`.
- No `listmonk`, `postgres`, `database`, or `smtp` references were added in the allowed frontend runtime files.
- No `localStorage`, `sessionStorage`, or `document.cookie` usage was added.

Anti-monolith verdict:
- OK.
- `frontend/components/dashboard/AdminDashboard.tsx` is now a thin composer.
- New admin UI responsibilities are split into focused presentational components under `frontend/components/admin/`.
- No business logic was moved into the page layer.

Tests executed:
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed.
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --check` passed.
- `grep -R "from .*mock-api" frontend/app frontend/components || true` returned no matches.
- `grep -R "fetch(" frontend/app frontend/components frontend/lib || true` confirmed the only `fetch(` remains in `frontend/lib/api.ts`.
- `grep -R "listmonk\|postgres\|database\|smtp" frontend/app frontend/components frontend/lib || true` returned no matches.
- `grep -R "localStorage\|sessionStorage\|document.cookie" frontend/app frontend/components frontend/lib || true` returned no matches.

Tests not executed and why:
- Browser-based visual verification of `/login` and `/admin` could not be completed because the available Playwright browser tooling requires a Chrome runtime that is not installed in this environment.

Contract changes requested:
- None.

Risks remaining:
- Backend mode still exposes only the current admin stub coverage, so blocked-send details and email-limit aggregates can remain empty when the backend does not provide richer data yet.
- Final human visual QA is still advisable because automated browser capture is unavailable in this environment.

Suggested next step:
- Run a manual browser pass on `/login` and `/admin`, then proceed with the future auth milestone that replaces the temporary local access route with Clerk.

Coordinator handoff:
- `develop` now contains the official login cleanup and the admin dashboard visual upgrade only.
- No `/client` redesign was performed.
- No backend, DB, Docker config, Clerk, real auth, signup, token/cookie/storage, real listmonk, real email sending, AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase implementation was added.
