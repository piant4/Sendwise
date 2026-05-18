# Sendwise VPS Backup And Restore Runbook

## Purpose

This runbook defines the safe backup and restore strategy for Sendwise staging and the baseline that future production must exceed. The app VPS may stay stateless, but PostgreSQL data for both `email_ai` and `listmonk` must always be recoverable.

## Backup Policy

- Run backups hourly.
- Keep a local copy on the VPS filesystem.
- Keep a remote copy in S3-compatible object storage through `rclone` or an equivalent tool configured outside versioned files.
- Back up both PostgreSQL databases:
  - `email_ai`
  - `listmonk`
- Use `pg_dump` custom format archives so each dump is compressed and compatible with `pg_restore`.
- Retention policy:
  - 24 hourly snapshots
  - 7 daily snapshots
  - 4 weekly snapshots

## Script: `scripts/backup_postgres.sh`

The backup script is fail-fast and does not read `.env` directly. It relies on the running `postgres` container environment and optional runtime-provided variables.

Supported runtime variables:

- `BACKUP_DATABASES`
  Default: `email_ai listmonk`
- `BACKUP_ROOT`
  Default: `<repo>/backups/postgres`
- `POSTGRES_SERVICE`
  Default: `postgres`
- `BACKUP_RCLONE_REMOTE`
  Optional remote destination such as `sendwise-staging:postgres`

Behavior:

1. Verifies `docker` and Docker Compose are available.
2. Creates a timestamped hourly snapshot directory.
3. Dumps `email_ai` and `listmonk` with `pg_dump --format=custom --compress=9`.
4. Writes a local `SHA256SUMS` file for integrity checks.
5. Updates the daily and weekly snapshot mirrors from the newest hourly snapshot.
6. Applies local retention pruning.
7. If `BACKUP_RCLONE_REMOTE` is set, uploads the same hourly, daily, and weekly trees and applies remote retention pruning.

Example cron entry:

```cron
5 * * * * cd /opt/sendwise && /usr/bin/env BACKUP_RCLONE_REMOTE=sendwise-staging:postgres ./scripts/backup_postgres.sh >> /var/log/sendwise-backup.log 2>&1
```

## Script: `scripts/restore_postgres_check.sh`

This script is validation-only. It must never restore over `email_ai` or `listmonk`.

Behavior:

1. Selects a backup snapshot directory explicitly or uses the newest hourly snapshot.
2. Restores `email_ai.dump` into a temporary database name such as `email_ai_restore_check_<timestamp>`.
3. Restores `listmonk.dump` into a temporary database name such as `listmonk_restore_check_<timestamp>`.
4. Verifies the restored databases contain public tables.
5. Drops the temporary databases automatically on success unless `--keep-temp` is used.
6. On failure, prints the temporary database names and manual cleanup commands instead of touching live databases.

Example validation run:

```bash
./scripts/restore_postgres_check.sh
./scripts/restore_postgres_check.sh --snapshot-dir backups/postgres/hourly/20260516T120000Z
./scripts/restore_postgres_check.sh --keep-temp
```

Manual cleanup if temporary databases remain:

```bash
docker compose exec -T postgres sh -lc 'dropdb -U "$POSTGRES_USER" email_ai_restore_check_<timestamp>'
docker compose exec -T postgres sh -lc 'dropdb -U "$POSTGRES_USER" listmonk_restore_check_<timestamp>'
```

## Deploy Safety

Before any staging or production deploy:

1. Run `./scripts/backup_postgres.sh`.
2. Confirm the new hourly snapshot exists locally.
3. Confirm remote upload completed if `BACKUP_RCLONE_REMOTE` is configured.

Deploy order:

1. Pull the target code revision.
2. Rebuild and restart containers.
3. Apply migrations only after the new code and images are in place.
4. Run health checks after restart.
5. Run smoke checks before declaring success.

Minimum post-restart checks:

- `docker compose ps`
- `bash scripts/healthcheck.sh`
- `bash scripts/smoke_test.sh`

## Rollback Procedure

Code rollback:

1. Check out the previous known-good revision.
2. Rebuild and restart the stack for that revision.
3. Re-run health and smoke checks.

Database restore:

1. Stop and assess the incident before touching data.
2. Preserve the current failed state with a fresh backup if possible.
3. Validate the candidate backup with `./scripts/restore_postgres_check.sh`.
4. Restore only after the backup passes validation and the restore target is confirmed.
5. Restore `email_ai` and `listmonk` together from the same snapshot set.
6. Re-run health and smoke checks after recovery.

## Forbidden Destructive Commands

Never run these as part of routine deploys, debugging, or restore attempts:

- `docker compose down -v`
- `docker volume rm`
- `docker system prune --volumes`
- `DROP DATABASE`
- Any destructive restore over a live database without a verified backup

## Managed PostgreSQL Recommendation

- A self-managed PostgreSQL container is acceptable for staging if the backup policy above is active and tested.
- Managed PostgreSQL is preferred for production.
- The application VPS should remain stateless where practical.
- Production PostgreSQL must provide automated backups and point-in-time recovery.
- If production keeps `listmonk` on the same PostgreSQL cluster, the managed backup policy must cover both `email_ai` and `listmonk`.
