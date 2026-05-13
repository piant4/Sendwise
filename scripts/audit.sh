#!/usr/bin/env bash
set -euo pipefail

failures=0

check_file() {
  if [ ! -f "$1" ]; then
    echo "FAIL missing file: $1"
    failures=$((failures + 1))
  else
    echo "OK file: $1"
  fi
}

check_dir() {
  if [ ! -d "$1" ]; then
    echo "FAIL missing directory: $1"
    failures=$((failures + 1))
  else
    echo "OK directory: $1"
  fi
}

required_docs=(
  docs/structural_contracts_v1.md
  docs/api_contracts_v1.md
  docs/architecture_v1.md
  docs/data_model_v1.md
  docs/states_v1.md
  docs/ownership_v1.md
  docs/audit_checklist_v1.md
  docs/audit_log.md
  docs/codex_prompt_engine_v1.md
  docs/codex_skills/README.md
  docs/codex_skills/audit-runtime-flow.md
  docs/codex_skills/check-anti-monolith.md
  docs/codex_skills/extract-root-cause.md
  docs/codex_skills/generate-minimal-fix.md
  docs/codex_skills/run-regression-guard.md
  docs/codex_skills/update-docs-after-fix.md
  docs/codex_skills/audit-installer-vps.md
  docs/codex_skills/validate-state-and-persistence.md
)

required_dirs=(
  backend/app
  backend/tests
  frontend/app
  frontend/lib
  frontend/types
  templates/mjml
  db/migrations
  listmonk/config
  mailpit
  scripts
)

for file in "${required_docs[@]}"; do
  check_file "$file"
done

for dir in "${required_dirs[@]}"; do
  check_dir "$dir"
done

check_file .env.example
check_file docker-compose.yml
check_file docker-compose.dev.yml
check_file scripts/validate_ses_readiness.sh
check_file backend/app/api/health.py
check_file backend/app/schemas/clients.py
check_file backend/app/schemas/campaigns.py
check_file backend/app/schemas/contacts.py
check_file backend/app/schemas/usage.py
check_file backend/app/schemas/blocked_sends.py
check_file frontend/types/index.ts
check_file frontend/lib/mock-api.ts
check_file frontend/lib/api.ts
check_file README.md

if ! grep -q '^EMAIL_SENDING_ENABLED=false$' .env.example; then
  echo "FAIL .env.example must contain EMAIL_SENDING_ENABLED=false"
  failures=$((failures + 1))
else
  echo "OK EMAIL_SENDING_ENABLED defaults false"
fi

if ! grep -q '^EMAIL_PROVIDER=mailpit$' .env.example; then
  echo "FAIL .env.example must default EMAIL_PROVIDER to mailpit for dev"
  failures=$((failures + 1))
else
  echo "OK EMAIL_PROVIDER defaults to mailpit"
fi

if grep -q '^EMAIL_SENDING_ENABLED=true$' .env.example docker-compose.yml docker-compose.dev.yml; then
  echo "FAIL versioned config must not enable real sending by default"
  failures=$((failures + 1))
else
  echo "OK versioned config keeps real sending disabled by default"
fi

if ! grep -q '^REAL_SEND_MAX_RECIPIENTS=3$' .env.example; then
  echo "FAIL .env.example must cap SES controlled send recipients at 3"
  failures=$((failures + 1))
else
  echo "OK SES controlled send recipient cap defaults to 3"
fi

if grep -q '5432:5432' docker-compose.yml; then
  echo "FAIL docker-compose.yml must not expose PostgreSQL publicly"
  failures=$((failures + 1))
else
  echo "OK PostgreSQL is not publicly exposed"
fi

if grep -Eqi 'image:.*mailpit|^[[:space:]]+mailpit:' docker-compose.yml; then
  echo "FAIL Mailpit service/image must not be in production docker-compose.yml"
  failures=$((failures + 1))
else
  echo "OK Mailpit service absent from production compose"
fi

if ! grep -qi 'mailpit' docker-compose.dev.yml; then
  echo "FAIL Mailpit must be present in docker-compose.dev.yml"
  failures=$((failures + 1))
else
  echo "OK Mailpit present in dev compose"
fi

if ! grep -q 'LISTMONK_smtp__host: ${SMTP_HOST:-mailpit}' docker-compose.dev.yml; then
  echo "FAIL dev compose must wire listmonk SMTP host to Mailpit"
  failures=$((failures + 1))
else
  echo "OK dev compose wires listmonk SMTP host to Mailpit"
fi

if ! grep -qi 'n8n is optional' README.md; then
  echo "FAIL README must mention n8n is optional, not core V1"
  failures=$((failures + 1))
else
  echo "OK README documents n8n optional status"
fi

if ! grep -Rqi 'backend is gatekeeper' README.md docs/ownership_v1.md; then
  echo "FAIL README or ownership docs must state backend is gatekeeper"
  failures=$((failures + 1))
else
  echo "OK backend gatekeeper boundary documented"
fi

if ! grep -Rqi 'listmonk is engine only' README.md docs/ownership_v1.md; then
  echo "FAIL README or ownership docs must state listmonk is engine only"
  failures=$((failures + 1))
else
  echo "OK listmonk engine-only boundary documented"
fi

if ! grep -Rqi 'n8n is not core V1' README.md docs/ownership_v1.md; then
  echo "FAIL README or ownership docs must state n8n is not core V1"
  failures=$((failures + 1))
else
  echo "OK n8n non-core boundary documented"
fi

if grep -Rqi 'listmonk' frontend/app frontend/lib frontend/types; then
  echo "FAIL frontend must not call or reference listmonk directly"
  failures=$((failures + 1))
else
  echo "OK frontend has no direct listmonk references"
fi

if [ "$failures" -ne 0 ]; then
  echo "Audit failed with $failures failure(s)."
  exit 1
fi

echo "Audit passed."
