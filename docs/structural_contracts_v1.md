# Structural Contracts V1

Source of truth: `project_handoff_v1.md`.

These contracts are binding for V1 until explicitly changed. Older files are historical context only.

## Mandatory Rules

- Backend is the only gatekeeper.
- UI talks only to FastAPI backend APIs.
- Backend talks to Business PostgreSQL, Deliverability Guard, and listmonk.
- Business PostgreSQL remains the product and business source of truth.
- listmonk remains an engine-only technical system.
- Frontend never calls listmonk directly.
- Frontend never decides trusted `client_id`.
- Frontend never decides limits, Guard result, or provider.
- No component may bypass the Deliverability Guard.
- No email may be simulated or sent without backend-controlled checks.
- `EMAIL_SENDING_ENABLED` remains fail-closed for real dispatch.
- Mailpit is dev/staging only.
- SES remains controlled and outside this milestone's implementation scope.
- AI is editorial assistance only; it does not authorize or send.
- Codex must not change contracts without explicit instruction.

## Product Direction

The client portal is the future product surface for self-service campaign management.

Target V1 self-service flow:

1. Setup campaign
2. Create content or apply a template
3. Add or import recipients
4. Review content and delivery readiness
5. Request simulation or controlled send

This milestone updates contracts only. It does not implement the wizard, slot persistence, template CRUD, AI generation, or new dispatch behavior.

## Components

### Frontend Custom Next.js

Can do:
- Render admin and client dashboards and future client self-service wizard screens.
- Collect form input for campaign setup, content, recipients, and review actions.
- Call FastAPI backend endpoints only.
- Display backend-owned states, readiness flags, blocked-send reasons, slot summaries, and usage data.

Cannot do:
- Decide business logic.
- Call listmonk directly.
- Write to PostgreSQL directly.
- Decide `client_id`.
- Decide slot or campaign limits.
- Decide Guard or review outcome.
- Authorize sending.
- Bypass Deliverability Guard.

### FastAPI Backend

Can do:
- Serve admin, client, auth, campaign, contact, and future AI-assist APIs.
- Resolve trusted `client_id` from auth and `client_access`.
- Enforce client isolation and cross-client denial.
- Create and update client-scoped campaigns.
- Validate step progression, readiness, slot assignment, and state transitions.
- Own final review and Deliverability Guard evaluation.
- Read and write Business PostgreSQL.
- Call listmonk after backend authorization only.
- Call AI providers in future as editorial assistants only, with usage logging.

Cannot do:
- Trust frontend-supplied `client_id`, limits, Guard result, or provider choice.
- Treat listmonk as source of truth.
- Let AI publish or send autonomously.
- Bypass Deliverability Guard.

### Business PostgreSQL

Can do:
- Store business source-of-truth data for clients, client access, campaigns, contacts, campaign-contact links, blocked sends, usage, template records, slot records, and future review artifacts.

Cannot do:
- Replace listmonk's operational database.
- Be accessed directly by UI.
- Decide send authorization by itself.

### Deliverability Guard

Can do:
- Enforce backend-owned dispatch rules.
- Fail closed when runtime prerequisites, client scope, limits, or contact eligibility are invalid.
- Apply campaign-level limits from the active contract model.

Cannot do:
- Be bypassed by review, AI, frontend, or listmonk.
- Be replaced by client-side validation.

### listmonk

Can do:
- Operate technical lists, subscribers, campaigns, and dispatch mechanics.
- Receive backend-approved HTML and subscriber/list mappings.
- Send through Mailpit in dev/staging and SMTP/provider infrastructure in approved environments.

Cannot do:
- Own business campaign lifecycle.
- Own business template truth.
- Decide `client_id`, limits, readiness, or authorization.
- Be accessed directly by frontend.

### AI Assistant

Can do:
- Generate or improve email copy, subject, preview text, and structured editorial suggestions in a future milestone.
- Analyze copy risk and propose alternatives.

Cannot do:
- Send email.
- Decide slot assignment or limits.
- Decide `client_id`.
- Decide Guard or review results.
- Apply output without explicit user approval.

### Mailpit / SMTP / SES

Mailpit:
- can capture safe dev/staging traffic for inspection
- cannot be used as production delivery

SMTP / SES:
- can remain provider infrastructure behind approved backend/listmonk flows
- cannot be directly chosen or controlled by frontend

## Authorized Flows

- Client portal -> FastAPI backend
- Admin portal -> FastAPI backend
- FastAPI backend -> Deliverability Guard
- FastAPI backend -> Business PostgreSQL
- FastAPI backend -> listmonk
- listmonk -> Mailpit in dev/staging
- listmonk -> SMTP/provider infrastructure in controlled environments
- future AI assist request -> FastAPI backend -> AI provider -> FastAPI backend

## Forbidden Flows

- UI -> PostgreSQL direct
- UI -> listmonk direct
- UI -> SMTP/provider direct
- listmonk -> Business PostgreSQL direct
- AI -> listmonk direct
- AI -> provider direct
- email sending without backend authorization
- email sending without Deliverability Guard
- frontend deciding `client_id`, limits, Guard result, or provider
- AI applying content without explicit user action
