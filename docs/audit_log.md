# Audit Log

## Initial Entry

Date: 2026-05-05
Milestone: Milestone 0
Scope: Structural contracts, repo skeleton, backend/frontend stubs, Docker base, environment example, audit and smoke scripts.
Files created: Milestone 0 skeleton under `docs/`, `backend/`, `frontend/`, `templates/`, `db/`, `listmonk/`, `mailpit/`, `scripts/`, plus root config files.
Files modified: None; workspace was empty when skeleton was created.
Tests executed:
- `bash scripts/audit.sh`
- `docker compose config`
- `bash scripts/smoke_test.sh`
Tests not executed and reason:
- `PYTHONPATH=backend python3 -m pytest backend/tests` was attempted but local Python does not have `pytest` installed.
Risks remaining:
- Real auth is not implemented.
- Real sending is not implemented.
- listmonk runtime configuration is a skeleton and must be hardened before production.
- Database schema is intentionally minimal and not production-complete.
Confirmation:
  - no real sending implemented
  - no real AI implemented
  - no full dashboard implemented
  - no Keycloak implemented
  - no Celery implemented
  - no n8n workflows implemented
  - no Postal/Rspamd implemented

## Codex Skills Documentation

Date: 2026-05-05
Milestone: Codex Skills Documentation
Scope: docs-only operational skills
Files created/modified:
- Created `docs/codex_prompt_engine_v1.md`
- Created `docs/codex_skills/README.md`
- Created `docs/codex_skills/audit-runtime-flow.md`
- Created `docs/codex_skills/check-anti-monolith.md`
- Created `docs/codex_skills/extract-root-cause.md`
- Created `docs/codex_skills/generate-minimal-fix.md`
- Created `docs/codex_skills/run-regression-guard.md`
- Created `docs/codex_skills/update-docs-after-fix.md`
- Created `docs/codex_skills/audit-installer-vps.md`
- Created `docs/codex_skills/validate-state-and-persistence.md`
- Modified `scripts/audit.sh` to require the new Codex skill docs.
- Modified `docs/audit_log.md` with this entry.
Tests executed:
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
Tests not executed and reason:
- Backend pytest and frontend lint/build were not run because this was a docs-only change with no backend or frontend behavior touched.
Risks remaining:
- These skills are operational guidance only; future prompts must explicitly apply the relevant skill.
Confirmation: no application code changed

## Milestone 0.5 - Parallel Work Boundary

Date: 2026-05-05
Milestone: Milestone 0.5 - Parallel Work Boundary
Scope: Boundary-only backend/frontend parallel-work preparation through schemas, typed endpoint stubs, frontend shared types, mock API, API transport abstraction, ownership rules, and audit checks.
Files created:
- `backend/app/schemas/common.py`
- `backend/app/schemas/clients.py`
- `backend/app/schemas/campaigns.py`
- `backend/app/schemas/contacts.py`
- `backend/app/schemas/usage.py`
- `backend/app/schemas/blocked_sends.py`
- `backend/tests/test_milestone_05_stubs.py`
Files modified:
- `backend/app/api/admin.py`
- `backend/app/api/client.py`
- `frontend/types/index.ts`
- `frontend/lib/mock-api.ts`
- `frontend/lib/api.ts`
- `frontend/app/admin/page.tsx`
- `frontend/app/client/page.tsx`
- `docs/ownership_v1.md`
- `docs/api_contracts_v1.md`
- `docs/audit_checklist_v1.md`
- `scripts/audit.sh`
- `docs/audit_log.md`
Tests executed:
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
Tests not executed and reason:
- `PYTHONPATH=backend pytest backend/tests` could not run because `pytest` is not installed in the local shell.
- `PYTHONPATH=backend python3 -m pytest backend/tests` could not run because the local Python environment does not have `pytest`.
- A direct backend import check could not run because the local Python environment does not have `fastapi`.
- `cd frontend && npm run build` was not run because `frontend/node_modules` is absent; no dependency installation was performed for this milestone.
Residual risks:
- Real auth is not implemented.
- Real database reads/writes are not implemented.
- Endpoint payloads are static stubs and must be replaced by backend-owned business logic in later approved milestones.
- Frontend backend mode has only minimal transport behavior and no production auth handling.
Confirmation:
- no real email sending implemented
- no real AI generation implemented
- no real auth implemented
- no real DB logic implemented
- no real listmonk logic implemented
- no n8n workflows implemented
- no Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase implemented

## Frontend API Boundary Review

Date: 2026-05-05
Branch: feature/frontend-v1
Scope: Minimal frontend API/mock boundary hardening for future admin and client overview summary consumption.
Files created: None.
Files modified:
- `frontend/lib/api.ts`
- `frontend/lib/mock-api.ts`
- `frontend/types/index.ts`
- `docs/audit_log.md`
Tests executed:
- `cd frontend && npm run lint` reached the known interactive Next.js ESLint setup prompt; ESLint was not configured.
- `cd frontend && npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --name-only` confirmed only allowed files changed.
- `rg "\bfetch\s*\(" frontend/app frontend/components frontend/lib` confirmed the only fetch remains in `frontend/lib/api.ts`.
- `rg -i "listmonk|postgres|postgresql|smtp|database_url|db_url" frontend/app frontend/components frontend/lib frontend/types` returned no frontend matches.
Tests not executed and reason:
- No backend pytest was run because this task did not touch backend behavior, database access, Guard logic, or API contracts.
Residual risks:
- Overview summaries are mock-only until matching backend API contracts are approved.
- Real auth, tenant enforcement, deliverability decisions, sending, AI generation, and limit enforcement remain backend-owned future work.
Confirmation:
- no frontend app or component files modified
- no backend, DB, Docker, script, Makefile, listmonk, mailpit, package/config, or contract docs modified
- no direct listmonk, PostgreSQL, SMTP, or database URL references added
- no fetch calls added outside `frontend/lib/api.ts`

## Frontend Overview Page Boundary Consumption

Date: 2026-05-05
Branch: feature/frontend-v1
Scope: Minimal page wiring for `/admin` and `/client` to consume typed overview summary accessors through `frontend/lib/api.ts`.
Files created: None.
Files modified:
- `frontend/app/admin/page.tsx`
- `frontend/app/client/page.tsx`
- `docs/audit_log.md`
Tests executed:
- `cd frontend && npm run lint` reached the known interactive Next.js ESLint setup prompt; ESLint was not configured.
- `cd frontend && npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --name-only` confirmed only allowed tracked files changed.
- `rg "\bfetch\s*\(" frontend/app frontend/components frontend/lib` confirmed the only fetch remains in `frontend/lib/api.ts`.
- `rg "mock-api" frontend/app frontend/components` returned no matches.
- `rg -i "listmonk|postgres|postgresql|smtp|database_url|db_url" frontend/app frontend/components frontend/lib frontend/types` returned no frontend matches.
Tests not executed and reason:
- No backend pytest was run because this task did not touch backend behavior, database access, Guard logic, or API contracts.
Residual risks:
- Overview summaries remain mock-backed until matching backend contracts are approved.
- Real auth, tenant enforcement, deliverability decisions, sending, AI generation, and limit enforcement remain backend-owned future work.
- `npm run build` generated untracked `frontend/next-env.d.ts`; it was not included in this task.
Confirmation:
- pages import overview data only from `frontend/lib/api.ts`
- no `frontend/lib`, `frontend/types`, or `frontend/components` files modified
- no backend, DB, Docker, script, Makefile, listmonk, mailpit, package/config, or contract docs modified
- no direct listmonk, PostgreSQL, SMTP, or database URL references added
- no fetch calls added outside `frontend/lib/api.ts`

## Frontend Mock Mode Indicator

Date: 2026-05-05
Branch: feature/frontend-v1
Scope: Minimal presentational shell update to identify mock frontend-only auth and mock-backed data mode.
Files created: None.
Files modified:
- `frontend/components/layout/AppShell.tsx`
- `docs/audit_log.md`
Tests executed:
- `cd frontend && npm run lint` reached the known interactive Next.js ESLint setup prompt; ESLint was not configured.
- `cd frontend && npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --name-only` showed this task's files plus pre-existing dirty frontend mock-login files.
- `rg "\bfetch\s*\(" frontend/app frontend/components frontend/lib` confirmed the only fetch remains in `frontend/lib/api.ts`.
- `rg "mock-api" frontend/app frontend/components` returned no matches.
- `rg -i "listmonk|postgres|postgresql|smtp|database_url|db_url" frontend/app frontend/components frontend/lib frontend/types` returned no frontend matches.
- `rg -i "localStorage|sessionStorage|document.cookie|jwt|token" frontend/app frontend/components` returned no matches.
Tests not executed and reason:
- No backend pytest was run because this task did not touch backend behavior, database access, Guard logic, or API contracts.
Residual risks:
- Real auth, tenant enforcement, backend data, deliverability decisions, sending, AI generation, and limit enforcement remain future backend-owned work.
Confirmation:
- indicator is presentational only
- no auth, route protection, credentials, tokens, cookies, localStorage, or sessionStorage introduced
- no frontend app, frontend lib, frontend types, frontend auth, or frontend UI primitive files modified by this task
- no backend, DB, Docker, scripts, Makefile, listmonk, mailpit, package/config, or contract docs modified
- no direct listmonk, PostgreSQL, SMTP, or database URL references added
- no fetch calls added outside `frontend/lib/api.ts`

## Frontend Next 16 Dependency Upgrade

Date: 2026-05-06
Branch: feature/frontend-v1
Scope: Controlled frontend dependency stack upgrade from Next.js 15 to Next.js 16.
Files created: None.
Files modified:
- `frontend/package.json`
- `frontend/tsconfig.json`
- `docs/audit_log.md`
Dependency changes:
- `next` upgraded from `15.1.3` to `^16.2.4`.
- `react` upgraded from `19.0.0` to `^19.2.5`.
- `react-dom` upgraded from `19.0.0` to `^19.2.5`.
- `typescript` remained `5.7.2`.
Tests executed:
- `cd frontend && node -v`
- `cd frontend && npm -v`

## Milestone 0.8B - Design Tokens + App Shell

Date: 2026-05-06
Branch: develop
Scope: Shared frontend visual foundation only - design tokens, brand mark, app shell, contextual sidebar, reusable top bar, mobile drawer, mock mode badge, and shell styling aligned to the Sendwise design reference zip.
Files created:
- `docs/branch_handoffs/frontend-design-shell-0.8B-handoff.md`
- `frontend/components/layout/TopBar.tsx`
- `frontend/components/shared/BrandMark.tsx`
- `frontend/components/shared/MockModeBadge.tsx`
Files modified:
- `frontend/app/globals.css`
- `frontend/app/layout.tsx`
- `frontend/components/layout/AppShell.tsx`
- `frontend/components/layout/MainNav.tsx`
- `frontend/components/layout/MobileNav.tsx`
- `frontend/components/layout/Sidebar.tsx`
- `docs/audit_log.md`
Design tokens adapted:
- Neutral `#CACFD6`
- Pale mint `#D6E5E3`
- Aqua accent `#9FD8CB`
- Primary green `#517664`
- Deep olive `#2D3319`
- Background `#FAFAF7`
- Surface `#FFFFFF`
- Surface mint `#EEF4F2`
- Border `#E3E5E0`
Implementation notes:
- Refactored the existing shell instead of creating a second app shell or duplicate navigation layer.
- Preserved `/login` without shell wrapping by making `AppShell` route-aware.
- Kept `frontend/lib/api.ts` as the only fetch boundary and did not add direct mock imports.
- Used the existing shadcn `Sheet` for mobile navigation and kept all placeholder actions disabled/presentational.
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
Tests not executed and reason:
- No browser-level visual verification was run in this milestone; validation stayed at build, audit, smoke, and static boundary checks.
Risks remaining:
- Admin/client dashboard internals are still the earlier milestone UI and will need a separate content restyling pass.
- Small visual tuning issues may remain until the next milestone performs browser-level validation.
Confirmation:
- no backend changes
- no DB changes
- no Docker config changes
- no real auth implemented
- no real listmonk integration implemented
- no real email sending implemented
- no AI generation implemented
- no n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase implemented
- `cd frontend && npm ls next react react-dom typescript`
- `cd frontend && npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `rg "\bfetch\s*\(" frontend/app frontend/components frontend/lib`
- `rg "mock-api" frontend/app frontend/components`
- `rg -i "listmonk|postgres|postgresql|smtp|database_url|db_url" frontend/app frontend/components frontend/lib frontend/types`
- `rg -i "localStorage|sessionStorage|document.cookie|jwt|token" frontend/app frontend/components`
- `cd frontend && rm -rf .next && npm run dev`
- Runtime HTTP checks for `/`, `/login`, `/admin`, and `/client`.
Tests not executed and reason:
- `cd frontend && npm run lint` was not run because this repo has the known Next.js ESLint setup prompt and this task must not configure ESLint.
Runtime route check:
- `/` returned `307` redirect to `/login`.
- `/login` returned `200` and rendered mock login with the mock mode indicator.
- `/admin` returned `200` and rendered the mock-backed admin overview.
- `/client` returned `200` and rendered the mock-backed client overview.
Residual risks:
- Next.js 16 requires Node.js `20.9.0+`; local preflight used Node `v25.6.1`.
- `package-lock.json` is absent in this repo, so no lockfile was created under the max-new-files constraint.
- `npm install` reported two moderate vulnerabilities; no broad audit fix was run because it would be outside the controlled upgrade scope.
- Next.js 16 regenerates `frontend/next-env.d.ts` during build/dev; generated changes were not included in this task.
Confirmation:
- no frontend app, component, lib, or types files modified
- no backend, DB, Docker, scripts, Makefile, listmonk, mailpit, or contract docs modified
- no auth, route protection, tokens, cookies, localStorage, or sessionStorage introduced
- no direct listmonk, PostgreSQL, SMTP, or database URL references added
- no fetch calls added outside `frontend/lib/api.ts`

## Admin Overview V1 Foundation

Date: 2026-05-06
Branch: feature/frontend-v1
Scope: Small mock-backed admin overview foundation with minimal Sendwise/shadcn token hygiene, typed admin overview summary extension, and `/admin` presentation update.
Files created: None.
Files modified:
- `frontend/app/globals.css`
- `frontend/types/index.ts`
- `frontend/lib/mock-api.ts`
- `frontend/app/admin/page.tsx`
- `docs/audit_log.md`
Tests executed:
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --name-only` confirmed only allowed tracked files changed.
- `rg "\bfetch\s*\(" frontend/app frontend/components frontend/lib` confirmed the only fetch remains in `frontend/lib/api.ts`.
- `rg "mock-api" frontend/app frontend/components` returned no matches.
- `rg -i "listmonk|postgres|postgresql|smtp|database_url|db_url" frontend/app frontend/components frontend/lib frontend/types` returned no matches.
- `rg -i "localStorage|sessionStorage|document.cookie|jwt|token" frontend/app frontend/components` returned no matches.
- `cd frontend && rm -rf .next && npm run dev` ran on port 3001 because port 3000 was already in use.
- Runtime HTTP checks for `/`, `/login`, `/admin`, and `/client`.
Runtime route check:
- `/` returned `307` redirect to `/login`.
- `/login` returned `200` and rendered mock login with the mock mode indicator.
- `/admin` returned `200` and rendered expanded mock-backed Admin Overview V1 fields.
- `/client` returned `200` and rendered the existing mock-backed client overview.
Tests not executed and reason:
- No backend pytest was run because this task did not touch backend behavior, database access, Guard logic, or API contracts.
Residual risks:
- Admin Overview V1 remains mock-backed until approved backend contracts exist.
- Real auth, tenant enforcement, deliverability decisions, sending, AI generation, and limit enforcement remain backend-owned future work.
Confirmation:
- `/admin` imports data only from `frontend/lib/api.ts`.
- `/`, `/login`, `/client`, `frontend/components`, and package/config files were not modified.
- no backend, DB, Docker, scripts, Makefile, listmonk, mailpit, or contract docs modified.
- no auth, route protection, tokens, cookies, localStorage, or sessionStorage introduced.
- no direct listmonk, PostgreSQL, SMTP, or database URL references added.
- no fetch calls added outside `frontend/lib/api.ts`.

## Frontend Non-Interactive Lint Setup

Date: 2026-05-06
Branch: feature/frontend-v1
Scope: Minimal frontend ESLint CLI setup for Next.js 16 so `npm run lint` runs without interactive setup or removed `next lint` behavior.
Files created:
- `frontend/eslint.config.mjs`
- `frontend/package-lock.json`
Files modified:
- `frontend/package.json`
- `docs/audit_log.md`
Dependency changes:
- Added `eslint` as a frontend dev dependency.
- Added `eslint-config-next` as a frontend dev dependency.
- No Next.js, React, or React DOM version changes.
Tests executed:
- `cd frontend && npm run lint` preflight failed non-interactively because `next lint` is removed in Next.js 16.
- `cd frontend && npm run lint` passed after setup.
- `cd frontend && npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --name-only` reported tracked changes.
- `rg "\bfetch\s*\(" frontend/app frontend/components frontend/lib` confirmed the only fetch remains in `frontend/lib/api.ts`.
- `rg "mock-api" frontend/app frontend/components` returned no matches.
- `rg -i "listmonk|postgres|postgresql|smtp|database_url|db_url" frontend/app frontend/components frontend/lib frontend/types` returned no matches.
- `rg -i "localStorage|sessionStorage|document.cookie|jwt|token" frontend/app frontend/components` returned no matches.
- `cd frontend && rm -rf .next && npm run dev` ran on port 3001 because port 3000 was already in use.
- Runtime HTTP checks for `/`, `/login`, `/admin`, and `/client`.
Tests not executed and reason:
- No backend pytest was run because this task did not touch backend behavior, database access, Guard logic, or API contracts.
Runtime route check:
- `/` returned `307` redirect to `/login`.
- `/login` returned `200` and rendered mock login with the mock mode indicator.
- `/admin` returned `200` and rendered the mock-backed admin overview.
- `/client` returned `200` and rendered the mock-backed client overview.
Residual risks:
- `npm install` reported two moderate vulnerabilities; no `npm audit fix` was run because that may make broader dependency changes outside this task.
- `frontend/next-env.d.ts` is tracked and was regenerated during build/dev; generated diff was restored and not included.
Confirmation:
- no frontend app, component, lib, or types files modified
- no backend, DB, Docker, scripts, Makefile, listmonk, mailpit, or contract docs modified
- no auth, route protection, tokens, cookies, localStorage, or sessionStorage introduced
- no direct listmonk, PostgreSQL, SMTP, or database URL references added
- no fetch calls added outside `frontend/lib/api.ts`

## Client Overview V1 Foundation

Date: 2026-05-06
Branch: feature/frontend-v1
Scope: Small mock-backed Client Overview V1 foundation through the typed frontend mock/API boundary and `/client` presentation.
Files created: None.
Files modified:
- `frontend/types/index.ts`
- `frontend/lib/mock-api.ts`
- `frontend/app/client/page.tsx`
- `docs/audit_log.md`
Tests executed:
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --name-only` confirmed only allowed tracked files changed.
- `rg "\bfetch\s*\(" frontend/app frontend/components frontend/lib` confirmed the only fetch remains in `frontend/lib/api.ts`.
- `rg "mock-api" frontend/app frontend/components` returned no matches.
- `rg -i "listmonk|postgres|postgresql|smtp|database_url|db_url" frontend/app frontend/components frontend/lib frontend/types` returned no matches.
- `rg -i "localStorage|sessionStorage|document.cookie|jwt|token" frontend/app frontend/components` returned only the required client usage metric fields for token usage, not auth/session storage.
- `cd frontend && rm -rf .next && npm run dev` ran on port 3001 because port 3000 was already in use.
- Runtime HTTP checks for `/`, `/login`, `/admin`, and `/client`.
Runtime route check:
- `/` returned `307` redirect to `/login`.
- `/login` returned `200` and rendered mock login with the mock mode indicator.
- `/admin` returned `200` and rendered the existing mock-backed admin overview.
- `/client` returned `200` and rendered expanded mock-backed Client Overview V1 sections.
Tests not executed and reason:
- No backend pytest was run because this task did not touch backend behavior, database access, Guard logic, or API contracts.
Residual risks:
- Client Overview V1 remains mock-backed until approved backend contracts exist.
- Real auth, tenant enforcement, deliverability decisions, sending, AI generation, and limit enforcement remain backend-owned future work.
- Next.js regenerated `frontend/next-env.d.ts` during build/dev; the generated diff was restored and not included.
Confirmation:
- `/client` imports data only from `frontend/lib/api.ts`.
- `/`, `/login`, `/admin`, `frontend/components`, and package/config files were not modified.
- no backend, DB, Docker, scripts, Makefile, listmonk, mailpit, or contract docs modified.
- no auth, route protection, credential tokens, cookies, localStorage, or sessionStorage introduced.
- no direct listmonk, PostgreSQL, SMTP, or database URL references added.
- no fetch calls added outside `frontend/lib/api.ts`.

## Client Overview Email Limits Copy Fix

Date: 2026-05-06
Branch: feature/frontend-v1
Scope: Minimal mock-backed Client Overview correction to display email sending usage/limits instead of client-facing AI calls/tokens, with affected `/client` copy in Italian.
Root cause: The Client Overview V1 mock/type/page model introduced AI calls/tokens as client-facing usage, but the product requirement is that the client-facing limit is email sending volume controlled by admin.
Files created: None.
Files modified:
- `frontend/types/index.ts`
- `frontend/lib/mock-api.ts`
- `frontend/app/client/page.tsx`
- `docs/audit_log.md`
Tests executed:
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --name-only` confirmed only allowed tracked files changed.
- `rg "\bfetch\s*\(" frontend/app frontend/components frontend/lib` confirmed the only fetch remains in `frontend/lib/api.ts`.
- `rg "mock-api" frontend/app frontend/components` returned no matches.
- `rg -i "listmonk|postgres|postgresql|smtp|database_url|db_url" frontend/app frontend/components frontend/lib frontend/types` returned no matches.
- `rg -i "localStorage|sessionStorage|document.cookie|jwt|token" frontend/app frontend/components` returned no matches.
- `rg -i "AI calls|Tokens|token usage|usage overview" frontend/app/client/page.tsx frontend/types/index.ts frontend/lib/mock-api.ts` returned no matches.
- `cd frontend && rm -rf .next && npm run dev` initially hit sandbox `EPERM` on port bind, then ran with approval on port 3001 because port 3000 was already in use.
- Runtime HTTP checks for `/`, `/login`, `/admin`, and `/client`.
Runtime route check:
- `/` returned `307` redirect to `/login`.
- `/login` returned `200` and rendered mock login with the mock mode indicator.
- `/admin` returned `200` and rendered the existing mock-backed Admin Overview V1.
- `/client` returned `200` and rendered Italian email-limit based Client Overview copy.
Tests not executed and reason:
- No backend pytest was run because this task did not touch backend behavior, database access, Guard logic, or API contracts.
Residual risks:
- Client Overview remains mock-backed until approved backend contracts exist.
- Admin dashboard still has its existing AI usage metric; this task intentionally changed only `/client`.
- Real auth, tenant enforcement, deliverability decisions, sending, AI generation, and limit enforcement remain backend-owned future work.
- Next.js regenerated `frontend/next-env.d.ts` during build/dev; the generated diff was restored and not included.
Confirmation:
- `/client` imports data only from `frontend/lib/api.ts`.
- `/`, `/login`, `/admin`, `frontend/components`, and package/config files were not modified.
- no backend, DB, Docker, scripts, Makefile, listmonk, mailpit, or contract docs modified.
- no auth, route protection, credentials, auth tokens, cookies, localStorage, or sessionStorage introduced.
- no direct listmonk, PostgreSQL, SMTP, or database URL references added.
- no fetch calls added outside `frontend/lib/api.ts`.
- client-facing AI call/token usage was removed from `/client`.

## Frontend Sidebar Role Nav And Client Email KPIs

Date: 2026-05-06
Branch: feature/frontend-v1
Scope: Minimal mock-backed frontend shell correction for route-contextual sidebar/mobile navigation and client email delivery KPI model.
Root cause: The shared `MainNav` rendered a static `/login`, `/admin`, and `/client` role switcher in every shell context, while the client overview type/mock/page still exposed daily email-limit fields instead of a client-facing delivery KPI grouping.
Files created: None.
Files modified:
- `frontend/components/layout/AppShell.tsx`
- `frontend/components/layout/MainNav.tsx`
- `frontend/components/layout/Sidebar.tsx`
- `frontend/components/layout/MobileNav.tsx`
- `frontend/types/index.ts`
- `frontend/lib/mock-api.ts`
- `frontend/app/client/page.tsx`
- `docs/audit_log.md`
Tests executed:
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --check` passed.
- `git diff --name-only` confirmed only allowed tracked files changed after restoring generated `frontend/next-env.d.ts`.
- `rg "\bfetch\s*\(" frontend/app frontend/components frontend/lib` confirmed the only fetch remains in `frontend/lib/api.ts`.
- `rg "mock-api" frontend/app frontend/components` returned no matches.
- `rg -i "listmonk|postgres|postgresql|smtp|database_url|db_url" frontend/app frontend/components frontend/lib frontend/types` returned no matches.
- `rg -i "localStorage|sessionStorage|document.cookie|jwt|auth token" frontend/app frontend/components` returned no matches.
- `rg -n -i "AI calls|Tokens|token usage|usageOverview|dailyEmailLimit|dailyEmailsSent" frontend/app/client/page.tsx frontend/types/index.ts frontend/lib/mock-api.ts frontend/lib/api.ts` returned no matches.
- `cd frontend && rm -rf .next && npm run dev` initially hit sandbox `EPERM` on port bind, then ran with approval on port 3001 because port 3000 was already in use.
- Runtime browser checks for `/`, `/login`, `/admin`, and `/client` on `http://localhost:3001`.
Runtime route check:
- `/` redirected to `/login`.
- `/login` rendered the mock login form and no dashboard navigation links.
- `/admin` rendered the existing mock-backed admin overview with admin menu: Panoramica, Clienti, Campagne, Limiti email, Invii bloccati, Sistema.
- `/client` rendered the corrected mock-backed client overview with client menu: Panoramica, Campagne, Limiti email, Invii bloccati.
- `/client` showed Limite email mensile, Email inviate, Aperte, Finite in spam, Rimbalzate, and Invii bloccati.
- `/client` did not show AI calls, token usage, or daily email limit terms.
Tests not executed and reason:
- No backend pytest was run because this task did not touch backend behavior, database access, Guard logic, API contracts, or schemas.
Residual risks:
- Route-contextual navigation is UI-only pathname inference, not real auth or tenant security.
- Future placeholder links do not have pages yet and may render 404 until separately implemented.
- Client KPIs remain mock-backed until approved backend contracts exist.
- Admin dashboard still has its existing AI usage metric; this task intentionally changed only client-facing KPI presentation.
Confirmation:
- sidebar menu is route-contextual and mock-only, not real auth/security.
- `/client` imports data only from `frontend/lib/api.ts`.
- `/`, `/login`, `/admin`, package/config files, and generated `frontend/next-env.d.ts` were not modified.
- no backend, DB, Docker, scripts, Makefile, listmonk, mailpit, or contract docs modified.
- no auth, route protection, credentials, auth tokens, cookies, localStorage, or sessionStorage introduced.
- no direct listmonk, PostgreSQL, SMTP, or database URL references added.
- no fetch calls added outside `frontend/lib/api.ts`.
- client-facing AI/token/daily-limit usage was removed from `/client`.

## Milestone 0.6 — Integration Audit

Date: 2026-05-06
Branch: develop
Branches merged:
- feature/backend-core
- feature/frontend-v1
Scope:
- Merge backend/frontend foundations into `develop`
- Audit state and API compatibility between backend schemas/stubs and frontend shared types/mock boundary
- Verify boundary rules, smoke/audit/build flows, and route inventory
Conflicts:
- No textual merge conflicts occurred.
- One sandbox-related Git metadata permission issue blocked the first merge attempt; rerunning with elevated repo write access resolved it without content changes.
Fixes:
- Updated `frontend/types/index.ts` so `ClientCampaignSummaryStatus` reuses documented `CampaignStatus` values.
- Updated `frontend/lib/mock-api.ts` so the client overview summary uses `running` instead of undocumented `active` for campaign state.
Tests:
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --check` passed.
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed.
- Boundary grep checks passed:
  - no frontend `listmonk` references
  - no frontend PostgreSQL/SMTP/database references
  - no `mock-api` imports from frontend pages/components
  - frontend `fetch(` remains centralized in `frontend/lib/api.ts`
- Backend pytest not executed because `pytest` is unavailable in the local Python environment (`pytest: command not found`; `python3 -m pytest`: `No module named pytest`).
Risks:
- Sidebar links target routes not yet implemented: `/admin/clients`, `/admin/campaigns`, `/admin/email-limits`, `/admin/blocked-sends`, `/admin/system`, `/client/campaigns`, `/client/email-limits`, `/client/blocked-sends`.
- `POST /campaigns/{campaign_id}/authorize` and `POST /campaigns/{campaign_id}/send` remain stub/planned rather than end-to-end typed integration contracts.
- Admin/client overview summary helpers remain frontend mock-only and are not backed by backend endpoints yet.
Confirmation:
- No real email sending, AI generation, auth/RBAC, DB persistence work, listmonk execution, n8n workflows, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase was implemented.
- Backend remains the gatekeeper.
- Business PostgreSQL remains the documented business source of truth.
- UI does not call listmonk or PostgreSQL directly.
- `EMAIL_SENDING_ENABLED` remains fail-closed by exact `"true"` evaluation.

## Prompt Shortcuts V1

Date: 2026-05-06
Branch: develop
Scope: docs-only prompt shortcut reference for compact Sendwise task prompts.
Files created:
- `docs/prompt_shortcuts_v1.md`
Files modified:
- `docs/audit_log.md`
Tests executed:
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`
Tests not executed and reason:
- No backend pytest or frontend build/lint was run because this task changed docs only and did not modify backend, frontend, DB, Docker, scripts, or runtime behavior.
Residual risks:
- Prompt shortcuts are operational guidance only; future prompts still need explicit goal, scope, and allowed-file boundaries.
- If the V1 contracts or Codex skills change later, `docs/prompt_shortcuts_v1.md` must be kept in sync.
Confirmation:
- no application code changed
- no backend, frontend, DB, Docker, script, Makefile, or env files modified

## Milestone 0.7 - Frontend Backend Connection

Date: 2026-05-06
Branch: develop
Scope:
- Harden `frontend/lib/api.ts` for dual mock/backend operation through the existing API boundary
- Keep mock mode behavior intact
- Align frontend typing with current FastAPI stub payloads
- Move `/admin` and `/client` to backend-derived overview data without adding backend routes

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

Endpoints connected:
- `GET /admin/clients`
- `GET /admin/campaigns`
- `GET /client/me`
- `GET /client/campaigns`
- `GET /client/usage`
- `GET /client/blocked-sends`

Implementation notes:
- `frontend/lib/api.ts` now centralizes backend fetches, network failure handling, non-2xx handling, invalid JSON handling, and missing `NEXT_PUBLIC_API_BASE_URL` handling.
- Mock mode still returns the existing `frontend/lib/mock-api.ts` fixtures and summaries unchanged.
- Backend mode derives admin and client overview summaries from the allowed stub endpoints so the dashboards no longer stay mock-only when `NEXT_PUBLIC_USE_MOCK_API=false`.
- `/admin` and `/client` were kept thin via dashboard components plus a shared error-state component.
- Both pages are marked dynamic so backend-mode production builds do not fail by trying to pre-render unavailable local APIs.

Tests:
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed.
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --check` passed.
- Boundary grep checks passed:
  - no direct `mock-api` imports from `frontend/app` or `frontend/components`
  - `fetch(` remains only in `frontend/lib/api.ts`
  - no `listmonk`, `postgres`, `database`, or `smtp` references in allowed frontend runtime files
  - no `localStorage`, `sessionStorage`, or `document.cookie` references in allowed frontend runtime files

Tests not executed and reason:
- No live browser or HTTP runtime verification was completed with the full local stack in backend mode. Docker Desktop had to be started during the session, and `docker compose up -d` did not finish bringing the stack up before handoff.

Risks:
- Admin backend mode still renders zero/empty values for overview fields that do not have matching backend stub endpoints yet.
- Client backend mode still renders zero limits where the current backend stubs do not expose limit data.
- A live backend-mode runtime check remains outstanding.

Confirmation:
- no backend, DB, Docker, or contract files were modified
- no real auth, tokens, cookies, localStorage, sessionStorage, or session handling was introduced
- no real listmonk calls, real sending, AI generation, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work was implemented
- fetches remain centralized in `frontend/lib/api.ts`

## Milestone 0.7.1 - Frontend Backend Mode Verification

Date: 2026-05-06
Branch: develop
Scope:
- Verify the existing frontend backend-mode integration against the current stub backend endpoints
- Resolve the TypeScript `baseUrl` deprecation safely for the current toolchain
- Reconfirm frontend boundary constraints without expanding scope

Files created:
- `docs/branch_handoffs/frontend-backend-verification-0.7.1-handoff.md`

Files modified:
- `docs/audit_log.md`
- `frontend/tsconfig.json`

Implementation notes:
- `frontend/tsconfig.json` no longer uses `baseUrl`, which removes the deprecated option at the source while preserving the existing `@/*` alias mapping through `paths`.
- The exact task-requested `ignoreDeprecations: "6.0"` value was tested and rejected by the installed compiler (`typescript@5.7.2`) and by `next build` with `TS5103: Invalid value for '--ignoreDeprecations'.`
- Live HTTP verification succeeded for `GET /health`, `GET /admin/clients`, `GET /admin/campaigns`, `GET /client/me`, `GET /client/campaigns`, `GET /client/usage`, and `GET /client/blocked-sends`.
- Backend mode build succeeded with `NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`.
- No frontend API boundary regressions were found: `fetch(` remains in `frontend/lib/api.ts`, and no direct `mock-api`, storage, auth-token, cookie, database, SMTP, or listmonk usage was introduced in app/component/runtime files.

Tests:
- `cd frontend && npm run lint` passed.
- `cd frontend && npx tsc -p tsconfig.json --noEmit` passed.
- `cd frontend && npm run build` passed.
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --check` passed.
- Required boundary grep checks passed.
- Required localhost endpoint curls passed against the running backend stub.

Tests not executed and reason:
- No browser runtime verification was performed, so no browser-level backend-mode success is claimed.

Contract changes requested:
- None.

Risks:
- If the team wants the exact VS Code suppression value `ignoreDeprecations: "6.0"`, the TypeScript toolchain will need to be upgraded first because the current repo version rejects it.
- Browser rendering behavior in backend mode remains to be validated in a real session.

Confirmation:
- no backend, DB, Docker config, env, or contract files changed
- no backend logic changed
- no real auth, tokens, cookies, localStorage, or sessionStorage introduced
- no real listmonk calls, real sending, AI generation, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work implemented
## Milestone 0.7.2 - Browser Backend Mode Smoke Check

Date: 2026-05-06
Branch: develop
Scope:
- verify browser rendering for `/login`, `/admin`, and `/client` in backend mode
- confirm frontend/backend boundary behavior under a real browser session
- apply only the smallest frontend-only fix required by runtime verification

Files created:
- `docs/branch_handoffs/browser-backend-mode-smoke-0.7.2-handoff.md`

Files modified:
- `docs/audit_log.md`
- `frontend/components/layout/MobileNav.tsx`

Implementation notes:
- Verified `GET /health`, `GET /admin/clients`, `GET /admin/campaigns`, `GET /client/me`, `GET /client/campaigns`, `GET /client/usage`, and `GET /client/blocked-sends` against the running local backend stub.
- Verified `/login`, `/admin`, and `/client` in a real browser with `NEXT_PUBLIC_USE_MOCK_API=false` and `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`.
- Confirmed backend mode on `/admin` and `/client` through rendered values and the `Backend stub` badge while keeping `fetch(` centralized in `frontend/lib/api.ts`.
- Added a `SheetDescription` to `frontend/components/layout/MobileNav.tsx` to remove the runtime warning emitted by the Radix sheet dialog when the mobile navigation opens.

Tests:
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed.
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --check` passed.
- Required boundary grep checks passed.
- Required localhost endpoint curls passed.
- Real browser route verification passed for `/login`, `/admin`, and `/client`.

Tests not executed and reason:
- None.

Risks:
- `/login` remains intentionally mock-only until a separate auth milestone is approved.
- Some `/admin` and `/client` summary fields remain zero/empty because the current backend stub does not expose fuller aggregate data yet.

Confirmation:
- no backend, DB, Docker config, env, or contract files changed
- no real auth, tokens, cookies, localStorage, or sessionStorage introduced
- no real listmonk calls, real sending, AI generation, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work implemented
- fetches remain centralized in `frontend/lib/api.ts`
## Milestone 0.8B.1 - Frontend Shell Bugfix & Runtime Hardening

Date: 2026-05-06
Branch: develop
Scope:
- audit and reproduce current frontend shell/runtime issues before fixing
- remove the shell brand icon
- restore correct mock-mode startup behavior
- stop existing sidebar-linked routes from failing
- verify frontend behavior in both mock and backend modes without touching backend contracts

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

Issues reproduced:
- The shell brand rendered an icon next to `Sendwise`.
- Plain `npm run dev` did not stay in mock mode when `NEXT_PUBLIC_USE_MOCK_API` was unset.
- `/admin` and `/client` rendered the dashboard error state with `NEXT_PUBLIC_API_BASE_URL is required when NEXT_PUBLIC_USE_MOCK_API=false.` under that startup condition.
- Sidebar-linked routes returned `404`: `/admin/clients`, `/admin/campaigns`, `/admin/email-limits`, `/admin/blocked-sends`, `/admin/system`, `/client/campaigns`, `/client/email-limits`, `/client/blocked-sends`.
- No real `400` frontend route or backend API response was reproduced. The audited backend endpoints all returned `200 OK`.

Implementation notes:
- `frontend/lib/api.ts` now defaults to mock mode unless the env explicitly sets `NEXT_PUBLIC_USE_MOCK_API=false`.
- `frontend/components/shared/BrandMark.tsx` now renders only the `Sendwise` wordmark.
- Added minimal static app routes only for the already-linked shell URLs so navigation no longer points at missing pages.
- `AppShell`, `Sidebar`, `MobileNav`, and `TopBar` now hide the mock badge when backend mode is active.
- Verified mock-mode browser behavior on `http://localhost:3000` and backend-mode browser behavior on `http://localhost:3101`.
- Verified `GET /health`, `GET /admin/clients`, `GET /admin/campaigns`, `GET /client/me`, `GET /client/campaigns`, `GET /client/usage`, and `GET /client/blocked-sends` against the running backend stub; each returned `200 OK`.

Tests:
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed.
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose up -d backend` passed.
- `docker compose config` passed.
- `git diff --check` passed.
- Boundary grep checks passed:
  - no direct `mock-api` imports from `frontend/app` or `frontend/components`
  - `fetch(` remains only in `frontend/lib/api.ts`
  - no `listmonk`, `postgres`, `database`, or `smtp` references in allowed frontend runtime files
  - no `localStorage`, `sessionStorage`, or `document.cookie` references in allowed frontend runtime files
- Browser verification passed for the listed mock-mode routes on `http://localhost:3000`.
- Browser verification passed for the listed backend-mode routes on `http://localhost:3101`.

Tests not executed and reason:
- A second concurrent backend-mode `npm run dev` session was not run because the workspace already had an active `next dev` process on `localhost:3000`, and Next 16 refused a second dev server in the same directory.
- Backend-mode runtime verification was completed instead from a separate built frontend server on `http://localhost:3101`.

Contract changes requested:
- None.

Risks:
- The newly added sidebar route pages are static placeholders that prevent broken navigation but intentionally do not add new feature behavior.
- `/login` remains intentionally mock-only until an approved auth milestone changes that boundary.
- `/admin` and `/client` still reflect the current backend stub coverage and can show zero/empty aggregates where the backend does not yet expose richer data.

Confirmation:
- no backend, DB, Docker config, env, or contract files changed
- no backend logic changed
- no real auth, tokens, cookies, localStorage, or sessionStorage introduced
- no real listmonk calls, real sending, AI generation, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work implemented
- fetches remain centralized in `frontend/lib/api.ts`

## Milestone 0.8C - Login Visual

Date: 2026-05-06
Branch: develop
Scope:
- restyle only `frontend/app/login/page.tsx`
- keep `/login` outside the dashboard shell
- preserve mock-only routing behavior without adding auth persistence or backend calls

Files created:
- `docs/branch_handoffs/frontend-login-visual-0.8C-handoff.md`

Files modified:
- `docs/audit_log.md`
- `frontend/app/globals.css`
- `frontend/app/login/page.tsx`

Implementation notes:
- Replaced the basic login panel with a premium split layout built directly from existing shared primitives and dedicated login CSS.
- Kept the Sendwise wordmark visible without reintroducing a shell icon.
- Preserved the Sendwise palette and 0.8B visual tone while keeping all visible copy in Italian.
- Preserved the existing demo role switch and local route redirects to `/admin` and `/client`.
- Moved the route styling foundation into semantic login classes in `frontend/app/globals.css` so the page does not depend on page-local arbitrary utility generation.
- No changes were made to `frontend/components/auth/MockLoginForm.tsx` because that file is outside the allowed edit scope; the login page now owns its presentational mock form directly.

Tests:
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed.
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --check` passed.
- `grep -R "from .*mock-api" frontend/app frontend/components || true` returned no matches.
- `grep -R "fetch(" frontend/app frontend/components frontend/lib || true` confirmed the only fetch remains in `frontend/lib/api.ts`.
- `grep -R "listmonk\|postgres\|database\|smtp" frontend/app frontend/components frontend/lib || true` returned no matches.
- `grep -R "localStorage\|sessionStorage\|document.cookie" frontend/app frontend/components frontend/lib || true` returned no matches.
- `curl -I http://localhost:3000/login` returned `HTTP/1.1 200 OK`.

Tests not executed and reason:
- Browser-based visual verification could not be completed because the available Playwright browser tooling requires a Chrome runtime that is not installed in this environment.

Residual risks:
- Final visual parity against the attached design artifact may need a manual browser pass because the reference zip was not present in the workspace for direct inspection during implementation.
- The premium serif headline effect depends on locally available fallback fonts.

Confirmation:
- no backend, DB, Docker config, env, or contract files changed
- no real auth, tokens, cookies, localStorage, or sessionStorage introduced
- no real listmonk calls, real sending, AI generation, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work implemented
- no fetch calls added outside `frontend/lib/api.ts`

## Milestone 0.8D - Admin Visual Dashboard + Login Official Cleanup

Date: 2026-05-07
Branch: develop
Scope:
- restyle `/admin` as the primary Sendwise operational dashboard
- clean `/login` so it no longer presents as demo/mock
- preserve the current frontend architecture and temporary local-only access behavior

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

Implementation notes:
- Replaced the previous admin stub card layout with a structured dashboard made of a control header, KPI cards, recent campaigns, recent blocked sends, and a compact operational rail.
- Kept the page boundary intact by expanding only the typed admin summary fields needed for presentation: client status counts and recent campaigns.
- Preserved the existing `page -> component -> api.ts -> mock/backend -> types` flow and kept `frontend/components/dashboard/AdminDashboard.tsx` as a thin composition layer.
- Removed visible demo/mock wording and the role selector from `/login`.
- Preserved a single temporary local access route to `/admin` for controlled internal verification without introducing auth persistence or backend calls.

Tests:
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

Tests not executed and reason:
- Browser-based visual verification of `/login` and `/admin` could not be completed because the available Playwright browser tooling requires a Chrome runtime that is not installed in this environment.

Contract changes requested:
- None.

Risks:
- Backend mode still returns zero or empty admin aggregates for fields that do not yet have richer backend endpoints.
- Final manual browser QA is still recommended because automated screenshot verification was blocked by the missing local Chrome runtime.

Confirmation:
- no backend, DB, Docker config, env, or contract files changed
- no `/client` redesign was performed
- no Clerk integration, real auth, signup, password reset, token, cookie, localStorage, or sessionStorage was introduced
- no real listmonk calls, real sending, AI generation, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work implemented
- fetches remain centralized in `frontend/lib/api.ts`

## Milestone 0.8E - Client Visual Dashboard + Admin/Login Polish

Date: 2026-05-07
Branch: develop
Scope:
- refine `/client` into the official client-facing dashboard
- tighten `/admin` header, KPI density, and top summary surface
- simplify `/login` into the official reserved-access page
- increase the visual weight of the Sendwise wordmark across touched surfaces

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

Implementation notes:
- Replaced the admin breadcrumb-style header with a title-only top bar and safe placeholder actions.
- Reduced the admin hero surface to a compact summary and tightened KPI density to a two-column layout.
- Rebuilt `/client` using dedicated presentational components under `frontend/components/client/` while preserving the current frontend API boundary.
- Removed redundant and temporary explanatory UI from `/login` while preserving the existing local-only temporary route behavior.
- Increased the weight and size of the `Sendwise` wordmark without changing the logo system.

Tests:
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

Tests not executed and reason:
- Browser-based visual verification of `/admin`, `/client`, and `/login` was attempted against a local dev server, but Playwright could not attach because this environment does not have a Chrome runtime installed.

Contract changes requested:
- None.

Risks:
- Client limit values remain presentation-safe but can still display as unavailable until richer backend summary data exists.
- Final human QA is recommended to confirm hierarchy and spacing on `/admin`, `/client`, and `/login`.

Confirmation:
- no backend, DB, Docker config, env, or contract files changed
- no Clerk integration, real auth, signup, password reset, token, cookie, `localStorage`, or `sessionStorage` was introduced
- no real listmonk calls, real sending, AI generation, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work implemented
- fetches remain centralized in `frontend/lib/api.ts`

## Milestone 0.8F - Visual QA Polish for Admin / Client / Login

Date: 2026-05-07
Branch: develop
Scope:
- refine spacing, hierarchy, and compactness on `/admin`, `/client`, and `/login`
- preserve the current Sendwise UI system and frontend API boundary
- keep the milestone strictly frontend-only with no auth or backend work

Files created:
- `docs/branch_handoffs/frontend-visual-qa-0.8F-handoff.md`

Files modified:
- `docs/audit_log.md`
- `frontend/app/globals.css`
- `frontend/app/login/page.tsx`
- `frontend/components/admin/AdminTopBarActions.tsx`
- `frontend/components/dashboard/AdminDashboard.tsx`
- `frontend/components/dashboard/ClientDashboard.tsx`

Implementation notes:
- Tightened admin and client card density by moving both dashboards to a clearer two-column content rhythm with wider follow-up metric blocks.
- Reduced KPI stretch and improved card separation while preserving the existing palette, rounded surfaces, and Sendwise tone.
- Refined the admin topbar action buttons with lightweight line icons and more intentional disabled styling.
- Simplified the login card header copy and replaced the weak lower info row with a single reserved-access support block.
- Deliberately skipped extra illustration or animation work because the existing glow treatment was sufficient and cleaner.

Tests:
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
- Browser verification completed on `/admin`, `/client`, and `/login` against the existing local dev server at `http://localhost:3000` using the in-app browser viewport

Tests not executed and reason:
- Dedicated Playwright-browser verification on a separate Chrome runtime was not available because the local Playwright backend does not have Chrome installed in this environment.

Contract changes requested:
- None.

Risks:
- Final human visual QA on a wide desktop viewport is still recommended to confirm spacing and card rhythm at the exact acceptance resolution.

Confirmation:
- no backend, DB, Docker config, env, or contract files changed
- no Clerk integration, real auth, signup, password reset, token, cookie, `localStorage`, or `sessionStorage` was introduced
- no real listmonk calls, real sending, AI generation, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work implemented
- fetches remain centralized in `frontend/lib/api.ts`
