# Sendwise VPS Staging Runbook

## Purpose

This staging runbook defines the safe first VPS deploy flow for Sendwise without enabling real sending. The staging app is served through Caddy HTTPS on `staging-app.mailerpro.it` and `staging-api.mailerpro.it`; Docker services bind only to localhost or remain internal.

## Safety Baseline

- Take a fresh PostgreSQL backup before every deploy.
- Back up both `email_ai` and `listmonk`.
- Keep local and remote backup copies.
- Do not read secrets from versioned files.
- Do not commit env files, tokens, passwords, API keys, Clerk secrets, Listmonk credentials, PostgreSQL passwords, SMTP credentials, unsubscribe secrets, or AWS credentials.
- First VPS deploy must keep sends disabled.
- First VPS deploy must not enable real sending.
- During first VPS deploy, do not call any send or dispatch endpoint.
- During first VPS deploy, do not use direct Listmonk send.
- During first VPS deploy, do not use SES console send.
- SES readiness and controlled SES validation are later milestones, not part of first VPS deploy.
- AWS has denied SES production access for Sendwise at this time. Treat SES as sandbox-only until AWS explicitly approves production access.
- Do not run destructive Docker volume or database commands during routine operations.

Reference:

- `docs/runbook_backup_restore.md`

## Staging Domains And Reverse Proxy

Caddy is the only public HTTP/HTTPS entrypoint. Backend and frontend containers must bind to localhost on the VPS, with Caddy terminating HTTPS and proxying to those local ports.

Required Caddy config:

```caddyfile
staging-app.mailerpro.it {
	reverse_proxy 127.0.0.1:3000
}

staging-api.mailerpro.it {
	reverse_proxy 127.0.0.1:8000
}
```

Required public URLs:

- Frontend: `https://staging-app.mailerpro.it`
- API: `https://staging-api.mailerpro.it`
- Public unsubscribe links must use `FRONTEND_URL=https://staging-app.mailerpro.it`.
- `NEXT_PUBLIC_API_BASE_URL` must point to the public HTTPS backend because the frontend unsubscribe page posts to the backend JSON endpoint.

## Staging Environment Requirements

Configure real values only on the VPS environment. Do not place secrets in versioned files.
The VPS `.env` is the source of truth for Docker Compose runtime builds and container runtime environment. Always pass `--env-file .env` to staging runtime commands. `--env-file` controls Docker Compose interpolation, while service-level `env_file` controls container environment injection. Listmonk SMTP runtime config is also sourced from `.env` through the provider-neutral `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_TLS`, and `SMTP_FROM_EMAIL` values. For safe validation against `.env.example`, set `SENDWISE_ENV_FILE=.env.example` so service-level `env_file` does not read the real `.env`. After editing `.env`, recreate the affected containers; old containers keep their old environment. After SMTP env changes, recreate at least `listmonk` and `backend`. Never commit `.env`.

Postgres password drift warning:

- `POSTGRES_PASSWORD` is only applied automatically when the Postgres volume is initialized the first time.
- If the persistent `postgres_data` volume already exists, changing `POSTGRES_PASSWORD` in `.env` does not rotate the database role password inside Postgres.
- In that drift state, `postgres` can still become healthy while `backend` and `listmonk` fail with `password authentication failed for user "<business user>"`.
- Safe diagnosis is:
  - confirm `backend` and `listmonk` are targeting the expected host, database, and user and only record password presence and length;
  - confirm the persistent volume is being reused from Postgres logs (`Database directory appears to contain a database; Skipping initialization`);
  - confirm TCP auth with the current runtime password fails before changing anything.
- Safe repair for the approved persistent-business-DB path is:
  - do not delete volumes and do not reset Postgres;
  - use authenticated local-socket access inside the `postgres` container to run `ALTER ROLE` for the existing business DB user so the stored role password matches the current `.env`;
  - recreate `listmonk` and `backend` after the password is aligned.
- Treat the current VPS `.env` as the runtime source of truth unless an operator intentionally decides to restore the older stored password instead.

Required non-secret staging values:

```env
FRONTEND_URL=https://staging-app.mailerpro.it
BACKEND_PUBLIC_URL=https://staging-api.mailerpro.it
NEXT_PUBLIC_API_BASE_URL=https://staging-api.mailerpro.it
ENVIRONMENT=staging
EMAIL_SENDING_ENABLED=false
EMAIL_PROVIDER=listmonk
REAL_SEND_REQUIRE_ALLOWED_RECIPIENTS=true
REAL_SEND_MAX_RECIPIENTS=1
REAL_SEND_ALLOWED_RECIPIENTS=
```

Required secret-backed values must be configured only on the VPS:

- Real Clerk issuer, JWKS URL, audience if used, publishable key, and secret key.
- Clerk application invitation email templates and invitation redirect or Account Portal settings for client access.
- Real Listmonk username and password.
- Real PostgreSQL database, user, and password.
- Real backend API key and unsubscribe/signing secrets required by the deployed backend.
- Real SMTP or AWS SES credentials only in the later SES readiness milestone. When approved, set them only in the VPS `.env`; do not hardcode them in Compose or docs.

For first deploy, keep `EMAIL_PROVIDER=listmonk` and `EMAIL_SENDING_ENABLED=false` so the runtime contract matches the production fallback while real dispatch stays fail-closed. Keep `REAL_SEND_ALLOWED_RECIPIENTS=` empty until the controlled SES validation milestone.

Client access note:

- Admin client provisioning and resend now rely on Clerk native application invitations.
- Sendwise does not send a separate SMTP transactional access email for `POST /admin/clients` or `POST /admin/clients/{client_id}/send-access-email`.
- Sendwise now passes the application invite redirect URL from `FRONTEND_URL` and expects Clerk to redirect new invites to `${FRONTEND_URL}/auth/redirect`.
- The Sendwise invite activation card on `/auth/redirect` is password-only. First name and last name are sourced from admin provisioning and Clerk invitation metadata when Clerk still requires them.
- If Clerk requires first or last name and the invitation metadata is missing those values, the customer must see `Dati invito incompleti. Richiedi una nuova email di accesso.` and the admin should resend a fresh invite after correcting the provisioned client name.
- Existing invite links created before this redirect change can still land in old Clerk-hosted paths. Create a fresh invite before QA.
- After terminal Clerk invite failures such as invalid, expired, already-used, or consumed tickets, the same invite link must be treated as non-reusable and QA must request a fresh invite before trying again.
- If Clerk rejects the password as compromised (`form_password_pwned` or `form_password_compromised`), Sendwise must fail closed, disable resubmission from the same page state, and direct the user back to login or to request a fresh invite.
- Existing already-linked Clerk users cannot use the native resend flow from Sendwise; the backend returns a controlled unsupported code instead of sending a manual sign-in link.

Clerk Dashboard checklist before staging QA:

- Disable Social Connections such as Google and GitHub unless they are explicitly required for this client-access flow.
- Keep Clerk password enabled. If `User & Authentication -> User profile -> First and last name` remains required, confirm the admin provisioning flow captures those names before sending the invite.
- Set Component paths to:
  - `SignIn=/login`
  - `SignUp=/auth/redirect`
  - `SignOut=/login`
- Set Application paths to:
  - `Home URL=/auth/redirect`
  - `Unauthorized sign in URL=/login`
- Verify the Clerk invitation template content, sender, and application invitation redirect behavior.
- Do not rely on Clerk Account Portal paths for Sendwise client invitations.

## SES Production Access Rejection

Meaning of the rejection:

- AWS denied the current request to move SES into production and/or increase sending capacity for public recipients.
- Sendwise must treat SES as sandbox-only. Production sending to non-verified recipients is blocked until AWS approves a new request.
- This does not remove SES support from the codebase, and it does not affect Clerk native invitation emails for client access.

Smallest safe QA path while SES is sandboxed:

- Keep `EMAIL_SENDING_ENABLED=false` for staging UI, review, and smoke validation.
- Use `EMAIL_PROVIDER=mailpit` for no-send workflow checks and Mailpit capture.
- If SES sandbox validation is explicitly approved later, keep `EMAIL_PROVIDER=ses`, `REAL_SEND_REQUIRE_ALLOWED_RECIPIENTS=true`, `REAL_SEND_MAX_RECIPIENTS=1`, and use only verified SES sandbox recipients.
- Continue using backend `review`, `simulate-send`, and `sync-listmonk` flows for campaign QA. Do not use direct Listmonk send, SES console send, or any shortcut around backend gates.

SES reapplication checklist:

- Prepare a clear production use case, audience source, unsubscribe flow, and complaint-handling description.
- Confirm the sending domain identity, DKIM, SPF, DMARC, and `SMTP_FROM_EMAIL` alignment.
- Document that Sendwise uses backend authorization, suppression handling, unsubscribe pages, and controlled rollout limits.
- Prepare examples of the website, privacy policy, signup/contact source, and sample campaign content reviewers can inspect.
- Reconfirm that sandbox tests use verified recipients only and that production is still fail-closed pending approval.

Provider fallback options while SES is blocked:

- Keep staging and QA on `mailpit` plus backend simulation for no-send validation.
- Preferred production fallback: keep `EMAIL_PROVIDER=listmonk` and point the existing `SMTP_*` contract at Mailgun SMTP.
- Evaluate whether the provider also exposes delivery/bounce/complaint webhooks that can be normalized into `POST /events/provider`.
- Do not activate a new provider in production until runtime classification, env contract, and webhook needs are reviewed and explicitly approved.

Recommended next provider evaluation criteria:

- SMTP compatibility with listmonk and support for a verified custom sending domain.
- Clear webhook coverage for delivery, bounce, complaint, open, and click events.
- Low-friction production approval process and transparent reputation/compliance posture.
- EU-friendly operations, rate limits, support responsiveness, and predictable pricing.
- Ability to support gradual warmup, suppression discipline, and audit-friendly logs without bypassing Sendwise backend ownership.

## Mailgun SMTP Fallback Through Listmonk

Production fallback contract:

- Keep `EMAIL_PROVIDER=listmonk`.
- Keep Sendwise as the authorization boundary and listmonk as the dispatch boundary.
- Use Mailgun SMTP relay behind listmonk; do not add a direct Mailgun API send path in this milestone.
- Mailgun sending domain for this fallback: `send.mailerpro.it`.

DNS and relay setup notes:

- Publish SPF for `send.mailerpro.it` with the Mailgun include for the chosen region.
- Enable and verify Mailgun DKIM for `send.mailerpro.it`.
- Keep DMARC aligned with the visible sender and verified domain posture.
- Delay Mailgun click/open tracking until provider-webhook follow-up work is approved; this milestone does not implement Mailgun webhook ingestion.
- Use `SMTP_HOST=smtp.mailgun.org` and `SMTP_PORT=587`.
- Keep `SMTP_TLS=true` for the STARTTLS relay path on port `587`.
- Keep `SMTP_HOST` as a bare host with no protocol prefix.

Suggested `.env` placeholders for the production fallback:

- `EMAIL_PROVIDER=listmonk`
- `SMTP_HOST=smtp.mailgun.org`
- `SMTP_PORT=587`
- `SMTP_USERNAME=postmaster@send.mailerpro.it`
- `SMTP_PASSWORD=` set only in the real VPS `.env`
- `SMTP_FROM_EMAIL=sendwise@send.mailerpro.it`
- `SMTP_FROM_NAME=Sendwise` for operator/display-name guidance only

Listmonk SMTP setup expectations:

- The committed Compose contract already passes `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_TLS`, and `SMTP_FROM_EMAIL` into the listmonk container.
- After editing relay env values, recreate `listmonk` and `backend`.
- Do not print rendered Compose output from a real `.env`; it expands SMTP secrets.
- Keep listmonk non-public and continue to drive campaign actions only through Sendwise backend routes.

No-live-send validation steps:

1. Keep `EMAIL_SENDING_ENABLED=false`.
2. Render Compose safely with `SENDWISE_ENV_FILE=.env.example docker compose --env-file .env.example -f docker-compose.yml -f docker-compose.staging.yml config`.
3. Verify the backend/admin runtime labels show SES as sandbox-blocked when selected, and listmonk SMTP relay as configured or pending without exposing usernames, passwords, or the full sender address.
4. Use backend `review`, `simulate-send`, and `sync-listmonk` flows only. Do not call send endpoints and do not dispatch from listmonk directly.
5. Confirm `/health` and normal staging smoke checks only after safe no-send startup; no SMTP live test is part of this milestone.

First controlled live-send checklist for a later approved milestone:

1. Confirm Mailgun domain verification, SPF, DKIM, and DMARC for `send.mailerpro.it`.
2. Confirm the SMTP relay credentials exist only in the VPS `.env`.
3. Confirm `EMAIL_PROVIDER=listmonk`, `EMAIL_SENDING_ENABLED=true`, and the public unsubscribe URLs are correct only in the approved runtime.
4. Confirm the target campaign is already reviewed and the recipient set is intentionally bounded.
5. Confirm the operator runbook for bounce/complaint monitoring before any first real send.
6. Execute only after explicit approval; this milestone does not perform the send.

Controlled send persistence checks after an approved send:

1. Confirm the Business DB remains the source of truth: exactly one `email_logs` row per intended recipient and no duplicate rows for the same campaign/contact set.
2. Confirm those rows are created by the backend dispatch path only after Listmonk campaign start is attempted.
3. Treat `email_logs.status="sent"` as "accepted by Listmonk / dispatch started", not inbox delivery.
4. Treat `provider_status` as the Listmonk start response status only. For the current Listmonk SMTP relay flow, `running` means Listmonk accepted the campaign start call.
5. Expect `provider_message_id` to remain empty for Listmonk campaign sends until per-recipient provider-event correlation exists.
6. Do not infer delivered/opened/clicked/bounced/complained results from `email_logs.status="sent"` or from recipient counts.
7. If Listmonk start fails after dispatch is attempted, confirm the backend persists `email_logs.status="failed"` for the attempted recipient set and does not create extra rows on retry.
8. Keep duplicate-dispatch protection active: a second send attempt for the same campaign must return a blocked response once queued, started, or accepted logs exist.
9. Keep Deliverability Guard active before every controlled send. Never bypass campaign status, recipient eligibility, suppression, unsubscribe readiness, or configured campaign limits.
10. Do not paste rendered HTML, recipient addresses, subjects, unsubscribe tokens, or provider credentials into audit notes or shared diagnostics.

Domain warmup guard V1 for approved Listmonk and Mailgun relay sends:

- The backend now enforces a fail-closed sending-domain warmup guard before any Listmonk preparation or campaign-start call.
- The current V1 default is `20` accepted sends per Rome business day for the configured Listmonk SMTP sending domain.
- The guard uses the domain derived from `SMTP_FROM_EMAIL` and counts only Business DB `email_logs` rows already accepted or later processed by the Listmonk flow: `sent`, `dispatched`, `delivered`, `opened`, `clicked`, `bounced`, `complained`, `spam`, and `unsubscribed`.
- `simulated`, `queued`, and `failed` rows do not consume warmup volume.
- If current Rome-day accepted volume plus the eligible recipient batch would exceed the cap, Sendwise must block before Listmonk and persist the blocked attempt in `blocked_sends` when campaign context exists.
- This V1 behavior is safe only for the currently verified single-domain runtime. If Sendwise later rotates across multiple active sending domains in the same Business DB, approval is required before changing schema or warmup attribution logic.

## Standard Staging Deploy

1. Confirm the current branch and target revision.
2. Run mandatory Linux/VPS checks listed below.
3. Run `./scripts/backup_postgres.sh`.
4. Verify the backup finished and produced a new timestamped snapshot.
5. Pull the target revision.
6. Render and inspect the staging Compose config.
7. Rebuild and restart the stack with the staging override.
8. Apply migrations after the new code is present.
9. Run health and smoke checks.
10. Complete the QA checklist without triggering real sends.

Suggested command sequence:

```bash
bash -n scripts/apply_migrations.sh
bash -n scripts/backup_postgres.sh
bash -n scripts/restore_postgres_check.sh
cd frontend && npm run lint
cd frontend && npm run build
cd ..
bash scripts/audit.sh
bash scripts/smoke_test.sh
./scripts/backup_postgres.sh
git pull
SENDWISE_ENV_FILE=.env.example docker compose --env-file .env.example -f docker-compose.yml -f docker-compose.staging.yml config
docker compose --env-file .env -f docker-compose.yml -f docker-compose.staging.yml up -d --build
./scripts/apply_migrations.sh
bash scripts/healthcheck.sh
bash scripts/smoke_test.sh
```

## Compose Port Policy

The staging Compose stack must expose only:

- `127.0.0.1:3000:3000` for frontend.
- `127.0.0.1:8000:8000` for backend.

The staging Compose stack must not publish public host ports for:

- PostgreSQL.
- Listmonk.
- Mailpit.

Use this command before every staging restart:

```bash
SENDWISE_ENV_FILE=.env.example docker compose --env-file .env.example -f docker-compose.yml -f docker-compose.staging.yml config
```

Never run public or shared config dumps against a real `.env`.
Never paste `docker compose config` output rendered from a real `.env` into shared logs because it expands SMTP passwords, Listmonk credentials, and other secrets.
Stop if the rendered config shows `0.0.0.0:3000`, `0.0.0.0:8000`, public `9000`, public `5432`, public `8025`, or public `1025`.

## First Deploy QA Checklist

Admin:

- Login admin.
- Campaign create/setup works.
- Campaign limits save and reload.
- Content save works.
- Contacts manual add works.
- CSV import works.
- Remove contact works.
- Review ready state works.
- Blocked dispatch: dispatch is blocked with sends disabled.

Client:

- Client dashboard loads.
- `Performance campagne` is visible.
- Period selector is visible.
- Client daily limit is hidden.
- Client campaigns page loads.
- No recipient count is used as send usage.

Public:

- 404 page loads with illustration.
- Invalid-token unsubscribe returns safe HTML.
- Frontend public unsubscribe page loads and hides backend/internal error wording.

## SES Readiness Later Step

SES readiness is intentionally separated from first VPS deploy. A later controlled validation may enable real sending only after:

- Caddy HTTPS is live for both staging domains.
- `FRONTEND_URL=https://staging-app.mailerpro.it` is verified in unsubscribe links for new emails.
- `NEXT_PUBLIC_API_BASE_URL=https://staging-api.mailerpro.it` is reachable from the public unsubscribe page.
- `EMAIL_SENDING_ENABLED` is explicitly reviewed.
- `REAL_SEND_REQUIRE_ALLOWED_RECIPIENTS=true`.
- `REAL_SEND_MAX_RECIPIENTS=1`.
- `REAL_SEND_ALLOWED_RECIPIENTS` contains only the single approved validation recipient.
- The recipient is verified in the SES sandbox account.
- No direct Listmonk send is used.
- No SES console send is used outside the approved validation plan.

## SES Deliverability Checklist For Official Trials

Before any approved official product trial:

- Verify the SES domain identity used by `SMTP_FROM_EMAIL`.
- Enable SES DKIM and wait for verification to complete.
- Publish SPF that includes Amazon SES for the sending domain.
- Publish a DMARC record for the sending domain.
- Configure a custom MAIL FROM domain if the SES setup uses one, then verify it resolves correctly.
- Move SES out of sandbox before sending to non-verified recipients.
- If AWS denies production access again, keep SES in sandbox-only QA posture and do not widen the recipient set.
- Confirm `EMAIL_PROVIDER=ses` only in the intended runtime and keep `EMAIL_SENDING_ENABLED` as the emergency off switch.
- Confirm `AWS_SES_REGION` matches the SES SMTP endpoint in use.
- Confirm `SMTP_HOST` is a bare SES SMTP host with no protocol prefix.
- Confirm `SMTP_USERNAME` and `SMTP_PASSWORD` are SES SMTP credentials, not AWS access keys.
- Confirm `SMTP_FROM_EMAIL` matches a verified SES identity/domain.
- Confirm `FRONTEND_URL` is the public unsubscribe origin used in email links.
- Confirm `BACKEND_PUBLIC_URL` stays the public API origin and is not used as the recipient-facing unsubscribe page.
- Confirm `NEXT_PUBLIC_API_BASE_URL` points at the public backend used by the unsubscribe page.
- Recreate `listmonk` and `backend` after SMTP-related env changes.

Provider event limitations for trials:

- `POST /events/provider` ingests normalized provider events and minimal SES/SNS-like payloads only.
- SES SNS signature validation is still pending.
- SES SNS `SubscriptionConfirmation` handling is still pending.
- A non-SES provider may require its own webhook normalization or signature-verification work before event-backed metrics can be trusted in production.
- Do not treat accepted send results as delivered inbox placement; delivery/open/click/bounce/complaint truth depends on processed provider events.
- Bounce and complaint side effects are expected to create suppression behavior once matching provider events are received and correlated.

Suppression expectations:

- Unsubscribes remain backend-owned and write through the suppression path.
- Bounced or complained recipients should be treated as suppression candidates once matching provider events are ingested.
- Stop sending if complaint or bounce rates rise above acceptable trial thresholds; do not keep retrying affected audiences.

## Official Product Trial Send Posture

Use the one-recipient gate only for first SES validation:

```env
REAL_SEND_MAX_RECIPIENTS=1
REAL_SEND_REQUIRE_ALLOWED_RECIPIENTS=true
```

For official product trials, keep backend safety gates active while allowing the campaign audience:

```env
REAL_SEND_MAX_RECIPIENTS=0
REAL_SEND_REQUIRE_ALLOWED_RECIPIENTS=false
```

Campaign limits configured by the admin are the real product daily and 30-day limits. `EMAIL_SENDING_ENABLED=false` remains the emergency global off switch. Do not bypass Deliverability Guard, suppression checks, unsubscribe readiness, or the backend send path with direct Listmonk or SES sends.

Warmup policy for official trials:

- Start with low-volume campaigns only.
- Keep `campaign_sending_limits.daily_email_limit` intentionally low at first.
- Increase daily volume gradually only after acceptable bounce and complaint trends.
- Review provider-event-backed bounce and complaint counts after every trial campaign.
- Pause trial sends immediately if complaint or bounce rates become elevated.

Secret rotation before official trials:

- Rotate `CLERK_SECRET_KEY`.
- Rotate `BACKEND_API_KEY`.
- Rotate `UNSUBSCRIBE_TOKEN_SECRET`.
- Rotate SES SMTP credentials.
- Rotate Listmonk API/admin token or password.
- Rotate the PostgreSQL password if operationally feasible.
- Treat previous config-output exposure as a reason to rotate before public sending.

Provider-event semantics:
- `queued` means prepared and not yet accepted.
- `sent` means the backend successfully started the Listmonk campaign or received an equivalent provider acceptance signal; it does not mean inbox delivery.
- For the current Listmonk SMTP relay path, `provider_message_id` is expected to stay empty because the Listmonk campaign-start response does not expose stable per-recipient Mailgun message IDs.
- `delivered`, `opened`, `clicked`, `bounced`, `complained`, and `unsubscribed` must come only from processed provider or unsubscribe events.
- If provider events are missing, those metrics must stay unavailable rather than being inferred from recipient totals or send attempts.

## Restore Safety

- Never restore directly into `email_ai` or `listmonk` as a first step.
- Always validate a backup with `./scripts/restore_postgres_check.sh` before planning a live restore.
- If validation fails, stop and investigate the snapshot instead of forcing a restore.

## Rollback Procedure

If a deploy is bad but data is intact:

1. Roll code back to the last known-good revision.
2. Rebuild and restart the stack with `docker compose --env-file .env -f docker-compose.yml -f docker-compose.staging.yml up -d --build`.
3. Re-run `bash scripts/healthcheck.sh` and `bash scripts/smoke_test.sh`.

If data recovery is required:

1. Take one more safety backup of the current state if the cluster is still readable.
2. Run `./scripts/restore_postgres_check.sh --snapshot-dir <candidate-snapshot>`.
3. Only after a successful check, schedule the real restore with explicit operator approval.
4. Restore `email_ai` and `listmonk` from the same snapshot family.
5. Re-run health and smoke checks after recovery.

## Forbidden Commands

Do not run any of the following on staging or production unless the incident procedure explicitly requires it and a verified backup already exists:

- `docker compose down -v`
- `docker volume rm`
- `docker system prune --volumes`
- `DROP DATABASE`
- A destructive restore over a live database without a validated backup

## Production Direction

- Staging may continue on the VPS PostgreSQL container while backup validation is in place.
- Production should prefer managed PostgreSQL with automated backups and point-in-time recovery.
- Keeping the application VPS stateless reduces deploy and rollback risk.
