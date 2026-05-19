#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is unavailable. Install Docker before running smoke tests."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose is unavailable. Install Docker Compose before running smoke tests."
  exit 1
fi

SENDWISE_ENV_FILE=.env.example docker compose --env-file .env.example config >/dev/null
SENDWISE_ENV_FILE=.env.example docker compose --env-file .env.example -f docker-compose.yml -f docker-compose.dev.yml config >/dev/null
SENDWISE_ENV_FILE=.env.example docker compose --env-file .env.example -f docker-compose.yml -f docker-compose.staging.yml config >/dev/null
bash scripts/audit.sh

if [ ! -f scripts/apply_migrations.sh ]; then
  echo "Migration runner is missing: scripts/apply_migrations.sh"
  exit 1
fi

bash -n scripts/apply_migrations.sh

echo "Smoke test passed."
