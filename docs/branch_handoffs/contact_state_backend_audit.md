# Contact State Backend Audit

Date: 2026-05-05
Branch: `feature/backend-core`
Task type: `backend_audit`
Implementation depth: audit-only

## 1. Audit Summary

Read-only audit completed for contacts and contact state. No application code, tests, DB schema, Docker, frontend, templates, README, Makefile, or env files were changed.

Applied skills:
- `docs/codex_prompt_engine_v1.md`
- Requested underscore skill paths were not present; applied repository equivalents:
  - `docs/codex_skills/validate-state-and-persistence.md`
  - `docs/codex_skills/audit-runtime-flow.md`
  - `docs/codex_skills/check-anti-monolith.md`
  - `docs/codex_skills/run-regression-guard.md`

Source of truth checked:
- `docs/states_v1.md`
- `docs/data_model_v1.md`
- `docs/api_contracts_v1.md`
- `docs/architecture_v1.md`
- `project_handoff_v1.md` was not present in this checkout.

Flow audited:
- Contacts API: `FastAPI router -> endpoint-only stub response`.
- Campaign authorize: `FastAPI router -> CampaignsService -> CampaignsRepository -> DeliverabilityGuard.authorize_campaign_state() -> optional BlockedSendsService logging`.

Anti-monolith verdict:
- Verdict: OK for audit-only.
- Touched layers: docs only.
- Boundary risk for future work: contact sendability must stay in backend service/Guard, with repository as persistence boundary. Router, frontend, listmonk adapter, scripts, and DB triggers must not decide sendability.

## 2. Contact States Contrattuali

Contractual contact states from `docs/states_v1.md` and `docs/data_model_v1.md`:
- `pending`
- `sendable`
- `suppressed`
- `bounced`
- `unsubscribed`
- `blacklisted`
- `error`

Contractual transitions:
- `pending -> sendable`
- `pending -> error`
- `sendable -> suppressed`
- `sendable -> bounced`
- `sendable -> unsubscribed`
- `sendable -> blacklisted`
- `error -> pending`

Sendability decision:
- `sendable` is the only normal sendable state.
- `suppressed`, `bounced`, `unsubscribed`, and `blacklisted` must block sending.
- `pending` cannot send until validated, so it must not be treated as authorizable by default.
- `error` cannot send until resolved, so it must block unless a future contract explicitly changes that.

Contract note:
- `docs/states_v1.md` Send Authorization explicitly names `unsubscribed`, `blacklisted`, `bounced`, and `suppressed` as blocking states. Its Contact Sendability section also says `pending` and `error` cannot send. Future Guard work should apply both sections together.

## 3. Stato Attuale Contacts Backend

Existing Pydantic schema:
- `backend/app/schemas/contacts.py` defines `Contact` with `id`, `client_id`, `email`, `status`, `created_at`, and `updated_at`.
- `backend/app/schemas/common.py` defines `ContactStatus` with all contractual contact states.

Existing contacts endpoints:
- `backend/app/api/contacts.py` defines `POST /contacts/import`, `GET /contacts`, and `POST /contacts/{contact_id}/suppress`.
- All three endpoints return `{"status": "stub", "endpoint": ...}` and do not read or mutate contact data.

Router/service/repository boundary:
- Contacts currently has a router and Pydantic schema.
- No `backend/app/services/contacts.py` was found.
- No `backend/app/repositories/contacts.py` was found.
- Therefore contacts does not yet have a router -> service -> repository boundary.

Stub contact data:
- No in-memory contact fixture list was found in `backend/app`.
- Contacts endpoints do not return contact rows or state fixtures.
- `db/init.sql` defines `contacts.status TEXT NOT NULL DEFAULT 'pending'`, but this is DB schema stub only, not backend application data.

`campaign_contacts`:
- Present in `docs/data_model_v1.md` and `db/init.sql`.
- Not found as a backend Pydantic schema, repository, service, router, or runtime model in `backend/app`.
- Current backend application therefore has no `campaign_contacts` boundary.

## 4. Gap Rispetto A Guard/sendability

Current campaign authorize behavior:
- `backend/app/api/campaigns.py` delegates `POST /campaigns/{campaign_id}/authorize` to `CampaignsService.authorize_campaign(campaign_id)`.
- `backend/app/services/campaigns.py` loads only a campaign via `CampaignsRepository.get_campaign(campaign_id)`.
- It calls `DeliverabilityGuard.authorize_campaign_state(campaign.status)`.
- If blocked, it logs a blocked authorization attempt through `BlockedSendsService.log_blocked_authorization(...)` with `contact_id=None`.
- It does not load contacts, `campaign_contacts`, suppression records, or contact state.

Current Guard behavior:
- `backend/app/guard/deliverability_guard.py` authorizes campaign statuses `ready` and `running`.
- It blocks other campaign states.
- `can_send_to_contact()` exists but always returns blocked with reason `Contact sendability checks are not implemented in Milestone 0.`
- No current authorize flow calls `can_send_to_contact()`.

First divergence point:
- Expected contract: send authorization must consider client, campaign, and contact sendability states before sending.
- Observed behavior: current `CampaignsService.authorize_campaign()` stops after campaign-state authorization and does not evaluate contact state.
- Fix status: not attempted.

## 5. Problemi Trovati

Issue/decision: Contacts endpoints are endpoint-only stubs with no contact service/repository boundary.
Severity: medium
File: `backend/app/api/contacts.py`
Rischio: `POST /contacts/{contact_id}/suppress` can return a stub success shape without proving persisted suppression, client scope, or future send blocking.
Suggested next micro-task: add an approved backend-only contacts service/repository boundary audit/implementation slice before implementing suppression behavior.

Issue/decision: Contact schema exists, but there is no backend contact read/write path.
Severity: medium
File: `backend/app/schemas/contacts.py`
Rischio: contractual states are typed but not backed by runtime retrieval, persistence, or `client_id` scoped queries.
Suggested next micro-task: implement a minimal contacts repository contract with `client_id` scoped list/read operations in an approved implementation task.

Issue/decision: Campaign authorize does not evaluate contact state.
Severity: high
File: `backend/app/services/campaigns.py`
Rischio: an authorization can return `authorized` for a `ready` or `running` campaign without checking whether target contacts are `suppressed`, `bounced`, `unsubscribed`, `blacklisted`, `pending`, or `error`.
Suggested next micro-task: wire campaign authorize through a contact sendability audit path before any real send path or batch authorization is introduced.

Issue/decision: `DeliverabilityGuard.can_send_to_contact()` is not integrated into authorize.
Severity: medium
File: `backend/app/guard/deliverability_guard.py`
Rischio: the Guard has a placeholder contact method, but no runtime flow calls it, so contact blocking policy is not enforced.
Suggested next micro-task: define the smallest Guard input contract for contact status checks and call it from a service-owned authorize flow.

Issue/decision: `campaign_contacts` exists only in DB/docs, not backend application boundaries.
Severity: medium
File: `db/init.sql`
Rischio: backend cannot prove campaign/contact/client consistency or per-campaign contact inclusion before authorization.
Suggested next micro-task: define a minimal backend `campaign_contacts` repository/service contract after contacts boundary exists.

Issue/decision: `pending` must not be considered authorizable by default.
Severity: medium
File: `docs/states_v1.md`
Rischio: DB defaults contacts and campaign_contacts to `pending`; treating pending as sendable would bypass validation and contradict Contact Sendability rules.
Suggested next micro-task: explicitly encode `pending` as blocked in future Guard contact-state tests and implementation.

Issue/decision: `sendable` is authorizable only after campaign/client/send checks also pass.
Severity: low
File: `docs/states_v1.md`
Rischio: future implementation might treat contact `sendable` as sufficient by itself, bypassing campaign/client state and `EMAIL_SENDING_ENABLED` fail-closed checks.
Suggested next micro-task: implement Guard decisions as combined client + campaign + contact + environment checks, not a contact-only shortcut.

CONTRACT CHANGE REQUEST:
- Required if future API responses for `POST /campaigns/{campaign_id}/authorize` expose per-contact reasons or contact state details beyond the current implemented shape.
- Required if `pending` or `error` should become authorizable under any context, because current `docs/states_v1.md` says neither can send until validated/resolved.
- Required if DB schema changes are needed for batch authorization/contact targeting beyond the existing `campaign_contacts` stub.

## 6. Test Eseguiti

- `docker compose config`: passed. Docker emitted access warnings for `C:\Users\Jacop\.docker\config.json`.
- `git diff --check`: passed, with CRLF warning for `docs/audit_log.md`.
- Python AST syntax check: passed for 42 Python files under `backend`.

## 7. Test Non Eseguiti

- `PYTHONPATH=backend pytest backend/tests`: not executed because `pytest` is not available in PATH.
- `PYTHONPATH=backend python -m pytest backend/tests`: not executed because the local Python environment has no `pytest` module.
- Direct backend import/check: not completed because the local Python environment has no `pydantic` module.
- `bash scripts/audit.sh`: sandbox run failed with WSL access denied; escalated retry reached WSL but failed because `/bin/bash` is unavailable.
- `bash scripts/smoke_test.sh`: sandbox run failed with WSL access denied; escalated retry reached WSL but failed because `/bin/bash` is unavailable.

## 8. File Modificati

- `docs/audit_log.md`
- `docs/branch_handoffs/contact_state_backend_audit.md`

## 9. Prossimo Micro-task Consigliato

Next micro-task: implement an approved backend-only contact sendability authorization slice that introduces the minimal contacts repository/service boundary and integrates `DeliverabilityGuard.can_send_to_contact()` into campaign authorization, while preserving current API response shape unless a contract change request is accepted.
