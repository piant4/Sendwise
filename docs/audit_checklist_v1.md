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
- [ ] public signup disabled or explicitly still out of scope.
- [ ] frontend does not trust access type or `client_id`.
- [ ] Sendwise DB stores no user password, password hash, password reset token, or session secret.
- [ ] protected backend requests use backend-owned auth verification or are explicitly documented as stubs.
- [ ] secrets not committed.
- [ ] secret values are not returned to frontend or logs.
- [ ] PostgreSQL not publicly exposed.
- [ ] listmonk admin not publicly exposed without protection.

## Auth And Onboarding Contract

- [ ] platform admin is backend-controlled.
- [ ] there is no role selector in client access UI.
- [ ] there is no admin or client selector in client access UI.
- [ ] there is no multi-user or team client UI in V1.
- [ ] invite-access endpoint accepts `email` only.
- [ ] invite-access endpoint does not accept trusted role or access type from frontend.
- [ ] onboarding endpoint does not accept trusted `client_id` or role from frontend.
- [ ] onboarding endpoint accepts `personal_name` and optional `company_name`.
- [ ] each client has at most one active access in V1.
- [ ] client account cannot access admin endpoints.
- [ ] invited, suspended, and archived access cannot access protected data.
- [ ] no public signup route exists.
- [ ] no `SignUpButton` is exposed.

## Multi-client

- [ ] client_id isolation enforced in contracts.
- [ ] client dashboard cannot access other clients.
- [ ] every business entity maps to client_id.
- [ ] backend resolves client scope from Business PostgreSQL mapping, not from frontend input.
- [ ] client_id is backend-derived or path-derived and validated where required.

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

## Milestone 0.5 - Parallel Work Boundary

- [ ] backend schemas exist.
- [ ] frontend types exist.
- [ ] frontend mock API exists.
- [ ] admin/client endpoint stubs exist.
- [ ] client mock data uses a single client_id.
- [ ] frontend API client supports mock mode.
- [ ] ownership file defines backend/frontend split.
