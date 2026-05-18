# SES Controlled Send Runbook

Milestone 12 supports a dev/staging-only SES controlled send path for an explicit one-recipient allowlist. It does not enable production mass sending.

This runbook must not be used with real customer lists. Use exactly one allowlisted test recipient, a verified SES identity/from address, and a public HTTPS backend URL so the unsubscribe link can be validated.

## Prerequisites

- SES domain or sender identity is verified in AWS.
- SPF, DKIM, and DMARC are configured and checked outside Sendwise.
- The runtime is local/staging only and is explicitly allowed by `REAL_SEND_ENVIRONMENTS`.
- listmonk SMTP settings point at SES SMTP for the runtime being tested.
- `POST /events/provider` is reachable with `X-API-Key: $BACKEND_API_KEY`.
- A campaign is admin-managed, `content_ready=true`, `contacts_ready=true`, `review_ready=true`, and all recipients pass Guard.
- The generated email body contains a Sendwise unsubscribe link from `BACKEND_PUBLIC_URL`.

## Local SES Override

Keep repository defaults fail-closed. Do not edit or commit `.env.example`, local env files, SMTP secrets, AWS secrets, or real recipient allowlists.

Create an untracked local override file such as `.env.ses.local`, or export these values only in the shell used to recreate the containers:

```bash
EMAIL_SENDING_ENABLED=true
EMAIL_PROVIDER=ses
ENVIRONMENT=staging
REAL_SEND_ENVIRONMENTS=staging
REAL_SEND_REQUIRE_ALLOWED_RECIPIENTS=true
REAL_SEND_MAX_RECIPIENTS=1
REAL_SEND_ALLOWED_RECIPIENTS=<single test recipient>
AWS_SES_REGION=<aws ses region>
SMTP_HOST=email-smtp.<aws ses region>.amazonaws.com
SMTP_PORT=587
SMTP_USERNAME=<ses smtp username>
SMTP_PASSWORD=<ses smtp password>
SMTP_FROM_EMAIL=<verified ses from address>
SMTP_TLS=true
BACKEND_PUBLIC_URL=https://<public dev or staging backend host>
SES_CONFIGURATION_SET=<optional ses configuration set>
```

Warnings:

- Do not commit this file.
- Do not use real customer lists.
- Do not use more than one allowlisted recipient.
- Do not use an unverified SES identity or from address.
- Do not use `http://localhost`, `http://127.0.0.1`, or `http://backend` for `BACKEND_PUBLIC_URL`; use public HTTPS for unsubscribe validation.

If using shell exports instead of a file, export the same names above and keep the shell history free of secrets where possible.

## Readiness Checks

Run the env readiness check after the containers are recreated with the local SES override:

```bash
bash scripts/validate_ses_readiness.sh
```

The script validates required env without printing secrets. It must pass before the controlled SES send.

Validate the Business DB target with one recipient only:

```bash
SES_VALIDATION_RECIPIENT="<single test recipient>" bash scripts/prepare_ses_validation_target.sh
```

`scripts/prepare_ses_validation_target.sh` is validation-only. It does not create data, does not send email, and does not call listmonk. It prints `CLIENT_ID`, `CAMPAIGN_ID`, `CONTACT_ID`, and `CAMPAIGN_CONTACT_ID` only when an existing target has:

- an active/trial client
- a ready/running campaign
- `content_ready=true`, `contacts_ready=true`, and `review_ready=true`
- exactly one campaign contact
- a `sendable` contact matching the provided recipient
- no matching suppression row

If no target exists, prepare it through the admin API/UI flow or manual SQL in a local/staging database only, then rerun the validation script. Do not insert fake provider events, delivered/open/click states, or fake metrics.

## listmonk SMTP

For dev compose, listmonk receives SMTP settings from runtime env:

- `LISTMONK_smtp__host=${SMTP_HOST:-mailpit}`
- `LISTMONK_smtp__port=${SMTP_PORT:-1025}`
- `LISTMONK_smtp__username=${SMTP_USERNAME:-}`
- `LISTMONK_smtp__password=${SMTP_PASSWORD:-}`
- `LISTMONK_smtp__tls_enabled=${SMTP_TLS:-false}`
- `LISTMONK_smtp__from_email=${SMTP_FROM_EMAIL:-dev@sendwise.local}`

When `EMAIL_PROVIDER=ses`, the backend safety gate blocks dispatch if SES SMTP env is incomplete.

## listmonk API Auth Diagnostic

For the previous backend-configured listmonk API `403`, verify configuration without printing passwords:

```bash
docker compose exec -T backend printenv LISTMONK_URL
docker compose exec -T backend printenv LISTMONK_USERNAME
docker compose exec -T backend sh -lc 'if [ -n "$LISTMONK_PASSWORD" ]; then echo "LISTMONK_PASSWORD=set"; else echo "LISTMONK_PASSWORD=missing"; fi'
docker compose exec -T listmonk sh -lc 'printf "%s\n" "$LISTMONK_ADMIN_USER"'
docker compose exec -T listmonk sh -lc 'if [ -n "$LISTMONK_ADMIN_PASSWORD" ]; then echo "LISTMONK_ADMIN_PASSWORD=set"; else echo "LISTMONK_ADMIN_PASSWORD=missing"; fi'
docker compose exec -T backend sh -lc 'wget -qO- "$LISTMONK_URL/health" || wget -qO- "$LISTMONK_URL/api/health"'
```

Then test a harmless authenticated listmonk API read from inside the backend container using the configured username and password, without echoing the password:

```bash
docker compose exec -T backend sh -lc 'wget -S -qO- --user="$LISTMONK_USERNAME" --password="$LISTMONK_PASSWORD" "$LISTMONK_URL/api/lists" 2>&1 | sed -n "1,12p"'
```

If this returns `403`, fix the local/staging listmonk admin credentials or listmonk initialization outside tracked files, recreate the containers, and rerun the diagnostic. Do not change credentials automatically and do not commit credential overrides.

## Final Flow

1. Prepare an uncommitted SES env override or shell exports using placeholders above.
2. Recreate containers with that env, for example `docker compose --env-file .env.ses.local -f docker-compose.yml -f docker-compose.dev.yml up -d --build`.
3. Verify backend effective config without printing secrets:
   `docker compose exec -T backend printenv EMAIL_SENDING_ENABLED EMAIL_PROVIDER ENVIRONMENT REAL_SEND_MAX_RECIPIENTS REAL_SEND_REQUIRE_ALLOWED_RECIPIENTS AWS_SES_REGION BACKEND_PUBLIC_URL`.
4. Verify password-bearing values are present without printing them:
   `docker compose exec -T backend sh -lc 'if [ -n "$SMTP_USERNAME" ]; then echo "SMTP_USERNAME=set"; else echo "SMTP_USERNAME=missing"; fi; if [ -n "$SMTP_PASSWORD" ]; then echo "SMTP_PASSWORD=set"; else echo "SMTP_PASSWORD=missing"; fi; if [ -n "$LISTMONK_PASSWORD" ]; then echo "LISTMONK_PASSWORD=set"; else echo "LISTMONK_PASSWORD=missing"; fi'`.
5. Verify listmonk API auth using the diagnostic above.
6. Confirm listmonk SMTP is switched to SES for validation by checking host, port, TLS, and from address only; do not print the SMTP password.
7. Prepare or verify the DB target, then run `SES_VALIDATION_RECIPIENT="<single test recipient>" bash scripts/prepare_ses_validation_target.sh`.
8. Run `bash scripts/validate_ses_readiness.sh`.
9. Execute the controlled send endpoint manually once, using the printed `CAMPAIGN_ID`; do not trigger listmonk campaign send directly.
10. Inspect `email_logs` for the created queued row and `provider_message_id` after listmonk/provider processing. Do not mark delivered/open/click states manually.
11. Click and verify the unsubscribe link from the received email, or perform a `GET /unsubscribe/<token>` check using the token produced in the prepared email body.
12. Ingest an SES-like event only if it is clearly marked as a dev/staging test payload and correlated to the validation message. Do not create fake production delivery metrics.
13. Restore Mailpit/dev config immediately after validation.

## Rollback

Set the local runtime back to:

```bash
EMAIL_SENDING_ENABLED=false
EMAIL_PROVIDER=mailpit
REAL_SEND_ALLOWED_RECIPIENTS=
REAL_SEND_MAX_RECIPIENTS=3
SMTP_HOST=mailpit
SMTP_PORT=1025
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_TLS=false
SMTP_FROM_EMAIL=
AWS_SES_REGION=
SES_CONFIGURATION_SET=
BACKEND_PUBLIC_URL=http://localhost:8000
```

Restart the backend/listmonk runtime as needed and confirm Mailpit remains the dev default. Do not leave local allowlists or secrets in versioned files.
