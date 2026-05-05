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
