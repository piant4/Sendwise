# State Management Stub Audit Handoff

Date: 2026-05-05
Branch: `feature/backend-core`
Mode: audit-only

## 1. Audit Summary

The V1 contract state vocabulary is present in backend schemas, and the current runtime data stubs use only contractual values. No application code was changed.

Current implementation is still planned-stub level for lifecycle transitions. Pause/resume/block/archive/suppress endpoints do not mutate state. Core authorize/send endpoints return planned stub payloads and do not yet call `DeliverabilityGuard`; no real send path exists today, and the Guard remains fail-closed if called.

`project_handoff_v1.md` is referenced by the V1 docs but is not present in this checkout.

## 2. Stati Contrattuali Rilevati

Campaign states: `draft`, `ready`, `running`, `paused`, `blocked`, `completed`, `failed`.

Campaign transitions: `draft -> ready -> running -> completed`, `ready -> paused -> ready`, `running -> paused -> running`, `draft -> blocked`, `ready -> blocked`, `running -> blocked`, `running -> failed`, `paused -> blocked`.

Contact states: `pending`, `sendable`, `suppressed`, `bounced`, `unsubscribed`, `blacklisted`, `error`.

Contact transitions: `pending -> sendable`, `pending -> error`, `sendable -> suppressed`, `sendable -> bounced`, `sendable -> unsubscribed`, `sendable -> blacklisted`, `error -> pending`.

## 3. Stati Presenti Negli Stub

Backend enum campaign/contact: all contractual states are present in `backend/app/schemas/common.py`.

Campaign data stubs: `ready` and `draft` in `backend/app/repositories/campaigns.py` and `backend/app/repositories/clients.py`.

Frontend mock campaign data: `ready` and `draft` in `frontend/lib/mock-api.ts`.

DB stub defaults: campaigns `draft`, contacts `pending`, campaign_contacts `pending` in `db/init.sql`.

No non-contractual campaign/contact states were found in inspected backend, frontend, or DB stubs.

Campaign `archived` was specifically checked because it appears in the prompt risk list; it is not a campaign state in V1 contracts and was not found in campaign stubs.

Missing from current campaign list fixtures: `running`, `paused`, `blocked`, `completed`, `failed`.

Missing from current backend data-returning contact stubs: all contact states, because contact endpoints return endpoint-only stub payloads.

## 4. Transizioni Gia Presenti O Assenti

Present only as planned endpoints:
- `POST /admin/clients/{client_id}/pause`
- `POST /admin/clients/{client_id}/resume`
- `POST /admin/clients/{client_id}/block`
- `POST /admin/clients/{client_id}/archive`
- `POST /admin/campaigns/{campaign_id}/pause`
- `POST /admin/campaigns/{campaign_id}/resume`
- `POST /contacts/{contact_id}/suppress`

Real persisted state transitions: none found.

Send authorization state checks: absent from current `CampaignsService`; placeholder Guard does not inspect concrete client/campaign/contact records yet.

`campaign_contacts`: present in `db/init.sql`; no backend schema/repository/service/API equivalent found.

## 5. Problemi Trovati

Issue: Campaign lifecycle action endpoints are planned stubs and do not mutate campaign/client state.
Severity: low
File: `backend/app/api/admin.py`, `backend/app/services/campaigns.py`
Rischio: callers can receive a stub response from pause/resume/block/archive without any persisted lifecycle change. This matches current planned-stub status but cannot prove enforcement.
Suggested next micro-task: implement the smallest service-owned campaign/client lifecycle transition slice with repository persistence and conflict checks.

Issue: Core campaign authorize/send endpoints do not evaluate campaign status or contact status.
Severity: medium
File: `backend/app/services/campaigns.py`, `backend/app/guard/deliverability_guard.py`
Rischio: no real send path exists today, but a future send implementation could miss blocking for `paused`, `blocked`, `completed`, `failed`, `unsubscribed`, `blacklisted`, `bounced`, and `suppressed`.
Suggested next micro-task: wire `POST /campaigns/{campaign_id}/authorize` through a backend Guard use case before any real send implementation.

Issue: Contact suppression/sendability endpoints are endpoint-only stubs with no contact repository state.
Severity: medium
File: `backend/app/api/contacts.py`, `backend/app/schemas/contacts.py`
Rischio: the contract states exist, but no backend read/write path proves that suppressed/unsubscribed/blacklisted/bounced contacts are persisted or blocked.
Suggested next micro-task: add a contact service/repository state audit slice, then implement `suppress` only in an approved implementation task.

Issue: `campaign_contacts` exists only as a DB schema stub.
Severity: low
File: `db/init.sql`
Rischio: per-campaign contact inclusion/send state cannot yet enforce `client_id`, `campaign_id`, and `contact_id` consistency at backend boundary.
Suggested next micro-task: define the minimal backend repository/service contract for `campaign_contacts` before batching or per-campaign send state work.

Issue: Current data stubs do not include negative fixtures for non-sendable campaign or contact states.
Severity: low
File: `backend/app/repositories/campaigns.py`, `backend/app/repositories/clients.py`
Rischio: regression coverage cannot currently observe handling of non-sendable campaign/contact states.
Suggested next micro-task: add negative state fixtures and read-path tests when state enforcement becomes approved implementation work.

## 6. Test Eseguiti

- `docker compose config`: passed, with access warnings for `C:\Users\Jacopo\.docker\config.json`.
- `git diff --check`: passed.

## 7. Test Non Eseguiti

- `PYTHONPATH=backend pytest backend/tests`: `pytest` is not available in PATH.
- `python -m pytest backend/tests`: `python` is not available in PATH.
- Python syntax check via `python -m compileall`: `python` is not available in PATH.
- `bash scripts/audit.sh`: sandbox returned `Access is denied`; escalated retry failed because WSL has no `/bin/bash`.
- `bash scripts/smoke_test.sh`: sandbox returned `Access is denied`; escalated retry failed because WSL has no `/bin/bash`.

## 8. File Modificati

- `docs/audit_log.md`
- `docs/branch_handoffs/state_management_stub_audit.md`

## 9. Raccomandazione

Next micro-task: implement a backend-only authorization/Guard integration slice for `POST /campaigns/{campaign_id}/authorize`, proving blocked campaign and contact states before any real send path is introduced.
