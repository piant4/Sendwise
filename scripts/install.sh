#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker before continuing."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose is required. Install Docker Compose before continuing."
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example."
else
  echo ".env already exists; leaving it unchanged."
fi

echo "Install skeleton checks complete."
echo "Next steps:"
echo "  1. Review .env and replace placeholder secrets."
echo "  2. Keep EMAIL_SENDING_ENABLED=false until a future authorized sending milestone."
echo "  3. Run: docker compose up -d"
