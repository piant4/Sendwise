# Audit Log

## Milestone 14.2 - Admin Create Campaign Flow

Date: 2026-05-14

Implemented:
- Audited the backend campaign creation contract before frontend changes: `POST /admin/campaigns` accepts `client_id`, `name`, and `subject`; `POST /admin/clients/{client_id}/campaigns` accepts `name` and `subject`; both require platform admin auth and return `AdminCampaignDetail`.
- Kept the admin `Nuova campagna` CTA enabled and routed to `/admin/campaigns/new`.
- Replaced the staged wizard UI with a minimal create form using only backend-required fields: client, campaign name, and subject.
- Added the `/admin/campaigns` API wrapper in `frontend/lib/api.ts` and kept all creation traffic behind the frontend API boundary.
- Kept the client campaign UI read-only; no client create campaign CTA was added.
- The success path redirects back to the campaign list and refreshes server data; submit is disabled while pending and backend errors are surfaced clearly.

Files touched:
- `frontend/components/admin/AdminCampaignCreateWizard.tsx`
- `frontend/lib/api.ts`
- `docs/audit_log.md`

Known limits:
- SES live validation remains pending.
- Creation only creates a draft/not-ready campaign; no send action, dispatch flow, provider claim, direct listmonk call, fake metric, backend schema change, or backend endpoint change was added.

## Milestone 15 - Admin Campaign Creation Wizard And Campaign Index Simplification

Date: 2026-05-14

Implemented:
- Added active `/admin/campaigns/new` admin campaign creation route.
- Added a compact three-step campaign wizard: client selection, campaign details, and summary.
- Wired campaign creation through the backend-backed `POST /admin/clients/{client_id}/campaigns` shortcut via `frontend/lib/api.ts`.
- Simplified `/admin/campaigns` into a scannable campaign index with campaign name, client, subject, status, readiness, recipients, backend metrics, updated date, and compact warning chips.
- Mapped known backend readiness/blocking reasons to product-friendly Italian labels and moved raw technical reason text into collapsed admin technical details.
- Removed the disabled "Nuova campagna" state and the unavailable-creation copy.
- Consolidated provider/event state so each campaign row renders one provider event label.

Files touched:
- `frontend/app/admin/campaigns/page.tsx`
- `frontend/app/admin/campaigns/new/page.tsx`
- `frontend/components/admin/AdminCampaignCreateWizard.tsx`
- `frontend/components/shared/campaignUi.ts`
- `frontend/lib/api.ts`
- `frontend/types/index.ts`
- `docs/audit_log.md`

Verified:
- `git diff --check` passed.
- `docker run --rm sendwise-frontend-builder npm run lint` passed.
- `docker compose build frontend` passed and completed Next.js production build/type check.
- Scanned touched frontend files for direct listmonk calls and fake delivered/open/click-rate claims; no new direct listmonk calls or fake delivery claims found.
- `bash scripts/audit.sh` passed via Git Bash login shell.
- `bash scripts/smoke_test.sh` passed via Git Bash login shell.
- `docker compose config` passed.

Known limits:
- SES live validation remains pending.
- Sending remains disabled and no send/dispatch behavior was changed.
- No database schema changes were made.
- No backend code changes were made.
- Admin create wizard uses only backend-supported fields: client, name, and subject.

## Milestone 14.1 - Campaign UI Repair And Create Campaign CTA

Date: 2026-05-14
Branch: develop

Implemented state:
- Repaired the admin and client campaign overview after screenshot review so campaigns render as product cards with clearer hierarchy for status, readiness, recipients, runtime safety, provider events, honest log counts, warnings, and compact blocked-recipient reasons.
- Added the admin `Nuova campagna` CTA in the campaign page header. The CTA is disabled with the visible copy `Creazione campagna non ancora disponibile` because no existing frontend creation route/page is present in the current admin app.
- Hid raw campaign/client IDs from the main admin overview and moved them into a native collapsed technical details section. The client campaign UI does not show raw IDs.
- Removed duplicate/redundant provider/readiness presentation from the campaign overview and kept queued/sent-attempted/bounced/unsubscribed/blocked counts backend-backed only.

Files touched:
- `frontend/app/admin/campaigns/page.tsx`
- `frontend/app/c/[portalSlug]/campaigns/page.tsx`
- `frontend/components/shared/campaignUi.ts`
- `docs/audit_log.md`

Known limits:
- SES live validation 12.1 remains pending; the UI does not claim SES delivery validation.
- Campaign creation backend endpoints exist in the contract/backend, but no admin frontend creation route/page was present in this repair scope.

Scope confirmation:
- No backend dispatch logic, backend services, database schema, direct frontend listmonk access, send action, fake metric, local env file, or secret was changed.

Checks run:
- `git diff --check` passed.
- Touched frontend file scan found no direct listmonk calls.
- Touched frontend file scan found no fake delivered/open-rate/click-rate claims; `opened`/`clicked` remain only as zero-value provider-event presence checks in the shared helper.
- Docker frontend builder `npm run lint` passed with the current touched frontend files and current API/type/mock boundary mounted into the builder image.
- Docker frontend builder `npm run build` passed with the current touched frontend files and current API/type/mock boundary mounted into the builder image.
- `bash scripts/audit.sh` passed through Git Bash login shell.
- `bash scripts/smoke_test.sh` passed through Git Bash login shell.
- `docker compose config` passed; Docker printed local config access warnings for `C:\Users\Jacop\.docker\config.json`.

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

## Milestone 0.9E.3 - Docker Clerk Runtime Alignment

Date: 2026-05-08
Branch: develop
Scope: Docker/env alignment for the Clerk-auth frontend and backend runtime so Compose serves the current custom Clerk login instead of stale mock frontend artifacts.
Files created:
- `frontend/.dockerignore`
- `docs/branch_handoffs/docker-clerk-runtime-alignment-0.9E.3-handoff.md`
Files modified:
- `docker-compose.yml`
- `frontend/Dockerfile`
- `frontend/lib/api.ts`
- `.env.example`
- `docs/audit_log.md`
Root cause:
- The frontend container was built and started as a host-style dev runtime: `frontend/Dockerfile` ran `next dev` and copied the entire frontend context, which allowed host `.next` artifacts and `frontend/.env.local` to bleed into Docker.
- Compose also defaulted `NEXT_PUBLIC_USE_MOCK_API=true` and did not pass the Clerk/backend env contract into the containers or frontend build.
- The first verified divergence was therefore Docker/runtime configuration, not current frontend source. Current source no longer routes `/login` through `MockLoginForm`, but the copied host `.next` tree still contained the old mock login bundle.
Tests executed:
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
Verification summary:
- Frontend Docker context dropped from about `1.35GB` to about `15.82kB` on the no-cache rebuild after adding `frontend/.dockerignore` and explicit production build stages.
- Frontend logs now show `Next.js 16.2.4` with `next start`/standalone behavior and no `.env.local` loading inside the container.
- Host `/login` now renders the current custom Clerk login with `Sendwise`, `Accesso riservato`, and `Accedi`, while the old mock strings are absent from rendered HTML.
- Backend `/health` returns `200`.
- Backend `/auth/me` without auth returns `401`.
- Backend `/auth/me` with an invalid bearer token now returns `401` instead of backend-misconfigured `500`.
- Signed-out `/admin`, `/client`, and `/auth/redirect` redirect to `/login`.
Tests not executed and reason:
- Live signed-in `/auth/redirect` routing to `/admin` or `/client` was not executed because real mapped Clerk users and verified `AUTH_USER_MAPPINGS_JSON` identities were not available in tracked repo config.
- Positive-path Clerk login against backend-owned mapped users remains dependent on local secret `.env` content that stays ignored.
Residual risks:
- `MockLoginForm` and its strings still exist as dormant mock-support code in `frontend/components/auth/MockLoginForm.tsx`; it is no longer rendered by Docker, but the fallback code remains in the repo by design.
- Real admin/client post-login routing still depends on supplying valid local `AUTH_USER_MAPPINGS_JSON` values for actual Clerk user ids.
Confirmation:
- no DB migration implemented
- no `client_access` persistence implemented
- no Clerk invitation API implemented
- no admin invite flow implemented
- no onboarding endpoint implemented
- no public signup implemented
- no custom password form implemented
- no custom 2FA implemented
- no real listmonk sending implemented
- no real email sending implemented
- no AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase implemented
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

## Milestone 0.9C.2 - Custom Clerk Login UI

Date: 2026-05-07
Branch: develop
Milestone: Milestone 0.9C.2 - Custom Clerk Login UI
Scope: Replace the prebuilt Clerk login surface on `/login` with a Sendwise-owned custom email/password form while preserving Clerk as the auth engine, the existing `/login/[[...login]]` route, and protected account/admin/client routes.
Files created:
- `docs/branch_handoffs/clerk-custom-login-0.9C.2-handoff.md`
Files modified:
- `frontend/app/login/LoginContent.tsx`
- `frontend/app/globals.css`
- `docs/audit_log.md`
Root cause:
- `frontend/app/login/LoginContent.tsx` rendered Clerk's prebuilt `<SignIn />` component directly.
- That delegated visible auth UI to Clerk, which is incompatible with the Sendwise product requirement to keep signup, social login, Clerk branding, and default Clerk card chrome off the `/login` surface.
Implementation result:
- Replaced the prebuilt Clerk login component with a custom Sendwise form driven by Clerk `useSignIn()`.
- Kept Italian-only copy, removed Sendwise-owned signup exposure, and redirected successful sign-in to `/admin`.
- Preserved `/login/[[...login]]`, `/account` via Clerk `UserProfile`, and existing protected-route structure.
Tests executed:
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build`
- `PYTHONPATH=backend python3 -m pytest backend/tests`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`
- `grep -R -n "from .*mock-api" frontend/app frontend/components || true`
- `grep -R -n "fetch(" frontend/app frontend/components frontend/lib || true`
- `grep -R -n "listmonk\|postgres\|database\|smtp" frontend/app frontend/components frontend/lib || true`
- `grep -R -n "localStorage\|sessionStorage\|document.cookie" frontend/app frontend/components frontend/lib || true`
- `grep -R -n "SignUpButton" frontend/app frontend/components frontend/lib || true`
- `grep -R -n "sign-up" frontend/app frontend/components frontend/lib || true`
- `grep -R -n "signup" frontend/app frontend/components frontend/lib || true`
- `grep -R -n "Continue with Google\|Google" frontend/app frontend/components frontend/lib || true`
Tests not executed and reason:
- Live browser verification of `/login`, authenticated sign-in with a real Clerk user, signed-out redirect checks, and `/account` interaction were not completed in this turn.
- The local browser verification path was blocked by in-app browser security/runtime limits, and no authorized test credentials were provided for a real Clerk session.
Residual risks:
- Live Clerk password-auth behavior still depends on Clerk Dashboard configuration for password sign-in, public signup disablement, and social-login disablement.
- The custom form currently surfaces a controlled message if the Clerk project does not support password auth or requires extra factors not yet exposed in Sendwise UI.
- Existing unrelated workspace change `frontend/.gitignore` remains outside this milestone.
Confirmation:
- no backend auth logic changed
- no DB migration or `client_users` persistence implemented
- no admin-created user flow implemented
- no public signup, social login UI, custom password storage, or custom password reset/change form implemented
- no real listmonk, real sending, AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase implemented
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

## Milestone 0.8F.1 - Dashboard KPI Card Grid Fix

Date: 2026-05-07
Branch: develop
Scope:
- fix the remaining KPI/stat card layout issue on `/admin` and `/client`
- preserve the existing dashboard visual style and frontend-only architecture
- keep the change limited to the smallest layout root cause

Files created:
- `docs/branch_handoffs/dashboard-kpi-grid-fix-0.8F.1-handoff.md`

Files modified:
- `frontend/app/globals.css`
- `docs/audit_log.md`

Implementation notes:
- Identified the actual layout bug in the shared KPI wrapper CSS: both KPI wrappers declared column tracks but were missing `display: grid`.
- Added grid display to the admin and client KPI wrappers so the existing two-column rules now apply as intended on desktop and tablet widths.
- Reduced KPI card minimum height and padding slightly to remove excess vertical bulk while preserving the current palette, rounded corners, borders, and typography.
- Left page logic, data boundaries, dashboard sections, and backend behavior untouched.

Admin result:
- KPI cards now render two per row on desktop-width layout instead of stacking one per row.

Client result:
- KPI cards now render two per row on desktop-width layout instead of stacking one per row.

Verification:
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
- Visual verification completed in the in-app browser on `/admin` and `/client` against the existing local dev server at `http://localhost:3000`

Tests not executed and reason:
- No separate live narrow-viewport browser pass was run; mobile behavior remains covered by the unchanged single-column media query.

Contract changes requested:
- None.

Risks:
- Final human QA on the intended acceptance viewport is still recommended to validate the preferred compactness and spacing feel.

Confirmation:
- no backend, DB, Docker config, env, or contract files changed
- no Clerk integration, real auth, signup, password reset, token, cookie, `localStorage`, or `sessionStorage` was introduced
- no real listmonk calls, real sending, AI generation, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work implemented
- fetches remain centralized in `frontend/lib/api.ts`

## Milestone 0.9A - Clerk Auth Contract + Backend Integration Plan

Date: 2026-05-07
Branch: develop
Scope:
- docs-only auth contract and implementation planning for Clerk with the existing Next.js frontend and FastAPI backend
- define the future identity, route protection, backend verification, user mapping, secret-storage, and rollout phases without changing runtime code
- keep the current Sendwise architecture and boundary rules intact

Files created:
- `docs/auth_contract_v1.md`
- `docs/branch_handoffs/auth-contract-0.9A-handoff.md`

Files modified:
- `docs/architecture_v1.md`
- `docs/data_model_v1.md`
- `docs/audit_checklist_v1.md`
- `docs/audit_log.md`

Planning notes:
- Clerk is defined as the identity and session provider, while FastAPI remains the authorization gatekeeper and Business PostgreSQL remains the business source of truth.
- Public signup stays disabled; admin-created or invited users only.
- Passwords, password hashes, reset tokens, and session secrets remain forbidden in Sendwise Business PostgreSQL.
- `client_users` is now documented as the planned Clerk-to-business mapping table, and `client_secrets` is documented as a future encrypted table only if per-client provider credentials are needed later.
- The rollout is staged into 0.9B through 0.9F so the frontend can connect earlier without prematurely changing backend, DB, Docker, or secret handling.

Tests executed:
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`

Tests not executed and reason:
- No frontend build or lint was run because this milestone changed docs only and did not modify frontend runtime code.
- No backend pytest was run because this milestone changed docs only and did not modify backend runtime code or tests.

Risks remaining:
- Clerk role names, `client_users` persistence, and backend token verification remain planned only and are not yet implemented in the runtime.
- Current stub frontend and backend auth behavior still uses pre-contract placeholder flows and will need explicit alignment in Milestones 0.9B through 0.9E.
- Platform-admin scoping, Clerk Organizations usage, and final invitation flow remain implementation decisions with recommended defaults but not final code.

Confirmation:
- no frontend runtime code changed
- no backend runtime code changed
- no DB migration or schema implementation changed
- no Docker config changed
- no Clerk install or real auth implementation added
- no signup, password implementation, token or cookie storage, listmonk execution, real sending, AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work implemented

## Milestone 0.9B - Clerk Auth Vertical Slice

Date: 2026-05-07
Branch: develop
Scope:
- implement the first Clerk authentication vertical slice across the Next.js frontend and FastAPI backend
- protect `/admin`, `/client`, and `/account`
- attach Clerk session tokens to frontend backend-mode API requests
- verify Clerk JWTs in FastAPI and derive a backend-owned authenticated user context
- keep public signup disabled in the Sendwise UI

Files created:
- `backend/app/core/auth.py`
- `backend/app/repositories/auth_users.py`
- `backend/tests/test_clerk_auth.py`
- `frontend/app/account/[[...account]]/page.tsx`
- `frontend/components/shared/AccountUserButton.tsx`
- `frontend/proxy.ts`
- `docs/branch_handoffs/clerk-auth-vertical-slice-0.9B-handoff.md`

Files removed:
- `backend/tests/test_milestone_05_stubs.py`

Files modified:
- `backend/app/api/admin.py`
- `backend/app/api/campaigns.py`
- `backend/app/api/client.py`
- `backend/app/core/config.py`
- `backend/app/core/security.py`
- `backend/app/schemas/blocked_sends.py`
- `backend/app/schemas/campaigns.py`
- `backend/requirements.txt`
- `.env.example`
- `frontend/app/layout.tsx`
- `frontend/app/login/page.tsx`
- `frontend/components/layout/AppShell.tsx`
- `frontend/components/layout/Sidebar.tsx`
- `frontend/lib/api.ts`
- `frontend/package.json`
- `frontend/package-lock.json`
- `docs/audit_log.md`

Implementation notes:
- Added `@clerk/nextjs` to the frontend and wrapped the root layout with `ClerkProvider`.
- Replaced the local fake login submit flow with Clerk `SignIn` and disabled sign-up UI on the Sendwise login page.
- Added Clerk `clerkMiddleware()` in `frontend/proxy.ts` and explicitly protected `/admin`, `/client`, and `/account`.
- Added `/account` with Clerk `UserProfile` and integrated a Clerk `UserButton` into the topbar while removing the fake local user identity card.
- Kept `fetch(` centralized in `frontend/lib/api.ts` and attached Clerk session tokens with server-side `auth().getToken()` in backend mode.
- Replaced the placeholder API-key gate on admin and client dashboard endpoints with Clerk JWT verification plus backend-owned role and status enforcement.
- Used a temporary backend-only `AUTH_USER_MAPPINGS_JSON` repository for Clerk user to Sendwise role and `client_id` mapping. This is fail-closed and explicitly temporary until `client_users` persistence lands in `0.9D`.

Verification:
- `cd frontend && npm run lint` passed
- `cd frontend && npm run build` passed
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build` passed
- `bash scripts/audit.sh` passed
- `bash scripts/smoke_test.sh` passed
- `docker compose config` passed
- `git diff --check` passed
- `PYTHONPATH=backend python3 -m pytest backend/tests` passed
- `grep -R "from .*mock-api" frontend/app frontend/components || true` returned no matches
- `grep -R "fetch(" frontend/app frontend/components frontend/lib || true` confirmed the only `fetch(` remains in `frontend/lib/api.ts`
- `grep -R "listmonk\\|postgres\\|database\\|smtp" frontend/app frontend/components frontend/lib || true` returned no matches
- `grep -R "localStorage\\|sessionStorage\\|document.cookie" frontend/app frontend/components frontend/lib || true` returned no matches
- `grep -R "SignUpButton\\|sign-up\\|signup" frontend/app frontend/components frontend/lib || true` returned no matches

Tests not executed and reason:
- No live Clerk browser sign-in was executed because real Clerk instance credentials and manual restricted-signup configuration were not provided in this turn.
- No authenticated browser or curl verification was executed against a real backend because no live Clerk user ids were mapped for local runtime use.

Contract changes requested:
- None.

Risks:
- The backend mapping is temporary env-backed state rather than `client_users` persistence.
- Frontend middleware enforces authentication but not role-specific route UX yet; backend role enforcement remains authoritative.
- `frontend/app/login/page.tsx` does not use a catch-all Clerk sign-in route, so more complex nested Clerk path flows should be validated live with real credentials.

Confirmation:
- no DB secrets, passwords, password hashes, reset tokens, or session secrets were committed or stored
- no public signup UI or route was added
- no frontend-trusted role or `client_id` was introduced
- no real listmonk calls, real sending, AI generation, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work was implemented

## Milestone 0.9B.1 - Clerk Login Catch-All Route Fix

Date: 2026-05-07
Branch: develop
Scope:
- fix the known Clerk login route limitation by replacing the single `/login` page route with an optional catch-all App Router route
- preserve the existing Sendwise login visual design
- keep login and nested Clerk login paths public without changing the auth architecture

Files created:
- `frontend/app/login/LoginContent.tsx`
- `frontend/app/login/[[...login]]/page.tsx`
- `docs/branch_handoffs/clerk-login-catchall-0.9B.1-handoff.md`

Files modified:
- `frontend/proxy.ts`
- `docs/audit_log.md`

Files removed:
- `frontend/app/login/page.tsx`

Verified behavior:
- Confirmed the root cause at the frontend route layer: the repo previously rendered Clerk `SignIn` only from `frontend/app/login/page.tsx`, so nested Clerk path flows under `/login/*` had no matching optional catch-all route.
- Preserved the existing login UI by moving the current Sendwise login JSX and Clerk appearance config into `frontend/app/login/LoginContent.tsx`.
- Mounted login through `frontend/app/login/[[...login]]/page.tsx` and preserved the existing signed-in redirect to `/admin`.
- Kept `withSignUp={false}` in the Clerk `SignIn` component.
- Made `frontend/proxy.ts` explicitly treat `/login` and `/login(.*)` as public while preserving existing protected matchers for `/admin(.*)`, `/client(.*)`, and `/account(.*)`.
- Verified through both frontend builds that Next now emits the route `ƒ /login/[[...login]]`.
- Verified boundary checks still pass:
- no direct `mock-api` imports from app or components
- the only frontend `fetch(` remains in `frontend/lib/api.ts`
- no `listmonk`, `postgres`, `database`, or `smtp` references in frontend app/components/lib
- no `localStorage`, `sessionStorage`, or `document.cookie`
- no `SignUpButton`, `/sign-up`, or `signup` exposure in frontend app/components/lib

Tests executed:
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`
- `PYTHONPATH=backend python3 -m pytest backend/tests`
- `grep -R "from .*mock-api" frontend/app frontend/components || true`
- `grep -R "fetch(" frontend/app frontend/components frontend/lib || true`
- `grep -R "listmonk\|postgres\|database\|smtp" frontend/app frontend/components frontend/lib || true`
- `grep -R "localStorage\|sessionStorage\|document.cookie" frontend/app frontend/components frontend/lib || true`
- `grep -R "SignUpButton\|sign-up\|signup" frontend/app frontend/components frontend/lib || true`

Tests not executed and reason:
- No live Clerk sign-in flow was executed because real Clerk environment values and authorized test credentials were not provided.
- No live browser or HTTP verification was run against a started local Next server for `/login/*`; route compatibility was verified at build level through the emitted App Router route tree.

Risks remaining:
- Live Clerk nested route behavior still depends on valid runtime Clerk configuration and credentials.
- Public signup must still remain disabled or restricted in the Clerk Dashboard; this fix does not override Clerk instance policy.
- The workspace still contains unrelated pre-existing dirty changes outside this milestone.

Confirmation:
- no backend, DB, Docker config, signup, custom password form, user CRUD, real listmonk, real sending, AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work was implemented

## Milestone 0.9C - Clerk Auth Runtime Verification

Date: 2026-05-07
Branch: develop
Scope:
- verify the existing Clerk auth vertical slice from `0.9B` against the current local runtime
- confirm env and secret handling
- run required regression and boundary checks
- apply no code changes unless a confirmed minimal runtime bug fits the allowed scope

Verified state:
- `git status --short` was clean.
- `git diff --cached --name-only || true` returned no staged files.
- `git diff -- .env .env.local frontend/.env.local backend/.env.local || true` returned no tracked secret diff.
- No local `.env` or `.env.local` files were present in the repo during verification.
- Required Clerk env vars were not present in the current shell environment.
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed.
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build` passed.
- `PYTHONPATH=backend python3 -m pytest backend/tests` passed with `11` tests.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --check` passed.
- Boundary checks passed:
- the only frontend `fetch(` remains in `frontend/lib/api.ts`
- no direct frontend `mock-api` imports from `frontend/app` or `frontend/components`
- no frontend references to `listmonk`, `postgres`, `database`, or `smtp`
- no frontend `localStorage`, `sessionStorage`, or `document.cookie`
- no Sendwise `SignUpButton`, `/sign-up`, or `signup` exposure
- Build output still includes `ƒ /login/[[...login]]`, confirming nested Clerk login paths do not fail at the Next route level.
- Live backend negative-path checks:
- `GET /health` returned `200`
- `GET /admin/clients` without auth returned `401`
- `GET /admin/clients` with invalid bearer token and missing Clerk backend config returned `500` with `Clerk auth is not fully configured on the backend.`

First divergence found:
- Live frontend requests to `/login`, `/admin`, and `/account` returned generic `500 Internal Server Error` responses when Clerk frontend env was absent.

Root cause:
- Category: frontend rendering
- Primary cause: `ClerkProvider` throws before page render when `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is missing.
- Evidence: Next server log reported `@clerk/nextjs: Missing publishableKey.`
- Minimal fix boundary: `frontend/app/layout.tsx`

Fix status:
- No app fix applied.
- Reason: the confirmed minimal fix boundary is outside the allowed modification scope for this milestone.

Known limits:
- Real Clerk runtime verification was blocked because no real local Clerk env values were present.
- Real Clerk Dashboard policy could not be confirmed from the workspace.
- Real mapped Clerk test users were not available for live admin/client authorization checks.
- Playwright browser verification was unavailable because the required local browser engine was not installed.

Contract changes requested:
- None.

Risks:
- Frontend missing-env behavior is not user-facing clear yet; the browser only receives a generic `500`.
- End-to-end frontend-to-backend token transport with a real Clerk session remains unverified.
- `AUTH_USER_MAPPINGS_JSON` remains temporary runtime mapping rather than `client_users` persistence.

Confirmation:
- no DB migration, `client_users` persistence, admin-created user flow, public signup, custom password form, real listmonk, real sending, AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work was implemented

## Milestone 0.9D-Prep - One Admin + One Client Account Contract

Date: 2026-05-07
Branch: develop
Scope:
- docs-only contract update for the V1 auth, data-model, API, architecture pointer, audit checklist, audit log, and branch handoff files
- simplify V1 from multi-user client roles to one backend-controlled platform admin plus one Clerk-backed client account per client
- define onboarding contract for Clerk password setup, required `personal_name`, and optional `company_name`

Verified state:
- `docs/auth_contract_v1.md` now defines one platform admin account, one client account per client, backend-resolved `client_id`, no role selection, no team or sub-user model, and Clerk-owned password management.
- `docs/data_model_v1.md` now replaces planned `client_users` with planned `client_access` and documents the `clients` plus `client_access` split.
- `docs/api_contracts_v1.md` now defines admin client-access endpoints, a client onboarding completion endpoint, and removes role or user-type contract language from V1 access flows.
- `docs/audit_checklist_v1.md` now includes explicit checks for no role selector, no admin/client selector, no multi-user client UI, backend-controlled platform admin, backend-derived `client_id`, one active access per client, no public signup route, and no `SignUpButton`.
- `docs/architecture_v1.md` now points to `client_access` mappings and clarifies that the platform admin is backend-controlled rather than a client account.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --check` passed.

Known limits:
- This milestone updates contracts only; no runtime auth behavior, Clerk API calls, database schema, invitation flow, or onboarding flow was implemented.
- The workspace contains a pre-existing untracked file: `docs/branch_handoffs/clerk-custom-login-0.9C.2-handoff.md`. It was not modified by this task.

Contract changes requested:
- define V1 as one platform admin plus one Clerk-backed client account per client
- remove V1 `client_users`, role selection, user-type selection, and team or sub-user assumptions
- define client onboarding profile fields as required `personal_name` plus optional `company_name`
- define future invite-access and onboarding-complete API contracts with backend-owned client scope

Residual risks:
- Existing runtime code and placeholder auth behavior still predate this simplified contract and will need a later implementation milestone to align code with docs.
- The exact future persistence constraints for `email` uniqueness among active or invited access rows will need implementation-level enforcement details when schema work is approved.

Confirmation:
- no frontend runtime code implemented
- no backend runtime code implemented
- no DB migration implemented
- no Clerk API call implemented
- no client access implementation implemented
- no onboarding implementation implemented
- no public signup implemented
- no custom password form implemented
- no custom 2FA implemented
- no real listmonk implemented
- no real sending implemented
- no AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase implemented

## Milestone 0.9E — Runtime Auth Model Alignment

Date: 2026-05-07
Branch: develop
Scope:
- align backend runtime auth from legacy role hierarchy to the V1 one-admin plus one-client access model
- replace temporary auth mapping expectations with object-shaped Clerk-user keyed access mappings
- keep protected admin, client, and campaign endpoints fail-closed without adding DB persistence, Clerk invitations, or UI redesign

Verified state:
- `backend/app/core/auth.py` now trusts `platform_admin` and `client` access kinds only, with `require_active_user`, `require_platform_admin`, and `require_client_scope` enforcing the simplified runtime contract.
- `backend/app/repositories/auth_users.py` now validates object-shaped `AUTH_USER_MAPPINGS_JSON`, rejects non-empty legacy list mappings, rejects unknown access types, rejects client access without `client_id`, and rejects platform admin access with a trusted `client_id`.
- `backend/app/api/admin.py` now depends on `require_platform_admin`.
- `backend/app/api/campaigns.py` now depends on `require_active_user`.
- `backend/tests/test_clerk_auth.py` now verifies public health, missing token `401`, invalid token `401`, active platform admin access, active client access, client-to-admin `403`, admin-to-client `403`, non-active status `403`, invalid mapping `500`, unknown access type `500`, and legacy role mapping `500`.
- `.env.example` now documents the temporary object-shaped auth mapping placeholder with `access_type` values `platform_admin` and `client`.
- `PYTHONPATH=backend python3 -m pytest backend/tests` passed.
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed.
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --check` passed.

Known limits:
- Clerk frontend login redirects still contain hard `/admin` assumptions in `frontend/app/layout.tsx` and `frontend/app/login/[[...login]]/page.tsx`, but those files were outside the allowed edit scope for this milestone.
- `frontend/components/auth/MockLoginForm.tsx` still contains a dev-only admin/client selector outside this milestone scope and appears unused by the current Clerk login route.
- Runtime auth mapping remains backend env configuration rather than persisted `client_access` state.
- The worktree contains an unrelated `frontend/app/globals.css` modification outside this milestone scope.

Contract changes requested:
- None.

Confirmation:
- no DB migration implemented
- no `client_access` persistence implemented
- no Clerk invitation API implemented
- no admin invite flow implemented
- no onboarding endpoint implemented
- no public signup implemented
- no custom password form implemented
- no custom 2FA implemented
- no real listmonk implemented
- no real sending implemented
- no AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase implemented

## Milestone 0.9C.3 — Custom Clerk Login Verification Steps

Date: 2026-05-07
Branch: develop
Scope:
- extend the Sendwise custom Clerk login UI to continue through Clerk intermediate verification states
- keep the custom `/login` surface Italian-only and Sendwise-owned
- preserve no-signup, no-social, and no-backend-change boundaries

Flow audited:
- Expected contract:
- `/login` remains custom Next.js UI
- Clerk identifies users and drives sign-in state transitions
- intermediate first-factor and second-factor states should continue inside the custom UI instead of dropping to Clerk prebuilt UI or blocking generically
- backend auth logic stays unchanged
- Observed behavior before fix:
- the old custom form only completed on `signIn.status === "complete"`
- `needs_first_factor` and `needs_second_factor` were mapped to generic blocking errors
- First divergence point:
- frontend login flow control in `frontend/app/login/LoginContent.tsx`
- Evidence:
- the old code returned a terminal generic message for `needs_second_factor`
- the old code returned a terminal generic message for `needs_first_factor`
- the installed Clerk SDK proxy in this repo exposes supported factor metadata and custom-flow methods that can continue the sign-in inside Sendwise UI

Root cause:
- Symptom:
- users with Clerk accounts that require additional verification could not complete sign-in from the custom Sendwise page
- Primary root cause:
- frontend rendering and flow handling treated Clerk intermediate states as final errors
- Category:
- frontend rendering
- Minimal fix boundary:
- `frontend/app/login/LoginContent.tsx`

Verified state:
- `frontend/app/login/LoginContent.tsx` now uses a Sendwise-owned multi-step flow built on Clerk custom-flow methods.
- Password-first sign-in continues through `signIn.create(...)` plus `signIn.password(...)` when password is a supported first factor.
- First-factor continuation now supports `email_code` and `phone_code`.
- Second-factor continuation now supports `totp`, `phone_code`, `email_code`, and `backup_code`.
- Code-based factors support controlled resend flows through the available Clerk send-code APIs.
- Successful completion activates the Clerk session through `clerk.setActive({ session: createdSessionId })`.
- Controlled Italian error messages now cover invalid credentials, invalid codes, expired codes, unsupported factor shapes, throttling, and temporary auth unavailability.
- Live browser verification on `http://localhost:3000/login` confirmed:
- the page loads
- the custom Sendwise UI renders
- invalid credentials show `Email o password non validi.`
- no signup or social UI is visible
- no hydration warning was observed in browser logs; only the expected Clerk development-keys warning appeared

Checks executed:
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build`
- `PYTHONPATH=backend python3 -m pytest backend/tests`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`
- boundary grep checks for mock API imports, direct fetches, listmonk/DB/SMTP references, storage/cookie writes, signup strings, and Google/social strings
- in-app browser verification of `/login`

Known limits:
- A live additional-verification success path was not completed in this turn because no authorized QA credentials or TOTP or backup codes were available in the workspace.
- The frontend redirect target after successful auth remains hard-coded to `/admin` in existing route behavior outside this milestone's allowed redirect follow-up.
- Unsupported future Clerk factor combinations still fail closed with support guidance instead of prebuilt Clerk UI.
- The worktree contains an unrelated pre-existing modification in `frontend/app/globals.css` outside this milestone scope.

Contract changes requested:
- None.

Confirmation:
- no backend auth logic changed
- no DB migration implemented
- no `client_access` persistence implemented
- no admin-created invitation flow implemented
- no public signup implemented
- no social login implemented
- no custom password storage implemented
- no custom password reset or change implemented
- no real listmonk or real sending implemented
- no AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase implemented

## Milestone 0.9E.1 — Clerk Redirect Alignment

Date: 2026-05-07
Branch: develop
Scope:
- align post-login Clerk routing to backend-resolved access type
- keep `AUTH_USER_MAPPINGS_JSON` as the temporary backend mapping source
- avoid DB persistence, invitations, onboarding, and UI redesign

Flow audited:
- Expected contract:
- Clerk identifies the user
- FastAPI resolves trusted access type and trusted `client_id`
- the frontend redirects to `/admin` for `platform_admin` and `/client` for `client` only after backend resolution
- Observed behavior before fix:
- `frontend/app/login/LoginContent.tsx` hard-coded the success redirect target to `/admin`
- `frontend/app/login/[[...login]]/page.tsx` redirected every authenticated user to `/admin`
- `frontend/app/layout.tsx` still contains `signInFallbackRedirectUrl="/admin"` and `signInForceRedirectUrl="/admin"`
- backend runtime auth had no minimal `/auth/me` endpoint for frontend redirect resolution
- First divergence point:
- frontend post-login routing in `frontend/app/login/LoginContent.tsx` and `frontend/app/login/[[...login]]/page.tsx`
- Evidence:
- the custom Clerk login flow completed by calling `router.replace("/admin")`
- authenticated visits to `/login` were immediately redirected to `/admin`
- no backend-owned auth-context endpoint existed for the frontend to ask which dashboard route to use

Root cause:
- Symptom:
- active client logins could be sent to `/admin` after successful Clerk authentication
- Primary root cause:
- frontend redirect handling was hard-coded to an admin route before any backend-owned access resolution step
- Category:
- frontend API client
- Minimal fix boundary:
- `frontend/app/login/LoginContent.tsx`
- `frontend/app/login/[[...login]]/page.tsx`
- `frontend/app/auth/redirect/page.tsx`
- `frontend/lib/api.ts`
- `backend/app/api/`
- `backend/app/schemas/`
- `backend/tests/test_clerk_auth.py`

Verified state:
- `backend/app/api/auth.py` now exposes `GET /auth/me` for active authenticated users and returns `access_type`, backend-owned `client_id`, `email`, and `status`.
- `backend/app/schemas/auth.py` defines the minimal `GET /auth/me` response shape.
- `frontend/lib/api.ts` now exposes a backend-only post-login redirect helper that calls `/auth/me` and maps `platform_admin` to `/admin` and `client` to `/client`.
- `frontend/app/auth/redirect/page.tsx` now resolves the redirect server-side through the backend and fails closed with a small error state if auth resolution is unavailable.
- `frontend/app/login/LoginContent.tsx` now routes successful Clerk session activation to `/auth/redirect` instead of `/admin`.
- `frontend/app/login/[[...login]]/page.tsx` now routes already-authenticated users to `/auth/redirect` instead of `/admin`.
- `frontend/proxy.ts` required no change; it still protects `/admin`, `/client`, and `/account` by authentication only.
- `backend/tests/test_clerk_auth.py` now verifies `GET /auth/me` for both active `platform_admin` and active `client` mappings.

Checks executed:
- `PYTHONPATH=backend python3 -m pytest backend/tests`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`

Known limits:
- `frontend/app/layout.tsx` still contains hard-coded Clerk fallback and force redirect props pointing to `/admin`. The current custom login flow no longer depends on them, but any future Clerk-managed redirect path would still need follow-up.
- post-login routing now fails closed if `NEXT_PUBLIC_USE_MOCK_API=true`, because backend resolution is required for this flow.
- backend auth mapping remains the temporary `AUTH_USER_MAPPINGS_JSON` env configuration rather than persisted `client_access` state.

Confirmation:
- no DB migration implemented
- no `client_access` persistence implemented
- no Clerk invitation API implemented
- no admin invite flow implemented
- no onboarding completion endpoint implemented
- no public signup implemented
- no custom password form implemented
- no custom 2FA implemented
- no real listmonk integration implemented
- no real sending implemented
- no AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase implemented

## Milestone 0.9E.1b — Remove Residual Clerk Admin Redirects

Date: 2026-05-07
Branch: develop
Scope:
- remove the remaining Clerk provider post-login `/admin` fallback from the shared frontend layout
- preserve `/auth/redirect` as the only post-login route chooser
- avoid backend, DB, invitation, onboarding, and UI changes

Flow audited:
- Expected contract:
- Clerk identifies the user
- `/auth/redirect` owns the post-login destination decision
- the frontend never decides trusted `access_type` or `client_id`
- Observed behavior before fix:
- `frontend/app/layout.tsx` still configured `signInFallbackRedirectUrl="/admin"` and `signInForceRedirectUrl="/admin"`
- that configuration could bypass `/auth/redirect` on Clerk-managed redirect paths
- First divergence point:
- shared Clerk provider configuration in `frontend/app/layout.tsx`
- Evidence:
- the live layout file still pointed both Clerk sign-in redirect props at `/admin`

Root cause:
- Symptom:
- future Clerk-managed sign-in redirects could still send client users to `/admin`
- Primary root cause:
- stale Clerk provider redirect configuration remained after the earlier `/auth/redirect` rollout
- Category:
- frontend rendering
- Minimal fix boundary:
- `frontend/app/layout.tsx`

Verified state:
- `frontend/app/layout.tsx` now points `signInFallbackRedirectUrl` and `signInForceRedirectUrl` to `/auth/redirect`.
- `afterSignOutUrl="/login"` remains unchanged.
- `frontend/proxy.ts` required no change and still protects `/admin`, `/client`, and `/account` by authentication only.
- Redirect grep returned no remaining forbidden post-login `/admin` fallback matches.
- Broad `/admin` grep still returns only:
- `frontend/components/layout/AppShell.tsx` and `frontend/components/layout/MainNav.tsx` admin navigation references
- `frontend/lib/api.ts` backend-owned `ADMIN_ROUTE` target used only after `/auth/me`
- `frontend/components/auth/MockLoginForm.tsx` dev-only mock role redirect logic outside the live Clerk flow and outside this task's allowed scope

Checks executed:
- `PYTHONPATH=backend python3 -m pytest backend/tests`
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
- `grep -R "SignUpButton\|sign-up\|signup" frontend/app frontend/components frontend/lib || true`
- `grep -R "afterSignInUrl.*admin\|forceRedirectUrl.*admin\|fallbackRedirectUrl.*admin\|router.push('/admin')\|router.replace('/admin')" frontend/app frontend/components frontend/lib || true`
- `grep -R '"/admin"' frontend/app frontend/components frontend/lib || true`

Known limits:
- Live Clerk runtime verification was not executed because no real mapped Clerk credentials were available in the workspace.
- `frontend/components/auth/MockLoginForm.tsx` still contains a dev-only admin or client mock redirect outside the live Clerk flow and outside this task's allowed scope.
- The worktree still contains the earlier uncommitted 0.9E.1 backend and frontend auth-alignment changes.

Contract changes requested:
- None.

Confirmation:
- no backend implemented or modified for this milestone
- no DB migration implemented
- no `client_access` persistence implemented
- no Clerk invitation API implemented
- no admin invite flow implemented
- no onboarding endpoint implemented
- no public signup implemented
- no custom password form implemented
- no custom 2FA implemented
- no real listmonk implemented
- no real sending implemented
- no AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase implemented

## Milestone 0.9E.2 — Clerk Runtime QA with Real Mapped Users

Date: 2026-05-07
Branch: develop

Verified state:
- Secret-safety checks passed:
- `git status --short` was clean before task output
- no tracked or staged diff was present for `.env`, `.env.local`, `frontend/.env.local`, or `backend/.env.local`
- `frontend/.env.local` exists with frontend Clerk variables
- `backend/.env.local` does not exist in this workspace
- the current shell environment does not contain `CLERK_JWKS_URL`, `CLERK_ISSUER`, or `AUTH_USER_MAPPINGS_JSON`
- Automated regression checks passed:
- `PYTHONPATH=backend python3 -m pytest backend/tests`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`
- Boundary grep checks passed:
- `fetch(` remains isolated to `frontend/lib/api.ts`
- no direct frontend `listmonk`, `postgres`, `database`, `smtp`, `localStorage`, `sessionStorage`, `document.cookie`, or signup exposure was found
- no forbidden generic post-login `/admin` redirect match was found in the checked frontend paths
- Live runtime checks executed outside the sandbox:
- backend `GET /health` returned `200`
- backend `GET /auth/me`, `GET /admin/clients`, and `GET /client/me` returned `401` without auth
- frontend signed-out `/admin`, `/client`, and `/account` are protected and redirect or rewrite to `/login`
- frontend `/login` renders the custom Sendwise login HTML and no signup or social button was visible in the rendered HTML
- Code-path verification passed:
- `frontend/app/auth/redirect/page.tsx` routes through backend-owned `getPostLoginRedirectPath()`
- `frontend/lib/api.ts` attaches `Authorization: Bearer <token>` in backend mode using Clerk `auth().getToken()`
- `getPostLoginRedirectPath()` decides `/admin` versus `/client` only from backend `GET /auth/me`

Known limits:
- Real backend Clerk runtime verification is blocked because local backend Clerk env is missing:
- `CLERK_JWKS_URL`
- `CLERK_ISSUER`
- `AUTH_USER_MAPPINGS_JSON`
- Real mapped admin and client Clerk users were not available in the workspace for live sign-in.
- Clerk Dashboard settings for public signup, social login, local redirect URLs, and mapped test users were not confirmable from this workspace.
- Interactive browser checks are limited because Playwright could not start Chrome on this machine.

Observed blocker:
- `GET /auth/me` with `Authorization: Bearer invalid-token` returned `500` with `Clerk auth is not fully configured on the backend.`
- This does not count as an application bug for this milestone because the required Clerk backend verification env was not present locally.

Scope confirmation:
- No DB migration was implemented.
- No `client_access` persistence was implemented.
- No Clerk invitation API, admin invite flow, onboarding endpoint, public signup, custom password form, custom 2FA, real listmonk, real sending, AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase was implemented.

## Milestone 11.2 - DB Migration Runner Hardening

Date: 2026-05-13
Branch: develop

Verified state:
- Added `scripts/apply_migrations.sh` as the explicit dev/staging SQL migration runner.
- Existing PostgreSQL volumes can be aligned with `db/migrations` without dropping data or resetting volumes.
- The runner creates `schema_migrations` if missing, applies pending migration files once in lexicographic order, and skips filenames already recorded.
- `--dry-run` lists pending/applied status without creating the tracking table or mutating schema.
- `scripts/smoke_test.sh` now verifies the runner exists and is executable without mutating the database.

Known limits:
- Existing migrations are not rewritten to be independently rerunnable; idempotency is enforced by tracking table filename registration.
- `20260508_client_access_v1.sql` still contains the historical `DROP TABLE IF EXISTS client_users`; the runner prevents accidental second application after tracking.

Out of scope:
- No SES controlled send, frontend UI, provider event expansion, send flow, Guard logic, auth, AI, or worker changes were implemented.

Milestone 11 audit note:
- Added backend-owned `GET /unsubscribe/{token}` with signed opaque tokens, idempotent suppression, and minimal safe HTML response.
- Added `POST /events/provider` ingestion for normalized provider payloads and minimal SES/SNS-like payloads, persisting idempotent `provider_events` rows before correlated side effects.
- Campaign read models now expose provider-event-backed `opened`, `clicked`, `bounced`, `complained`, and `unsubscribed` counts when processed events exist, while keeping zero/unavailable behavior honest when they do not.

## 2026-05-13 - Milestone 10.9 admin review summary and client campaign stats

Summary:
- Implemented `GET /admin/campaigns/{campaign_id}/summary` as a Business-DB-backed read model for admin review.
- Consolidated `POST /admin/campaigns/{campaign_id}/review` to return stable readiness/sendability fields including `allowed_to_send`, `can_send_when_enabled`, `sending_enabled`, and `current_step`.
- Implemented `GET /client/campaigns/{campaign_id}` and `GET /client/campaigns/{campaign_id}/stats` as client-scoped read-only endpoints backed by `campaigns`, `campaign_contacts`, `email_logs`, `blocked_sends`, and suppression data.
- Kept provider-event-derived metrics honest: `opened`, `clicked`, `complained/spam`, and similar metrics remain `0` with unavailable source metadata when no DB-backed event data exists.

Checks:
- `docker run --rm -v "$PWD/backend:/app" -v "$PWD/templates/dist:/templates/dist:ro" -w /app sendwise-backend python -m pytest tests`
- `cd templates && npm run build`
- `cd frontend && npm run build`
- `cd frontend && npm run lint`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config`
- `git diff --check`

Scope confirmation:
- No frontend implementation was added.
- No AI, SES, provider-event ingestion, or real send-path behavior was added.
- No broad refactor or listmonk bypass was introduced.

## Milestone 10.8 Completion — Admin Campaign Recipients API

Date: 2026-05-13
Branch: develop

Verified state:
- Added `GET /admin/campaigns/{campaign_id}/contacts` for platform-admin recipient reads scoped by `campaign.client_id`.
- Added `POST /admin/campaigns/{campaign_id}/contacts` for platform-admin JSON batch import/association.
- Contact import now normalizes email with trim/lowercase, rejects invalid email syntax, deduplicates within payload, reuses existing contacts by `client_id + email`, and attaches contacts idempotently to `campaign_contacts`.
- Recipient summary now reports `total`, `valid`, `invalid`, `suppressed`, `unsubscribed`, `blacklisted`, `bounced`, `eligible`, and per-contact blocked reasons.
- `contacts_ready` is refreshed from recipient eligibility for the admin recipients flow and `review_ready` is invalidated when recipient associations change.
- Client campaign routes remain read-only; no client contacts write surface was added.
- Recipients import does not call listmonk, does not create `email_logs`, does not create `blocked_sends`, and does not trigger send or simulation side effects.

Known limits:
- CSV file upload/import was not implemented in this milestone.
- No DB unique constraint was added to `campaign_contacts`; idempotency remains enforced application-side.
- Contact classification uses current `contacts.status` plus `suppression_list`; separate boolean fields for unsubscribe/blacklist/bounce do not exist in the current schema.

Checks referenced:
- `docker run --rm -v "$PWD/backend:/app" -v "$PWD/templates/dist:/templates/dist:ro" -w /app sendwise-backend python -m pytest tests/test_admin_campaigns.py -q`

Scope confirmation:
- No frontend code was changed.
- No auth flow, onboarding, provider events, SES, AI, Mailpit dispatch path, or Docker production behavior was changed.
- No broad refactor or legacy route removal was performed.

## Milestone 10.6.5 - Campaign Contract Realignment

Date: 2026-05-13
Branch: develop
Scope: Docs-only correction of campaign ownership contracts from the Milestone 10.5 self-service direction to the binding admin-managed direction.

Files modified:
- `docs/structural_contracts_v1.md`
- `docs/api_contracts_v1.md`
- `docs/data_model_v1.md`
- `docs/states_v1.md`
- `docs/ownership_v1.md`
- `docs/audit_checklist_v1.md`
- `docs/architecture_v1.md`
- `docs/audit_log.md`

Audit summary:
- Verified runtime campaign write routes still exist under the generic backend-owned `/campaigns/*` surface.
- Verified client runtime routes remain read-only today: `GET /client/campaigns`, `GET /client/usage`, `GET /client/blocked-sends`, plus stub detail/stats.
- Verified admin runtime surfaces exist for campaign listing and client administration, while the admin campaign wizard remains contractual only.
- Verified persisted `campaign_slots`, `campaign_slot_id`, `preview_text`, `body_html`, `body_text`, `content_ready`, `contacts_ready`, `review_ready`, and `current_step` remain valid for the admin-managed model.
- Verified Deliverability Guard, Mailpit dispatch, `email_logs`, `blocked_sends`, template rendering, and listmonk mapping/sync remain unchanged and in scope.

Contract updates:
- Admin is now documented as the only V1 actor allowed to create, configure, review, simulate, and send campaigns.
- Client portal is now documented as read-only for campaign visibility, usage, blocked sends, and delivery metrics.
- Client-side write campaign endpoints were removed from the V1 contract and replaced by planned admin campaign endpoints.
- AI editorial endpoints were moved under future admin-owned routes.
- Historical self-service wording in older audit entries is superseded by this milestone.

Tests executed:
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`

Tests not executed and reason:
- `PYTHONPATH=backend pytest backend/tests` was not run because only docs were modified.
- Frontend lint/build checks were not run because no frontend files changed.

Residual risks:
- Current runtime still exposes generic `/campaigns/*` write routes, so the final admin namespaced API contract is not implemented yet.
- Historical branch handoff and audit log entries still describe the old self-service direction as past context.
- Client detail, stats, and events routes remain stub/future and do not yet deliver the full read-only contract.

Scope confirmation:
- No frontend UI was modified.
- No backend runtime route, service, repository, Guard, listmonk adapter, or auth flow was modified.
- No DB schema or migration was modified.
- No Mailpit, SMTP, SES, worker, or provider behavior was modified.

## Milestone 10.5 — Contract Alignment For Self-Service Campaigns

Date: 2026-05-13
Branch: develop

Verified state:
- Audited current campaign persistence and runtime behavior from:
- `db/init.sql`
- `backend/app/api/campaigns.py`
- `backend/app/api/client.py`
- `backend/app/services/campaigns.py`
- `backend/app/services/campaign_preparation.py`
- `backend/app/services/send_simulation.py`
- `backend/app/guard/deliverability_guard.py`
- `backend/app/repositories/clients.py`
- `backend/app/repositories/contacts.py`
- `backend/app/repositories/email_logs.py`
- `frontend/app/c/[portalSlug]/campaigns/page.tsx`
- `frontend/lib/api.ts`
- Verified current runtime contract:
- campaigns are currently persisted with `id`, `client_id`, `name`, `status`, `subject`, timestamps only
- client campaign reads are currently available through backend-owned `GET /client/campaigns`
- client campaign detail and stats routes still return stub responses
- `POST /campaigns/{campaign_id}/simulate-send` is implemented and creates `email_logs.status="simulated"`
- `POST /campaigns/{campaign_id}/send` is implemented for controlled dev dispatch and creates `email_logs.status="queued"`
- Deliverability Guard currently enforces `clients.email_limit_per_campaign` and `clients.max_campaigns`
- no persisted `campaign_slots`, `email_templates`, wizard-step flags, or final-review records exist today
- Updated contracts only:
- `docs/structural_contracts_v1.md`
- `docs/api_contracts_v1.md`
- `docs/data_model_v1.md`
- `docs/states_v1.md`
- `docs/ownership_v1.md`
- `docs/audit_checklist_v1.md`
- `docs/architecture_v1.md`
- Contract updates now document:
- client self-service campaign ownership in the portal
- backend-derived `client_id` and backend-owned Guard/review decisions
- recommended wizard steps and readiness flags
- recommended `campaign_slots` model with legacy compatibility for `email_limit_per_campaign` and `max_campaigns`
- recommended `email_templates` product model
- future AI assistant boundaries as editorial-only
- proposed future client/admin/AI endpoints clearly marked `planned` or `future`

Known limits:
- No runtime schema, API, service, frontend, or Guard implementation was changed for the new self-service flow.
- `campaign_slots` and `email_templates` remain contractual only.
- Current runtime still uses legacy campaign states including `running`, `completed`, and `failed`.
- Current runtime still stores only `subject` on campaigns and builds HTML from the technical template renderer during preparation/simulation/send.

Checks referenced:
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`

Scope confirmation:
- No DB migration was implemented.
- No backend runtime feature was implemented.
- No frontend UI flow was implemented.
- No real AI, CSV import, slot persistence, SES rollout, worker, or new integration was implemented.

## Milestone 10.7 Completion — Backend API admin campaign wizard

Date: 2026-05-13
Branch: develop

Verified state:
- Implemented admin-managed campaign write endpoints under `/admin/campaigns` for create, detail, patch, content save, slot selection, review, simulate-send, and send.
- Implemented shortcut `POST /admin/clients/{client_id}/campaigns`.
- Admin create now requires explicit `client_id`, validates Business DB client existence, and rejects non-writable client statuses `blocked`, `archived`, and `suspended`.
- Admin content updates persist `subject`, `preview_text`, `body_html`, and `body_text`, and recompute `content_ready` in Business PostgreSQL.
- Admin review now runs backend preflight without treating `EMAIL_SENDING_ENABLED=false` as a review failure; readiness and real dispatch remain distinct.
- Admin simulate/send wrappers now reuse the existing simulation and dispatch services from the namespaced admin contract.
- Client campaign routes remain read-only; no client write endpoint was added.
- Generic `/campaigns/*` runtime routes remain available as legacy/internal technical surfaces.

Known limits:
- No frontend wizard was implemented.
- No contacts import endpoint was added in this milestone.
- No AI, provider events, SES, or worker flow was implemented.

Checks referenced:
- `docker run --rm -v "$PWD/backend:/app" -v "$PWD/templates/dist:/templates/dist:ro" -w /app sendwise-backend python -m pytest tests`
- `cd templates && npm run build`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config`
- `git diff --check`

Scope confirmation:
- No frontend code was changed.
- No auth flow, onboarding, provider event, SES, AI, or Docker production behavior was changed.
- No broad refactor or legacy route removal was performed.

## Milestone 0.9E.2 Completion — Real Clerk Mapped Users Verification

Date: 2026-05-08
Branch: develop

Verified state:
- Secret-safety checks passed and no tracked or staged env-file changes were present.
- `docker compose down`, `docker compose up -d --build`, and `docker compose ps` completed successfully.
- Backend container runtime included Clerk issuer, JWKS, and auth-mapping env keys.
- Frontend container runtime included Clerk publishable-key and backend URL env keys with `NEXT_PUBLIC_USE_MOCK_API=false`.
- Signed-out runtime matched contract:
- `GET /health` returned `200`
- `GET /auth/me`, `GET /admin/clients`, and `GET /client/me` returned `401` without auth
- signed-out `/admin`, `/client`, and `/account` redirected to `/login`
- signed-out `/auth/redirect` returned safe unauthenticated behavior and routed back to `/login`
- `/login` rendered the custom Sendwise login form with no rendered signup or social login surface.
- Backend positive-path verification succeeded with real Clerk-created sessions for the mapped users:
- admin session resolved `/auth/me` to `platform_admin`, `client_id: null`, `status: active`
- admin session reached `/admin/clients` with `200`
- admin session hit `/client/me` with `403`
- client session resolved `/auth/me` to `client`, `client_id: client_demo`, `status: active`
- client session reached `/client/me` with `200`
- client session hit `/admin/clients` with `403`
- Automated checks passed:
- `PYTHONPATH=backend python3 -m pytest backend/tests`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 BACKEND_URL=http://backend:8000 npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`
- required boundary greps

First divergence still blocking full browser completion:
- Real Clerk bearer-auth runtime is working in FastAPI, but direct frontend page verification with a raw Clerk session cookie still resolves as signed out on the Clerk dev-instance frontend flow.
- Protected frontend pages served the signed-out login shell even when tested with:
- a real active Clerk session JWT created through the official Clerk backend SDK
- a Clerk testing token

Root cause summary:
- Symptom: positive backend auth passes, but positive frontend protected-page verification remains signed out in the non-interactive verification path.
- Expected contract: real mapped Clerk users should complete `/login` and then route through `/auth/redirect` to `/admin` or `/client`.
- First divergence: the frontend Clerk browser session was not established from the available raw HTTP injection path, so `/admin`, `/client`, `/account`, and `/auth/redirect` still rendered as signed out.
- Primary root cause: the remaining blocker is the Clerk dev-instance browser-session handshake, not the Sendwise backend auth mapping.
- Category: Docker/VPS config
- Minimal fix boundary: no verified Sendwise code fix identified in this run; completion requires a real browser-authenticated Clerk session or a Clerk-supported frontend testing helper.

Known limits:
- Real browser login through the visible `/login` form was not completed because no password or interactive verification channel was available in this environment.
- Authenticated `/account` browser UI and sign-out return flow remain unverified for the same reason.
- `frontend/components/auth/MockLoginForm.tsx` still contains dormant mock-label text outside the live route path and outside scope.

Scope confirmation:
- No DB migration was implemented.
- No `client_access` persistence was implemented.
- No Clerk invitation API, admin invite flow, onboarding endpoint, public signup, custom password form, custom 2FA, real listmonk, real sending, AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase was implemented.

## Milestone 12 Safety Implementation - SES Controlled Send

Date: 2026-05-13
Branch: develop

Verified state:
- Added SES controlled-send safety configuration while keeping repository defaults fail-closed: `EMAIL_SENDING_ENABLED=false` and `EMAIL_PROVIDER=mailpit`.
- Added backend SES safety gate before listmonk dispatch for runtime environment, SES SMTP completeness, public unsubscribe URL, review readiness, allowed recipients, recipient max, and prepared unsubscribe link.
- Added admin send response diagnostics for provider, safety checks, recipient counts, listmonk dispatch, real-send attempt, email log creation, unsubscribe readiness, and provider event readiness.
- Added `scripts/validate_ses_readiness.sh` and `docs/runbook_ses_controlled_send.md` for dev/staging live-test preparation without printing or committing secrets.

Known limits:
- SES live send was not validated in this implementation pass because local SES credentials and an authorized live recipient were not provided.
- SES SNS signature verification remains a follow-up.
- No frontend, AI, worker, production mass-send, or provider-event expansion was implemented.

Checks referenced:
- Backend SES safety tests are in `backend/tests/test_campaign_dispatch.py`.
- Full command results are reported in the Milestone 12 completion response for this task.

Scope confirmation:
- No secrets, local env files, frontend files, auth flow, n8n, AI, worker, or dashboard UI were changed.

## Milestone 13.1 - Runtime Provider Mode Read Model

Date: 2026-05-13
Branch: develop

Verified state:
- Added a safe runtime provider read model to admin system status and campaign read-model responses: `email_sending_enabled`, normalized `email_provider`, `provider_mode_label`, `real_send_available=false`, `ses_live_validation_status`, `provider_events_available`, and `mailpit_dev_mode`.
- Updated admin campaign/system UI labels to use backend runtime labels for Mailpit/dev, SES pending validation, sending disabled, and unavailable provider modes.
- Response tests assert the runtime shape and verify fake SMTP/AWS/Clerk secret values are not present in responses.

Known limits:
- SES live validation remains `pending`; this milestone does not validate SES live delivery.
- `real_send_available` remains false because no new live-send validation was performed.

Checks referenced:
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config`
- `bash scripts/apply_migrations.sh`
- backend tests
- frontend lint/build
- `git diff --check`

Scope confirmation:
- No send/dispatch behavior, database schema, SES enablement, secret response fields, fake metrics, direct frontend listmonk access, or broad refactor was added.

## Milestone 14 - Campaign Detail Polish And Client Stats UX

Date: 2026-05-14
Branch: develop

Implemented state:
- Polished the admin campaign list/detail-style row UI with clearer campaign status, readiness, send safety, provider runtime, recipient summary, blocked reasons, and DB/provider-backed stat wording.
- Polished the client campaign list/detail-style row UI with plain-language status, recipient stats, provider-events state, blocked-send state, and empty/unavailable states without exposing internal provider IDs or listmonk IDs.
- Added a small frontend-only campaign UI helper for shared status labels, readiness copy, recipient summaries, provider event labels, runtime safety copy, and honest log stat labels.

Files touched:
- `frontend/app/admin/campaigns/page.tsx`
- `frontend/app/c/[portalSlug]/campaigns/page.tsx`
- `frontend/components/shared/campaignUi.ts`
- `docs/audit_log.md`

Known limits:
- SES live validation 12.1 remains pending; the UI does not claim SES delivery validation.
- Full regression tests are intentionally pending for the later validation pass.

Scope confirmation:
- No backend send/dispatch logic, backend services, DB schema, n8n files, direct frontend listmonk access, local env files, secrets, fake metrics, or optimistic provider stats were added.

Checks referenced:
- Full regression intentionally not run in this task per instruction.

## Milestone 12.1 - Live SES Validation Preflight

Date: 2026-05-13
Branch: develop

Verified state:
- Live SES dispatch was not attempted because the local runtime remained fail-closed: `EMAIL_SENDING_ENABLED=false`, `EMAIL_PROVIDER=mailpit`, no SES SMTP credentials, no `AWS_SES_REGION`, no single-recipient allowlist, and `BACKEND_PUBLIC_URL=http://localhost:8000`.
- listmonk was running with dev SMTP pointed at Mailpit, not SES.
- Business PostgreSQL had no clients, campaigns, contacts, campaign-contact rows, or email logs available for a one-recipient controlled send target.
- `scripts/validate_ses_readiness.sh` was tightened to fail when `AWS_SES_REGION` is missing, runtime environment is not allowed, allowed-recipient enforcement is disabled, `REAL_SEND_MAX_RECIPIENTS` is not `1`, or the allowlist does not contain exactly one recipient.

Checks executed:
- `bash -n scripts/validate_ses_readiness.sh`
- `scripts/validate_ses_readiness.sh` against current local env, which failed safely.
- `scripts/validate_ses_readiness.sh` against dummy non-secret SES-shaped env, which passed without printing secrets.
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config`
- `bash scripts/apply_migrations.sh`
- `docker run --rm ... sendwise-backend python -m pytest tests`
- Docker Node temp-copy `npm run lint`
- Docker Node temp-copy `npm run build`
- `git diff --check`

Result:
- Milestone 12.1 is blocked by external/local runtime configuration and missing target data, not by the send service.
- No fake delivery, open, click, or provider metrics were added.
- No secrets or local env files were committed.

## Milestone 12.0R - SES Runtime Readiness Seed

Date: 2026-05-13
Branch: develop

Verified state:
- Expanded `docs/runbook_ses_controlled_send.md` with an uncommitted SES override flow using placeholders only, one-recipient allowlist requirements, public HTTPS unsubscribe requirements, listmonk API `403` diagnostics, and an exact manual validation sequence.
- Added `scripts/prepare_ses_validation_target.sh` as a validation-only Business DB target checker. It rejects missing or multiple recipients, does not create data, does not send email, does not call listmonk, and prints target IDs only when an existing client/campaign/contact relation is safe for one-recipient SES validation.
- Kept committed defaults safe: `EMAIL_SENDING_ENABLED=false`, `EMAIL_PROVIDER=mailpit`, Mailpit remains the dev default, and no local env or credential files were changed.

Known limits:
- The new target script does not create test data because review state, Guard eligibility, and prepared listmonk content must remain backend/admin-flow owned.
- Live SES validation still requires local/staging secrets, one allowlisted recipient, a verified SES from identity, public HTTPS `BACKEND_PUBLIC_URL`, working listmonk API auth, and an existing reviewed campaign target.

Checks referenced:
- `bash -n scripts/validate_ses_readiness.sh`
- `bash -n scripts/prepare_ses_validation_target.sh`
- `git diff --check`

Scope confirmation:
- No frontend, schema, campaign send logic, Deliverability Guard, credential, fake metric, provider event, or real send behavior was changed.
- No email was sent and no listmonk campaign send was triggered.

## Milestone 13 - Campaign Wizard And Stats UI Alignment

Date: 2026-05-13
Branch: develop

Verified state:
- Admin campaign list now reads the existing backend campaign summary read model for readiness flags, recipient eligibility/blocked counts, blocked-send reasons, sendability warnings, DB-backed log counts, and provider-events availability.
- Client campaign list now reads existing client-scoped campaign detail and stats endpoints for readiness, recipient counts, blocked sends, and DB/provider-backed log counts.
- Empty and neutral states were added for unavailable read models, no contacts, no eligible recipients, all recipients blocked, no provider events, and pending SES live validation.

Known limits:
- SES live validation remains pending; the UI does not claim real SES delivery validation.
- Provider mode is not exposed in the campaign read model, so the UI shows a neutral unavailable state instead of inventing it.

Checks referenced:
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config`
- `bash scripts/apply_migrations.sh`
- Docker backend pytest with `/templates/dist` mounted
- Docker frontend builder `npm run lint`
- Fresh Docker frontend image build
- `git diff --check`

Scope confirmation:
- No backend send/dispatch logic, DB schema, listmonk integration, n8n files, local env files, secrets, fake metrics, or direct frontend listmonk access were added.
