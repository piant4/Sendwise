#!/usr/bin/env bash
set -euo pipefail

backend_url="${BACKEND_URL:-http://localhost:8000}"
frontend_url="${FRONTEND_URL:-http://localhost:3000}"

check_url() {
  local name="$1"
  local url="$2"

  if curl -fsS --max-time 3 "$url" >/dev/null 2>&1; then
    echo "OK $name reachable at $url"
  else
    echo "WARN $name not reachable at $url"
  fi
}

check_url "backend health" "$backend_url/health"
check_url "frontend root" "$frontend_url"
