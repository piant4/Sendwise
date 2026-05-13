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
require_env AWS_SES_REGION

runtime_env="${APP_ENV:-${ENVIRONMENT:-}}"
if [ -z "$runtime_env" ]; then
  echo "FAIL APP_ENV or ENVIRONMENT must be set for SES readiness validation"
  failures=$((failures + 1))
else
  case ",${REAL_SEND_ENVIRONMENTS:-development,staging,test}," in
    *,"$runtime_env",*)
      echo "OK runtime environment is allowed for controlled real sends"
      ;;
    *)
      echo "FAIL runtime environment must be included in REAL_SEND_ENVIRONMENTS"
      failures=$((failures + 1))
      ;;
  esac
fi

if [ "${REAL_SEND_REQUIRE_ALLOWED_RECIPIENTS:-true}" != "true" ]; then
  echo "FAIL REAL_SEND_REQUIRE_ALLOWED_RECIPIENTS must be true"
  failures=$((failures + 1))
else
  echo "OK REAL_SEND_REQUIRE_ALLOWED_RECIPIENTS=true"
fi

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
if [ "$max_recipients" != "1" ]; then
  echo "FAIL REAL_SEND_MAX_RECIPIENTS must be 1 for SES controlled validation"
  failures=$((failures + 1))
else
  echo "OK REAL_SEND_MAX_RECIPIENTS=1"
fi

recipient_count=0
if [ -n "${REAL_SEND_ALLOWED_RECIPIENTS:-}" ]; then
  old_ifs="$IFS"
  IFS=","
  for recipient in $REAL_SEND_ALLOWED_RECIPIENTS; do
    trimmed="$(printf "%s" "$recipient" | tr -d "[:space:]")"
    if [ -n "$trimmed" ]; then
      recipient_count=$((recipient_count + 1))
    fi
  done
  IFS="$old_ifs"
fi

if [ "$recipient_count" -ne 1 ]; then
  echo "FAIL REAL_SEND_ALLOWED_RECIPIENTS must contain exactly one recipient"
  failures=$((failures + 1))
else
  echo "OK REAL_SEND_ALLOWED_RECIPIENTS contains exactly one recipient"
fi

if [ "$failures" -ne 0 ]; then
  echo "SES readiness failed with ${failures} failure(s)."
  exit 1
fi

echo "SES readiness passed. No secrets were printed."
