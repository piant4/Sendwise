# Local QA Signoff

Date: 2026-05-27
Scope: Milestone 20.4.1 local-only QA blocker clearance

## Last Validated Commits

- `e4d0003` - Stabilize backend pytest suite
- `6466631` - Clear RC follow-up review and test blockers

## Current Local QA Status

Status: local QA is ready to rerun after the local preflight passes.

This artifact is local-only. It does not approve VPS staging, production deployment, provider sends, or any runtime change outside the local Docker Compose stack.

Current verified baseline from 20.4 evidence:

- Backend pytest was green: `332 passed`.
- Frontend lint and build were green.
- Audit and smoke checks were green.
- Follow-up executor is not implemented.
- Production deploy is not approved.

Blockers cleared by 20.4.1:

- Existing local PostgreSQL volumes can be brought current by the migration runner instead of dropping data.
- Local QA has an explicit preflight for required follow-up columns.
- The dev Compose overlay forces a no-send Mailpit posture for local QA.

## Local QA Commands

Start local QA safely:

```bash
SENDWISE_ENV_FILE=.env.example docker compose --env-file .env.example -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Apply pending migrations to an existing local volume:

```bash
SENDWISE_ENV_FILE=.env.example SENDWISE_COMPOSE_ENV_FILE=.env.example SENDWISE_COMPOSE_FILES=docker-compose.yml:docker-compose.dev.yml bash scripts/apply_migrations.sh
```

Run the local QA preflight:

```bash
bash scripts/local_qa_preflight.sh
```

The preflight must pass before 20.4 local browser QA begins. If it reports missing columns, apply migrations. Recreating the local PostgreSQL volume is a last-resort manual recovery step only after preserving any needed local data.

Required schema columns:

- `campaign_sending_limits.followup_enabled`
- `campaign_sending_limits.followup_daily_limit`
- `campaign_sending_limits.followup_monthly_limit`
- `campaign_sending_limits.followup_delay_value`
- `campaign_sending_limits.followup_delay_unit`
- `email_logs.send_kind`

## Local Safety Assertions

- VPS not touched.
- No SSH.
- No remote commands.
- No staging or production DB mutation.
- No real sends.
- No provider replay.
- No Mailgun/Listmonk/Caddy/VPS runtime setting changes.
- No follow-up executor implemented.
- Not production deploy approval.

## 20.4 Local QA Rerun Checklist

- Start local stack with the dev-safe command above.
- Apply migrations with the local-safe migration command if the volume is not current.
- Run `bash scripts/local_qa_preflight.sh`.
- Run `bash scripts/audit.sh`.
- Run `bash scripts/smoke_test.sh`.
- Run backend pytest through the Docker backend image.
- Run frontend lint and build.
- Run browser QA only after the preflight is green.
- Confirm campaign create/update no longer fails with undefined follow-up columns.
