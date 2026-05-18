# Audit Checklist V1

Source of truth: `project_handoff_v1.md`.

Run this checklist after each milestone and record results in `docs/audit_log.md`.

## Architecture Compliance

- [ ] UI does not call listmonk.
- [ ] UI does not write directly to DB.
- [ ] backend is gatekeeper.
- [ ] Business PostgreSQL remains source of truth.
- [ ] listmonk does not decide business logic.
- [ ] Mailpit is not used in production.
- [ ] `EMAIL_SENDING_ENABLED` remains fail-closed for real dispatch.

## Admin-Managed Campaign Contract

- [ ] admin campaign creation is documented as the only V1 operational campaign flow.
- [ ] backend validates admin-selected `client_id` on every campaign write action.
- [ ] frontend does not trust or send a privileged `client_id`.
- [ ] frontend does not decide slot limits.
- [ ] frontend does not decide Guard or review results.
- [ ] backend validates campaign-step progression.
- [ ] cross-client campaign access is denied.
- [ ] no client write endpoint for campaign creation, mutation, simulation, or send is documented as V1.

## Wizard And Review Contract

- [ ] contract documents the admin UX flow `new campaign`, `select client`, `setup`, `content`, `recipients`, `review`, `send`.
- [ ] contract documents persisted `setup`, `content`, `recipients`, `review`, `send` step values.
- [ ] contract documents `content_ready`.
- [ ] contract documents `contacts_ready`.
- [ ] contract documents `review_ready`.
- [ ] review is documented as non-sending.
- [ ] send is documented to re-run or validate Guard.

## Client Read-Only Contract

- [ ] client campaign routes are documented as read-only in V1.
- [ ] client portal does not expose CTA or documented flow for "Nuova campagna".
- [ ] client routes do not simulate, send, assign slots, import contacts, or mutate templates.
- [ ] client dashboard is documented as visibility/metrics only.

## Limits And Slots

- [ ] current legacy limit fields are identified.
- [ ] recommended `campaign_slots` contract is documented.
- [ ] `clients.email_limit_per_campaign` is marked legacy/fallback.
- [ ] `clients.max_campaigns` compatibility is documented.
- [ ] Guard ownership of final limit enforcement is preserved.

## Templates And AI

- [ ] template catalog is documented as Business DB truth.
- [ ] listmonk receives final rendered HTML only.
- [ ] AI is documented as editorial assistance only.
- [ ] AI cannot send or authorize.
- [ ] future AI usage logging is documented.

## Security And Auth

- [ ] protected backend requests use backend-owned auth verification or are explicitly documented as stubs.
- [ ] backend derives trusted `client_id` from access mapping.
- [ ] no password, password hash, reset token, or session secret is stored in Sendwise DB.
- [ ] client account cannot access admin endpoints.
- [ ] client account cannot use campaign write endpoints in V1.
- [ ] invited, suspended, and archived access cannot access protected client data.

## Deliverability

- [ ] suppression respected.
- [ ] bounced not sent.
- [ ] unsubscribed not sent.
- [ ] blacklisted not sent.
- [ ] no send path bypasses the Guard.

## Testing

- [ ] `bash scripts/audit.sh`
- [ ] `bash scripts/smoke_test.sh`
- [ ] `docker compose config`
- [ ] `git diff --check`

## Regression

- [ ] no features outside scope.
- [ ] no unrequested refactors.
- [ ] no frontend trust-boundary regression.
- [ ] no listmonk source-of-truth regression.
