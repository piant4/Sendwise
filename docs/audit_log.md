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

## Backend Admin Campaign Boundary

Date: 2026-05-05
Milestone: Milestone 0.5 - Backend Core Boundary
Scope: Moved admin campaign in-memory stub data and campaign-specific stub logic from the admin router into campaign service/repository boundaries.
Files created:
- `backend/app/repositories/campaigns.py`
- `backend/app/services/campaigns.py`
Files modified:
- `backend/app/api/admin.py`
- `backend/tests/test_milestone_05_stubs.py`
- `docs/audit_log.md`
Tests executed:
- In-memory Python syntax compile check for changed backend/test files passed.
- Direct campaign service/repository contract check passed.
- `git diff --check` passed.
Tests not executed and reason:
- `PYTHONPATH=backend pytest backend/tests` could not run because `pytest` is not installed in the available Python environment.
- `bash scripts/audit.sh` and `bash scripts/smoke_test.sh` could not run because `bash` is not available in the shell.
- `docker compose config` could not run because `docker` is not available in the shell.
- `python -m py_compile ...` could not run because bytecode writing to `backend/app/api/__pycache__` was denied; an in-memory syntax compile check was used instead.
Residual risks:
- Full FastAPI app startup and endpoint HTTP regression checks still need to run in an environment with project dependencies installed.
Confirmation:
- no API contract changes
- no DB schema changes
- no real persistence introduced
- no real auth introduced
- no email sending introduced
- no listmonk integration introduced

## Milestone 1 - Service & Repository Foundation Final Audit

Date: 2026-05-05
Milestone: Milestone 1 - Service & Repository Foundation
Scope: Audit-only verification of router -> service -> repository boundaries for clients, campaigns, usage, and blocked_sends.
Implementation depth: audit_only

Boundary status:
- clients: OK for extracted admin/client routes. Routers call `ClientsService`; service calls `ClientsRepository`; repository is in-memory only. Planned client stubs are service-owned.
- campaigns: Micro-fix needed. Admin campaign routes use `CampaignsService` and `CampaignsRepository`, but core `/campaigns` routes still return router-local stubs from `backend/app/api/campaigns.py`.
- usage: OK. Routers call `UsageService`; service calls `UsageRepository`; repository is in-memory only and filters by explicit `client_id` where applicable.
- blocked_sends: OK. Routers call `BlockedSendsService`; service calls `BlockedSendsRepository`; repository is in-memory only and filters by explicit `client_id` where applicable.

Problems found:
- Issue: Core campaign router still owns stub response construction instead of delegating through a service boundary.
  Severity: medium
  File: `backend/app/api/campaigns.py`
  Evidence: `stub_response()` is defined in the router and used by `POST /campaigns`, `POST /campaigns/{campaign_id}/authorize`, and `POST /campaigns/{campaign_id}/send`.
  Suggested next micro-task: Move planned core campaign stubs behind `CampaignsService` while preserving the existing API response bodies and status codes.
- Issue: Residual unused `stub_response()` helper remains in `backend/app/api/admin.py`.
  Severity: low
  File: `backend/app/api/admin.py`
  Evidence: helper is still present in the router after extracted admin domains moved to services.
  Suggested next micro-task: Remove the unused router helper if no route references it, without changing API contracts.

Checks executed:
- Contract/skill review: `docs/codex_prompt_engine_v1.md`, `docs/codex_skills/check-anti-monolith.md`, `docs/codex_skills/run-regression-guard.md`, audit runtime-flow skill, `docs/structural_contracts_v1.md`, `docs/api_contracts_v1.md`, and `docs/audit_checklist_v1.md`.
- Static router/service/repository inspection for clients, campaigns, usage, and blocked_sends.
- Search for direct repository imports in routers: none found.
- Search for real DB/listmonk/email calls in inspected API/service/repository files: no real DB/listmonk/email integration found for the audited domains.
- `docker compose config` passed with Docker config access warnings.
- `git diff --check` passed.
- In-memory Python syntax check passed for backend API, service, repository, and test files using bundled Python.
- Direct import check passed for audited services and repositories using bundled Python.

Checks not executed and reason:
- `PYTHONPATH=backend pytest backend/tests` did not run because `pytest` is not installed in the available shell or bundled Python environment.
- `bash scripts/audit.sh` did not run because Bash failed with `Access is denied`.
- `bash scripts/smoke_test.sh` did not run because Bash failed with `Access is denied`.

Contract change request:
- None. The required fix should preserve existing API contracts and remain within backend service boundary work.

Confirmation:
- no application code modified during this audit
- no backend API/service/repository code modified
- no frontend, Docker, DB, template, Makefile, README, dependency, or schema changes made
- no real DB, listmonk, email, auth/RBAC, AI generation, n8n, worker, or Deliverability Guard implementation attempted

Recommendation: Milestone 1 is not closed yet. A micro-fix is needed for the core campaign router stub boundary before final closure.

## Core Campaign Router Stub Boundary Fix

Date: 2026-05-05
Milestone: Milestone 1 - Service & Repository Foundation
Scope: Minimal backend fix moving core `/campaigns` planned stub response construction out of the router and into `CampaignsService`.
Implementation depth: minimal_fix

Root cause:
- Core campaign router still constructed planned stub responses inline through `stub_response()`, violating the router -> service -> repository boundary.

Files modified:
- `backend/app/api/campaigns.py`
- `backend/app/services/campaigns.py`
- `docs/audit_log.md`

Fix applied:
- Removed router-local `stub_response()` from `backend/app/api/campaigns.py`.
- Added router delegation to `CampaignsService` for `POST /campaigns`, `POST /campaigns/{campaign_id}/authorize`, and `POST /campaigns/{campaign_id}/send`.
- Preserved exact planned stub response bodies, endpoint paths, and status codes.

Boundary confirmation:
- Router remains HTTP-only and delegates to service.
- Service returns the existing planned stub JSON shape.
- Repository remains unchanged because no persistence data was needed.

Tests executed:
- In-memory Python syntax compile check for changed backend files passed.
- Direct `CampaignsService` import and exact planned stub payload checks passed.
- Manual router source check found no `stub`, `stub_response`, `endpoint`, or `status: stub` construction in `backend/app/api/campaigns.py`.
- `docker compose config` passed with Docker config access warnings.
- `git diff --check` passed.

Tests not executed and reason:
- `PYTHONPATH=backend pytest backend/tests` could not run because `python` is not available in the shell and the bundled Python runtime does not have `pytest` installed.
- Direct router function import check could not run because the bundled Python runtime does not have `fastapi` installed.
- `bash scripts/audit.sh` could not run because Bash failed with `Access is denied`.
- `bash scripts/smoke_test.sh` could not run because Bash failed with `Access is denied`.

Residual risks:
- Full FastAPI endpoint regression still depends on an environment with backend dependencies available.

Confirmation:
- no API contract changes
- no schema changes
- no DB, listmonk, auth/RBAC, email sending, or Deliverability Guard implementation introduced
- no frontend, admin router, client router, usage, blocked_sends, Docker, env, Makefile, README, or dependency changes made
- fix is minimal and limited to the confirmed backend router/service boundary issue
