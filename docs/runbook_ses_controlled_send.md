# SES Controlled Send Runbook

Milestone 12 supports a dev/staging-only SES controlled send path for an explicit 1-3 recipient allowlist. It does not enable production mass sending.

## Prerequisites

- SES domain or sender identity is verified in AWS.
- SPF, DKIM, and DMARC are configured and checked outside Sendwise.
- listmonk SMTP settings point at SES SMTP for the runtime being tested.
- `POST /events/provider` is reachable with `X-API-Key: $BACKEND_API_KEY`.
- A campaign is admin-managed, `content_ready=true`, `contacts_ready=true`, `review_ready=true`, and all recipients pass Guard.
- The generated email body contains a Sendwise unsubscribe link from `BACKEND_PUBLIC_URL`.

## Runtime Env

Keep repository defaults fail-closed. Use local, uncommitted overrides only:

```bash
EMAIL_SENDING_ENABLED=true
EMAIL_PROVIDER=ses
SMTP_HOST=email-smtp.<region>.amazonaws.com
SMTP_PORT=587
SMTP_TLS=true
SMTP_FROM_EMAIL=verified-sender@example.com
BACKEND_PUBLIC_URL=https://public-dev-or-staging.example.com
REAL_SEND_ALLOWED_RECIPIENTS=allowed-person@example.com
REAL_SEND_MAX_RECIPIENTS=1
REAL_SEND_REQUIRE_ALLOWED_RECIPIENTS=true
AWS_SES_REGION=<region>
SES_CONFIGURATION_SET=
```

Set `SMTP_USERNAME` and `SMTP_PASSWORD` from local secrets only.

Never commit SMTP or AWS secrets. Do not commit real recipient allowlists.

## Readiness Check

Run:

```bash
bash scripts/validate_ses_readiness.sh
```

The script validates required env without printing secrets. It must pass before the controlled SES send.

## listmonk SMTP

For dev compose, listmonk receives SMTP settings from runtime env:

- `LISTMONK_smtp__host=${SMTP_HOST:-mailpit}`
- `LISTMONK_smtp__port=${SMTP_PORT:-1025}`
- `LISTMONK_smtp__username=${SMTP_USERNAME:-}`
- `LISTMONK_smtp__password=${SMTP_PASSWORD:-}`
- `LISTMONK_smtp__tls_enabled=${SMTP_TLS:-false}`
- `LISTMONK_smtp__from_email=${SMTP_FROM_EMAIL:-dev@sendwise.local}`

When `EMAIL_PROVIDER=ses`, the backend safety gate blocks dispatch if SES SMTP env is incomplete.

## Test Flow

1. Apply migrations with `./scripts/apply_migrations.sh`.
2. Verify backend health.
3. Prepare one admin campaign with at most the configured recipient max.
4. Confirm send is blocked with `EMAIL_SENDING_ENABLED=false`.
5. Start the runtime with the SES env above.
6. Confirm an unlisted recipient is blocked.
7. Confirm more than `REAL_SEND_MAX_RECIPIENTS` is blocked.
8. Send once to the allowlisted recipient.
9. Verify response has `provider=ses`, `safety_passed=true`, `listmonk_dispatched=true`, and `real_send_attempted=true`.
10. Verify `email_logs` are `queued` or later provider-event-derived status, never invented `delivered`.
11. Verify the email contains the unsubscribe link.
12. POST a SES-like test payload to `/events/provider` with `X-API-Key`.

SES SNS signature verification remains a follow-up.

## Rollback

Set:

```bash
EMAIL_SENDING_ENABLED=false
EMAIL_PROVIDER=mailpit
REAL_SEND_ALLOWED_RECIPIENTS=
```

Restart the backend/listmonk runtime as needed. Do not leave local allowlists or secrets in versioned files.
