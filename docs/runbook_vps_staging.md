# Sendwise VPS Staging Runbook

## Purpose

This staging runbook defines the minimum safe deploy and recovery flow for the Sendwise VPS. It assumes the app stack runs on Docker Compose and PostgreSQL data remains the only state that must survive rebuilds.

## Safety Baseline

- Take a fresh PostgreSQL backup before every deploy.
- Back up both `email_ai` and `listmonk`.
- Keep local and remote backup copies.
- Do not read secrets from versioned files.
- Do not run destructive Docker volume or database commands during routine operations.

Reference:

- `docs/runbook_backup_restore.md`

## Standard Staging Deploy

1. Confirm the current branch and target revision.
2. Run `./scripts/backup_postgres.sh`.
3. Verify the backup finished and produced a new timestamped snapshot.
4. Pull the target revision.
5. Rebuild and restart the stack.
6. Apply migrations after the new code is present.
7. Run health and smoke checks.

Suggested command sequence:

```bash
./scripts/backup_postgres.sh
git pull
docker compose up -d --build
./scripts/apply_migrations.sh
bash scripts/healthcheck.sh
bash scripts/smoke_test.sh
```

## Restore Safety

- Never restore directly into `email_ai` or `listmonk` as a first step.
- Always validate a backup with `./scripts/restore_postgres_check.sh` before planning a live restore.
- If validation fails, stop and investigate the snapshot instead of forcing a restore.

## Rollback Procedure

If a deploy is bad but data is intact:

1. Roll code back to the last known-good revision.
2. Rebuild and restart the stack.
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
