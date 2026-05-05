# Blocked Authorization Attempts Audit Handoff

Date: 2026-05-05
Branch: `feature/backend-core`
Mode: audit-only

## 1. Audit Summary

`POST /campaigns/{campaign_id}/authorize` now reaches `CampaignsService` and, for found campaigns, calls `DeliverabilityGuard.authorize_campaign_state()`. The Guard returns a `GuardResult` with both decision and reason.

The current authorize response shape is still only `{"status": <decision>, "endpoint": <endpoint>}`. The service discards `GuardResult.reason`, and no blocked authorization attempt is written into `blocked_sends`.

`blocked_sends` exists as schema, service, repository, DB stub, and client read endpoint, but the repository is list-only. No application code was changed.

`project_handoff_v1.md` is referenced by V1 docs but is not present in this checkout.

## 2. Flow Attuale Authorize -> Guard

1. `backend/app/api/campaigns.py`: route `POST /campaigns/{campaign_id}/authorize` calls `CampaignsService.authorize_campaign(campaign_id)`.
2. `backend/app/services/campaigns.py`: service builds the endpoint string and calls `CampaignsRepository.get_campaign(campaign_id)`.
3. Missing campaign: service returns `{"status": "stub", "endpoint": ...}`.
4. Found campaign: service calls `DeliverabilityGuard.authorize_campaign_state(campaign.status)`.
5. `backend/app/guard/deliverability_guard.py`: Guard authorizes `ready` and `running`; blocks `draft`, `paused`, `blocked`, `completed`, and `failed`, with a readable reason.
6. `backend/app/services/campaigns.py`: service returns `{"status": decision.decision.value, "endpoint": endpoint}` and discards `decision.reason`.

Current flow does not call `BlockedSendsService` or `BlockedSendsRepository`.

## 3. Stato Attuale Blocked_Sends Boundary

Shape attuale dei record stub:

- `id`
- `client_id`
- `campaign_id`
- `contact_id`
- `reason`
- `decision`
- `created_at`

Evidence:

- `backend/app/schemas/blocked_sends.py` defines the typed `BlockedSend` shape.
- `backend/app/repositories/blocked_sends.py` contains one in-memory fake record:
  - id `blocked_acme_001`
  - client `client_acme`
  - campaign `campaign_acme_reactivation`
  - contact `contact_acme_001`
  - decision `blocked`
  - reason `Milestone 0.5 fake blocked send for UI contract testing.`
- `backend/app/services/blocked_sends.py` exposes current-client read and planned admin stubs.
- `db/init.sql` defines `blocked_sends.reason` as `TEXT NOT NULL` and `decision` as `TEXT NOT NULL DEFAULT 'blocked'`.

Repository support:

- Supports: `list_blocked_sends(client_id: str | None = None)`.
- Does not support: append, create, add, or any mutation method.

## 4. Decisione: Logging In-Memory Possibile Si/No

No, not within the current audit-only task.

Adding in-memory logging would create a real mutable write path and would change observable behavior of `GET /client/blocked-sends` during the process lifetime. That is useful for a future approved backend micro-task, but it is still implementation, not audit.

Internal logging can preserve the current authorize response shape. Exposing `reason` in the authorize response is a separate API response shape decision and should be contract-approved before implementation.

## 5. Problemi Trovati

Issue/decision: Authorize discards `GuardResult.reason`.
Severity: medium
File: `backend/app/services/campaigns.py`
Rischio: blocked authorization decisions are not explainable through either response or blocked_sends, even though the Guard already computes a readable reason.
Suggested next micro-task: decide whether reason is internal-log only or API-visible; if API-visible, raise a contract change request.

Issue/decision: `blocked_sends` repository is list-only.
Severity: medium
File: `backend/app/repositories/blocked_sends.py`
Rischio: the service has no existing persistence boundary where it can record blocked authorization attempts.
Suggested next micro-task: add a minimal repository append/create method in an approved backend-only implementation task.

Issue/decision: Authorize flow is not connected to blocked_sends boundary.
Severity: medium
File: `backend/app/services/campaigns.py`, `backend/app/services/blocked_sends.py`
Rischio: blocked Guard decisions are returned but not represented in audit/dashboard data.
Suggested next micro-task: call a blocked_sends service method after blocked Guard decisions, preserving router and Guard responsibilities.

Issue/decision: Blocked sends fixture campaign id does not exist in current campaign repository fixtures.
Severity: low
File: `backend/app/repositories/blocked_sends.py`, `backend/app/repositories/campaigns.py`
Rischio: the current UI fixture cannot be traced to a campaign record during runtime-flow audits.
Suggested next micro-task: align fixtures when blocked_sends becomes behaviorally tied to authorization.

Issue/decision: Current regression test preserves response keys as `status` and `endpoint` only.
Severity: low
File: `backend/tests/test_campaign_authorize_guard.py`
Rischio: adding `reason` to the response is a deliberate API/test change, not a hidden implementation detail.
Suggested next micro-task: keep response shape unchanged for internal logging; open CONTRACT CHANGE REQUEST before exposing `reason`.

## CONTRACT CHANGE REQUEST

Not required for internal logging if:

- authorize response remains `status` plus `endpoint`
- no DB schema change is introduced
- blocked_sends append/create remains an internal backend boundary

Required if:

- `POST /campaigns/{campaign_id}/authorize` starts exposing `reason` in the response
- DB schema shape changes
- new endpoint or response shape is introduced

## 6. Test Eseguiti

- `docker compose config`: passed, with access warnings for `C:\Users\Jacopo\.docker\config.json`.
- `git diff --check`: passed.
- Read-only Python AST syntax check with bundled Python: passed for 42 backend app/test files.
- Direct import/check with bundled Python: passed for `CampaignsService`, `DeliverabilityGuard`, `CampaignsRepository`, and `BlockedSendsRepository`.

## 7. Test Non Eseguiti

- `PYTHONPATH=backend pytest backend/tests`: `pytest` is not available in PATH.
- Bundled Python `-m pytest backend/tests`: bundled Python has no `pytest` module.
- `bash scripts/audit.sh`: sandbox returned `Access is denied`; escalated retry reached WSL but failed because `/bin/bash` is unavailable.
- `bash scripts/smoke_test.sh`: sandbox returned `Access is denied`; escalated retry reached WSL but failed because `/bin/bash` is unavailable.

## 8. File Modificati

- `docs/audit_log.md`
- `docs/branch_handoffs/blocked_authorization_attempts_audit.md`

## 9. Prossimo Micro-Task Consigliato

Implement an approved backend-only internal logging slice for blocked authorize decisions:

- add the smallest `BlockedSendsRepository` append/create method
- add a `BlockedSendsService` method that accepts campaign/client/contact/reason/decision data
- call it from `CampaignsService.authorize_campaign()` only after blocked Guard decisions
- keep router and response shape unchanged unless the contract change request is accepted
- add focused service/repository tests
