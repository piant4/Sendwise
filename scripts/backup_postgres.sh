#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/backup_postgres.sh

Creates local PostgreSQL backups for the configured databases, mirrors them into
hourly/daily/weekly retention trees, and optionally uploads them to an rclone
remote when BACKUP_RCLONE_REMOTE is set.
EOF
}

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

if [ "$#" -ne 0 ]; then
  usage
  exit 2
fi

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

checksum_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    echo ""
  fi
}

sync_snapshot_tree() {
  local src_dir="$1"
  local dest_dir="$2"
  local existing=()

  mkdir -p "$dest_dir"
  shopt -s nullglob
  existing=("$dest_dir"/*)
  shopt -u nullglob
  if [ "${#existing[@]}" -gt 0 ]; then
    rm -f "${existing[@]}"
  fi

  cp -f "$src_dir"/* "$dest_dir"/
}

prune_local_dirs() {
  local base_dir="$1"
  local keep_count="$2"
  local dirs=()
  local prune_total=0
  local idx=0

  mkdir -p "$base_dir"
  shopt -s nullglob
  for path in "$base_dir"/*; do
    if [ -d "$path" ]; then
      dirs+=("$path")
    fi
  done
  shopt -u nullglob

  if [ "${#dirs[@]}" -le "$keep_count" ]; then
    return
  fi

  prune_total=$(("${#dirs[@]}" - keep_count))
  for ((idx = 0; idx < prune_total; idx += 1)); do
    rm -rf "${dirs[$idx]}"
  done
}

prune_remote_dirs() {
  local remote_dir="$1"
  local keep_count="$2"
  local entries=()
  local prune_total=0
  local idx=0

  if ! rclone lsf --dirs-only "$remote_dir" >/dev/null 2>&1; then
    return
  fi

  mapfile -t entries < <(rclone lsf --dirs-only "$remote_dir" | sed 's:/$::' | LC_ALL=C sort)

  if [ "${#entries[@]}" -le "$keep_count" ]; then
    return
  fi

  prune_total=$(("${#entries[@]}" - keep_count))
  for ((idx = 0; idx < prune_total; idx += 1)); do
    rclone purge "${remote_dir}/${entries[$idx]}"
  done
}

require_command docker
if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose is unavailable. Install Docker Compose before running backups." >&2
  exit 1
fi

backup_root="${BACKUP_ROOT:-$repo_root/backups/postgres}"
postgres_service="${POSTGRES_SERVICE:-postgres}"
hourly_retention="${BACKUP_RETENTION_HOURLY:-24}"
daily_retention="${BACKUP_RETENTION_DAILY:-7}"
weekly_retention="${BACKUP_RETENTION_WEEKLY:-4}"
rclone_remote="${BACKUP_RCLONE_REMOTE:-}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
day_key="$(date -u +%F)"
week_key="$(date -u +%G-W%V)"
snapshot_dir="$backup_root/hourly/$timestamp"
daily_dir="$backup_root/daily/$day_key"
weekly_dir="$backup_root/weekly/$week_key"

umask 077
mkdir -p "$snapshot_dir" "$backup_root/daily" "$backup_root/weekly"

read -r -a databases <<<"${BACKUP_DATABASES:-email_ai listmonk}"
if [ "${#databases[@]}" -eq 0 ]; then
  echo "BACKUP_DATABASES is empty." >&2
  exit 1
fi

if [ -n "$rclone_remote" ]; then
  require_command rclone
fi

for database in "${databases[@]}"; do
  output_file="$snapshot_dir/${database}.dump"
  docker compose exec -T "$postgres_service" sh -lc \
    'pg_dump --format=custom --compress=9 --no-owner --no-privileges --dbname "$1"' \
    sh "$database" >"$output_file"
done

checksum_manifest="$snapshot_dir/SHA256SUMS"
: >"$checksum_manifest"
for dump_file in "$snapshot_dir"/*.dump; do
  checksum="$(checksum_file "$dump_file")"
  if [ -z "$checksum" ]; then
    echo "Unable to calculate checksum for $dump_file" >&2
    exit 1
  fi
  printf '%s  %s\n' "$checksum" "$(basename "$dump_file")" >>"$checksum_manifest"
done

sync_snapshot_tree "$snapshot_dir" "$daily_dir"
sync_snapshot_tree "$snapshot_dir" "$weekly_dir"

prune_local_dirs "$backup_root/hourly" "$hourly_retention"
prune_local_dirs "$backup_root/daily" "$daily_retention"
prune_local_dirs "$backup_root/weekly" "$weekly_retention"

if [ -n "$rclone_remote" ]; then
  rclone copy "$snapshot_dir" "$rclone_remote/hourly/$timestamp"
  rclone sync "$daily_dir" "$rclone_remote/daily/$day_key"
  rclone sync "$weekly_dir" "$rclone_remote/weekly/$week_key"
  prune_remote_dirs "$rclone_remote/hourly" "$hourly_retention"
  prune_remote_dirs "$rclone_remote/daily" "$daily_retention"
  prune_remote_dirs "$rclone_remote/weekly" "$weekly_retention"
fi

echo "Backup complete: $snapshot_dir"
printf 'Databases: %s\n' "${databases[*]}"
if [ -n "$rclone_remote" ]; then
  echo "Remote copy updated."
else
  echo "Remote copy skipped: BACKUP_RCLONE_REMOTE is not set."
fi
