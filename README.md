# Sendwise

Sendwise is a Docker-first, multi-client email automation platform with a custom Next.js dashboard, FastAPI backend, Business PostgreSQL, and listmonk as the email engine.

The repository is the public reference for the current product/runtime shape. Detailed contracts and runbooks live in `docs/`; this README intentionally stays concise.

## Current Status

- Local product runtime is verified for admin-managed campaign setup, campaign-level sending limits, Deliverability Guard checks, backend-backed client dashboard analytics, contact metadata, and unsubscribe handling.
- VPS staging assets are present, including `docker-compose.staging.yml` and deployment runbooks.
- VPS deployment is not marked complete by this repository. First deploy must follow the staging runbook and keep real sends disabled.
- SES live sending is not generally enabled. Controlled send paths remain fail-closed behind backend safety gates and runtime configuration.
- The first staging deploy must use a no-send posture: `EMAIL_SENDING_ENABLED=false`.

## Product Summary

- Admin campaign creation and setup for selected clients.
- Admin-created client account provisioning with Clerk-owned password setup/reset and a Sendwise transactional access email.
- Campaign content management and review readiness without dispatching.
- Manual and CSV contact management for campaigns.
- Recipient metadata in `contacts.metadata`, including `nome` and optional `cognome` for `{{nome}}` / `{{cognome}}` personalization.
- Campaign-level sending limits through `campaign_sending_limits`.
- Backend Deliverability Guard enforcement before simulation or controlled send.
- Client dashboard analytics backed by backend-owned `client_dashboard` read models.
- Public frontend unsubscribe page with backend-owned validation, suppression, and event side effects.
- VPS staging deployment assets with Caddy HTTPS reverse proxy guidance.

## Architecture

```txt
Custom Next.js UI
        |
FastAPI Backend
        |
Deliverability Guard + Business Logic
        |
Business PostgreSQL
        |
listmonk
        |
SMTP / Amazon SES
```

Core ownership rules:

- FastAPI is the gatekeeper for product APIs, send decisions, client isolation, and business rules.
- Business PostgreSQL is the source of truth for clients, campaigns, contacts, usage, suppressions, provider events, blocked sends, and limit state.
- listmonk is the email mechanics engine only. It does not own product state.
- The frontend calls the backend only. It must not call listmonk or PostgreSQL directly.
- Real dispatch remains backend-authorized and fail-closed unless all safety gates pass.
- Client passwords remain Clerk-owned; Sendwise must not persist or email permanent plaintext passwords.

## Sending Limits

Sending limits are campaign scoped, not client email quotas.

- `campaign_sending_limits.period_email_limit` is the campaign 30-day period limit.
- `campaign_sending_limits.daily_email_limit` is an admin/internal pacing control.
- The client dashboard must not expose the configured daily limit.
- Deliverability Guard blocks dispatch with campaign limit reasons when daily or 30-day usage would exceed configured limits.
- Usage counts are based on real non-simulated send log rows, not recipient counts.

See `docs/api_contracts_v1.md` and `docs/data_model_v1.md` for the full contract.

## Client Dashboard Analytics

Client dashboard business metrics are backend owned through `client_dashboard`.

- The frontend may format data and switch periods, but it must not derive fake sent/open/block metrics from unrelated fields.
- Performance windows are `24h`, `7d`, `14d`, `30d`, and `allTime`.
- Delivery, open, click, bounce, complaint, and unsubscribe metrics are provider-event-backed only.
- Blocked metrics come from `blocked_sends`.
- Unavailable metric sources remain unavailable rather than being synthesized.

## Repository Structure

```txt
.
|-- backend/                  # FastAPI service, schemas, repositories, guard layer
|-- frontend/                 # Next.js dashboard
|-- db/                       # PostgreSQL init and migrations
|-- docs/                     # Architecture, contracts, audit notes, runbooks
|-- listmonk/                 # listmonk boundary/configuration
|-- mailpit/                  # Dev/staging email capture boundary
|-- scripts/                  # Install, audit, healthcheck, backup, restore, smoke scripts
|-- templates/                # Email template placeholders
|-- docker-compose.yml        # Local development stack
|-- docker-compose.dev.yml    # Mailpit dev overlay
|-- docker-compose.staging.yml # VPS staging override
`-- Makefile                  # Common developer commands
```

## Quick Start

Prerequisites:

- Docker
- Docker Compose
- Make

Start the local stack:

```bash
cp .env.example .env
docker compose --env-file .env up -d
```

Local services:

- Frontend: <http://localhost:3000>
- Backend: <http://localhost:8000>
- Backend health: <http://localhost:8000/health>
- listmonk: <http://localhost:9000>

Start with the dev Mailpit overlay:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Mailpit:

- Web UI: <http://localhost:8025>
- SMTP: `localhost:1025`

Mailpit is for development/staging capture only and must not be used as a production send posture.

## Migrations

Fresh PostgreSQL volumes are initialized by `db/init.sql`. Existing local or staging volumes must be updated with the migration runner:

```bash
./scripts/apply_migrations.sh
./scripts/apply_migrations.sh --dry-run
```

The runner applies pending files from `db/migrations` through the Docker Compose `postgres` service and records them in `schema_migrations`.

## Checks

```bash
bash scripts/audit.sh
bash scripts/smoke_test.sh
bash scripts/healthcheck.sh
SENDWISE_ENV_FILE=.env.example docker compose --env-file .env.example config
SENDWISE_ENV_FILE=.env.example docker compose --env-file .env.example -f docker-compose.yml -f docker-compose.dev.yml config
cd frontend && npm run lint
cd frontend && npm run build
```

`make audit`, `make smoke`, `make health`, and `make compose-config` are also available shortcuts.

## Staging Deployment

Staging uses the base Compose file plus `docker-compose.staging.yml`:

```bash
SENDWISE_ENV_FILE=.env.example docker compose --env-file .env.example -f docker-compose.yml -f docker-compose.staging.yml config
docker compose --env-file .env -f docker-compose.yml -f docker-compose.staging.yml up -d --build
```

The VPS `.env` is the source of truth for runtime builds and container runtime environment. `--env-file` controls Docker Compose interpolation, while service-level `env_file` controls container environment injection. Listmonk SMTP config is sourced from `.env` with the `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_TLS`, and `SMTP_FROM_EMAIL` values; after SMTP env changes, recreate `listmonk` and `backend`. For safe validation against `.env.example`, set `SENDWISE_ENV_FILE=.env.example` so service-level `env_file` does not read the real `.env`. Never run public or shared config dumps against a real `.env`, and never commit `.env`.

Recommended staging domains:

- `staging-app.mailerpro.it`
- `staging-api.mailerpro.it`

Caddy is the intended public HTTPS reverse proxy. Containers should bind frontend/backend ports to localhost on the VPS, while PostgreSQL, listmonk, and Mailpit remain non-public.

Use `docs/runbook_vps_staging.md` for the full deploy flow, port policy, first-deploy QA checklist, rollback guidance, and forbidden destructive command policy.

## Backup And Restore

Backup and restore validation are documented in `docs/runbook_backup_restore.md`.

Relevant scripts:

- `scripts/backup_postgres.sh`
- `scripts/restore_postgres_check.sh`

Backups cover both the Sendwise business database and listmonk database. Restore checks must validate into temporary databases before any live restore is considered.

## Safety Defaults

- Keep `EMAIL_SENDING_ENABLED=false` for first staging deploy and any no-send validation.
- Do not run real sends before SES readiness and controlled validation are explicitly approved.
- First SES validation may use `REAL_SEND_MAX_RECIPIENTS=1` and `REAL_SEND_REQUIRE_ALLOWED_RECIPIENTS=true`.
- Official product trials should use `REAL_SEND_MAX_RECIPIENTS=0` and `REAL_SEND_REQUIRE_ALLOWED_RECIPIENTS=false`; admin-configured campaign daily and 30-day limits are the real product limits.
- `EMAIL_SENDING_ENABLED=false` remains the emergency global off switch.
- Do not call send/dispatch endpoints during first VPS deploy.
- Do not use direct listmonk send or SES console send as a shortcut around backend gates.
- Do not commit `.env` files, secrets, tokens, passwords, API keys, AWS credentials, SMTP credentials, Clerk secrets, Listmonk credentials, unsubscribe secrets, or real recipient allowlists.
- Consult the runbooks for destructive command policy instead of copying those procedures into ad hoc workflows.

## SES Deliverability Readiness

Official product trials require a documented SES posture before any approved real send:

- Verify the SES sending identity at the domain level and use a `SMTP_FROM_EMAIL` address that belongs to that verified identity.
- Enable SES DKIM and confirm the DNS records are verified before trials.
- Publish SPF for the sending domain and include Amazon SES in that policy.
- Publish a DMARC record for the sending domain before public trials.
- Configure a MAIL FROM domain if the SES setup depends on a custom return path.
- Move the SES account out of sandbox before sending to non-verified recipients.
- Keep `SMTP_HOST` as a bare host name only; do not include `smtp://` or `smtps://`.
- Use SES SMTP credentials for `SMTP_USERNAME` and `SMTP_PASSWORD`; do not use AWS access keys in Listmonk SMTP auth.
- Keep `FRONTEND_URL` as the public unsubscribe origin and keep `BACKEND_PUBLIC_URL` as the public API origin only.
- Expect real bounce and complaint handling to come from provider events plus suppression writes; do not assume inbox delivery from accepted sends alone.
- Current provider webhook support is partial: normalized events are ingested, but SES SNS `SubscriptionConfirmation` handling and SNS signature validation remain pending.

Safe warmup guidance:

- Start with low-volume campaigns and raise volume gradually.
- Keep campaign `daily_email_limit` conservative during the first trial days.
- Watch bounce and complaint rates after each send window.
- Stop the trial and investigate content, targeting, and DNS posture if bounce or complaint rates spike.

Secret rotation remains required before official trials because earlier config output exposed secret values. Rotate at minimum:

- `CLERK_SECRET_KEY`
- `BACKEND_API_KEY`
- `UNSUBSCRIBE_TOKEN_SECRET`
- SES SMTP credentials
- Listmonk API/admin token or password
- PostgreSQL password if operationally feasible

## Documentation

Main reference documents:

- `docs/architecture_v1.md`
- `docs/api_contracts_v1.md`
- `docs/data_model_v1.md`
- `docs/states_v1.md`
- `docs/ownership_v1.md`
- `docs/structural_contracts_v1.md`
- `docs/audit_checklist_v1.md`
- `docs/runbook_vps_staging.md`
- `docs/runbook_backup_restore.md`
- `docs/runbook_ses_controlled_send.md`

When behavior changes, update the matching contract or runbook with the code.

## Roadmap And Boundaries

Implemented or repository-backed:

- Docker Compose local stack.
- FastAPI backend with admin/client product APIs.
- Next.js admin and client dashboard workflows.
- Business PostgreSQL persistence and migrations.
- listmonk engine boundary.
- Mailpit dev/staging capture.
- Campaign-level sending limits and Guard enforcement.
- Backend-backed client dashboard analytics.
- Public unsubscribe page routed through the frontend and backed by the backend API.
- VPS staging and backup/restore assets.

Still constrained or future:

- VPS staging deploy execution is not complete unless tracked separately outside this repository.
- SES live send is not generally enabled.
- Production authentication/role hardening remains an active boundary.
- AI content generation remains future work.
- Background worker/scheduling expansion remains future work.

Explicitly out of scope for core V1:

- Budibase as the final dashboard.
- Postal.
- Rspamd.
- Mautic.
- Keila.
- n8n as core V1. n8n is optional and is not part of the Sendwise core V1 runtime.
- Direct provider sending as the default product path.
- Direct UI access to listmonk or PostgreSQL.
- n8n is optional, not core V1.

## Contributing

Keep changes aligned with repository contracts:

1. Update code and docs together.
2. Keep FastAPI as the single business gatekeeper.
3. Keep Business PostgreSQL as the product source of truth.
4. Keep listmonk as the engine, not the owner.
5. Preserve safe no-send defaults unless an approved controlled validation explicitly changes runtime configuration.
6. Run the relevant audit, smoke, lint, and build checks before opening a pull request.

## License

License information has not been added yet.
