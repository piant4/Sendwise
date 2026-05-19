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

if ! grep -q 'LISTMONK_smtp__host: ${SMTP_HOST}' docker-compose.dev.yml; then
  echo "FAIL dev compose must read listmonk SMTP host from selected env file"
  failures=$((failures + 1))
else
  echo "OK dev compose reads listmonk SMTP host from selected env file"
fi

if ! grep -q 'env_file:' docker-compose.yml || ! grep -q '${SENDWISE_ENV_FILE:-.env}' docker-compose.yml; then
  echo "FAIL docker-compose.yml must default service env_file to .env through SENDWISE_ENV_FILE"
  failures=$((failures + 1))
else
  echo "OK docker-compose.yml defaults service env_file to .env through SENDWISE_ENV_FILE"
fi

if ! grep -q 'SENDWISE_ENV_FILE=.env.example docker compose --env-file .env.example config' scripts/smoke_test.sh; then
  echo "FAIL smoke test must safely validate base compose with .env.example"
  failures=$((failures + 1))
else
  echo "OK smoke test safely validates base compose with .env.example"
fi

if ! grep -q 'SENDWISE_ENV_FILE=.env.example docker compose --env-file .env.example -f docker-compose.yml -f docker-compose.dev.yml config' scripts/smoke_test.sh; then
  echo "FAIL smoke test must safely validate dev compose with .env.example"
  failures=$((failures + 1))
else
  echo "OK smoke test safely validates dev compose with .env.example"
fi

if ! grep -q 'SENDWISE_ENV_FILE=.env.example docker compose --env-file .env.example -f docker-compose.yml -f docker-compose.staging.yml config' scripts/smoke_test.sh; then
  echo "FAIL smoke test must safely validate staging compose with .env.example"
  failures=$((failures + 1))
else
  echo "OK smoke test safely validates staging compose with .env.example"
fi

if grep -qE '^[[:space:]]*docker compose( -f [^[:space:]]+)* config' scripts/smoke_test.sh; then
  echo "FAIL smoke test must not run compose config without SENDWISE_ENV_FILE=.env.example and --env-file .env.example"
  failures=$((failures + 1))
else
  echo "OK smoke test compose config calls use safe env selection"
fi

if grep -qE '^[[:space:]]*docker compose( -f [^[:space:]]+)* config' scripts/audit.sh; then
  echo "FAIL audit script must not run compose config without safe env selection"
  failures=$((failures + 1))
else
  echo "OK audit script does not run unsafe compose config"
fi

if grep -qE '"?0\.0\.0\.0:(5432|9000|1025|8025)|"?[0-9.]*:(5432|9000|1025|8025):(5432|9000|1025|8025)' docker-compose.staging.yml; then
  echo "FAIL staging compose must not publicly expose postgres/listmonk/mailpit"
  failures=$((failures + 1))
else
  echo "OK staging compose does not publicly expose postgres/listmonk/mailpit"
fi

if ! grep -q '"127.0.0.1:8000:8000"' docker-compose.staging.yml; then
  echo "FAIL staging backend must bind to localhost"
  failures=$((failures + 1))
else
  echo "OK staging backend binds to localhost"
fi

if ! grep -q '"127.0.0.1:3000:3000"' docker-compose.staging.yml; then
  echo "FAIL staging frontend must bind to localhost"
  failures=$((failures + 1))
else
  echo "OK staging frontend binds to localhost"
fi

if grep -qE 'EMAIL_SENDING_ENABLED|REAL_SEND_(ALLOWED_RECIPIENTS|REQUIRE_ALLOWED_RECIPIENTS|MAX_RECIPIENTS|ENVIRONMENTS|CONFIRMATION_TOKEN)' docker-compose.staging.yml; then
  echo "FAIL staging compose must not hardcode test send gates"
  failures=$((failures + 1))
else
  echo "OK staging compose does not hardcode test send gates"
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
