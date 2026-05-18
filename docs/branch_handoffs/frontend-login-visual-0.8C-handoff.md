Branch: develop

Task completed:
- Milestone 0.8C — Login Visual
- Restyled only `frontend/app/login/page.tsx` into a premium technical SaaS login screen aligned with the Sendwise palette and the 0.8B visual foundation.
- Preserved mock-only login behavior with local role-based redirects to `/admin` and `/client` and no auth persistence or backend integration.

Files created:
- `docs/branch_handoffs/frontend-login-visual-0.8C-handoff.md`

Files modified:
- `docs/audit_log.md`
- `frontend/app/globals.css`
- `frontend/app/login/page.tsx`

Visual summary:
- Replaced the basic login panel with a premium split layout: editorial left narrative area plus a compact right-side access card.
- Kept the Sendwise wordmark visible without reintroducing a shell icon.
- Used the approved Sendwise palette: `#FAFAF7`, `#CACFD6`, `#D6E5E3`, `#9FD8CB`, `#517664`, and `#2D3319`.
- All visible copy is in Italian.
- Added a clear mock/demo label, helper text, and restrained static footer placeholders.
- Anchored the layout styling in dedicated login CSS classes inside `globals.css` to avoid dependence on fragile page-local utility generation.
- Reused existing shared primitives (`BrandMark`, `MockModeBadge`) without creating a parallel design system.

Login behavior preserved:
- Submit remains mock-only.
- Demo role selector remains present.
- `client` redirects to `/client`.
- `admin` redirects to `/admin`.
- No token, cookie, local storage, session storage, or real auth state is created.

API/security boundary status:
- No `fetch` was added.
- No `frontend/lib/api.ts` usage was added.
- No `frontend/lib/mock-api.ts` import was added.
- No backend, listmonk, PostgreSQL, SMTP, or database references were added.
- No `localStorage`, `sessionStorage`, or `document.cookie` usage was added.

Anti-monolith verdict:
- Acceptable.
- The implementation stays within a single page file plus route-specific CSS and remains presentationally segmented through small local data structures.
- No oversized shared abstraction or duplicate auth form system was introduced.

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
- `curl -I http://localhost:3000/login`

Tests not executed and why:
- Browser-based visual verification on `http://localhost:3000/login` could not be completed because the available Playwright browser tooling in this environment requires a Chrome runtime that is not installed.
- A local HTTP check confirmed the route responds with `200 OK`, but no screenshot-based validation was possible from this session.

Contract changes requested:
- None.

Risks remaining:
- Visual fine-tuning against the exact attached design reference may still be warranted because the reference zip was not present in the workspace for direct file inspection in this session.
- The serif headline uses a local fallback stack and depends on host-available fonts for the premium editorial effect.

Suggested next step:
- Run a human browser pass against `/login` on desktop and mobile to fine-tune spacing, typography, and contrast relative to the original reference artifact.

Coordinator handoff:
- `develop` now contains the 0.8C login-only visual refresh with no changes to admin/client dashboards, backend code, API contracts, or storage/auth boundaries.
- The route remains outside the dashboard shell and preserves mock-only behavior.
- No duplicate design system, API layer, or auth layer was introduced.
- No backend, DB, Docker config, real auth, token/cookie/storage, real listmonk, real email sending, AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase implementation was added.
