# Local QA Signoff

Date: 2026-05-27
Scope: Milestone 20.5.2 staging signoff documentation closure

## Last Validated Commits

- `4f741b62` - Fix staging admin dark card and account security overlay
- `e4d0003` - Stabilize backend pytest suite
- `6466631` - Clear RC follow-up review and test blockers

## Current QA Status

Status: staging deployment and no-dispatch browser QA are recorded as complete for Milestone 20.5.2.

This artifact records operator-confirmed staging closure evidence. It does not approve production deployment, provider sends, follow-up sending, or any runtime change beyond the completed staging deployment already reported by the operator.

Current verified staging evidence:

- Deployed commit/HEAD: `4f741b62a8f5655ef720196e704c237955922a8b`.
- Follow-up migration applied successfully.
- Required follow-up schema columns verified.
- Backend health passed.
- Frontend publicly reachable.
- Public Listmonk boundary verified.
- `scripts/audit.sh` passed.
- `scripts/smoke_test.sh` passed.
- Browser QA passed for the admin campaign detail dark-mode post-send status card.
- Browser QA passed for the Clerk account security fullscreen overlay.
- No real sends were performed during browser QA.
- No provider replay was performed.
- No secrets, tokens, recipient emails, raw payloads, or raw email bodies are recorded.
- Follow-up executor is not implemented.
- Production deploy is not approved.

UI patch verification:

- Dark post-send status card rendering is corrected.
- Fullscreen Clerk security overlay rendering is corrected.

Residual product scope:

- Follow-up limits and delay configuration exist.
- The backend eligibility helper exists for follow-up checks.
- A runtime follow-up executor, job, or worker is not implemented.
- No operational follow-up send claim is made by this signoff.

Blockers cleared by 20.4.1:

- Existing local PostgreSQL volumes can be brought current by the migration runner instead of dropping data.
- Local QA has an explicit preflight for required follow-up columns.
- The dev Compose overlay forces a no-send Mailpit posture for local QA.

## Local QA Commands

Start local QA safely:

```bash
SENDWISE_ENV_FILE=.env.example docker compose --env-file .env.example -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Apply pending migrations to an existing local volume:

```bash
SENDWISE_ENV_FILE=.env.example SENDWISE_COMPOSE_ENV_FILE=.env.example SENDWISE_COMPOSE_FILES=docker-compose.yml:docker-compose.dev.yml bash scripts/apply_migrations.sh
```

Run the local QA preflight:

```bash
bash scripts/local_qa_preflight.sh
```

The preflight must pass before 20.4 local browser QA begins. If it reports missing columns, apply migrations. Recreating the local PostgreSQL volume is a last-resort manual recovery step only after preserving any needed local data.

Required schema columns:

- `campaign_sending_limits.followup_enabled`
- `campaign_sending_limits.followup_daily_limit`
- `campaign_sending_limits.followup_monthly_limit`
- `campaign_sending_limits.followup_delay_value`
- `campaign_sending_limits.followup_delay_unit`
- `email_logs.send_kind`

## Local Safety Assertions

- This documentation task did not touch VPS/runtime state.
- No SSH or remote command was executed during this documentation task.
- No staging or production DB mutation was performed during this documentation task.
- No real sends.
- No provider replay.
- No Mailgun/Listmonk/Caddy/VPS runtime setting changes.
- No follow-up executor implemented.
- Not production deploy approval.

## 20.4 Local QA Rerun Checklist

- Start local stack with the dev-safe command above.
- Apply migrations with the local-safe migration command if the volume is not current.
- Run `bash scripts/local_qa_preflight.sh`.
- Run `bash scripts/audit.sh`.
- Run `bash scripts/smoke_test.sh`.
- Run backend pytest through the Docker backend image.
- Run frontend lint and build.
- Run browser QA only after the preflight is green.
- Confirm campaign create/update no longer fails with undefined follow-up columns.
