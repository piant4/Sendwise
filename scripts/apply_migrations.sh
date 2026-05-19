#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/apply_migrations.sh [--dry-run]

Applies pending SQL migrations from db/migrations to the docker compose
Postgres service and records applied filenames in schema_migrations.
EOF
}

dry_run=0
if [ "${1:-}" = "--dry-run" ]; then
  dry_run=1
  shift
fi

if [ "$#" -ne 0 ]; then
  usage
  exit 2
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is unavailable. Install Docker before applying migrations."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose is unavailable. Install Docker Compose before applying migrations."
  exit 1
fi

psql_compose() {
  docker compose exec -T postgres sh -lc \
    'psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"' \
    sh "$@"
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

table_exists() {
  local result
  result="$(psql_compose -Atc "SELECT to_regclass('public.schema_migrations') IS NOT NULL;")"
  [ "$result" = "t" ]
}

ensure_tracking_table() {
  psql_compose <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    checksum TEXT,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
SQL
}

is_applied() {
  local filename="$1"
  local result
  result="$(psql_compose -At -v "filename=$filename" <<'SQL'
SELECT EXISTS (
    SELECT 1
    FROM schema_migrations
    WHERE filename = :'filename'
);
SQL
)"
  [ "$result" = "t" ]
}

apply_migration() {
  local path="$1"
  local filename="$2"
  local checksum="$3"

  {
    printf 'BEGIN;\n'
    cat "$path"
    printf '\n'
    printf "INSERT INTO schema_migrations (filename, checksum) VALUES (:'filename', :'checksum');\n"
    printf 'COMMIT;\n'
  } | psql_compose -v "filename=$filename" -v "checksum=$checksum"
}

shopt -s nullglob
migrations=(db/migrations/*.sql)
shopt -u nullglob

if [ "${#migrations[@]}" -eq 0 ]; then
  echo "No migrations found in db/migrations."
  exit 0
fi

if [ "$dry_run" -eq 1 ]; then
  echo "Dry run: listing migration status without mutating the database."
  tracking_exists=0
  if table_exists; then
    tracking_exists=1
  fi
else
  if ! table_exists; then
    ensure_tracking_table
  fi
  tracking_exists=1
fi

for migration in "${migrations[@]}"; do
  filename="$(basename "$migration")"
  checksum="$(checksum_file "$migration")"

  if [ "$tracking_exists" -eq 1 ] && is_applied "$filename"; then
    if [ "$dry_run" -eq 1 ]; then
      echo "APPLIED $filename"
    else
      echo "SKIP  $filename"
    fi
    continue
  fi

  if [ "$dry_run" -eq 1 ]; then
    echo "PEND  $filename"
    continue
  fi

  echo "APPLY $filename"
  apply_migration "$migration" "$filename" "$checksum"
  echo "DONE  $filename"
done

echo "Migration check complete."
