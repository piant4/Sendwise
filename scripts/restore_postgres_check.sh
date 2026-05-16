#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/restore_postgres_check.sh [--snapshot-dir PATH] [--keep-temp]

Restores backup archives into temporary databases only, verifies that public
tables exist, and drops the temporary databases on success unless --keep-temp
is provided.
EOF
}

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

latest_snapshot_dir() {
  local hourly_root="$1"
  local latest=""

  if [ ! -d "$hourly_root" ]; then
    return 1
  fi

  shopt -s nullglob
  for path in "$hourly_root"/*; do
    if [ -d "$path" ]; then
      latest="$path"
    fi
  done
  shopt -u nullglob

  if [ -z "$latest" ]; then
    return 1
  fi

  printf '%s\n' "$latest"
}

db_exists() {
  local database_name="$1"
  local exists=""

  exists="$(docker compose exec -T "$postgres_service" sh -lc \
    'database_name="$1"
    psql -U "$POSTGRES_USER" -d postgres -Atqc "SELECT 1 FROM pg_database WHERE datname = '\''${database_name}'\'';"' \
    sh "$database_name")"
  [ "$exists" = "1" ]
}

drop_temp_db() {
  local database_name="$1"

  docker compose exec -T "$postgres_service" sh -lc \
    'dropdb -U "$POSTGRES_USER" --if-exists "$1"' \
    sh "$database_name" >/dev/null
}

public_table_count() {
  local database_name="$1"

  docker compose exec -T "$postgres_service" sh -lc \
    'database_name="$1"
    psql -U "$POSTGRES_USER" -d "$database_name" -Atqc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = '\''public'\'' AND table_type = '\''BASE TABLE'\'';"' \
    sh "$database_name"
}

print_cleanup_commands() {
  local database_name=""

  for database_name in "${temp_databases[@]}"; do
    printf "docker compose exec -T %s sh -lc 'dropdb -U \"\\$POSTGRES_USER\" --if-exists %s'\n" "$postgres_service" "$database_name"
  done
}

snapshot_dir=""
keep_temp=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --snapshot-dir)
      snapshot_dir="${2:-}"
      shift 2
      ;;
    --keep-temp)
      keep_temp=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      exit 2
      ;;
  esac
done

require_command docker
if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose is unavailable. Install Docker Compose before running restore checks." >&2
  exit 1
fi

backup_root="${BACKUP_ROOT:-$repo_root/backups/postgres}"
postgres_service="${POSTGRES_SERVICE:-postgres}"
read -r -a databases <<<"${BACKUP_DATABASES:-email_ai listmonk}"
run_id="$(date -u +%Y%m%dT%H%M%SZ)"
declare -a temp_databases=()

if [ -z "$snapshot_dir" ]; then
  snapshot_dir="$(latest_snapshot_dir "$backup_root/hourly")"
fi

if [ -z "$snapshot_dir" ] || [ ! -d "$snapshot_dir" ]; then
  echo "Snapshot directory not found." >&2
  exit 1
fi

cleanup_on_exit() {
  local status="$1"
  local database_name=""

  if [ "$status" -eq 0 ] && [ "$keep_temp" -eq 0 ]; then
    for database_name in "${temp_databases[@]}"; do
      drop_temp_db "$database_name"
    done
    return
  fi

  if [ "${#temp_databases[@]}" -gt 0 ]; then
    echo "Temporary databases retained. Manual cleanup:" >&2
    print_cleanup_commands >&2
  fi
}

trap 'cleanup_on_exit $?' EXIT

for database in "${databases[@]}"; do
  archive_file="$snapshot_dir/${database}.dump"
  temp_database="${database}_restore_check_${run_id}"
  archive_basename="${temp_database}.dump"

  case "$temp_database" in
    email_ai|listmonk)
      echo "Refusing to use a live database name for restore validation." >&2
      exit 1
      ;;
  esac

  if [ ! -f "$archive_file" ]; then
    echo "Missing archive: $archive_file" >&2
    exit 1
  fi

  if db_exists "$temp_database"; then
    echo "Temporary database already exists: $temp_database" >&2
    exit 1
  fi

  temp_databases+=("$temp_database")

  cat "$archive_file" | docker compose exec -T "$postgres_service" sh -lc '
    archive_path="/tmp/$1"
    database_name="$2"
    cat > "$archive_path"
    createdb -U "$POSTGRES_USER" "$database_name"
    pg_restore --no-owner --no-privileges -U "$POSTGRES_USER" -d "$database_name" "$archive_path"
    rm -f "$archive_path"
  ' sh "$archive_basename" "$temp_database"

  table_count="$(public_table_count "$temp_database")"
  case "$table_count" in
    ''|*[!0-9]*)
      echo "Restore validation failed for $database: invalid table count from $temp_database" >&2
      exit 1
      ;;
  esac

  if [ "$table_count" -eq 0 ]; then
    echo "Restore validation failed for $database: no public tables found in $temp_database" >&2
    exit 1
  fi

  printf '%s restored into %s with %s public tables\n' "$database" "$temp_database" "$table_count"
done

if [ "$keep_temp" -eq 1 ]; then
  echo "Restore check passed. Temporary databases retained:"
  printf '%s\n' "${temp_databases[@]}"
else
  echo "Restore check passed. Temporary databases will be dropped."
fi
