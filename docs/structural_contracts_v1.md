# Structural Contracts V1

Source of truth: `project_handoff_v1.md`.

These contracts are binding for V1 until explicitly changed. Older files are historical context only.

## Mandatory Rules

- Backend is the only gatekeeper.
- UI talks only to backend.
- Backend talks to Business PostgreSQL and listmonk.
- listmonk is not the business source of truth.
- Mailpit is dev/staging only.
- n8n is optional future integration layer only.
- No component may bypass the Deliverability Guard.
- No email may be sent without backend authorization.
- Codex must not change contracts without explicit instruction.

## Components

### UI Custom Next.js

Can do:
- Render admin and client dashboards.
- Call FastAPI backend endpoints.
- Display states, metrics, blocked-send reasons, and usage data returned by backend.
- Use mock API data during skeleton and early frontend development.

Cannot do:
- Decide business logic.
- Call listmonk directly.
- Write to PostgreSQL directly.
- Authorize sending.
- Bypass Deliverability Guard.

Can communicate with:
- FastAPI backend only.

Cannot communicate with:
- Business PostgreSQL.
- listmonk.
- SMTP / Amazon SES.
- Mailpit.

### FastAPI Backend

Can do:
- Serve admin and client APIs.
- Enforce business rules and client isolation.
- Own send authorization.
- Call Deliverability Guard.
- Read/write Business PostgreSQL.
- Call listmonk API after authorization.
- Receive provider/listmonk events.

Cannot do:
- Send directly through SMTP / Amazon SES as the default V1 path.
- Bypass Deliverability Guard.
- Treat listmonk as source of truth.
- Implement real sending in Milestone 0.

Can communicate with:
- UI Custom Next.js.
- Business PostgreSQL.
- listmonk.
- Future n8n/Activepieces/webhook callers through backend API.

Cannot communicate with:
- SMTP / Amazon SES directly for default V1 campaign sending.

### Business PostgreSQL

Can do:
- Store business source-of-truth data.
- Store clients, campaigns, contacts, send decisions, events, usage, mappings, and blocked sends.

Cannot do:
- Replace listmonk's operational email engine database.
- Be accessed directly by UI.
- Decide sending policy.

Can communicate with:
- FastAPI backend.

Cannot communicate with:
- UI.
- listmonk directly.
- n8n directly in core V1.

### listmonk

Can do:
- Operate as the email engine.
- Manage technical lists, subscribers, campaigns, tracking, and unsubscribe handling.
- Send through configured SMTP / Amazon SES after backend authorization.

Cannot do:
- Decide business logic.
- Own client source-of-truth data.
- Authorize sending by itself.
- Be accessed directly by UI or n8n.

Can communicate with:
- FastAPI backend.
- SMTP / Amazon SES provider.
- Mailpit in dev/staging only.

Cannot communicate with:
- Business PostgreSQL directly.
- UI directly.
- n8n directly.

### SMTP / Amazon SES

Can do:
- Act as the production delivery provider behind listmonk.

Cannot do:
- Be called directly by the backend as the default V1 path.
- Be called directly by UI or n8n.
- Decide business logic.

Can communicate with:
- listmonk.

Cannot communicate with:
- UI.
- Business PostgreSQL.
- n8n.

### Mailpit

Can do:
- Capture dev/staging email for inspection.
- Support safe HTML, subject, unsubscribe, and event testing.

Cannot do:
- Be used in production.
- Be treated as the production sending provider.
- Decide business logic.

Can communicate with:
- listmonk in dev/staging.

Cannot communicate with:
- Production traffic.
- UI directly.
- Business PostgreSQL.

### MJML

Can do:
- Define responsive email template placeholders.
- Provide future integration points for AI-generated content.

Cannot do:
- Contain real campaign copy in Milestone 0.
- Decide sending or business rules.

Can communicate with:
- Backend/template rendering pipeline in future milestones.

Cannot communicate with:
- listmonk, SMTP, PostgreSQL, or UI directly.

### Worker Python Minimal

Can do:
- Run future technical background tasks.
- Sync listmonk stats.
- Normalize provider/listmonk events.
- Process simple retries and KPI updates.

Cannot do:
- Become a second business brain.
- Authorize sending independently.
- Bypass backend or Deliverability Guard.
- Require full Celery setup in Milestone 0.

Can communicate with:
- FastAPI backend modules and Business PostgreSQL in future milestones.
- listmonk through backend-owned integration code in future milestones.

Cannot communicate with:
- SMTP / Amazon SES directly for default V1 sending.

### n8n Optional Future Layer

Can do:
- Serve as a future integration layer for CRM, Google Sheets, external webhooks, and notifications.

Cannot do:
- Be core V1.
- Call listmonk directly.
- Call SMTP directly.
- Decide business rules.
- Bypass backend or Deliverability Guard.

Can communicate with:
- FastAPI backend only.

Cannot communicate with:
- listmonk directly.
- SMTP / Amazon SES directly.
- Business PostgreSQL directly.

## Authorized Flows

- Dashboard Admin -> Backend
- Dashboard Client -> Backend
- Backend -> Business PostgreSQL
- Backend -> listmonk
- listmonk -> SMTP provider
- listmonk -> Mailpit in dev/staging
- future n8n/Activepieces/webhook -> Backend

## Forbidden Flows

- UI -> PostgreSQL direct
- UI -> listmonk direct
- n8n -> listmonk direct
- n8n -> SMTP direct
- listmonk -> Business PostgreSQL direct
- Mailpit in production
- email sending without backend authorization
- email sending without Deliverability Guard
- dashboard deciding business logic
- Codex changing contracts without explicit instruction
