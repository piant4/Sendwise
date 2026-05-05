# Deliverability Guard V1 Perimeter Audit Handoff

Date: 2026-05-05
Branch: `feature/backend-core`
Task type: `backend_audit`
Implementation depth: `audit_only`

## 1. Audit Summary

Current `DeliverabilityGuard` exposes three checks:
- `authorize_campaign_send(email_sending_enabled)` for send-mode/fail-closed behavior.
- `authorize_campaign_state(campaign_status)` for campaign lifecycle eligibility.
- `can_send_to_contact(contact_status)` for contact sendability.

Runtime `POST /campaigns/{campaign_id}/authorize` currently uses campaign and contact checks only. It does not call `authorize_campaign_send()` and does not read `Settings.email_sending_enabled`.

Campaign state and contact state are separated correctly in the current flow: campaign state is checked first, blocked campaign states short-circuit, and contacts are checked only after campaign state is eligible.

## 2. Guard Controls Presenti

- Campaign `ready` and `running` authorize.
- Campaign `draft`, `paused`, `blocked`, `completed`, and `failed` block.
- Contact `sendable` authorizes.
- Contact `pending`, `suppressed`, `bounced`, `unsubscribed`, `blacklisted`, and `error` block.
- Blocked campaign/contact decisions are logged internally with `client_id`, `campaign_id`, readable `reason`, `decision`, and `created_at`.
- `.env.example` defaults `EMAIL_SENDING_ENABLED=false`, and config parses it as true only when exactly `"true"`.

## 3. Guard Controls Mancanti

- Client status check for `paused`, `blocked`, and `archived`.
- Runtime use of `EMAIL_SENDING_ENABLED=false` / fail-closed in campaign authorization.
- Usage limits.
- Suppression list lookup independent from contact status.
- Structured internal reason codes.
- Contact id on contact-state blocked logs.
- Empty target handling.
- DB-backed `campaign_contacts`.

## 4. Rischi Prioritari

Issue: Campaign authorization does not evaluate client lifecycle state.
Severity: high
File: `backend/app/services/campaigns.py`
Rischio: paused, blocked, or archived clients can still have eligible campaigns authorized in the current service path.
Suggested next micro-task: add a minimal client lifecycle authorization slice before campaign/contact checks.

Issue: `EMAIL_SENDING_ENABLED=false` is not wired into authorize.
Severity: high
File: `backend/app/services/campaigns.py`, `backend/app/guard/deliverability_guard.py`, `backend/app/core/config.py`
Rischio: ready/running campaigns with sendable contacts can return `authorized` even when the environment is configured fail-closed.
Suggested next micro-task: call `DeliverabilityGuard.authorize_campaign_send()` from `CampaignsService.authorize_campaign()` before returning authorization.

Issue: Ready/running campaigns with no contacts can authorize.
Severity: medium
File: `backend/app/services/campaigns.py`, `backend/app/repositories/contacts.py`
Rischio: empty target batches are treated as authorized by fall-through.
Suggested next micro-task: define the internal V1 empty-target decision and enforce it in the service/Guard flow.

Issue: Contact-state blocked logs omit `contact_id`.
Severity: medium
File: `backend/app/services/campaigns.py`, `backend/app/services/blocked_sends.py`
Rischio: blocked_sends can explain the state reason but cannot identify the blocked contact.
Suggested next micro-task: pass optional `contact_id` into internal blocked authorization logging for contact blocks.

Issue: Missing structured internal reasons.
Severity: medium
File: `backend/app/guard/deliverability_guard.py`, `backend/app/services/blocked_sends.py`
Rischio: readable strings are brittle for dashboards, filters, analytics, and regression guards.
Suggested next micro-task: add internal reason codes without changing public API unless approved.

Issue: Usage limits are not integrated.
Severity: medium
File: `backend/app/services/campaigns.py`, `backend/app/services/usage.py`
Rischio: future quota or send limits cannot block authorization.
Suggested next micro-task: add a tiny usage-limit guard boundary after env/client checks.

Issue: Suppression records are not integrated.
Severity: medium
File: `backend/app/guard/deliverability_guard.py`, `backend/app/services/contacts.py`
Rischio: contact `status=suppressed` blocks, but persisted suppression-list rows are not checked.
Suggested next micro-task: introduce an approved suppression lookup boundary and feed it to Guard decisions.

Issue: `campaign_contacts` is in-memory only.
Severity: low
File: `backend/app/repositories/contacts.py`
Rischio: current stubs do not prove DB-backed relationship integrity or persistence.
Suggested next micro-task: replace the stub association only in an approved persistence slice.

## 5. Suggested Micro-Task Order

1. Wire `EMAIL_SENDING_ENABLED=false` fail-closed into `CampaignsService.authorize_campaign()`.
2. Add client lifecycle authorization.
3. Decide and enforce empty target handling.
4. Add `contact_id` to contact blocked logging.
5. Add structured internal reason codes.
6. Integrate suppression lookup.
7. Integrate usage limits.
8. Replace in-memory `campaign_contacts` with an approved DB-backed boundary.

## 6. Test Eseguiti

- `docker compose config`: passed, with Docker config access warnings.
- `git diff --check`: passed.
- Python AST syntax check for 45 backend Python files: passed.

## 7. Test Non Eseguiti

- `PYTHONPATH=backend pytest backend/tests`: `pytest` not available in PATH.
- `PYTHONPATH=backend python -m pytest backend/tests`: Python has no `pytest` module.
- Direct backend import/check: Python has no `pydantic` module.
- `bash scripts/audit.sh`: sandbox WSL access denied; escalated retry failed because `/bin/bash` is unavailable.
- `bash scripts/smoke_test.sh`: sandbox WSL access denied; escalated retry failed because `/bin/bash` is unavailable.

## 8. File Modificati

- `docs/audit_log.md`
- `docs/branch_handoffs/deliverability_guard_v1_perimeter_audit.md`

## 9. Raccomandazione Prossimo Micro-Task

Implement the backend-only fail-closed authorization slice first: `CampaignsService.authorize_campaign()` must evaluate `EMAIL_SENDING_ENABLED` through the existing Guard method before any `authorized` decision can be returned. Preserve the public response shape and do not introduce real sending.

## Contract Change Request

Required before exposing Guard reasons, reason codes, per-contact reasons, or empty-target semantics in public API responses.

Required before any DB schema change for usage limits, suppression, or `campaign_contacts`.
