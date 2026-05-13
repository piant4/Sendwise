#!/usr/bin/env bash
set -euo pipefail

failures=0

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "FAIL ${name} is required"
    failures=$((failures + 1))
  else
    echo "OK ${name} is set"
  fi
}

if [ "${EMAIL_PROVIDER:-mailpit}" != "ses" ]; then
  echo "FAIL EMAIL_PROVIDER must be ses for SES readiness validation"
  failures=$((failures + 1))
else
  echo "OK EMAIL_PROVIDER=ses"
fi

if [ "${EMAIL_SENDING_ENABLED:-false}" != "true" ]; then
  echo "FAIL EMAIL_SENDING_ENABLED must be true only for the controlled SES test runtime"
  failures=$((failures + 1))
else
  echo "OK EMAIL_SENDING_ENABLED=true"
fi

require_env SMTP_HOST
require_env SMTP_PORT
require_env SMTP_USERNAME
require_env SMTP_PASSWORD
require_env SMTP_FROM_EMAIL
require_env BACKEND_PUBLIC_URL
require_env REAL_SEND_ALLOWED_RECIPIENTS

if [ "${SMTP_TLS:-false}" != "true" ]; then
  echo "FAIL SMTP_TLS must be true for SES SMTP"
  failures=$((failures + 1))
else
  echo "OK SMTP_TLS=true"
fi

case "${BACKEND_PUBLIC_URL:-}" in
  http://localhost*|http://127.0.0.1*|http://backend*|"")
    echo "FAIL BACKEND_PUBLIC_URL must be public and reachable for unsubscribe"
    failures=$((failures + 1))
    ;;
  http://*|https://*)
    echo "OK BACKEND_PUBLIC_URL has an HTTP(S) origin"
    ;;
  *)
    echo "FAIL BACKEND_PUBLIC_URL must start with http:// or https://"
    failures=$((failures + 1))
    ;;
esac

max_recipients="${REAL_SEND_MAX_RECIPIENTS:-3}"
if ! [[ "$max_recipients" =~ ^[0-9]+$ ]] || [ "$max_recipients" -lt 1 ] || [ "$max_recipients" -gt 3 ]; then
  echo "FAIL REAL_SEND_MAX_RECIPIENTS must be 1, 2, or 3"
  failures=$((failures + 1))
else
  echo "OK REAL_SEND_MAX_RECIPIENTS=${max_recipients}"
fi

if [ "$failures" -ne 0 ]; then
  echo "SES readiness failed with ${failures} failure(s)."
  exit 1
fi

echo "SES readiness passed. No secrets were printed."
