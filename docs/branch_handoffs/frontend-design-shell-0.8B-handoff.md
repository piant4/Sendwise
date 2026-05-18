Branch: develop

Task completed:
- Milestone 0.8B — Design Tokens + App Shell
- Adapted the shared Sendwise visual foundation from the provided design zip into the existing Next.js frontend without rebuilding the admin/client dashboards.
- Refactored the existing shell instead of creating a parallel app, duplicate routing tree, duplicate API client, or duplicate mock layer.

Files created:
- `docs/branch_handoffs/frontend-design-shell-0.8B-handoff.md`
- `frontend/components/layout/TopBar.tsx`
- `frontend/components/shared/BrandMark.tsx`
- `frontend/components/shared/MockModeBadge.tsx`

Files modified:
- `docs/audit_log.md`
- `frontend/app/globals.css`
- `frontend/app/layout.tsx`
- `frontend/components/layout/AppShell.tsx`
- `frontend/components/layout/MainNav.tsx`
- `frontend/components/layout/MobileNav.tsx`
- `frontend/components/layout/Sidebar.tsx`

Design tokens adapted:
- Neutral: `#CACFD6`
- Pale mint: `#D6E5E3`
- Aqua accent: `#9FD8CB`
- Primary green: `#517664`
- Deep olive: `#2D3319`
- Background: `#FAFAF7`
- Surface: `#FFFFFF`
- Surface mint: `#EEF4F2`
- Border: `#E3E5E0`
- Added supporting shell tokens for muted text, soft background, border strength, warning, danger, and status surfaces while mapping the palette into shadcn-compatible CSS variables.

Components created/refactored:
- Created `BrandMark` for the shared monogram + wordmark treatment.
- Created `MockModeBadge` as a small presentational mock-state indicator.
- Refactored `AppShell` to be route-aware and to exclude `/login`.
- Refactored `Sidebar` to use contextual admin/client shell content and shared branding.
- Refactored `MainNav` into the single source of truth for contextual navigation items and active-route logic.
- Created reusable `TopBar` with optional breadcrumb, title, disabled visual placeholders, and action slot support.
- Refactored `MobileNav` to use the existing shadcn `Sheet` with accessible title/description and contextual admin/client drawer content.

Duplicates avoided/removed:
- No second `AppShell` created.
- No second `Sidebar` created.
- No second `MobileNav` created.
- No second API client or mock data layer created.
- Reused the existing `MainNav` instead of introducing a second route map.

Shell/sidebar/mobile status:
- Shared shell now uses the adapted Sendwise token system and surface styling.
- Desktop sidebar is contextual for admin/client routes and keeps route-aware active states.
- Top bar is presentational-only and reusable.
- Mobile navigation uses the existing Sheet pattern and matches the updated shell styling.
- `/login` no longer inherits the authenticated shell.

API/mock boundary status:
- `frontend/lib/api.ts` remains the only fetch boundary.
- No direct imports from `frontend/lib/mock-api.ts` were added in `frontend/app` or `frontend/components`.
- No auth tokens, cookies, local storage, or session storage logic was introduced.
- No backend, DB, listmonk, or email-sending access was added to frontend components.

Tests executed:
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

Tests not executed and why:
- No browser session or screenshot verification was executed in this milestone; validation was limited to build, audit, smoke, and boundary checks.

Risks remaining:
- The admin/client dashboard content still uses the pre-existing card/layout internals and has not yet been visually rebuilt against the new shell.
- No live browser review was performed, so minor visual spacing differences may still need tuning in the next frontend pass.

Suggested next step:
- Milestone 0.8C should restyle the admin and client dashboard page content to align with the new shell, reusing the token system and avoiding new fetch/auth behavior.

Coordinator handoff:
- `develop` now contains the Sendwise shared visual base: tokens, brand mark, app shell, contextual sidebar, top bar, mobile drawer, and mock mode badge.
- The refactor stays within the allowed frontend scope and preserves the existing API/mock architecture.
- No duplicate shell, route layer, API layer, or data layer was introduced.
- No backend, DB, Docker config, auth, listmonk, sending, AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase implementation was added.
