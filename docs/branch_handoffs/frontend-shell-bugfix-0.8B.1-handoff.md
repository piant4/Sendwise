Branch: develop

Task completed:
- Milestone 0.8B.1 — Frontend Shell Bugfix & Runtime Hardening
- Audited the reported shell/runtime issues before any fix.
- Reproduced the current frontend failures in browser and via local HTTP checks.
- Applied the minimum frontend-only fixes inside the allowed scope.

Issues reproduced:
- The sidebar brand rendered a small icon next to the `Sendwise` wordmark.
- Plain `cd frontend && npm run dev` did not behave as mock mode when `NEXT_PUBLIC_USE_MOCK_API` was unset.
- `/admin` and `/client` returned a rendered dashboard error state with `NEXT_PUBLIC_API_BASE_URL is required when NEXT_PUBLIC_USE_MOCK_API=false.` under that startup condition.
- Existing sidebar links pointed to missing app routes and returned `404`:
  - `/admin/clients`
  - `/admin/campaigns`
  - `/admin/email-limits`
  - `/admin/blocked-sends`
  - `/admin/system`
  - `/client/campaigns`
  - `/client/email-limits`
  - `/client/blocked-sends`
- No genuine `400` frontend route or backend API response was reproduced during this audit.

Root causes found:
- `frontend/components/shared/BrandMark.tsx` always rendered the icon wrapper and SVG before the brand text.
- `frontend/lib/api.ts` treated mock mode as enabled only when `NEXT_PUBLIC_USE_MOCK_API === "true"`, so an unset env defaulted to backend mode instead of mock mode.
- `frontend/components/layout/MainNav.tsx` exposed sidebar links for routes that had no corresponding files under `frontend/app`.
- The shell mock badge was rendered even in backend mode, which was misleading after runtime verification.
- Backend stub endpoints were not the source of the reported `400`s; the audited endpoints all returned `200 OK`.

Files created:
- `docs/branch_handoffs/frontend-shell-bugfix-0.8B.1-handoff.md`
- `frontend/app/section-placeholder.tsx`
- `frontend/app/admin/clients/page.tsx`
- `frontend/app/admin/campaigns/page.tsx`
- `frontend/app/admin/email-limits/page.tsx`
- `frontend/app/admin/blocked-sends/page.tsx`
- `frontend/app/admin/system/page.tsx`
- `frontend/app/client/campaigns/page.tsx`
- `frontend/app/client/email-limits/page.tsx`
- `frontend/app/client/blocked-sends/page.tsx`

Files modified:
- `docs/audit_log.md`
- `frontend/components/shared/BrandMark.tsx`
- `frontend/components/layout/AppShell.tsx`
- `frontend/components/layout/Sidebar.tsx`
- `frontend/components/layout/MobileNav.tsx`
- `frontend/components/layout/TopBar.tsx`
- `frontend/lib/api.ts`

Fixes applied:
- Removed the brand icon from `BrandMark` and kept the text styling intact.
- Changed frontend mode selection so mock mode is the default unless `NEXT_PUBLIC_USE_MOCK_API=false` is explicitly set.
- Added minimal static route stubs only for the already-linked sidebar URLs so those pages no longer 404.
- Gated the shell `MockModeBadge` so it renders only when mock mode is actually active.

Routes/pages verified:
- Mock-mode browser verification on `http://localhost:3000`:
  - `/login`
  - `/admin`
  - `/admin/clients`
  - `/admin/campaigns`
  - `/admin/email-limits`
  - `/admin/blocked-sends`
  - `/admin/system`
  - `/client`
  - `/client/campaigns`
  - `/client/email-limits`
  - `/client/blocked-sends`
- Backend-mode browser verification on `http://localhost:3101`:
  - `/admin`
  - `/client`
  - `/admin/clients`
  - `/admin/campaigns`
  - `/admin/email-limits`
  - `/admin/blocked-sends`
  - `/admin/system`
  - `/client/campaigns`
  - `/client/email-limits`
  - `/client/blocked-sends`

Mock mode result:
- Passed.
- Plain `npm run dev` now renders `/admin` and `/client` without the missing-env runtime error.
- All sidebar-linked routes above rendered without `404`.
- The shell brand no longer shows the small icon.

Backend mode result:
- Passed.
- Verified against the running local backend stub after `docker compose up -d backend`.
- `GET /health`, `GET /admin/clients`, `GET /admin/campaigns`, `GET /client/me`, `GET /client/campaigns`, `GET /client/usage`, and `GET /client/blocked-sends` all returned `200 OK`.
- `/admin` and `/client` rendered backend-mode content with no `404`, no API failure message, no missing-env error, and no console errors on `/admin`.
- Sidebar placeholder routes also rendered cleanly in backend mode and no longer showed the mock badge.

Tests executed:
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose up -d backend`
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
- Browser verification on `http://localhost:3000`
- Browser verification on `http://localhost:3101`

Tests not executed and why:
- A second concurrent backend-mode `NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run dev` session was not run because the workspace already had an active `next dev` instance on port `3000`, and Next 16 refused a second dev server in the same directory.
- Backend-mode runtime verification was completed instead from a separate built frontend server on `http://localhost:3101`.

Contract changes requested:
- None.

Risks remaining:
- The new sidebar route pages are intentionally static placeholders. They fix broken navigation without adding feature logic or new API reads.
- `/login` remains mock-only by design until a separate auth milestone changes that contract.
- `/admin` and `/client` still depend on current stub backend data and can show zero/empty aggregates where the backend does not expose richer fields yet.

Suggested next step:
- Replace the new static placeholder route content with approved real page implementations one section at a time, keeping data access inside `frontend/lib/api.ts`.

Coordinator handoff:
- `develop` now defaults correctly to mock mode for plain frontend startup, no longer leaks the mock badge into backend mode, removes the sidebar brand icon, and serves every currently linked shell route without `404`.
- No backend, DB, Docker config, env file, auth flow, or external integration contract was changed.
