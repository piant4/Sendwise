#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bash scripts/local_qa_preflight.sh [--config-only]

Checks that local QA uses the dev-safe Compose overlay and, unless
--config-only is provided, verifies the live local PostgreSQL schema and
runtime no-send posture.

Start local QA with:
  SENDWISE_ENV_FILE=.env.example docker compose --env-file .env.example -f docker-compose.yml -f docker-compose.dev.yml up -d --build

Bring an existing local database current with:
  SENDWISE_ENV_FILE=.env.example SENDWISE_COMPOSE_ENV_FILE=.env.example SENDWISE_COMPOSE_FILES=docker-compose.yml:docker-compose.dev.yml bash scripts/apply_migrations.sh
EOF
}

config_only=0
while [ "$#" -gt 0 ]; do
  case "${1:-}" in
    --config-only)
      config_only=1
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

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

env_file="${SENDWISE_LOCAL_QA_ENV_FILE:-.env.example}"
export SENDWISE_ENV_FILE="$env_file"

compose_args=(
  docker compose
  --env-file "$env_file"
  -f docker-compose.yml
  -f docker-compose.dev.yml
)

fail() {
  echo "FAIL local QA preflight: $*"
  exit 1
}

require_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "$1 is unavailable."
  fi
}

require_tool docker

if ! "${compose_args[@]}" version >/dev/null 2>&1; then
  fail "Docker Compose is unavailable."
fi

config_yaml="$(mktemp)"
backend_block="$(mktemp)"
listmonk_block="$(mktemp)"
trap 'rm -f "$config_yaml" "$backend_block" "$listmonk_block"' EXIT

if ! "${compose_args[@]}" config >"$config_yaml"; then
  fail "dev Compose config does not resolve."
fi

awk '
  /^  backend:/ {inside=1; print; next}
  inside && /^  [A-Za-z0-9_-]+:/ {exit}
  inside {print}
' "$config_yaml" >"$backend_block"

awk '
  /^  listmonk:/ {inside=1; print; next}
  inside && /^  [A-Za-z0-9_-]+:/ {exit}
  inside {print}
' "$config_yaml" >"$listmonk_block"

config_failures=""

require_config_value() {
  local block_file="$1"
  local label="$2"
  local key="$3"
  local expected_regex="$4"
  if ! grep -Eq "^[[:space:]]+$key:[[:space:]]+$expected_regex$" "$block_file"; then
    config_failures="$config_failures $label $key"
  fi
}

require_config_value "$backend_block" backend EMAIL_SENDING_ENABLED '"false"'
require_config_value "$backend_block" backend EMAIL_PROVIDER mailpit
require_config_value "$backend_block" backend REAL_SEND_ALLOWED_RECIPIENTS '""'
require_config_value "$backend_block" backend REAL_SEND_MAX_RECIPIENTS '"0"'
require_config_value "$backend_block" backend SMTP_HOST mailpit
require_config_value "$backend_block" backend SMTP_PORT '"1025"'
require_config_value "$backend_block" backend SMTP_USERNAME '""'
require_config_value "$backend_block" backend SMTP_PASSWORD '""'
require_config_value "$backend_block" backend SMTP_TLS '"false"'

require_config_value "$listmonk_block" listmonk LISTMONK_smtp__host mailpit
require_config_value "$listmonk_block" listmonk LISTMONK_smtp__port '"1025"'
require_config_value "$listmonk_block" listmonk LISTMONK_smtp__username '""'
require_config_value "$listmonk_block" listmonk LISTMONK_smtp__password '""'
require_config_value "$listmonk_block" listmonk LISTMONK_smtp__tls_enabled '"false"'

if [ -n "$config_failures" ]; then
  echo "FAIL unsafe local QA config fields:$config_failures"
  echo "Remediation: use docker-compose.dev.yml with .env.example for local QA; do not use staging/provider env for local QA."
  exit 1
fi

echo "OK local QA config is no-send and Mailpit-scoped."

if [ "$config_only" -eq 1 ]; then
  exit 0
fi

if ! "${compose_args[@]}" exec -T postgres sh -lc 'true' >/dev/null 2>&1; then
  fail "local postgres is not running. Start local QA with: SENDWISE_ENV_FILE=.env.example docker compose --env-file .env.example -f docker-compose.yml -f docker-compose.dev.yml up -d --build"
fi

if ! runtime_failures="$(
  "${compose_args[@]}" exec -T backend sh -lc '
    failures=""
    [ "${EMAIL_SENDING_ENABLED:-}" = "false" ] || failures="$failures backend EMAIL_SENDING_ENABLED"
    [ "${EMAIL_PROVIDER:-}" = "mailpit" ] || failures="$failures backend EMAIL_PROVIDER"
    [ "${REAL_SEND_ALLOWED_RECIPIENTS:-}" = "" ] || failures="$failures backend REAL_SEND_ALLOWED_RECIPIENTS"
    [ "${REAL_SEND_MAX_RECIPIENTS:-}" = "0" ] || failures="$failures backend REAL_SEND_MAX_RECIPIENTS"
    [ "${SMTP_HOST:-}" = "mailpit" ] || failures="$failures backend SMTP_HOST"
    [ "${SMTP_PORT:-}" = "1025" ] || failures="$failures backend SMTP_PORT"
    [ "${SMTP_USERNAME:-}" = "" ] || failures="$failures backend SMTP_USERNAME"
    [ "${SMTP_PASSWORD:-}" = "" ] || failures="$failures backend SMTP_PASSWORD"
    [ "${SMTP_TLS:-}" = "false" ] || failures="$failures backend SMTP_TLS"
    if [ -n "$failures" ]; then
      printf "%s\n" "$failures"
      exit 1
    fi
  '
)"; then
  if [ -n "$runtime_failures" ]; then
    echo "FAIL unsafe backend runtime fields:$runtime_failures"
    fail "recreate local runtime with the dev-safe local QA command."
  fi
  fail "local backend is not running. Start local QA with the dev-safe local QA command."
fi

if [ -n "$runtime_failures" ]; then
  echo "FAIL unsafe backend runtime fields:$runtime_failures"
  fail "recreate local runtime with the dev-safe local QA command."
fi

if ! listmonk_failures="$(
  "${compose_args[@]}" exec -T listmonk sh -lc '
    failures=""
    [ "${LISTMONK_smtp__host:-}" = "mailpit" ] || failures="$failures listmonk LISTMONK_smtp__host"
    [ "${LISTMONK_smtp__port:-}" = "1025" ] || failures="$failures listmonk LISTMONK_smtp__port"
    [ "${LISTMONK_smtp__username:-}" = "" ] || failures="$failures listmonk LISTMONK_smtp__username"
    [ "${LISTMONK_smtp__password:-}" = "" ] || failures="$failures listmonk LISTMONK_smtp__password"
    [ "${LISTMONK_smtp__tls_enabled:-}" = "false" ] || failures="$failures listmonk LISTMONK_smtp__tls_enabled"
    if [ -n "$failures" ]; then
      printf "%s\n" "$failures"
      exit 1
    fi
  '
)"; then
  if [ -n "$listmonk_failures" ]; then
    echo "FAIL unsafe listmonk runtime fields:$listmonk_failures"
    fail "recreate local runtime with the dev-safe local QA command."
  fi
  fail "local listmonk is not running. Start local QA with the dev-safe local QA command."
fi

if [ -n "$listmonk_failures" ]; then
  echo "FAIL unsafe listmonk runtime fields:$listmonk_failures"
  fail "recreate local runtime with the dev-safe local QA command."
fi

missing_columns="$(
  "${compose_args[@]}" exec -T postgres sh -lc \
    'psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At' <<'SQL'
WITH required_columns(table_name, column_name) AS (
    VALUES
        ('campaign_sending_limits', 'followup_enabled'),
        ('campaign_sending_limits', 'followup_daily_limit'),
        ('campaign_sending_limits', 'followup_monthly_limit'),
        ('campaign_sending_limits', 'followup_delay_value'),
        ('campaign_sending_limits', 'followup_delay_unit'),
        ('email_logs', 'send_kind')
)
SELECT required_columns.table_name || '.' || required_columns.column_name
FROM required_columns
WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = required_columns.table_name
      AND column_name = required_columns.column_name
)
ORDER BY 1;
SQL
)"

if [ -n "$missing_columns" ]; then
  echo "FAIL missing local DB columns:"
  echo "$missing_columns"
  echo "Remediation: SENDWISE_ENV_FILE=.env.example SENDWISE_COMPOSE_ENV_FILE=.env.example SENDWISE_COMPOSE_FILES=docker-compose.yml:docker-compose.dev.yml bash scripts/apply_migrations.sh"
  echo "Last resort only, after preserving needed local data: recreate the local postgres volume."
  exit 1
fi

echo "OK local runtime is no-send safe and required follow-up columns exist."
