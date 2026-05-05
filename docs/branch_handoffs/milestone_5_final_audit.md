# Milestone 5 Final Audit - Send Simulation Pipeline

Branch: `feature/backend-core`
Date: 2026-05-05
Task type: `backend_audit`
Implementation depth: `audit_only`

## 1. Audit summary

Milestone 5 is ready to close for the send simulation pipeline. The send path is still stub/simulation-only, but now runs through the same backend Guard preflight used by authorize. No high severity issue was found.

Validated invariants:
- `send_campaign()` passes through Guard preflight.
- `authorize` and `send` share the same service-owned preflight.
- `EMAIL_SENDING_ENABLED` protects send through `DeliverabilityGuard.authorize_campaign_send()`.
- Send remains stub-only and keeps the existing public response shape.
- No listmonk send call, provider send, SMTP call, queue send, or `email_logs` write path was found.
- Router remains HTTP-only.
- Multi-client isolation is preserved by using `campaign.client_id` for client and contact checks.
- Tests exist for allowed send, blocked send, blocked logging, and fail-closed env behavior.

## 2. Validazione send preflight

Evidence:
- `backend/app/services/campaigns.py`: `authorize_campaign()` calls `_preflight_campaign_send()`.
- `backend/app/services/campaigns.py`: `send_campaign()` calls `_preflight_campaign_send()` before returning the send stub.
- `_preflight_campaign_send()` checks, in order: campaign exists, env send gate, campaign client state, campaign state, campaign targets, contact sendability.
- `backend/app/guard/deliverability_guard.py`: Guard owns env, client, campaign, target, and contact decisions.

Flow audited:

```txt
POST /campaigns/{campaign_id}/send
-> backend/app/api/campaigns.py
-> CampaignsService.send_campaign()
-> CampaignsService._preflight_campaign_send()
-> DeliverabilityGuard
-> BlockedSendsService when blocked
-> stub response
```

## 3. Validazione no real send/listmonk

`send_campaign()` returns:

```json
{
  "status": "stub",
  "endpoint": "POST /campaigns/{campaign_id}/send"
}
```

No direct send execution was found:
- no `ListmonkClient` call from `CampaignsService`
- no SMTP/provider send call
- no queue/worker dispatch
- no backend `email_logs` service/repository write
- listmonk adapter remains placeholder-only

## 4. Logging validation

Blocked preflight decisions call `BlockedSendsService.log_blocked_authorization()`.

Evidence:
- `backend/app/services/blocked_sends.py` creates a `BlockedSend` record with readable reason and blocked decision.
- `backend/app/repositories/blocked_sends.py` appends the record to in-memory `_BLOCKED_SENDS`.
- `backend/tests/test_campaign_authorize_guard.py` covers send blocked by missing/false `EMAIL_SENDING_ENABLED`, blocked campaign, blocked client, blocked contact, and allowed send with no blocked record.

## 5. API invariants

Router boundary:
- `backend/app/api/campaigns.py` parses HTTP and delegates to `CampaignsService`.
- No router-level Guard logic, repository logic, persistence, listmonk call, or send policy was found.

Response shape:
- Send remains `status` plus `endpoint`.
- Authorize remains `status` plus `endpoint`.
- No new public fields were added during Milestone 5 final audit.

## 6. Problemi trovati

Issue: `blocked_sends` is still in-memory only.  
Severity: medium  
File: `backend/app/repositories/blocked_sends.py`  
Rischio: blocked send audit records disappear on restart and cannot be shared across workers or deployments.  
Suggested next micro-task: add a DB-backed blocked sends repository in a persistence-only milestone after scope approval.

Issue: backend `email_logs` service/repository is not implemented.  
Severity: medium  
File: `backend/app/services/campaigns.py`, `db/init.sql`  
Rischio: simulated or future operational send attempts cannot yet be audited through the intended business email log boundary.  
Suggested next micro-task: define a minimal backend `email_logs` repository/service contract before any operational send or queue implementation.

Issue: listmonk adapter is present but unused by send.  
Severity: low  
File: `backend/app/integrations/listmonk/client.py`  
Rischio: safe for current no-real-send constraints, but future integration must not place authorization decisions in the adapter.  
Suggested next micro-task: keep listmonk engine-only and add adapter calls only after backend Guard preflight, dry-run semantics, and tests are approved.

Issue: missing campaign/client policy remains future behavior.  
Severity: low  
File: `backend/app/services/campaigns.py`  
Rischio: missing campaign and missing client currently preserve stub behavior instead of explicit `404`/blocked policy.  
Suggested next micro-task: create a small API contract task for missing campaign/client behavior before real send acceptance semantics.

Issue: usage limits are not integrated into send preflight.  
Severity: medium  
File: `backend/app/guard/deliverability_guard.py`, `backend/app/services/campaigns.py`  
Rischio: future send volume controls are not enforced yet, though no real send exists today.  
Suggested next micro-task: add a Guard-owned usage-limit check after usage persistence/read contracts are implemented.

Issue: real suppression-list persistence is not integrated.  
Severity: medium  
File: `backend/app/guard/deliverability_guard.py`, `backend/app/repositories/contacts.py`  
Rischio: current suppression behavior is represented by contact status fixtures only; future imported suppression records would not independently block send until wired.  
Suggested next micro-task: add repository-backed suppression lookup to Guard preflight in a dedicated suppression milestone.

## 7. Test eseguiti

- `docker compose exec -T backend pytest backend/tests`: attempted; failed because the running backend container does not include `backend/tests`.
- `docker compose run -T --rm -v "${PWD}\backend\tests:/app/backend/tests:ro" backend python -m pytest backend/tests`: passed, 42 tests.
- `scripts/audit.sh`: passed via Git Bash after sandbox WSL/bash access denial.
- `scripts/smoke_test.sh`: passed via Git Bash after sandbox WSL/bash access denial.
- `docker compose config`: passed; Docker printed non-fatal access warnings for `C:\Users\Jacop\.docker\config.json`.
- `git diff --check`: passed.

## 8. Test non eseguiti

- Host `pytest backend/tests` did not run because pytest is not installed on the active host Python/PATH.
- Frontend lint/build were not run because this was backend audit-only and frontend was outside scope.
- DB migration tests were not run because schema changes were forbidden and no schema was modified.

## 9. File modificati

- `docs/audit_log.md`
- `docs/branch_handoffs/milestone_5_final_audit.md`

## 10. Raccomandazione

Milestone 5 can be closed.

The remaining gaps are future persistence/integration hardening items, not blockers for the current simulation milestone: `blocked_sends` persistence, `email_logs`, listmonk adapter usage, missing campaign/client policy, usage limits, and real suppression-list integration.
