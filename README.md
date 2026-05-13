# Sendwise

> 🚀 Docker-first foundation for a multi-client email automation platform powered by a custom dashboard, FastAPI, PostgreSQL, and listmonk.

Sendwise is the V1 skeleton for an installable Email AI Automation Platform. It defines the product boundary, service topology, API contracts, data ownership rules, and local/VPS deployment path for a controlled email system.

⚠️ **Milestone status:** this repository is a platform skeleton. Real email sending and AI generation are intentionally disabled in the current milestone.

## ✨ Highlights

- 🧠 **FastAPI backend as the gatekeeper** for business rules, client isolation, send authorization, and Deliverability Guard checks.
- 🖥️ **Custom Next.js dashboard** for admin and client-facing product workflows.
- 🗄️ **Business PostgreSQL** as the source of truth for clients, campaigns, contacts, usage, suppressions, and send decisions.
- 📬 **listmonk engine integration** for email mechanics, subscribers, technical campaigns, tracking, and SMTP/SES delivery.
- 🧪 **Mailpit dev overlay** for safe local and staging email capture.
- 🐳 **Docker Compose target** for local development and Linux VPS deployment.
- 🔒 **Audit scripts and structural contracts** to protect the architecture from accidental shortcuts.

## 🧱 Architecture

```txt
Custom Next.js UI
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

Core ownership rules:

- **Backend is gatekeeper.** All product APIs, send decisions, client isolation, and business rules go through FastAPI.
- **listmonk is engine only.** It handles operational email mechanics, but it does not own product state.
- **PostgreSQL is the business source of truth.** Client data, campaigns, contacts, usage, suppressions, and mappings live there.
- **UI calls the backend only.** The frontend must not call listmonk or write directly to PostgreSQL.
- **n8n is optional, not core V1.** If n8n or Activepieces are added later, they must call the backend only.

## 📦 Repository Structure

```txt
.
├── backend/                 # FastAPI service, API stubs, schemas, guard layer
├── frontend/                # Next.js dashboard skeleton
├── db/                      # PostgreSQL init and migration placeholders
├── docs/                    # Architecture, API contracts, data model, audit docs
├── listmonk/                # listmonk configuration boundary
├── mailpit/                 # Dev/staging email capture boundary
├── scripts/                 # Install, audit, healthcheck, and smoke scripts
├── templates/               # MJML email template placeholders
├── docker-compose.yml       # Core stack
├── docker-compose.dev.yml   # Mailpit dev/staging overlay
└── Makefile                 # Common developer commands
```

## 🛠️ Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python |
| Database | PostgreSQL 16 |
| Email engine | listmonk |
| Dev email capture | Mailpit |
| Runtime | Docker, Docker Compose |

## 🚀 Quick Start

### Prerequisites

- Docker
- Docker Compose
- Make

### Start the stack

```bash
git clone <repo-url>
cd Sendwise
cp .env.example .env
bash scripts/install.sh
docker compose up -d
```

Services:

- Frontend: <http://localhost:3000>
- Backend: <http://localhost:8000>
- Backend health: <http://localhost:8000/health>
- listmonk: <http://localhost:9000>

### Start with Mailpit for dev/staging

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Mailpit:

- Web UI: <http://localhost:8025>
- SMTP: `localhost:1025`

Mailpit is dev/staging only and must not be used for production sending.

### Apply database migrations

`db/init.sql` initializes fresh PostgreSQL volumes. Existing dev or staging
volumes must be updated explicitly with the migration runner:

```bash
./scripts/apply_migrations.sh
```

The runner uses the `postgres` Docker Compose service, creates
`schema_migrations` if needed, applies pending files from `db/migrations` in
lexicographic order, and skips files already recorded. To inspect status without
changing the database:

```bash
./scripts/apply_migrations.sh --dry-run
```

## 🧪 Development Commands

```bash
make audit
make smoke
make health
make compose-config
```

What they do:

| Command | Purpose |
| --- | --- |
| `make audit` | Validates required files, service boundaries, and architectural guardrails. |
| `make smoke` | Validates Docker Compose config and runs the audit. |
| `make health` | Checks the backend health endpoint. |
| `make compose-config` | Renders the effective Docker Compose configuration. |

## ✅ Health Check

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

## 🔐 Safety Defaults

Sendwise is conservative by default:

- `EMAIL_SENDING_ENABLED=false` in `.env.example`.
- `EMAIL_PROVIDER=mailpit` in `.env.example`; SES is never the default.
- SES controlled send requires explicit runtime overrides plus `REAL_SEND_ALLOWED_RECIPIENTS` and `REAL_SEND_MAX_RECIPIENTS`.
- Only the exact string `"true"` may enable future send logic.
- PostgreSQL is not publicly exposed in the production compose file.
- Mailpit is excluded from the production compose file.
- listmonk admin access must be protected before production use.
- Client data must be isolated by `client_id`.
- No email may be sent without backend authorization.

### SES controlled send

Milestone 12 adds a dev/staging SES controlled-send gate for 1-3 explicitly allowed recipients. It remains fail-closed unless `EMAIL_SENDING_ENABLED=true`, `EMAIL_PROVIDER=ses`, SES SMTP env is complete, `BACKEND_PUBLIC_URL` is public, Guard authorizes the campaign, and every eligible recipient is listed in `REAL_SEND_ALLOWED_RECIPIENTS`.

Use `docs/runbook_ses_controlled_send.md` and `scripts/validate_ses_readiness.sh` before any SES live test. Do not commit SMTP credentials, AWS secrets, or real recipient allowlists.

## 📚 Documentation

The main project contracts live in `docs/`:

- `docs/architecture_v1.md`
- `docs/api_contracts_v1.md`
- `docs/data_model_v1.md`
- `docs/states_v1.md`
- `docs/ownership_v1.md`
- `docs/structural_contracts_v1.md`
- `docs/audit_checklist_v1.md`

These docs define how the product should evolve. When behavior changes, update the matching contract document with the code.

## 🗺️ Roadmap

Current milestone:

- ✅ Docker Compose foundation
- ✅ FastAPI skeleton and typed API stubs
- ✅ Next.js dashboard skeleton
- ✅ PostgreSQL schema stubs
- ✅ listmonk as email engine boundary
- ✅ Mailpit dev/staging overlay
- ✅ Audit and smoke scripts
- ⏳ Real send authorization flow
- ⏳ Production authentication and roles
- ⏳ AI content generation
- ⏳ Provider/webhook event ingestion
- ⏳ Background workers and scheduling

Future optional integrations:

- n8n or Activepieces as backend-only integration layers
- Keycloak for a later auth milestone
- Celery if background task volume justifies it
- Metabase for internal read-only analytics

## 🚫 Explicitly Out of Scope

These are not part of core V1:

- Budibase as the final dashboard
- Postal
- Rspamd
- Mautic
- Keila
- n8n as core V1
- Direct provider sending from the backend as the default V1 path
- Direct UI access to listmonk or PostgreSQL

## 🤝 Contributing

Keep changes aligned with the repository contracts:

1. Update code and docs together.
2. Keep FastAPI as the single business gatekeeper.
3. Keep listmonk as the engine, not the source of truth.
4. Preserve `EMAIL_SENDING_ENABLED=false` as the safe default.
5. Run `make audit` before opening a pull request.

## 📄 License

License information has not been added yet.
