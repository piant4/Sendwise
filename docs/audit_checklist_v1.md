# Audit Checklist V1

Source of truth: `project_handoff_v1.md`.

Run this checklist after each milestone and record results in `docs/audit_log.md`.

## Architecture Compliance

- [ ] UI does not call listmonk.
- [ ] UI does not write directly to DB.
- [ ] backend is gatekeeper.
- [ ] listmonk does not decide business logic.
- [ ] Mailpit is not used in production.
- [ ] n8n is not core V1.

## Security

- [ ] endpoint protection planned/present.
- [ ] API key/auth planned/present.
- [ ] secrets not committed.
- [ ] PostgreSQL not publicly exposed.
- [ ] listmonk admin not publicly exposed without protection.

## Multi-client

- [ ] client_id isolation enforced in contracts.
- [ ] client dashboard cannot access other clients.
- [ ] every business entity maps to client_id.

## Deliverability

- [ ] suppression respected.
- [ ] bounced not sent.
- [ ] unsubscribed not sent.
- [ ] blacklisted not sent.
- [ ] EMAIL_SENDING_ENABLED fail-closed.

## Testing

- [ ] smoke test.
- [ ] backend tests.
- [ ] frontend basic build planned.
- [ ] docker compose config.
- [ ] healthcheck.
- [ ] Mailpit test in dev.

## Regression

- [ ] no features outside scope.
- [ ] no unrequested refactors.
- [ ] no backend bypass.
- [ ] no restoration of old n8n-core architecture.
