# Deliverability Guard V1 Hardening Final Audit Handoff

Date: 2026-05-05
Branch: `feature/backend-core`
Task type: `backend_audit`
Implementation depth: `audit_only`

## 1. Audit Summary

Post-fix audit confirms Milestone 4 Guard V1 hardening is wired for the current approved backend stub scope.

Verified runtime path:

`POST /campaigns/{campaign_id}/authorize` -> router delegates to `CampaignsService` -> campaign repository read -> env fail-closed Guard -> client lookup by `campaign.client_id` -> client lifecycle Guard -> campaign state Guard -> campaign contact lookup by `campaign.id` and `campaign.client_id` -> empty target Guard -> contact sendability Guard -> blocked send logging for blocked decisions.

No application code, tests, frontend, DB, templates, Docker/env, Makefile, README, dependencies, or schema were changed by this audit.

## 2. Validazione Controlli Guard

- `EMAIL_SENDING_ENABLED` fail-closed: OK. Missing or non-`true` values block before client lifecycle and log the loaded campaign's `client_id`.
- Client lifecycle guard: OK. Non-`active` client states block, and the lookup is scoped to `campaign.client_id`.
- Campaign state guard: OK. `ready` and `running` authorize; `draft`, `paused`, `blocked`, `completed`, and `failed` block before contact lookup.
- Empty target guard: OK for the current stub boundary. Empty associated contact lists block with reason `no_campaign_contacts`.
- Contact sendability guard: OK. Only `sendable` authorizes; `pending`, `suppressed`, `bounced`, `unsubscribed`, `blacklisted`, and `error` block.
- Multi-client isolation in authorize path: OK for Milestone 4 stub scope. Campaign lifecycle, target lookup, and blocked logging use `campaign.client_id`; contacts repository filters by campaign association and `client_id`.

## 3. Validazione Lifecycle Scoped A `campaign.client_id`

Evidence:
- `backend/app/services/campaigns.py` reads the campaign first, then calls `self.clients_service.get_client(campaign.client_id)`.
- Contact target lookup uses `self.contacts_service.list_campaign_contacts(campaign_id=campaign.id, client_id=campaign.client_id)`.
- Blocked env/client/campaign/empty-target/contact decisions log `client_id=campaign.client_id`.
- Regression test `test_authorize_checks_lifecycle_for_campaign_client_id` verifies the lifecycle lookup receives the campaign client id.
- Regression test `test_paused_blocked_archived_campaign_client_blocks_when_current_is_active` verifies the campaign client's lifecycle state blocks even when the current mock client context is active.

Residual note:
- `CampaignsRepository.get_campaign()` remains an unscoped in-memory lookup by `campaign_id`. This is acceptable for the current stubbed router surface, but must become caller/client-scoped before real tenant data is exposed.

## 4. Logging Validation

- Env block logging: OK. Logs `client_id`, `campaign_id`, `contact_id=None`, `reason`, `decision`, and `created_at`.
- Client lifecycle block logging: OK. Logs under `campaign.client_id`.
- Campaign state block logging: OK. `contact_id=None`.
- Empty target block logging: OK. `contact_id=None`.
- Contact sendability block logging: OK. Passes `contact_id=contact.id` when applicable.
- Repository stub: OK. `BlockedSendsRepository.append_blocked_send()` remains the persistence boundary and stores in-memory records only.

## 5. API Invariants

- `POST /campaigns/{campaign_id}/authorize` response remains exactly `status` plus `endpoint`.
- No public `reason`, per-contact detail, structured reason code, or empty-target semantic was exposed.
- Router remains HTTP-only and delegates to `CampaignsService`.
- Service orchestration remains separated from repository reads and Guard decisions.
- listmonk remains engine-only and is not involved in authorization.
- Business PostgreSQL remains the contractual source of truth, while this milestone path still uses repository-owned in-memory stubs.

## 6. Problemi Trovati

Issue: Usage limits are not integrated.
Severity: medium
File: `backend/app/services/campaigns.py`, `backend/app/services/usage.py`
Rischio: Authorization can succeed without quota/usage policy checks when limits become meaningful.
Suggested next micro-task: Add a tiny usage-limit guard boundary after env/client checks and before campaign/contact checks, preserving public response shape.

Issue: Real suppression lookup is not integrated.
Severity: medium
File: `backend/app/services/contacts.py`, `backend/app/guard/deliverability_guard.py`
Rischio: `ContactStatus.suppressed` blocks, but persisted `suppression_list` records are not independently checked.
Suggested next micro-task: Add a backend-owned suppression lookup and feed the result into Guard without exposing reasons publicly.

Issue: `campaign_contacts` remains an in-memory stub.
Severity: low
File: `backend/app/repositories/contacts.py`
Rischio: Current checks prove ordering and `client_id` filtering in memory, but not DB-backed relationship integrity.
Suggested next micro-task: In an approved persistence task, replace the in-memory association with a minimal DB-backed `campaign_contacts` repository contract.

Issue: Real auth/RBAC is not present.
Severity: low
File: `backend/app/core/security.py`
Rischio: Placeholder API-key security does not distinguish admin/client roles or tenant context in production terms.
Suggested next micro-task: Keep as a documented gap until the approved auth milestone; do not expose real tenant data before role/client context exists.

Issue: Reason codes are readable strings only.
Severity: low
File: `backend/app/guard/deliverability_guard.py`, `backend/app/services/blocked_sends.py`
Rischio: Logs are human-readable but brittle for dashboards, filters, localization, analytics, and future regression assertions.
Suggested next micro-task: Add internal structured reason codes alongside readable reasons; create a contract change request first if this changes public API or DB schema.

Issue: Missing campaign client still falls back to planned stub response.
Severity: low
File: `backend/app/services/campaigns.py`
Rischio: A campaign whose `client_id` has no matching client record returns the generic planned stub shape instead of an explicit blocked/not-found policy decision.
Suggested next micro-task: Define the future policy for missing campaign clients and implement it without changing the public response shape unless approved.

## 7. Test Eseguiti

- `PYTHONPATH=backend python -m pytest backend/tests`: attempted locally; failed because local Python has no `pytest`.
- `docker compose run --rm -v "<repo>\\backend\\app:/app/app:ro" -v "<repo>\\backend\\tests:/app/tests:ro" backend python -m pytest /app/tests`: passed, 38 tests.
- `scripts/audit.sh`: initial sandbox Git Bash run failed with Win32 error 5; escalated Git Bash retry passed.
- `scripts/smoke_test.sh`: passed via Git Bash.
- `docker compose config`: passed; Docker emitted access warnings for `C:\Users\Jacop\.docker\config.json`.
- `git diff --check`: passed.
- `docker compose down`: executed after containerized pytest to stop/remove Compose services started by the audit.

## 8. Test Non Eseguiti

- Local host pytest suite did not run successfully because `pytest` is not installed in the active local Python.
- No frontend lint/build was run because this was backend audit-only and no frontend files changed.
- No DB migration/schema test was run because schema changes are out of scope.

## 9. File Modificati

- `docs/audit_log.md`
- `docs/branch_handoffs/deliverability_guard_v1_perimeter_audit.md`

## 10. Raccomandazione

Milestone 4 can be closed for the current approved stub scope.

No high-severity Guard V1 issue remains after the campaign-client-scoped lifecycle fix. Remaining items are non-blocking future-policy, persistence, and auth gaps:
- usage limits not integrated
- real suppression lookup not integrated
- `campaign_contacts` stub
- auth/RBAC absent
- reason codes not structured
- missing campaign client policy still future-defined
