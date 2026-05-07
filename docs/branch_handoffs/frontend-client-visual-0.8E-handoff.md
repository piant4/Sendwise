Branch: develop

Task completed:
- Milestone 0.8E — Client Visual Dashboard + Admin/Login Polish
- Refined `/client` into the official client-facing dashboard in the current Sendwise visual language.
- Tightened `/admin` header, KPI density, and hero footprint without changing architecture.
- Simplified `/login` into the official reserved access screen with reduced redundancy.

Files created:
- `docs/branch_handoffs/frontend-client-visual-0.8E-handoff.md`
- `frontend/components/admin/AdminTopBarActions.tsx`
- `frontend/components/client/ClientDashboardHeader.tsx`
- `frontend/components/client/ClientDeliveryCard.tsx`
- `frontend/components/client/ClientKpiGrid.tsx`
- `frontend/components/client/ClientRecentBlockedSendsCard.tsx`
- `frontend/components/client/ClientRecentCampaignsCard.tsx`
- `frontend/components/client/ClientSurface.tsx`
- `frontend/components/client/clientStatus.ts`

Files modified:
- `docs/audit_log.md`
- `frontend/app/client/page.tsx`
- `frontend/app/globals.css`
- `frontend/app/login/page.tsx`
- `frontend/components/admin/AdminDashboardHeader.tsx`
- `frontend/components/dashboard/AdminDashboard.tsx`
- `frontend/components/dashboard/ClientDashboard.tsx`
- `frontend/components/layout/AppShell.tsx`
- `frontend/components/layout/TopBar.tsx`
- `frontend/components/shared/BrandMark.tsx`

Admin polish summary:
- Replaced the breadcrumb-style top header with a single page title and safe UI-only actions for export and client creation.
- Reduced the hero card into a compact operational summary surface.
- Compressed the KPI grid into a tighter two-column layout while preserving the existing Sendwise visual system.

Client visual summary:
- Rebuilt `/client` as a dedicated client dashboard with a compact account summary, focused KPI cards, recent campaigns, recent blocks, and delivery metrics.
- Kept the page visually aligned with `/admin` while making it simpler, lighter, and free of admin-only controls, AI, or token usage.
- Preserved the existing data flow through `frontend/lib/api.ts` only.

Login polish summary:
- Removed redundant Sendwise repetition and deleted the unnecessary extra informational blocks.
- Removed the green helper/info surface and the previous "pannello operativo" content.
- Rewrote the copy into a concise official access screen that explains the product briefly and keeps access reserved language.

Temporary login behavior preserved:
- Submit still routes locally only to `/admin`.
- No auth implementation, signup, password reset, backend login call, cookie, token, `localStorage`, or `sessionStorage` was added.

API/security boundary status:
- No new `fetch(` calls were added outside `frontend/lib/api.ts`.
- No direct `mock-api` imports were added in pages or components.
- No `listmonk`, `postgres`, `database`, or `smtp` references were introduced in the allowed frontend runtime files.
- No `localStorage`, `sessionStorage`, or `document.cookie` usage was introduced.

Tests executed:
- `cd frontend && npm run lint` passed
- `cd frontend && npm run build` passed
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build` passed
- `bash scripts/audit.sh` passed
- `bash scripts/smoke_test.sh` passed
- `docker compose config` passed
- `git diff --check` passed
- `grep -R "from .*mock-api" frontend/app frontend/components || true` returned no matches
- `grep -R "fetch(" frontend/app frontend/components frontend/lib || true` confirmed the only `fetch(` remains in `frontend/lib/api.ts`
- `grep -R "listmonk\|postgres\|database\|smtp" frontend/app frontend/components frontend/lib || true` returned no matches
- `grep -R "localStorage\|sessionStorage\|document.cookie" frontend/app frontend/components frontend/lib || true` returned no matches

Tests not executed and why:
- Browser-based visual verification of `/admin`, `/client`, and `/login` was attempted against a local dev server, but Playwright could not attach because this environment does not have a Chrome runtime installed.

Contract changes requested:
- None.

Risks remaining:
- Client email-limit values still depend on currently exposed summary fields and can remain zero or "in definizione" until richer backend data exists.
- Final human visual QA is still advisable for spacing and hierarchy on `/admin`, `/client`, and `/login`.

Suggested next step:
- Run a manual browser pass on the three touched routes, then proceed to the future auth milestone without changing the current frontend API boundary.

Coordinator handoff:
- `develop` now contains the client dashboard visual refinement plus admin/login polish only.
- No backend, DB, Docker config, Clerk, real auth, signup, token/cookie/storage, real listmonk, real email sending, AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase implementation was added.
