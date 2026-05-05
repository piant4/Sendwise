# Simulated Send Runtime Flow Audit

Date: 2026-05-05
Branch: `feature/backend-core`
Task type: backend audit
Implementation depth: audit only

## 1. Audit Summary

This audit inspected the current simulated send flow without modifying application code.

Expected contract from V1 docs:
- FastAPI remains the gatekeeper.
- No component bypasses the Deliverability Guard.
- `EMAIL_SENDING_ENABLED` is fail-closed.
- No real email is sent.
- listmonk remains engine-only and must not decide business sendability.
- Business PostgreSQL remains business source of truth.

Observed behavior:
- `authorize` is service-owned and Guard-backed for existing campaigns.
- `send` is service-owned but still returns a planned stub without Guard checks.
- No real email, listmonk send, provider send, or queue call exists in the send path.
- `blocked_sends` is updated by blocked authorization decisions, not by the send endpoint.

First divergence:
- `backend/app/services/campaigns.py`: `CampaignsService.send_campaign()` returns `planned_admin_campaign_stub()` directly.

Fix status: not attempted.

## 2. Send Endpoints Attuali

Exposed campaign endpoints:
- `POST /campaigns`: planned create stub.
- `POST /campaigns/{campaign_id}/authorize`: send authorization endpoint.
- `POST /campaigns/{campaign_id}/send`: simulated/planned send endpoint.

Other send/execute search result:
- No other exposed backend `send` or `execute` product endpoint was found.
- `backend/app/integrations/listmonk/client.py` defines a stub `authorize_send()` method, but it is not an API endpoint and does not perform HTTP.
- `POST /events/listmonk` and `POST /events/provider` are event stubs, not send triggers.

Relevant files:
- `backend/app/api/campaigns.py`
- `backend/app/services/campaigns.py`
- `backend/app/api/events.py`
- `backend/app/integrations/listmonk/client.py`

## 3. Send Response Shape Attuale

Runtime HTTP evidence with default Compose env:
- `POST /campaigns/campaign_acme_welcome/authorize` returned `{"status":"blocked","endpoint":"POST /campaigns/campaign_acme_welcome/authorize"}`.
- `POST /campaigns/campaign_acme_welcome/send` returned `{"status":"stub","endpoint":"POST /campaigns/campaign_acme_welcome/send"}`.
- `POST /campaigns/campaign_missing/send` returned `{"status":"stub","endpoint":"POST /campaigns/campaign_missing/send"}`.

Current send response shape:

```json
{
  "status": "stub",
  "endpoint": "POST /campaigns/{campaign_id}/send"
}
```

Missing from current send response:
- send request id
- dry-run/queued indicator
- Guard reason
- target count
- contact-level results
- listmonk/provider ids

## 4. Guard Bypass Risk

Authorize flow:

```txt
FastAPI router
-> CampaignsService.authorize_campaign()
-> CampaignsRepository.get_campaign()
-> DeliverabilityGuard.authorize_campaign_send()
-> ClientsService.get_client(campaign.client_id)
-> DeliverabilityGuard.authorize_client_state()
-> DeliverabilityGuard.authorize_campaign_state()
-> ContactsService.list_campaign_contacts(campaign_id, client_id)
-> DeliverabilityGuard.authorize_campaign_targets()
-> DeliverabilityGuard.can_send_to_contact()
-> BlockedSendsService.log_blocked_authorization() for blocked decisions
```

Send flow:

```txt
FastAPI router
-> CampaignsService.send_campaign()
-> planned_admin_campaign_stub()
```

Risk classification:
- Immediate real-send risk: low, because send has no listmonk/provider call.
- Latent Guard bypass risk: high, because the named send trigger does not invoke Guard before returning an accepted-looking stub.

Invariant review:
- no real email: holds today.
- no listmonk: holds today.
- dry-run/simulation only: holds by absence of implementation, not by explicit send enforcement.
- Guard mandatory before any send: not enforced by `send_campaign()`.

## 5. Logging/Listmonk/Email Status

`blocked_sends`:
- Schema exists.
- Service exists.
- In-memory repository exists.
- `append_blocked_send()` exists.
- Blocked `authorize` decisions call `BlockedSendsService.log_blocked_authorization()`.
- `send` does not call Guard and therefore does not update `blocked_sends`.

`email_logs`:
- `docs/data_model_v1.md` defines the intended entity.
- `db/init.sql` defines the table.
- No backend `email_logs` schema/service/repository was found.

listmonk:
- Placeholder adapter exists at `backend/app/integrations/listmonk/client.py`.
- Adapter methods return stubs only.
- No real HTTP listmonk request is performed.
- `send_campaign()` does not call the adapter.

`EMAIL_SENDING_ENABLED`:
- Read in `backend/app/core/config.py`.
- Enforced through `DeliverabilityGuard.authorize_campaign_send()` in `authorize`.
- Not enforced by `send`.

## 6. Problemi Trovati

Issue: `POST /campaigns/{campaign_id}/send` bypasses Guard V1.
Severity: high
File: `backend/app/services/campaigns.py`
Rischio: any future real or queued send logic added behind this method could execute without fail-closed env, client, campaign, target, contact, or suppression checks.
Suggested next micro-task: route `send_campaign()` through a backend Guard preflight before any accepted dry-run/queued result.

Issue: `EMAIL_SENDING_ENABLED` protects authorize but not send.
Severity: high
File: `backend/app/services/campaigns.py`, `backend/app/guard/deliverability_guard.py`
Rischio: the fail-closed invariant is not proven at the named send trigger.
Suggested next micro-task: make `send_campaign()` block when `EMAIL_SENDING_ENABLED` is not exactly `true`, preserving public response shape unless a contract change is approved.

Issue: denied send attempts are not logged.
Severity: medium
File: `backend/app/services/campaigns.py`, `backend/app/services/blocked_sends.py`
Rischio: future denied send attempts would not appear in `blocked_sends`, reducing auditability and dashboard explainability.
Suggested next micro-task: after blocked send Guard decisions, log through `BlockedSendsService.log_blocked_authorization()`.

Issue: no backend `email_logs` service/repository exists.
Severity: medium
File: `backend/app/services`, `backend/app/repositories`, `db/init.sql`
Rischio: future send attempts cannot be recorded through the intended business audit boundary.
Suggested next micro-task: add a minimal email logs service/repository in a separate approved backend persistence task before operational sending.

Issue: current send response is a generic planned stub.
Severity: low
File: `backend/app/services/campaigns.py`, `docs/api_contracts_v1.md`
Rischio: callers cannot distinguish planned stub, blocked send, dry-run, or queued simulation without implementation knowledge.
Suggested next micro-task: keep response shape unchanged for the Guard micro-fix; open a contract change request before adding public fields.

Issue: listmonk adapter is placeholder-only.
Severity: low
File: `backend/app/integrations/listmonk/client.py`
Rischio: safe today, but future adapter work must not absorb authorization policy.
Suggested next micro-task: keep listmonk engine-only and add adapter send operations only after backend Guard and dry-run boundaries are tested.

## 7. Test Eseguiti

- `pytest backend/tests`: attempted on host; failed because `pytest` is not available in PowerShell PATH.
- `docker compose run --rm --no-deps -v C:\Users\Jacop\Documents\Sendwise\backend\tests:/app/tests:ro backend python -m pytest tests`: passed, 38 tests.
- `scripts/audit.sh`: first sandbox Git Bash attempt failed with Win32 error 5; escalated retry passed.
- `scripts/smoke_test.sh`: passed.
- `docker compose config`: passed; Docker emitted access warnings for `C:\Users\Jacop\.docker\config.json`.
- `git diff --check`: passed.
- HTTP spot checks against local backend container: authorize returned `blocked`; send returned `stub`.
- `docker compose down`: executed after containerized checks to stop/remove services started for the audit.

## 8. Test Non Eseguiti

- Host pytest did not run because `pytest` is not installed on the active host PATH.
- Frontend lint/build were not run because frontend was out of scope and unchanged.
- DB migration/schema tests were not run because schema changes were forbidden and unchanged.

## 9. File Modificati

- `docs/audit_log.md`
- `docs/branch_handoffs/send_simulated_flow_audit.md`

## 10. Raccomandazione Prossimo Micro-task

Implement a backend-only Guard preflight in `CampaignsService.send_campaign()`:
- preserve the current public `status` plus `endpoint` shape unless an API contract change is approved;
- log blocked send decisions through `BlockedSendsService`;
- do not call listmonk;
- do not send real email;
- add focused regression tests proving `EMAIL_SENDING_ENABLED=false` blocks the send endpoint.

## Contract Change Request

No contract change is required for the recommended backend-only Guard enforcement if response shape is preserved.

Contract change request required before:
- exposing `reason`, `dry_run`, `send_request_id`, queue id, target counts, listmonk ids, or provider ids in the public send response;
- adding or changing DB schema for `email_logs` or `blocked_sends`;
- adding frontend behavior that depends on new send response fields.
