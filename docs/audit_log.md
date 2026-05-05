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

## Milestone 2 Final Audit - Multi-client Isolation Enforcement

Date: 2026-05-05
Branch: feature/backend-core
Task type: backend_audit
Implementation depth: audit_only

Applied operating skills:
- `docs/codex_prompt_engine_v1.md`
- Requested underscore skill paths were not present; applied repository equivalents:
  - `docs/codex_skills/validate-state-and-persistence.md`
  - `docs/codex_skills/audit-runtime-flow.md`
  - `docs/codex_skills/check-anti-monolith.md`
  - `docs/codex_skills/run-regression-guard.md`
- Applied local audit skill runtime-flow reference.

Audit summary:
- Milestone 2 isolation is enforced for the current in-memory stub read surface.
- Current client mock is centralized in `backend/app/core/current_client.py`.
- Client-facing data endpoints under `/client` return only the current mock client data.
- Admin cross-client data remains exposed only through `/admin` list endpoints in the current stub state.
- No code, schema, frontend, Docker, dependency, auth/RBAC, DB, listmonk, or sending changes were made during this audit.

Client_id isolation status:
- Current client provider: `backend/app/core/current_client.py` exposes `get_current_client_id()` and currently returns `client_acme`.
- Clients repository imports the provider and derives `MOCK_CLIENT_ID` from it.
- Usage repository imports the provider and derives `MOCK_USAGE_CLIENT_ID` from it.
- Blocked sends repository imports the provider and derives `MOCK_CLIENT_ID` from it.
- `/client/me` returns one client context where `client.id == user.client_id == client_acme`.
- `/client/campaigns` derives the current client from `ClientsRepository.get_current_client_context().client.id` and filters client campaigns by that id.
- `/client/usage` passes the centralized mock client id into `UsageRepository.list_api_usage(client_id=...)`.
- `/client/blocked-sends` passes the centralized mock client id into `BlockedSendsRepository.list_blocked_sends(client_id=...)`.
- `/admin/clients` and `/admin/campaigns` intentionally expose cross-client mock data for admin list surfaces.

Repository coverage:
- `backend/tests/test_repository_client_isolation.py` covers:
  - usage repository filtering out non-current client records
  - blocked sends repository filtering out non-current client records
  - clients repository using centralized current-client provider after monkeypatch/reload
- `backend/tests/test_milestone_05_stubs.py` covers campaign repository client filtering for admin campaign data.
- Repository filtering evidence from static inspection:
  - `backend/app/repositories/clients.py` filters `_CLIENT_CAMPAIGNS` by explicit `client_id`.
  - `backend/app/repositories/usage.py` filters `_API_USAGE` by optional explicit `client_id`.
  - `backend/app/repositories/blocked_sends.py` filters `_BLOCKED_SENDS` by optional explicit `client_id`.
  - `backend/app/repositories/campaigns.py` supports optional `client_id` filtering for admin campaign data.

Service coverage:
- `backend/tests/test_service_client_isolation.py` covers:
  - `ClientsService.get_current_client_context()` and `ClientsService.list_current_client_campaigns()` using the patched current-client context
  - `UsageService.list_current_client_usage()` using current-client usage scope
  - `BlockedSendsService.list_current_client_blocked_sends()` using current-client blocked-send scope
- `backend/tests/test_milestone_05_stubs.py` covers exposed client API behavior for:
  - `/client/me`
  - `/client/campaigns`
  - `/client/usage`
  - `/client/blocked-sends`
  - planned `/client/campaigns/{campaign_id}` stub shape

Hardcoded client_id review:
- Expected central mock remains in `backend/app/core/current_client.py`: `client_acme`.
- Admin multi-client campaign seed data still hardcodes `client_acme` and `client_nova` in `backend/app/repositories/campaigns.py`; this is admin-facing stub data and not used by `/client/campaigns`.
- Clients repository still includes `client_nova` as admin list stub data.
- No residual independent current-client hardcoding found in usage or blocked_sends repositories; both derive from the centralized provider.

Client-facing endpoint coverage:
- Covered and data-returning:
  - `GET /client/me`
  - `GET /client/campaigns`
  - `GET /client/usage`
  - `GET /client/blocked-sends`
- Covered as planned stub:
  - `GET /client/campaigns/{campaign_id}`
- Present but not data-returning in current stub state:
  - `GET /client/campaigns/{campaign_id}/stats`
  - `POST /campaigns`
  - `POST /campaigns/{campaign_id}/authorize`
  - `POST /campaigns/{campaign_id}/send`
  - `POST /contacts/import`
  - `GET /contacts`
  - `POST /contacts/{contact_id}/suppress`

Admin cross-client vs client-scoped boundary:
- Admin cross-client is currently allowed only under `/admin`:
  - `GET /admin/clients` returns both `client_acme` and `client_nova`.
  - `GET /admin/campaigns` returns campaigns for both `client_acme` and `client_nova`.
- Client-scoped data is returned only under `/client` and is scoped to `client_acme` in the current mock state.
- The shared placeholder API-key dependency is not a real admin/client role boundary. This is expected before the auth/RBAC milestone and remains a future production risk, not a Milestone 2 code divergence.

Problems found:
- Issue: Some client-capable planned endpoints are not service/repository isolation-tested yet because they return endpoint-only stubs rather than records.
  Severity: low, future-implementation risk
  File: `backend/app/api/client.py`, `backend/app/api/campaigns.py`, `backend/app/api/contacts.py`
  Suggested next micro-task: When those planned endpoints become data-returning, route through service methods that obtain backend current-client or admin role context and add repository/service tests with at least two clients.
- Issue: Placeholder API key allows reaching both `/admin` and `/client` route groups.
  Severity: known milestone limitation
  File: `backend/app/core/security.py`
  Suggested next micro-task: In the approved auth/RBAC milestone, make backend auth context the source of current client and role, and keep admin cross-client reads role-gated.

Contract change request:
- None. No API, DB, frontend, Docker, dependency, or schema change is required for the audited current stub state.

Tests executed:
- `docker compose config` passed; Docker emitted access warnings for `C:\Users\Jacopo\.docker\config.json`.
- `git diff --check` passed.
- Read-only Python syntax check with bundled Python and `ast.parse` passed for 41 backend Python files.
- Direct repository/service import checks passed with bundled Python:
  - current client resolves to `client_acme`
  - client service campaign, usage, and blocked-send reads resolve only to `client_acme`
  - admin campaigns include `client_acme` and `client_nova`
  - repository filters for `client_nova` return only requested/available scoped data or empty lists where no Nova records exist

Tests not executed:
- `PYTHONPATH=backend pytest backend/tests` did not run because `pytest` is not available in the shell PATH.
- Bundled Python `-m pytest backend/tests` did not run because the bundled Python environment has no `pytest` module.
- `bash scripts/audit.sh` did not run because Bash/WSL returned `Access is denied`.
- `bash scripts/smoke_test.sh` did not run because Bash/WSL returned `Access is denied`.
- HTTP endpoint checks with `fastapi.testclient` did not run because FastAPI is not installed in the bundled Python runtime.
- `python -m compileall` was not counted as valid because it attempted to write `__pycache__` and hit access-denied errors; the read-only `ast.parse` syntax check was used instead.

Files modified:
- `docs/audit_log.md`
- `docs/branch_handoffs/milestone_2_final_audit.md`

Recommendation:
- Milestone 2 can be closed for the current stub state. No client-facing data endpoint currently returns cross-client records, current client mock identity is centralized, repository/service isolation tests exist for the active client-facing read paths, and admin cross-client visibility is limited to admin-prefixed routes. Carry the two documented future risks into the auth/data-returning endpoint milestones.

## State Management Stub Audit

Date: 2026-05-05
Branch: `feature/backend-core`
Task type: `backend_audit`
Implementation depth: audit-only

Skills applied:
- `docs/codex_prompt_engine_v1.md`
- `docs/codex_skills/validate-state-and-persistence.md` (requested underscore filename not present; hyphenated equivalent used)
- `docs/codex_skills/audit-runtime-flow.md` (requested underscore filename not present; hyphenated equivalent used)
- `docs/codex_skills/check-anti-monolith.md` (requested underscore filename not present; hyphenated equivalent used)
- `docs/codex_skills/run-regression-guard.md` (requested underscore filename not present; hyphenated equivalent used)

Audit summary:
- Source of truth checked: `docs/states_v1.md`, `docs/data_model_v1.md`, `docs/api_contracts_v1.md`, `docs/architecture_v1.md`.
- `project_handoff_v1.md` is referenced by V1 docs but is not present in this checkout.
- Backend schema enums match the V1 campaign/contact state sets.
- Current campaign runtime stub data contains only `ready` and `draft`.
- Current backend has a `Contact` schema and contact route stubs, but no contact repository/mock contact list returning contact statuses.
- `campaign_contacts` exists in `db/init.sql` as a planned schema stub, with default `pending`, but has no backend schema, repository, service, or exposed API path.
- No real campaign/contact state transitions are implemented. Pause/resume/block/archive/suppress endpoints return planned stub payloads and do not mutate state.
- No real sending is implemented. Core campaign authorize/send endpoints return planned stub payloads and do not call `DeliverabilityGuard`; the Guard itself remains fail-closed if called.

Contractual states detected:
- Campaign states from V1: `draft`, `ready`, `running`, `paused`, `blocked`, `completed`, `failed`.
- Campaign transitions from V1: `draft -> ready -> running -> completed`, `ready -> paused -> ready`, `running -> paused -> running`, `draft -> blocked`, `ready -> blocked`, `running -> blocked`, `running -> failed`, `paused -> blocked`.
- Contact states from V1: `pending`, `sendable`, `suppressed`, `bounced`, `unsubscribed`, `blacklisted`, `error`.
- Contact transitions from V1: `pending -> sendable`, `pending -> error`, `sendable -> suppressed`, `sendable -> bounced`, `sendable -> unsubscribed`, `sendable -> blacklisted`, `error -> pending`.
- Send-blocking rules from V1: campaigns in `paused`, `blocked`, `completed`, or `failed` cannot send; contacts in `unsubscribed`, `blacklisted`, `bounced`, or `suppressed` cannot send; `pending` and `error` contacts also cannot send.

States present in current stubs:
- Backend campaign enum: all contractual campaign states are present in `backend/app/schemas/common.py`.
- Backend contact enum: all contractual contact states are present in `backend/app/schemas/common.py`.
- Backend admin campaign stub data: `ready`, `draft` in `backend/app/repositories/campaigns.py`.
- Backend client campaign stub data: `ready`, `draft` in `backend/app/repositories/clients.py`.
- Frontend mock campaign data: `ready`, `draft` in `frontend/lib/mock-api.ts`.
- DB defaults: campaigns default to `draft`; contacts default to `pending`; `campaign_contacts` default to `pending` in `db/init.sql`.
- Non-contractual states found in inspected backend/frontend/DB stubs: none.
- Campaign `archived` was specifically checked because it appears in the prompt risk list; it is not a campaign state in V1 contracts and was not found in campaign stubs.
- Contractual campaign states not represented by current campaign list data: `running`, `paused`, `blocked`, `completed`, `failed`.
- Contractual contact states not represented by current backend data-returning stubs: all contact states, because contact endpoints return endpoint-only stub payloads.

Transitions present or absent:
- Present as enum/model vocabulary: campaign/contact states and send decisions.
- Present as planned endpoints only: client pause/resume/block/archive; campaign pause/resume; contact suppress.
- Present as real mutation: none found.
- Present in Guard: fail-closed placeholder decisions only; no client/campaign/contact status inspection.
- Present in listmonk adapter: stub operations only; no state ownership or send authorization.

Problems found:
- Issue: Campaign lifecycle action endpoints are planned stubs and do not mutate campaign/client state.
  Severity: low
  File: `backend/app/api/admin.py`, `backend/app/services/campaigns.py`
  Risk: UI or callers receive a stub response from pause/resume/block/archive without a persisted state change. Current behavior matches planned-stub status, but it cannot prove lifecycle enforcement yet.
  Suggested next micro-task: Implement the smallest service-owned campaign/client lifecycle transition slice with repository persistence and conflict checks, after an approved implementation task.
- Issue: Core campaign authorize/send endpoints do not evaluate campaign status or contact status.
  Severity: medium
  File: `backend/app/services/campaigns.py`, `backend/app/guard/deliverability_guard.py`
  Risk: There is no current real send path, so immediate accidental sending risk is low; however, when sending becomes data-returning/operational, campaigns in `paused`, `blocked`, `completed`, or `failed` would not be blocked unless Guard integration is added first.
  Suggested next micro-task: Wire `POST /campaigns/{campaign_id}/authorize` through a backend Guard use case that checks client, campaign, contact, suppression, and fail-closed config before any send implementation.
- Issue: Contact suppression/sendability endpoints are endpoint-only stubs with no contact repository state.
  Severity: medium
  File: `backend/app/api/contacts.py`, `backend/app/schemas/contacts.py`
  Risk: `unsubscribed`, `blacklisted`, `bounced`, and `suppressed` are contract states but no current backend read/write path proves they block eligibility or persist suppression.
  Suggested next micro-task: Add a contact service/repository state audit slice before implementation, then implement `suppress` as a backend-owned transition only in an approved fix/feature task.
- Issue: `campaign_contacts` exists only as a DB schema stub.
  Severity: low
  File: `db/init.sql`
  Risk: Per-campaign contact inclusion/send state is planned in the data model, but no backend boundary currently validates `client_id`, `campaign_id`, and `contact_id` consistency.
  Suggested next micro-task: Define the minimal backend repository/service contract for `campaign_contacts` before any send batching or per-campaign contact state work.
- Issue: Current data stubs do not include negative fixtures for non-sendable campaign or contact states.
  Severity: low
  File: `backend/app/repositories/campaigns.py`, `backend/app/repositories/clients.py`
  Risk: Regression coverage cannot currently observe UI/API handling of non-sendable campaign/contact states, even though the enum vocabulary is present.
  Suggested next micro-task: Add negative state fixtures and read-path tests only when the relevant state enforcement endpoint becomes part of an approved implementation task.

Runtime flow notes:
- Expected contract: UI/external caller -> FastAPI -> service -> Deliverability Guard/repository -> Business PostgreSQL/listmonk, with backend as gatekeeper.
- Observed current flow for `POST /campaigns/{campaign_id}/send`: FastAPI router -> `CampaignsService.send_campaign()` -> planned stub response.
- First divergence for future send readiness: service returns a planned stub and does not yet invoke Guard/repository. Fix status: not attempted.
- Anti-monolith verdict for this audit: OK. No application layer was changed; documentation-only output stayed in allowed audit/handoff files.

Tests executed:
- `docker compose config` passed. Docker emitted warnings that `C:\Users\Jacopo\.docker\config.json` was access-denied, but Compose rendered a valid config.
- `git diff --check` passed.

Tests not executed:
- `PYTHONPATH=backend pytest backend/tests` did not run because `pytest` is not available in PATH.
- `python -m pytest backend/tests` did not run because `python` is not available in PATH.
- Python syntax check with `python -m compileall backend/app backend/tests` did not run because `python` is not available in PATH.
- `bash scripts/audit.sh` did not run in sandbox because Bash returned `Access is denied`; escalated retry reached WSL but failed because `/bin/bash` is unavailable.
- `bash scripts/smoke_test.sh` did not run in sandbox because Bash returned `Access is denied`; escalated retry reached WSL but failed because `/bin/bash` is unavailable.

Contract change request:
- None. No API, DB, frontend, Docker, dependency, or schema change is required for this audit-only finding set.

Files modified:
- `docs/audit_log.md`
- `docs/branch_handoffs/state_management_stub_audit.md`

Recommendation:
- Next micro-task: implement a backend-only authorization audit/Guard integration slice for `POST /campaigns/{campaign_id}/authorize`, proving that paused/blocked/completed/failed campaigns and unsubscribed/blacklisted/bounced/suppressed contacts are blocked before any real send path is introduced.

## Blocked Authorization Attempts Audit

Date: 2026-05-05
Branch: `feature/backend-core`
Task type: `backend_audit`
Implementation depth: audit-only

Skills applied:
- `docs/codex_prompt_engine_v1.md`
- Requested underscore skill paths were not present; applied repository equivalents:
  - `docs/codex_skills/validate-state-and-persistence.md`
  - `docs/codex_skills/audit-runtime-flow.md`
  - `docs/codex_skills/extract-root-cause.md`
  - `docs/codex_skills/check-anti-monolith.md`
  - `docs/codex_skills/run-regression-guard.md`
- Applied local audit skill runtime-flow reference.

Audit summary:
- Source of truth checked: `docs/states_v1.md`, `docs/api_contracts_v1.md`, `docs/data_model_v1.md`, `docs/architecture_v1.md`.
- `project_handoff_v1.md` is referenced by V1 docs but is not present in this checkout.
- `POST /campaigns/{campaign_id}/authorize` currently routes through `CampaignsService.authorize_campaign()`.
- `CampaignsService.authorize_campaign()` reads the campaign from `CampaignsRepository.get_campaign()` and calls `DeliverabilityGuard.authorize_campaign_state()` when the campaign exists.
- The current authorize response shape is `{"status": <decision>, "endpoint": <endpoint>}` for found campaigns, or `{"status": "stub", "endpoint": <endpoint>}` when the campaign is missing.
- The current response does not include the Guard reason, even though `GuardResult` carries one and `docs/api_contracts_v1.md` says authorize output is `SendDecision` and reasons.
- `blocked_sends` currently has a schema and in-memory repository list stub only; no append/create method exists.
- No logging, persistence, DB, endpoint, response shape, listmonk, email sending, auth/RBAC, tests, or application code changes were made.

Flow attuale authorize to Guard:
- FastAPI router: `backend/app/api/campaigns.py` delegates `POST /campaigns/{campaign_id}/authorize` to `CampaignsService.authorize_campaign(campaign_id)`.
- Service: `backend/app/services/campaigns.py` builds the endpoint string, calls `CampaignsRepository.get_campaign(campaign_id)`, returns the planned stub shape if missing, otherwise sends `campaign.status` to `DeliverabilityGuard.authorize_campaign_state()`.
- Guard: `backend/app/guard/deliverability_guard.py` authorizes `ready` and `running`; blocks all other campaign statuses with reason `Campaign state <status> cannot send.`
- Response: service returns only `status` and `endpoint`; it discards `GuardResult.reason`.
- Current flow does not call `BlockedSendsService` or `BlockedSendsRepository`.

Stato attuale blocked_sends boundary:
- Schema: `backend/app/schemas/blocked_sends.py` defines `id`, `client_id`, nullable `campaign_id`, nullable `contact_id`, `reason`, `decision`, and `created_at`.
- Data model contract: `docs/data_model_v1.md` defines `blocked_sends` as records of blocked authorization/send attempts and reasons; every blocked send must include a readable reason.
- DB stub: `db/init.sql` has `blocked_sends` with `reason TEXT NOT NULL`, `decision TEXT NOT NULL DEFAULT 'blocked'`, and nullable campaign/contact foreign keys.
- Repository: `backend/app/repositories/blocked_sends.py` owns one fake in-memory `BlockedSend` record for UI contract testing.
- Repository support: current repository supports `list_blocked_sends(client_id: str | None = None)` only. No append/create/add method exists.
- Service: `backend/app/services/blocked_sends.py` exposes current-client list plus planned admin stubs only.

Decisione: logging in-memory possibile si/no:
- Decision: No for the next micro-task unless an approved behavior change explicitly allows mutable in-memory audit records.
- Severity: medium
- File: `backend/app/repositories/blocked_sends.py`, `backend/app/services/campaigns.py`
- Risk: adding mutable in-memory logging would change observable behavior of `GET /client/blocked-sends` in the same process and would introduce a real write path despite the current task forbidding logging/persistence changes.
- Suggested next micro-task: add an approved backend-only micro-task to introduce a service-owned blocked authorization audit method and repository append/create contract, with tests proving response shape remains unchanged unless a contract change is approved.

Problemi trovati:
- Issue/decision: Authorize discards `GuardResult.reason`.
  Severity: medium
  File: `backend/app/services/campaigns.py`
  Risk: blocked authorization decisions are no longer explainable at the API response or blocked_sends boundary, despite the Guard producing a readable reason and the V1 contract mentioning reasons.
  Suggested next micro-task: decide whether the reason should be logged internally only or exposed in authorize response; if exposed, raise a contract change request before changing response shape.
- Issue/decision: `blocked_sends` repository has list-only behavior.
  Severity: medium
  File: `backend/app/repositories/blocked_sends.py`
  Risk: there is no minimal persistence boundary where `CampaignsService` can append a blocked authorization attempt without adding new repository behavior.
  Suggested next micro-task: add a narrowly scoped `create`/`append` method to `BlockedSendsRepository` only in an approved implementation task.
- Issue/decision: No current coupling from authorize flow to blocked_sends boundary.
  Severity: medium
  File: `backend/app/services/campaigns.py`, `backend/app/services/blocked_sends.py`
  Risk: blocked campaign-state decisions are returned to the caller but not represented in the audit list, so `GET /client/blocked-sends` remains static and cannot explain actual authorize attempts.
  Suggested next micro-task: inject or otherwise coordinate a `BlockedSendsService` call from `CampaignsService` after blocked Guard decisions, preserving router and repository boundaries.
- Issue/decision: Current blocked_sends fixture references `campaign_acme_reactivation`, which is not in current campaign repository fixtures.
  Severity: low
  File: `backend/app/repositories/blocked_sends.py`, `backend/app/repositories/campaigns.py`
  Risk: the UI contract fixture is readable but cannot be traced to an existing in-memory campaign during runtime-flow audits.
  Suggested next micro-task: align fixtures only when blocked_sends records become behaviorally tied to campaign authorization.
- Issue/decision: Existing test intentionally preserves response keys as `status` and `endpoint` only.
  Severity: low
  File: `backend/tests/test_campaign_authorize_guard.py`
  Risk: exposing `reason` would intentionally break current regression expectations and therefore requires explicit contract/test update.
  Suggested next micro-task: keep response shape unchanged for internal logging work; open CONTRACT CHANGE REQUEST if the product needs `reason` in authorize response.

CONTRACT CHANGE REQUEST:
- Not required for internal logging if the authorize response remains unchanged and no DB schema change is introduced.
- Required if `POST /campaigns/{campaign_id}/authorize` starts exposing `reason` in the response, because current implementation/tests preserve `{"status", "endpoint"}` while `docs/api_contracts_v1.md` only states high-level `SendDecision` and reasons without a concrete implemented shape.
- Not required for a future in-memory append/create repository method if it remains internal and preserves current API response shape.

Root cause extraction:
- Symptom: blocked authorize attempts are not recorded in `blocked_sends`.
- Expected contract: blocked authorization/send attempts and reasons belong to the `blocked_sends` boundary.
- First divergence: `CampaignsService.authorize_campaign()` receives a blocked Guard decision but returns immediately without passing the decision/reason to a blocked_sends service/repository boundary.
- Primary root cause: missing write/append capability and orchestration between campaign authorization service and blocked_sends boundary.
- Category: backend service plus repository/query.
- Minimal fix boundary: backend service/repository only, without router response changes unless contract-approved.
- Confidence: high from static inspection and direct import/check.

Anti-monolith verdict:
- Verdict: OK for audit-only. No application layer was changed.
- Touched layers during future implementation should remain backend service plus backend repository only.
- Forbidden flows found: none in current code; future logging must not move Guard decisions into router, frontend, DB triggers, listmonk, or scripts.

Tests executed:
- `docker compose config`: passed; Docker emitted access warnings for `C:\Users\Jacopo\.docker\config.json`.
- `git diff --check`: passed.
- Read-only Python AST syntax check with bundled Python passed for 42 backend app/test Python files.
- Direct import/check with bundled Python passed for `CampaignsService`, `DeliverabilityGuard`, `CampaignsRepository`, and `BlockedSendsRepository`.

Tests not executed:
- `PYTHONPATH=backend pytest backend/tests`: `pytest` is not available in PATH.
- Bundled Python `-m pytest backend/tests`: bundled Python has no `pytest` module.
- `bash scripts/audit.sh`: sandbox returned `Access is denied`; escalated retry reached WSL but failed because `/bin/bash` is unavailable.
- `bash scripts/smoke_test.sh`: sandbox returned `Access is denied`; escalated retry reached WSL but failed because `/bin/bash` is unavailable.

Files modified:
- `docs/audit_log.md`
- `docs/branch_handoffs/blocked_authorization_attempts_audit.md`

Recommendation:
- Next micro-task: implement an approved backend-only internal logging slice for blocked authorize decisions, adding a minimal blocked_sends append/create boundary and keeping `POST /campaigns/{campaign_id}/authorize` response shape unchanged unless a contract change request is accepted.

## Contact State Backend Audit

Date: 2026-05-05
Branch: `feature/backend-core`
Task type: `backend_audit`
Implementation depth: audit-only

Skills applied:
- `docs/codex_prompt_engine_v1.md`
- Requested underscore skill paths were not present; applied repository equivalents:
  - `docs/codex_skills/validate-state-and-persistence.md`
  - `docs/codex_skills/audit-runtime-flow.md`
  - `docs/codex_skills/check-anti-monolith.md`
  - `docs/codex_skills/run-regression-guard.md`

Audit summary:
- Source of truth checked: `docs/states_v1.md`, `docs/data_model_v1.md`, `docs/api_contracts_v1.md`, `docs/architecture_v1.md`.
- `project_handoff_v1.md` is referenced by the V1 docs but is not present in this checkout.
- Contacts has a FastAPI router and Pydantic schema, but no service/repository boundary.
- Contacts endpoints are endpoint-only stubs and do not read, return, or mutate contact rows.
- Contact state enum contains all contractual states.
- No backend application contact fixture data was found.
- `campaign_contacts` exists in docs and `db/init.sql`, but not as a backend schema/repository/service/API boundary.
- Campaign authorize currently evaluates campaign state only. It does not evaluate contact state, campaign_contacts, suppression records, or target contact sendability.
- No code, tests, DB schema, Docker, frontend, templates, README, Makefile, or env files were changed.

Contact states contrattuali:
- Contractual states: `pending`, `sendable`, `suppressed`, `bounced`, `unsubscribed`, `blacklisted`, `error`.
- Blocking states for future sending: `suppressed`, `bounced`, `unsubscribed`, `blacklisted`, and `error`.
- `pending` is not authorizable by default because `docs/states_v1.md` says it cannot send until validated.
- `sendable` is the only normal contact-sendable state, but still requires campaign/client/send checks.

Stato attuale contacts backend:
- `backend/app/schemas/contacts.py` defines `Contact`.
- `backend/app/schemas/common.py` defines `ContactStatus` with all contractual contact states.
- `backend/app/api/contacts.py` defines `POST /contacts/import`, `GET /contacts`, and `POST /contacts/{contact_id}/suppress`.
- No `backend/app/services/contacts.py` was found.
- No `backend/app/repositories/contacts.py` was found.
- No stub contact data rows were found in `backend/app`.

Gap rispetto a Guard/sendability:
- `backend/app/services/campaigns.py` calls `DeliverabilityGuard.authorize_campaign_state(campaign.status)` only.
- `backend/app/guard/deliverability_guard.py` contains `can_send_to_contact()`, but it is a placeholder and is not called by the current authorize flow.
- Blocked authorize logging currently uses `contact_id=None`, so it does not represent per-contact sendability decisions.
- First divergence: campaign authorization can return `authorized` for a ready/running campaign without checking contact state.
- Fix status: not attempted.

Problemi trovati:
- Issue/decision: Contacts endpoints are endpoint-only stubs with no contact service/repository boundary.
  Severity: medium
  File: `backend/app/api/contacts.py`
  Risk: suppression/import/list responses do not prove persisted contact state, `client_id` scoped reads, or future send blocking.
  Suggested next micro-task: add an approved backend-only contacts service/repository boundary audit/implementation slice before implementing suppression behavior.
- Issue/decision: Contact schema exists, but there is no backend contact read/write path.
  Severity: medium
  File: `backend/app/schemas/contacts.py`
  Risk: contractual states are typed but not backed by runtime retrieval, persistence, or scoped queries.
  Suggested next micro-task: implement a minimal contacts repository contract with `client_id` scoped list/read operations in an approved implementation task.
- Issue/decision: Campaign authorize does not evaluate contact state.
  Severity: high
  File: `backend/app/services/campaigns.py`
  Risk: authorization can return `authorized` without checking whether target contacts are suppressed, bounced, unsubscribed, blacklisted, pending, or error.
  Suggested next micro-task: wire campaign authorize through a contact sendability audit path before any real send path or batch authorization is introduced.
- Issue/decision: `DeliverabilityGuard.can_send_to_contact()` is not integrated into authorize.
  Severity: medium
  File: `backend/app/guard/deliverability_guard.py`
  Risk: contact blocking policy is not enforced by runtime flow.
  Suggested next micro-task: define the smallest Guard input contract for contact status checks and call it from a service-owned authorize flow.
- Issue/decision: `campaign_contacts` exists only in DB/docs, not backend application boundaries.
  Severity: medium
  File: `db/init.sql`
  Risk: backend cannot prove campaign/contact/client consistency or per-campaign contact inclusion before authorization.
  Suggested next micro-task: define a minimal backend `campaign_contacts` repository/service contract after contacts boundary exists.
- Issue/decision: `pending` must not be considered authorizable by default.
  Severity: medium
  File: `docs/states_v1.md`
  Risk: DB defaults contacts and campaign_contacts to `pending`; treating pending as sendable would bypass validation.
  Suggested next micro-task: explicitly encode `pending` as blocked in future Guard contact-state tests and implementation.
- Issue/decision: `sendable` is authorizable only after campaign/client/send checks also pass.
  Severity: low
  File: `docs/states_v1.md`
  Risk: future implementation might treat contact `sendable` as sufficient by itself, bypassing campaign/client state and fail-closed checks.
  Suggested next micro-task: implement Guard decisions as combined client + campaign + contact + environment checks.

CONTRACT CHANGE REQUEST:
- Required if future API responses for `POST /campaigns/{campaign_id}/authorize` expose per-contact reasons or contact state details beyond the current implemented shape.
- Required if `pending` or `error` should become authorizable under any context.
- Required if DB schema changes are needed for batch authorization/contact targeting beyond the existing `campaign_contacts` stub.

Tests executed:
- `docker compose config`: passed. Docker emitted access warnings for `C:\Users\Jacop\.docker\config.json`.
- `git diff --check`: passed, with CRLF warning for `docs/audit_log.md`.
- Python AST syntax check: passed for 42 Python files under `backend`.

Tests not executed:
- `PYTHONPATH=backend pytest backend/tests`: not executed because `pytest` is not available in PATH.
- `PYTHONPATH=backend python -m pytest backend/tests`: not executed because the local Python environment has no `pytest` module.
- Direct backend import/check: not completed because the local Python environment has no `pydantic` module.
- `bash scripts/audit.sh`: sandbox run failed with WSL access denied; escalated retry reached WSL but failed because `/bin/bash` is unavailable.
- `bash scripts/smoke_test.sh`: sandbox run failed with WSL access denied; escalated retry reached WSL but failed because `/bin/bash` is unavailable.

Files modified:
- `docs/audit_log.md`
- `docs/branch_handoffs/contact_state_backend_audit.md`

Recommendation:
- Next micro-task: implement an approved backend-only contact sendability authorization slice that introduces the minimal contacts repository/service boundary and integrates `DeliverabilityGuard.can_send_to_contact()` into campaign authorization, while preserving current API response shape unless a contract change request is accepted.

## Contacts Service Repository Boundary

Date: 2026-05-05
Branch: `feature/backend-core`
Task type: `backend_feature`
Implementation depth: `shallow_service_repository_boundary`

Skills applied:
- `docs/codex_prompt_engine_v1.md`
- `docs/codex_skills/check-anti-monolith.md`
- `docs/codex_skills/run-regression-guard.md`

Scope:
- Created the minimal contacts router -> service -> repository boundary.
- Preserved existing contacts endpoint paths, status codes, and response shapes.
- Added in-memory contact stub data with explicit `client_id` and all contractual contact statuses.
- Did not integrate contact sendability into the Deliverability Guard.

Files created:
- `backend/app/repositories/contacts.py`
- `backend/app/services/contacts.py`
- `backend/tests/test_contacts_boundary.py`

Files modified:
- `backend/app/api/contacts.py`
- `docs/audit_log.md`

Boundary confirmation:
- Router remains HTTP-only and delegates contacts endpoints to `ContactsService`.
- Service exposes contact stub use cases and calls `ContactsRepository`.
- Repository owns in-memory contact stub rows only and filters by explicit `client_id`.

Contact states present:
- `sendable`
- `suppressed`
- `bounced`
- `unsubscribed`
- `blacklisted`
- `pending`
- `error`

Tests added:
- Contacts service/repository importability.
- Contacts repository `client_id` filtering.
- Contacts stub status coverage.

Tests executed:
- `git diff --check` passed, with CRLF warnings for `backend/app/api/contacts.py` and `docs/audit_log.md`.
- In-memory Python syntax check passed for changed contacts API, service, repository, and test files.
- Direct contacts service/repository import and contract check passed with the bundled Python runtime.
- `docker compose config` passed, with Docker config access warnings for `C:\Users\Jacop\.docker\config.json`.

Tests not executed and reason:
- `python -m pytest backend/tests` did not run because local Python has no `pytest` module.
- Bundled Python `-m pytest backend/tests` did not run because the bundled runtime has no `pytest` module.
- Direct local import check with shell Python did not run because local Python has no `pydantic` module; the bundled Python import check passed.
- `bash scripts/audit.sh` did not run because WSL Bash is unavailable: `/bin/bash` was not found after escalated retry.
- `bash scripts/smoke_test.sh` did not run because WSL Bash is unavailable: `/bin/bash` was not found after escalated retry.
- Docker container import/pytest checks did not run because the backend service is not running.

Invariant confirmation:
- No contacts API response shape change.
- No email sending introduced.
- No real DB, schema, listmonk, auth/RBAC, AI generation, campaign_contacts, or Guard integration introduced.
- `client_id` is explicit in contact stub data.

Next micro-task:
- Add an approved backend-only contact sendability authorization slice that wires contact status evaluation into campaign authorization without changing response shape unless a contract change is approved.
