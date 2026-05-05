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

## Backend Multi-Client Isolation Audit

Date: 2026-05-05
Branch: feature/backend-core
Task type: backend_audit
Implementation depth: audit_only
Scope: Read-only audit of multi-client isolation for extracted backend domains: clients, campaigns, usage, and blocked_sends.

Expected contract:
- FastAPI remains the gatekeeper and must enforce client isolation.
- Every customer-owned business entity must include `client_id` or be reachable through a `client_id` relationship.
- Client dashboard endpoints must return only the caller client's data.
- Admin endpoints may expose cross-client data only through admin routes.
- No real auth/RBAC, DB persistence, listmonk, sending, or Deliverability Guard implementation is part of this audit.

Client_id flow observed:
- Current mock client context originates in `backend/app/repositories/clients.py` as `MOCK_CLIENT_ID = "client_acme"` and `_CLIENT_CONTEXT`.
- `GET /client/me` returns `ClientsService.get_current_client_context()`.
- `GET /client/campaigns` derives `client_id` from `ClientsRepository.get_current_client_context().client.id`, then calls `ClientsRepository.list_current_client_campaigns(client_id)`.
- `GET /client/usage` uses `UsageService.list_current_client_usage()`, which imports `MOCK_USAGE_CLIENT_ID = "client_acme"` from `backend/app/repositories/usage.py`.
- `GET /client/blocked-sends` uses `BlockedSendsService.list_current_client_blocked_sends()`, which imports `MOCK_CLIENT_ID = "client_acme"` from `backend/app/repositories/blocked_sends.py`.
- Admin endpoints are separated under `/admin`; client endpoints are separated under `/client`; both currently share the placeholder API-key dependency.

Boundary status by domain:
- clients: OK for current stubs. Admin list intentionally returns both mock clients. Client context returns one mock client and matching user `client_id`.
- campaigns: OK for current exposed data. Client campaign list filters by current mock client. Admin campaign list intentionally returns all mock campaigns. Repository supports optional `client_id` filtering, but the service exposes only the all-admin list today.
- usage: OK for current exposed client data, but micro-fix needed before expanding beyond static stubs because the current client id is independently hardcoded in the usage repository.
- blocked_sends: OK for current exposed client data, but micro-fix needed before expanding beyond static stubs because the current client id is independently hardcoded in the blocked_sends repository.

Problems found:
- Issue: Current client identity is duplicated across extracted domains instead of flowing from one mock/current client context.
  Severity: medium
  File: `backend/app/services/usage.py`, `backend/app/services/blocked_sends.py`, `backend/app/repositories/usage.py`, `backend/app/repositories/blocked_sends.py`
  Risk: `GET /client/me` can report one client while `/client/usage` or `/client/blocked-sends` query another if one hardcoded mock id changes independently. No leakage is observed today because all constants currently equal `client_acme`, but the isolation boundary is brittle.
  Suggested micro-fix: Pass the current mock `client_id` from the same current-client context used by `ClientsService`, or centralize the temporary mock current-client provider, then keep repository filtering explicit.
- Issue: Admin per-client usage and blocked-sends routes are planned stubs and do not yet exercise repository filtering.
  Severity: low
  File: `backend/app/api/admin.py`
  Risk: `GET /admin/clients/{client_id}/usage` and `GET /admin/clients/{client_id}/blocked-sends` return endpoint-only stub payloads, so the audit cannot prove their future read path will stay client-scoped when implemented.
  Suggested micro-fix: When these planned endpoints become functional, route through service methods that pass the path `client_id` into repository filters and add read-only tests with at least two clients.
- Issue: Placeholder auth separates admin and client routes by path only, not by role.
  Severity: low
  File: `backend/app/core/security.py`
  Risk: A valid placeholder API key can reach both admin and client prefixes. This is expected in the current no-real-auth milestone, but it is not a production-grade admin/client boundary.
  Suggested micro-fix: Keep as documented until the approved auth milestone; before real client data is exposed, introduce role/client context at the backend gatekeeper.

Record/client_id evidence:
- `campaigns`, `api_usage`, and `blocked_sends` schemas include required `client_id`.
- `db/init.sql` defines `campaigns.client_id`, `api_usage.client_id`, and `blocked_sends.client_id` as `NOT NULL`.
- `suppression_list.client_id` and `provider_events.client_id` are nullable by V1 contract and are outside the four-domain read surface audited here.
- No real DB rows exist in the audited backend path; current data is in-memory static stub data.

Checks executed:
- Read and applied `docs/codex_prompt_engine_v1.md`.
- Read and applied `docs/codex_skills/validate-state-and-persistence.md`.
- Read and applied `docs/codex_skills/audit-runtime-flow.md`.
- Read and applied `docs/codex_skills/check-anti-monolith.md`.
- Read and applied `docs/codex_skills/run-regression-guard.md`.
- Read and applied audit skill runtime-flow reference.
- Reviewed V1 contracts: `docs/structural_contracts_v1.md`, `docs/api_contracts_v1.md`, `docs/data_model_v1.md`, and `docs/architecture_v1.md`.
- Static inspection of backend API, service, repository, schema, DB stub, and existing tests for `client_id`.
- `docker compose config` passed, with Docker config access warnings for `C:\Users\Jacopo\.docker\config.json`.
- `git diff --check` passed.
- In-memory Python syntax check passed for 38 backend app/test Python files using bundled Python and `PYTHONDONTWRITEBYTECODE=1`.
- Direct service/repository checks passed: client campaign/usage/blocked_sends endpoints resolve to `client_acme`; admin campaigns intentionally include `client_acme` and `client_nova`; repository filters for campaigns, usage, and blocked_sends returned only the requested client data.

Checks not executed and reason:
- `PYTHONPATH=backend pytest backend/tests` could not run because `pytest` is not installed in the available shell.
- `PYTHONPATH=backend python -m pytest backend/tests` with bundled Python could not run because the bundled Python environment has no `pytest` module.
- `bash scripts/audit.sh` could not run in sandbox because Bash returned `Access is denied`; escalated retry reached WSL but failed because `/bin/bash` was not available.
- `bash scripts/smoke_test.sh` could not run in sandbox because Bash returned `Access is denied`; escalated retry reached WSL but failed because `/bin/bash` was not available.

Contract change request:
- None. The identified micro-fix can preserve API, DB, frontend, Docker, and dependency contracts.

Confirmation:
- no application code modified during this audit
- no backend API/service/repository code modified
- no frontend, template, Docker, DB, Makefile, README, dependency, or schema changes made
- no real auth/RBAC, DB persistence, listmonk, email sending, Deliverability Guard, or refactor implemented

Recommendation:
- Milestone 2 should wait for a small backend micro-fix that removes duplicated current-client hardcoding for usage and blocked_sends. Current client-facing responses do not leak cross-client data in the static stubs, but the mock isolation boundary is too brittle to carry forward unchanged.

## Current Client Mock Centralization

Date: 2026-05-05
Branch: feature/backend-core
Task type: backend_fix
Implementation depth: minimal_fix

Root cause:
- The current mock client id was duplicated in repository constants across clients, usage, and blocked_sends. This made `/client/me`, `/client/usage`, and `/client/blocked-sends` vulnerable to drifting apart if one stub changed independently.

Files created:
- `backend/app/core/current_client.py`

Files modified:
- `backend/app/repositories/clients.py`
- `backend/app/repositories/usage.py`
- `backend/app/repositories/blocked_sends.py`
- `docs/audit_log.md`

Fix applied:
- Added `get_current_client_id()` as the single temporary mock current-client provider.
- Updated clients, usage, and blocked_sends repositories to derive their mock current-client constants from `get_current_client_id()`.
- Preserved the current mock value: `client_acme`.

Boundary confirmation:
- No routers changed.
- No API contracts changed.
- No schema, DB, Docker, frontend, dependency, auth, RBAC, middleware, listmonk, or sending changes were introduced.
- The new core module is limited to current mock client context and is not a general utility bucket.

Checks executed:
- In-memory Python syntax check passed for `backend/app/core/current_client.py`, `backend/app/repositories/clients.py`, `backend/app/repositories/usage.py`, and `backend/app/repositories/blocked_sends.py`.
- Direct repository import and data guard passed: current client context, usage, and blocked_sends all resolve to `client_acme` and preserve existing record ids.
- Direct service payload guard passed for `/client/me`, `/client/usage`, and `/client/blocked-sends` service paths.
- Static search across touched current-client files found `"client_acme"` only in `backend/app/core/current_client.py`.
- `docker compose config` passed with Docker config access warnings.
- `git diff --check` passed with line-ending warnings only.

Checks not executed and reason:
- `python -m pytest backend/tests` could not run because `python` is not available in the shell.
- Bundled Python `-m pytest backend/tests` could not run because `pytest` is not installed.
- `bash scripts/audit.sh` and `bash scripts/smoke_test.sh` could not run in sandbox because Bash returned `Access is denied`; escalated retries reached WSL but failed because `/bin/bash` is unavailable.

Residual risks:
- Full HTTP endpoint regression still depends on an environment with backend runtime dependencies installed.
