# Email AI Automation Platform V1

Source of truth: `project_handoff_v1.md`. Older files are historical context only. If anything conflicts with the handoff, the handoff wins.

This repository is the Milestone 0 base for a multi-client Email AI Automation Platform that can be installed on a Linux VPS with Docker and Docker Compose.

No real sending is implemented in Milestone 0.

## V1 Architecture

```txt
UI Custom Next.js
↓
FastAPI Backend
↓
Deliverability Guard + Business Logic
↓
Business PostgreSQL
↓
listmonk
↓
SMTP / Amazon SES
```

Core principle:

```txt
Backend = brain/gatekeeper
listmonk = email engine
UI = product
PostgreSQL = business source of truth
n8n = optional future integration layer, not core V1
```

## Components Included

- Custom Next.js frontend skeleton.
- FastAPI backend skeleton.
- Business PostgreSQL schema stubs.
- listmonk service as email engine.
- MJML placeholder templates.
- Mailpit dev/staging compose overlay.
- Audit, smoke, install, and healthcheck scripts.

## Components Optional

- n8n is optional, not core V1. If added later, it must call the backend only.
- Activepieces can follow the same future integration rule.
- Keycloak, Celery, and Metabase are future options, not Milestone 0 features.

## Components Excluded

- Budibase as final dashboard.
- Postal.
- Rspamd.
- Mautic.
- Keila.
- n8n as core V1.
- Direct provider sending from backend as the default V1 path.
- Direct UI access to listmonk or PostgreSQL.

## Setup

```bash
git clone <repo>
cd <repo>
cp .env.example .env
bash scripts/install.sh
docker compose up -d
```

For dev/staging Mailpit:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Mailpit is dev/staging only and must not be used in production.

## Development Commands

```bash
make audit
make smoke
make health
make compose-config
```

Backend health endpoint:

```txt
GET /health
```

Expected response:

```json
{
  "status": "ok",
  "service": "email-ai-platform",
  "version": "v1-skeleton"
}
```

## Docker / VPS Target

The base target is a Linux VPS with Docker and Docker Compose. PostgreSQL is not publicly exposed in production compose. Backend may expose `8000` and frontend may expose `3000` for local development. listmonk admin access must be protected before production use.

## Audit Rules

- Backend is the only gatekeeper.
- No email sending without backend authorization.
- `EMAIL_SENDING_ENABLED` defaults to `false`.
- Only exact string `"true"` enables sending in future logic.
- UI does not call listmonk.
- UI does not write to PostgreSQL.
- listmonk is engine only.
- Business PostgreSQL is source of truth.
- n8n is optional future layer, not core V1.
- Mailpit is dev/staging only.
- PostgreSQL is not publicly exposed.
- Client data must be isolated by `client_id`.
- Codex must not change contracts without explicit instruction.
