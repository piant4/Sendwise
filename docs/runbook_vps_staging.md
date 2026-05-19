# Sendwise VPS Staging Runbook

## Purpose

This staging runbook defines the safe first VPS deploy flow for Sendwise without enabling real sending. The staging app is served through Caddy HTTPS on `staging-app.mailerpro.it` and `staging-api.mailerpro.it`; Docker services bind only to localhost or remain internal.

## Safety Baseline

- Take a fresh PostgreSQL backup before every deploy.
- Back up both `email_ai` and `listmonk`.
- Keep local and remote backup copies.
- Do not read secrets from versioned files.
- Do not commit env files, tokens, passwords, API keys, Clerk secrets, Listmonk credentials, PostgreSQL passwords, SMTP credentials, unsubscribe secrets, or AWS credentials.
- First VPS deploy must keep sends disabled.
- First VPS deploy must not enable real sending.
- During first VPS deploy, do not call any send or dispatch endpoint.
- During first VPS deploy, do not use direct Listmonk send.
- During first VPS deploy, do not use SES console send.
- SES readiness and controlled SES validation are later milestones, not part of first VPS deploy.
- Do not run destructive Docker volume or database commands during routine operations.

Reference:

- `docs/runbook_backup_restore.md`

## Staging Domains And Reverse Proxy

Caddy is the only public HTTP/HTTPS entrypoint. Backend and frontend containers must bind to localhost on the VPS, with Caddy terminating HTTPS and proxying to those local ports.

Required Caddy config:

```caddyfile
staging-app.mailerpro.it {
	reverse_proxy 127.0.0.1:3000
}

staging-api.mailerpro.it {
	reverse_proxy 127.0.0.1:8000
}
```

Required public URLs:

- Frontend: `https://staging-app.mailerpro.it`
- API: `https://staging-api.mailerpro.it`
- Public unsubscribe links must use `BACKEND_PUBLIC_URL=https://staging-api.mailerpro.it`.

## Staging Environment Requirements

Configure real values only on the VPS environment. Do not place secrets in versioned files.
The VPS `.env` is the source of truth for Docker Compose runtime builds and container runtime environment. Always pass `--env-file .env` to staging runtime commands. `--env-file` controls Docker Compose interpolation, while service-level `env_file` controls container environment injection. For safe validation against `.env.example`, set `SENDWISE_ENV_FILE=.env.example` so service-level `env_file` does not read the real `.env`. After editing `.env`, recreate the affected containers; old containers keep their old environment. Never commit `.env`.

Required non-secret staging values:

```env
FRONTEND_URL=https://staging-app.mailerpro.it
BACKEND_PUBLIC_URL=https://staging-api.mailerpro.it
NEXT_PUBLIC_API_BASE_URL=https://staging-api.mailerpro.it
ENVIRONMENT=staging
EMAIL_SENDING_ENABLED=false
EMAIL_PROVIDER=mailpit
REAL_SEND_REQUIRE_ALLOWED_RECIPIENTS=true
REAL_SEND_MAX_RECIPIENTS=1
REAL_SEND_ALLOWED_RECIPIENTS=
```

Required secret-backed values must be configured only on the VPS:

- Real Clerk issuer, JWKS URL, audience if used, publishable key, and secret key.
- Real Listmonk username and password.
- Real PostgreSQL database, user, and password.
- Real backend API key and unsubscribe/signing secrets required by the deployed backend.
- Real SMTP or AWS SES credentials only in the later SES readiness milestone.

For first deploy, use `EMAIL_PROVIDER=mailpit` or another safe non-send provider while `EMAIL_SENDING_ENABLED=false`. Keep `REAL_SEND_ALLOWED_RECIPIENTS=` empty until the controlled SES validation milestone.

## Standard Staging Deploy

1. Confirm the current branch and target revision.
2. Run mandatory Linux/VPS checks listed below.
3. Run `./scripts/backup_postgres.sh`.
4. Verify the backup finished and produced a new timestamped snapshot.
5. Pull the target revision.
6. Render and inspect the staging Compose config.
7. Rebuild and restart the stack with the staging override.
8. Apply migrations after the new code is present.
9. Run health and smoke checks.
10. Complete the QA checklist without triggering real sends.

Suggested command sequence:

```bash
bash -n scripts/apply_migrations.sh
bash -n scripts/backup_postgres.sh
bash -n scripts/restore_postgres_check.sh
cd frontend && npm run lint
cd frontend && npm run build
cd ..
bash scripts/audit.sh
bash scripts/smoke_test.sh
./scripts/backup_postgres.sh
git pull
SENDWISE_ENV_FILE=.env.example docker compose --env-file .env.example -f docker-compose.yml -f docker-compose.staging.yml config
docker compose --env-file .env -f docker-compose.yml -f docker-compose.staging.yml up -d --build
./scripts/apply_migrations.sh
bash scripts/healthcheck.sh
bash scripts/smoke_test.sh
```

## Compose Port Policy

The staging Compose stack must expose only:

- `127.0.0.1:3000:3000` for frontend.
- `127.0.0.1:8000:8000` for backend.

The staging Compose stack must not publish public host ports for:

- PostgreSQL.
- Listmonk.
- Mailpit.

Use this command before every staging restart:

```bash
SENDWISE_ENV_FILE=.env.example docker compose --env-file .env.example -f docker-compose.yml -f docker-compose.staging.yml config
```

Never run public or shared config dumps against a real `.env`.
Stop if the rendered config shows `0.0.0.0:3000`, `0.0.0.0:8000`, public `9000`, public `5432`, public `8025`, or public `1025`.

## First Deploy QA Checklist

Admin:

- Login admin.
- Campaign create/setup works.
- Campaign limits save and reload.
- Content save works.
- Contacts manual add works.
- CSV import works.
- Remove contact works.
- Review ready state works.
- Blocked dispatch: dispatch is blocked with sends disabled.

Client:

- Client dashboard loads.
- `Performance campagne` is visible.
- Period selector is visible.
- Client daily limit is hidden.
- Client campaigns page loads.
- No recipient count is used as send usage.

Public:

- 404 page loads with illustration.
- Invalid-token unsubscribe returns safe HTML.

## SES Readiness Later Step

SES readiness is intentionally separated from first VPS deploy. A later controlled validation may enable real sending only after:

- Caddy HTTPS is live for both staging domains.
- `BACKEND_PUBLIC_URL=https://staging-api.mailerpro.it` is verified in unsubscribe links.
- `EMAIL_SENDING_ENABLED` is explicitly reviewed.
- `REAL_SEND_REQUIRE_ALLOWED_RECIPIENTS=true`.
- `REAL_SEND_MAX_RECIPIENTS=1`.
- `REAL_SEND_ALLOWED_RECIPIENTS` contains only the single approved validation recipient.
- No direct Listmonk send is used.
- No SES console send is used outside the approved validation plan.

## Official Product Trial Send Posture

Use the one-recipient gate only for first SES validation:

```env
REAL_SEND_MAX_RECIPIENTS=1
REAL_SEND_REQUIRE_ALLOWED_RECIPIENTS=true
```

For official product trials, keep backend safety gates active while allowing the campaign audience:

```env
REAL_SEND_MAX_RECIPIENTS=0
REAL_SEND_REQUIRE_ALLOWED_RECIPIENTS=false
```

Campaign limits configured by the admin are the real product daily and 30-day limits. `EMAIL_SENDING_ENABLED=false` remains the emergency global off switch. Do not bypass Deliverability Guard, suppression checks, unsubscribe readiness, or the backend send path with direct Listmonk or SES sends.

## Restore Safety

- Never restore directly into `email_ai` or `listmonk` as a first step.
- Always validate a backup with `./scripts/restore_postgres_check.sh` before planning a live restore.
- If validation fails, stop and investigate the snapshot instead of forcing a restore.

## Rollback Procedure

If a deploy is bad but data is intact:

1. Roll code back to the last known-good revision.
2. Rebuild and restart the stack with `docker compose --env-file .env -f docker-compose.yml -f docker-compose.staging.yml up -d --build`.
3. Re-run `bash scripts/healthcheck.sh` and `bash scripts/smoke_test.sh`.

If data recovery is required:

1. Take one more safety backup of the current state if the cluster is still readable.
2. Run `./scripts/restore_postgres_check.sh --snapshot-dir <candidate-snapshot>`.
3. Only after a successful check, schedule the real restore with explicit operator approval.
4. Restore `email_ai` and `listmonk` from the same snapshot family.
5. Re-run health and smoke checks after recovery.

## Forbidden Commands

Do not run any of the following on staging or production unless the incident procedure explicitly requires it and a verified backup already exists:

- `docker compose down -v`
- `docker volume rm`
- `docker system prune --volumes`
- `DROP DATABASE`
- A destructive restore over a live database without a validated backup

## Production Direction

- Staging may continue on the VPS PostgreSQL container while backup validation is in place.
- Production should prefer managed PostgreSQL with automated backups and point-in-time recovery.
- Keeping the application VPS stateless reduces deploy and rollback risk.
