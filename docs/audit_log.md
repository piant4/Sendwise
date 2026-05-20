# Audit Log

## Milestone 18.6O-FIX8 - Fix VPS Provisioning Errors And Campaign Summary Regression

Date: 2026-05-20

VPS regression audit summary:
- Audited only the allowed admin client provisioning, campaign summary, frontend admin access actions, and related regression tests without reading `.env`, printing secrets, dispatching campaigns, or touching live SES/Listmonk actions.
- Exact campaign-summary root cause: `AdminCampaignService._evaluate_campaign()` still called `self._evaluate_duplicate_dispatch_guard(...)`, but the method existed only on `CampaignDispatchService`. Summary/readiness code therefore raised `AttributeError` before returning the read model.
- Exact provisioning fault class on the backend: client-access provisioning still surfaced raw infra-style exceptions from Clerk-link creation and SMTP delivery/config checks, so the admin UI only received generic failure text instead of stable safe codes.
- Restored the duplicate-send guard inside `AdminCampaignService` with the same blocked states as the dispatch path: queued logs block as in-progress, accepted/mixed real logs block as already accepted, and fully failed retries stay eligible only when every real log is failed and the recipient set is unchanged.
- Provisioning now returns only controlled codes for the admin flow: `client_access_clerk_config_missing`, `client_access_clerk_link_failed`, `client_access_email_config_missing`, `client_access_email_send_failed`, `client_access_email_invalid`, and `client_access_existing_user_conflict`.
- If Clerk access is created but transactional email delivery fails, Sendwise keeps the access record active with pending invitation state and relies on the safe resend action after SMTP recovery.
- Frontend admin access actions now translate those provisioning codes into explicit Italian admin messages instead of echoing backend implementation text.

Checks executed:
- `git diff --check`
- `'/Users/leonardo/.local/share/uv/python/cpython-3.13-macos-aarch64-none/bin/python3.13' -m py_compile backend/app/services/campaigns.py backend/app/services/clients.py backend/app/services/emails.py backend/tests/test_admin_campaigns.py backend/tests/test_clerk_auth.py`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`

Checks result:
- `git diff --check`, Python syntax compilation, frontend lint, frontend build, audit, and smoke checks passed.
- Targeted backend pytest execution was not runnable in the current sandboxed local environment because the available Python with project dependencies is not configured locally: `/usr/bin/python3` is Python 3.9 and fails on modern union syntax during import, while the available Python 3.13 runtime does not have the project test dependencies installed.
- No schema migration was required.
- No secret, token, secure link, reset link, invitation URL, SMTP password, or Clerk key was logged or returned by the patched code paths.
- No plaintext password handling was introduced.
- No campaign send, direct Listmonk action, or direct SES action was executed during this fix.

## Milestone 18.6O-FIX7 - Replace Client Invite Onboarding With Account Provisioning

Date: 2026-05-20

Account provisioning audit summary:
- Audited the current client-access flow in `backend/app/api/admin.py`, `backend/app/api/auth.py`, `backend/app/services/client_access.py`, the frontend auth/onboarding surfaces, and the existing template/email utilities without reading secrets, dispatching campaigns, or touching live SES/Listmonk sends.
- The verified safe path is now admin-created account provisioning: Sendwise prepares a Clerk invitation for unclaimed access, reuses Clerk sign-in tokens for already linked users, activates the `client_access` record immediately in Business DB, and sends a transactional access email with the login email, panel URL, and secure Clerk link.
- The legacy onboarding route and ticket-based Sendwise activation shell are intentionally disabled. `/onboarding` and legacy ticket handoff now return product-safe copy that directs the customer back to the main login flow or to request a new access email.
- No schema migration was required. Existing `client_access` fields already support reserved `portal_slug`, Clerk linkage, pending/accepted access state, and revoke/archive transitions.
- Password ownership remains fully Clerk-managed. Sendwise does not generate, persist, or email permanent plaintext passwords.

Safety confirmation:
- No password is stored in Sendwise persistence; password creation and reset remain Clerk-owned.
- No send/dispatch execution, direct SES/Listmonk campaign action, DB reset, destructive DB command, or schema migration was performed during this milestone work.

## Milestone 18.6O-FIX6 - Make Invite Onboarding Single-Step And Coherent

Date: 2026-05-20

Invite onboarding audit summary:
- Audited `frontend/components/auth/ClientInviteActivationForm.tsx`, `frontend/components/auth/ClientOnboardingExperience.tsx`, `frontend/app/onboarding/[[...onboarding]]/page.tsx`, and the documented auth contract without reading secrets, sending invites, or touching provider actions.
- Exact root cause of the double-step UX: the invite route started with a Sendwise-owned password form even though Clerk can still require additional protected UI after `ticket` submission, while Clerk exposes those follow-up requirements only after the invite flow starts. That made the first screen optimistic and forced the user into either `Invito non completabile` or a later Clerk screen.
- Final mode decision is `clerk-framed first`. The current code makes the onboarding mode explicit and defaults ticket activation to `clerk-framed` because reliable pre-submit detection for missing protected requirements and pending Clerk tasks is not available in the installed runtime.
- The initial invite screen now renders the Clerk activation UI directly inside the Sendwise card, so the user never fills a custom Sendwise password form before seeing Clerk-managed requirements.
- After Clerk creates a valid session, the signed-in onboarding step now reuses Clerk `firstName` and `lastName` to complete backend onboarding automatically when possible, then routes through `/auth/redirect`. If those names are unavailable or backend completion fails, the existing Sendwise profile form remains as the controlled fallback.
- Pending portal behavior remains unchanged: `portal_slug` is still hidden until accepted active access, and backend onboarding still runs only after true auth completion.
- Required Clerk dashboard note: if the framed invite card must remain password-only, disable social providers in `User & Authentication -> Social Connections`.

Safety confirmation:
- No password is stored in Sendwise persistence; password creation remains Clerk-owned.
- No send/dispatch execution, direct SES/Listmonk action, DB reset, destructive DB command, or schema migration was performed.

## Milestone 18.6O-FIX5 - Enforce Fully Custom Invite Activation

Date: 2026-05-20

Invite activation audit summary:
- Audited `frontend/components/auth/ClientInviteActivationForm.tsx`, `frontend/components/auth/ClientOnboardingExperience.tsx`, and `frontend/app/onboarding/[[...onboarding]]/page.tsx` without reading secrets, sending invites, or touching provider actions.
- Exact root cause after `Attiva account`: the onboarding form still contained two continuation paths that could leave the Sendwise-owned flow and expose Clerk UI, `redirectToSignUp(...)` for unresolved ticket requirements and `window.location.assign(...)` for hosted continuation URLs returned from pending session tasks.
- The accepted success path is now strictly limited to ticket activation completed by the Sendwise form, a complete Clerk session with no pending task, backend onboarding completion, and redirect to `/auth/redirect`.
- Any unresolved protected requirement now fails closed inside the Sendwise card with `Invito non completabile`, product-safe copy, and `Torna al login`; no embedded Clerk component, hosted continuation, provider task component, or visible auth branding remains in the invite onboarding flow.
- Internal-only debug mapping remains in code through development-console warnings that classify blocked states such as unsupported pending fields, external/social verification requirements, missing session creation, hosted continuation targets, and pending session tasks.
- The required Clerk configuration for this flow is now documented explicitly: invite activation must be satisfiable by `ticket + first_name + last_name + password` only, with no additional social, email/phone verification, organization, MFA, reset-password, or hosted continuation requirement.

Safety confirmation:
- No password is stored in Sendwise persistence; password creation remains Clerk-owned.
- No send/dispatch execution, direct SES/Listmonk action, DB reset, destructive DB command, or schema migration was performed.

## Milestone 18.6O-FIX4 - Stop Embedded Clerk Invite Screen

Date: 2026-05-20

Invite activation audit summary:
- Audited `frontend/components/auth/ClientInviteActivationForm.tsx`, the signed-in onboarding gate, and the auth redirect handoff without reading secrets, sending invites, or touching provider actions.
- Exact root cause after `Attiva account`: the custom invite form escalated non-complete ticket states into embedded auth UI by rendering `<SignUp />` when the ticket flow reported follow-up requirements and by rendering provider task components after the finalized session exposed a pending task.
- The invite form now keeps the custom Sendwise fields visible, submits supported profile and password fields directly through the auth SDK, and retries supported missing-field completion through SDK updates before deciding whether the flow can finish.
- If protected follow-up still remains, the page now renders only the Sendwise fallback card `Completa la verifica` with product copy and a secure continuation action; no embedded auth card, social buttons, provider badges, or raw technical follow-up labels are rendered inside onboarding.
- Known limitation: the secure continuation button can redirect to a hosted follow-up only when the auth runtime exposes a safe redirect target; otherwise it falls back to the existing login entry so the user never loops back into an embedded auth card.
- Signed-in onboarding, pending portal gating, backend onboarding completion, and password ownership remain unchanged: Sendwise still stores only profile completion data after the auth system finishes account activation.

Safety confirmation:
- No password is stored in Sendwise persistence; password creation remains auth-system owned.
- No send/dispatch execution, direct SES/Listmonk action, DB reset, destructive DB command, or schema migration was performed.

## Milestone 18.6O-FIX3 - Resolve Clerk Invite Follow-Up States

Date: 2026-05-20

Invite follow-up audit summary:
- Audited the custom invite activation flow in `frontend/app/auth/redirect/page.tsx`, `frontend/components/auth/ClientInviteActivationForm.tsx`, and the signed-in onboarding gate without reading secrets, sending invites, or touching live provider actions.
- Exact fallback root cause remained in `ClientInviteActivationForm`: after `signUp.create()` the screen treated `signUp.status="missing_requirements"` and any non-complete result without `createdSessionId` as a terminal unsupported state, then after `signUp.finalize()` it converted `session.currentTask` into raw technical copy instead of continuing the supported auth follow-up.
- The installed auth SDK exposes three concrete session follow-up tasks in the current runtime typings: `choose-organization`, `reset-password`, and `setup-mfa`. Those tasks can be completed safely in-app with the existing provider components, so they no longer fall back to generic error copy.
- `missing_requirements` and missing-session invite states now hand off to the existing secure sign-up completion UI from the same screen, while unsupported technical wording is replaced with product copy: `Completa la verifica`, `Per proteggere il tuo account, è necessario completare un ultimo passaggio di sicurezza.`, primary action `Continua in sicurezza`, and secondary action `Torna al login`.
- The custom Sendwise password form, password validation semantics, and pending portal routing behavior remain unchanged. Sendwise still stores only profile completion data after the auth system finishes the secure account flow.

Safety confirmation:
- No password is stored in Sendwise persistence; password creation and protected follow-up states remain auth-system owned.
- No send/dispatch execution, direct SES/Listmonk action, DB reset, destructive DB command, or schema migration was performed.

## Milestone 18.6O-FIX1 - Fix Invited Client Onboarding And Pending Portal State

Date: 2026-05-20

Invite onboarding and pending portal audit summary:
- Audited the invite activation UI, Clerk ticket handoff, backend auth mapping, admin client detail surface, and current client-access persistence without reading secrets, sending invites manually, or touching live SES/Listmonk operations.
- Root cause for the raw fallback message was the custom invite UI treating every non-`complete` Clerk sign-up outcome as a generic unsupported security error. The audited unsupported states are `signUp.status="missing_requirements"` during ticket activation and pending Clerk `session.currentTask` values after `finalize()`, which Clerk documents for tasks like `choose-organization`, `reset-password`, and `setup-mfa`.
- The invite activation form now keeps Clerk as the password authority, adds a local strength meter, password checklist, confirm-password match feedback, friendlier Italian Clerk password error mapping, and safe fallback states for invalid invites or unsupported Clerk follow-ups.
- Backend and admin API summaries now hide `portal_slug` while access remains invited/pending even though persistence still keeps a reserved internal slug. No schema migration was required because the database already supports keeping the slug internally while the API exposes it only after active accepted access.
- Admin client detail now shows pending invite semantics only: no active portal slug copy, `Rimanda invito`, and `Annulla invito` until acceptance. Accepted access keeps the existing revoke/archive flow.

Safety confirmation:
- No password is stored in Sendwise persistence; password creation remains Clerk-owned.
- No send/dispatch execution, direct SES/Listmonk action, DB reset, destructive DB command, or schema migration was performed.

## Milestone 18.6K - SES Deliverability Posture And Production Readiness

Date: 2026-05-20

SES deliverability readiness audit summary:
- Audited the allowed docs, env example, and send-preparation surfaces without reading `.env`, printing secrets, sending mail, or touching live SES/Listmonk operations.
- Confirmed the current config surfacing already covers `EMAIL_PROVIDER`, `EMAIL_SENDING_ENABLED`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, and `AWS_SES_REGION`.
- Confirmed campaign preparation uses `SMTP_FROM_EMAIL` as the sender when present, public unsubscribe URLs are built from `FRONTEND_URL`, and no dedicated Reply-To surface exists today.
- Expanded the README and staging runbook with an official SES trial checklist covering verified SES identity/domain, DKIM, SPF, DMARC, optional MAIL FROM, sandbox exit, SES SMTP credential usage, correct public URL roles, warmup pacing, suppression expectations, and partial provider-event limitations.
- Added a minimal compliance footer line to backend-rendered campaign HTML when a saved HTML body does not already include an unsubscribe link.
- Documented required secret rotation for previously exposed values: Clerk secret, backend API key, unsubscribe token secret, SES SMTP credentials, Listmonk token/password, and PostgreSQL password where feasible.

Checks executed:
- `git diff --check`
- targeted backend tests for template rendering and campaign preparation
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- safe Compose config checks with `.env.example`
- changed-file scan for real secrets
- changed-file scan for direct SES/Listmonk send paths
- changed-file scan for fake metrics

Checks result:
- All listed checks passed.
- No live send, direct SES send, direct Listmonk send, or fake delivery/open/click metrics were introduced.
- No `.env` or secret file was read or printed.

## Milestone 18.6G - Polish Admin Send And Post-Send UI

Date: 2026-05-19

Admin send UI audit summary:
- Audited the admin campaign review/detail UI surfaces and shared campaign copy helpers without touching backend logic, schema, Docker, env, or live send flows.
- Replaced raw dispatch and provider-facing admin copy with product copy for started, accepted, failed, duplicate-blocked, and no-new-send outcomes.
- Refined the review panel with lower-density summary cards, a cleaner post-send result box, and duplicate-send CTA de-emphasis when backend blockers already indicate a previously accepted or in-progress send.
- Clarified that `sent` means accepted by the sending system, not inbox delivery, and kept delivered/opened/clicked/bounced/complained/unsubscribed cards explicitly unavailable until provider events exist.
- Kept counts limited to backend-backed values only: accepted, failed, queued/prepared, blocked, and eligible recipients where each value is actually exposed by the current frontend payload.

Checks executed:
- `git diff --check`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- touched frontend scan for direct Listmonk/SES calls
- touched frontend scan for fake delivered/open/click claims
- changed file scan for env/secrets/config edits

Checks result:
- `git diff --check`, frontend lint, frontend build, audit script, and smoke test passed.
- Touched frontend scans found no direct Listmonk/SES action code and no fake delivered/open/click claims.
- No env, secret, or config edits were introduced.

Scope confirmation:
- No backend logic, DB/schema/migration, Docker/env/config, or send/dispatch execution changes were made.
- No direct Listmonk/SES action was performed.
- No fake delivered/open/click metrics were introduced.

## Milestone 18.6F - Provider Events Ingestion And Metrics Truth

Date: 2026-05-19

Provider-event ingestion audit summary:
- Audited `events`, provider-event repositories, campaign/client read models, and frontend metric surfaces without reading secrets or calling live provider APIs.
- Confirmed the current schema already contains the required `provider_events`, `email_logs.provider_message_id`, and `suppression_list` fields, so no migration was required.
- Extended provider-event ingestion to keep SES delivery/open/click/bounce/complaint handling idempotent, accept supported normalized listmonk unsubscribe payloads, and map provider-event side effects back to correlated `email_logs`, `contacts`, and suppressions.
- Campaign and client read models now expose truthful provider-event-backed delivery metrics, keep delivery/open/click/bounce-style metrics unavailable until real processed events exist, and avoid synthesizing those values from recipient counts or queued/sent logs alone.
- Admin campaign detail UI now renders explicit provider metric cards for delivered, opened, clicked, bounced, complained, and unsubscribed counts with honest unavailable states when events are missing.

Safety confirmation:
- No schema change, migration, DB reset, Docker volume deletion, direct Listmonk send, direct SES send, Deliverability Guard bypass, suppression bypass, unsubscribe bypass, or fake delivered/open/click metric path was introduced.

## Milestone 18.6D - Reconcile Email Logs After Listmonk SMTP Dispatch

Email-log reconciliation audit summary:
- Audited controlled dispatch, email log persistence, provider event correlation, and admin send UI copy without reading secrets or calling external provider APIs.
- Root cause: `CampaignDispatchService.send_campaign()` treated a successful Listmonk trigger as a permanently `queued` backend state and created `email_logs` only after that trigger, while SMTP/Listmonk failures after dispatch had no truthful reconciliation path inside the backend response model.
- Controlled dispatch success now records `email_logs.status="sent"` as provider/Listmonk acceptance, not inbox delivery, and returns `provider_status`, `queued_count`, `sent_or_accepted_count`, and `failed_count`.
- Dispatch failures that occur after the backend actually attempts Listmonk send now persist `email_logs.status="failed"` for the attempted contacts; preparation failures still create no real send logs.
- No delivered/open/click metrics are synthesized, no direct Listmonk or SES shortcut path was added, and campaign/suppression/unsubscribe gates remain unchanged.

## Milestone 18.6C - Wire Listmonk SMTP Config From .env

Date: 2026-05-19

Compose/Listmonk SMTP audit summary:
- Audited base, dev, and staging Compose Listmonk service config without reading the real `.env`.
- Root cause: base/staging Listmonk only passed app address and database config, while SMTP mapping existed only in the dev overlay and included an unsupported sender mapping; staging therefore allowed Listmonk to retain the installed placeholder SMTP settings.
- Base Listmonk now receives admin credentials, app sender, and SMTP values from the selected env file, while staging marks required SMTP/Listmonk/Postgres values with Compose `:?required` guards.
- Dev overlay now relies on the base SMTP mapping and keeps only the Mailpit dependency/ports.
- `.env.example` now contains non-secret SMTP placeholder values so safe Compose rendering works without touching a real `.env`.

Docs/runbook changes:
- README and VPS staging runbook now document that Listmonk SMTP comes from `.env`.
- Docs now state that SMTP env changes require recreating `listmonk` and `backend`.
- Docs warn not to share Compose config output rendered from a real `.env`.

Safety confirmation:
- No backend send flow, direct Listmonk send, SES live send, database reset, volume deletion, schema change, migration, or real `.env` inspection was performed.

## Milestone 18.5E-FIX2 - Align Audit And Smoke Scripts With Selectable Env File

Date: 2026-05-19

Script alignment summary:
- `scripts/smoke_test.sh` now runs base, dev, and staging Compose config validation with `SENDWISE_ENV_FILE=.env.example` and `--env-file .env.example`.
- `scripts/audit.sh` no longer expects dev Compose to hardcode the Mailpit SMTP fallback; it checks that Listmonk SMTP host comes from the selected env file.
- `scripts/audit.sh` now guards the smoke/audit scripts against unsafe bare `docker compose config` calls.
- `scripts/audit.sh` checks that runtime service env files default to `.env`, staging keeps backend/frontend localhost-bound, staging does not publicly expose postgres/listmonk/mailpit, and staging does not hardcode test send gates.

Safety confirmation:
- No backend/frontend product logic, DB schema, migration, DB reset, Docker volume deletion, send/dispatch endpoint, direct Listmonk send, or direct SES send was changed or executed.
- No real `.env` contents were read, printed, staged, or committed.

## Milestone 18.5E-FIX - Prevent Compose Validation From Reading Real Env

Date: 2026-05-19

Compose/env audit summary:
- Base Compose service-level `env_file` entries now use `${SENDWISE_ENV_FILE:-.env}` for `postgres`, `backend`, `frontend`, and `listmonk`.
- VPS runtime remains defaulted to `.env` when `SENDWISE_ENV_FILE` is not set.
- Safe validation can use `SENDWISE_ENV_FILE=.env.example docker compose --env-file .env.example ... config` so Compose interpolation and service env injection both resolve to `.env.example`.

Docs/runbook changes:
- README and VPS staging runbook document that `--env-file` controls Compose interpolation, while service-level `env_file` controls container environment injection.
- README and VPS staging runbook now show safe validation with `SENDWISE_ENV_FILE=.env.example` and keep the runtime staging `up -d --build` command on `--env-file .env`.
- Docs warn not to run public or shared config dumps against a real `.env`.

Safety confirmation:
- No backend/frontend product logic, DB schema, migration, DB reset, Docker volume deletion, send/dispatch endpoint, direct Listmonk send, or direct SES send was changed or executed.
- Safe validation commands did not print real `.env` values, and `.env` was not modified, staged, or committed.
- `scripts/smoke_test.sh` still calls `docker compose config` without the safe `SENDWISE_ENV_FILE=.env.example --env-file .env.example` guard; on a workspace where `.env` exists, that script is unsafe for this milestone and remains a validation blocker until updated in a later allowed scope.

## Milestone 18.5E - Make VPS Env The Container Source Of Truth

Date: 2026-05-19

Compose/env audit summary:
- Base Compose now attaches `env_file: .env` to `postgres`, `backend`, `frontend`, and `listmonk`.
- Backend runtime env, frontend runtime env, frontend build args, Postgres credentials, Listmonk credentials, send gates, Listmonk API config, and SES/SMTP/provider settings are interpolated from `.env` instead of Compose defaults.
- The staging override no longer forces `EMAIL_PROVIDER=mailpit`, `EMAIL_SENDING_ENABLED=false`, real-send gate values, public URLs, or frontend API build args; those values must come from the VPS `.env`.
- The staging override keeps localhost-only backend/frontend ports and removes Listmonk host port publishing.

Docs/runbook changes:
- README and VPS staging runbook now use `docker compose --env-file .env -f docker-compose.yml -f docker-compose.staging.yml config`.
- README and VPS staging runbook now use `docker compose --env-file .env -f docker-compose.yml -f docker-compose.staging.yml up -d --build`.
- Runbook documents that `.env` edits require recreating affected containers and `.env` must never be committed.

Safety confirmation:
- No backend/frontend product logic, DB schema, migration, DB reset, Docker volume deletion, send/dispatch endpoint, direct Listmonk send, or direct SES send was changed or executed.
- Exact `docker compose --env-file .env.example config` validation expands service `env_file: .env` in this local workspace when `.env` exists; use `--no-env-resolution` for safe rendered inspection when validating against `.env.example` on a machine that also has a real `.env`.

## Milestone 18.5B - Switch Real Send Gates To Public Product Mode

Date: 2026-05-19

Real-send gate audit summary:
- `REAL_SEND_MAX_RECIPIENTS` is read by `Settings` and enforced in `CampaignDispatchService._check_real_send_recipient_limit`.
- `real_send_max_recipients_exceeded` is produced only by the SES safety gate before listmonk dispatch.
- `REAL_SEND_REQUIRE_ALLOWED_RECIPIENTS` is enforced by `CampaignDispatchService._check_allowed_recipients`.
- Dispatch gate order remains: `EMAIL_SENDING_ENABLED`, Deliverability Guard provider/runtime prerequisites, unsubscribe public URL readiness, eligible campaign contacts, optional max recipient cap and allowlist, prepared unsubscribe link, then listmonk dispatch.
- Campaign daily and 30-day period limits remain enforced by Deliverability Guard before provider dispatch.
- Send targets still come only from campaign-associated contacts returned by `list_campaign_contacts`; partial sends remain unsupported and suppressed or non-eligible mixed batches still block before dispatch.

Changes:
- Made `REAL_SEND_MAX_RECIPIENTS` optional: unset, empty, `0`, or negative disables the global test cap; a positive value still blocks over-cap sends.
- Made allowlist enforcement conditional on `REAL_SEND_REQUIRE_ALLOWED_RECIPIENTS=true`.
- Updated admin UI reason mapping so environment cap and allowlist blockers do not expose raw env variable names, while campaign limit blockers stay actionable.
- Updated API contract, staging runbook, README, and this audit log with first SES validation versus official product trial posture.

Safety confirmation:
- No schema change, migration, DB reset, Docker volume deletion, direct Listmonk send, direct SES send, Deliverability Guard bypass, suppression bypass, unsubscribe bypass, or campaign limit bypass was introduced.

## Milestone 17.2F - Polish Client Dashboard Header And Performance Card

Date: 2026-05-18
Branch: develop

Header greeting audit summary:
- Audited the frontend-only client dashboard mapping path in `frontend/lib/api.ts`, `frontend/types/index.ts`, `frontend/components/client/dashboardModel.ts`, and `frontend/components/client/ClientDashboardHeader.tsx`.
- Confirmed the frontend already maps the backend-owned `client_dashboard.greeting_name` directly into `summary.clientDashboard.greetingName`; no API contract or backend mapping bug was present in the touched frontend path.
- Identified the visible `Bentornato, cliente` fallback as a header rendering issue: the component trusted `greetingName` even when it contained the backend generic fallback instead of a real first name.
- Added a safe frontend fallback that keeps backend ownership first, but derives the display first name from the existing backend-owned `summary.client.name` only when `greetingName` is missing, empty, or equal to the generic fallback `cliente`.
- Kept the greeting first-name only and removed the header CTA so the hero stays shorter and cleaner.

Performance card layout audit summary:
- Audited `frontend/components/client/ClientRecentCampaignsCard.tsx`, the shared `ClientSurface` shell, and the dashboard card CSS in `frontend/app/globals.css`.
- Kept performance metrics fully backend-backed from `summary.clientDashboard.performanceAnalytics` and changed no metric semantics or fallback values.
- Tightened the card shell spacing, anchored the period selector into the top-right header slot, improved responsive wrapping on narrow widths, and increased internal rhythm for the summary tiles, chart rows, and footer.
- Compacted the empty state spacing without altering the existing backend-driven empty-state meaning.

Files touched:
- `frontend/components/client/ClientDashboardHeader.tsx`
- `frontend/components/client/ClientRecentCampaignsCard.tsx`
- `frontend/components/client/ClientSurface.tsx`
- `frontend/app/globals.css`
- `docs/audit_log.md`

Scope confirmation:
- No backend, DB schema, migration, API contract, auth, send/dispatch, SES, listmonk, Docker, env, or config changes were made for this milestone.
- No fake metrics, frontend-derived business metrics, recipient-count usage, or daily limit display were introduced.

## Milestone 17.2D - Backend-Backed Client Dashboard Analytics

Date: 2026-05-18
Branch: develop

Client dashboard backend sync audit summary:
- Extended `GET /client/overview` so the backend now owns a dedicated `client_dashboard` read model for client greeting, campaigns CTA, KPI values, performance analytics windows, required actions, status summary, and period usage.
- Removed dashboard business-metric dependence on frontend-derived campaign snapshots. The dashboard route now renders from the overview read model only.
- Verified backend metric sources before implementation:
  - campaign status counts and `max_campaigns` come from client-scoped campaign/client records
  - real send counts come from non-simulated `email_logs`
  - blocked counts come from timestamped client-scoped `blocked_sends`
  - opened counts come from processed `provider_events` with `event_type=\"ses_open\"`
- Kept unavailable vs zero semantics explicit: missing repositories return `null` plus `available=false`, while real zero-row windows return `0` plus `available=true`.
- Confirmed client daily pacing limits remain hidden from the dashboard read model and UI.

Implemented:
- Added client dashboard analytics windows for `24h`, `7d`, `14d`, `30d`, and `allTime`.
- Defined KPI semantics on the backend: active campaigns use `running` only, ready campaigns do not consume active capacity, sent analytics exclude simulated rows, and opened analytics use provider events only.
- Replaced the client dashboard status chart with a backend-fed `Performance campagne` chart plus selector and compact backend-fed status summary pills.
- Kept the client campaigns page on backend `periodUsage` only and removed the unused client campaign stats fetch from that page.

Checks executed:
- `git diff --check`
- `docker run ... PYTHONPATH=/src/backend pytest backend/tests/test_clerk_auth.py -k "client_overview or client_dashboard_endpoints_are_backend_owned_and_client_scoped"`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config`
- touched frontend scan for direct listmonk references

Checks result:
- `git diff --check`, frontend lint, frontend build, audit script, smoke test, and both Docker Compose config validations passed.
- Targeted backend coverage passed in Docker with Python 3.12: 4 selected tests passed.
- The frontend listmonk scan remained clean.

Scope confirmation:
- No DB schema or migration changes were made.
- No send/dispatch, SES, listmonk, auth, Docker, env, or config behavior was changed.
- No fake metrics, fake windows, recipient-count usage, or fake trends were introduced.

## Milestone 17.1C - Fix Client Dashboard Limits Semantics

Date: 2026-05-18
Branch: develop

Dashboard limits audit summary:
- Reviewed the client dashboard composition in `frontend/app/c/[portalSlug]/page.tsx`, the dashboard read-model builder in `frontend/components/client/dashboardModel.ts`, the campaign overview cards, and the frontend API/type mappings used by the client portal.
- Identified all capacity uses tied to `summary.campaigns.totalCampaigns` in `dashboardModel.ts`, `ClientKpiGrid.tsx`, and `ClientDeliveryCard.tsx`; these were incorrectly treating total campaigns as active-capacity usage.
- Added campaign-scoped `campaign_sending_limits` persistence with default `period_email_limit=1000`, `daily_email_limit=50`, optional `period_started_at`, and idempotent backfill from existing non-simulated `email_logs.created_at`.
- Moved Guard send-volume enforcement away from `clients.email_limit_per_campaign`; runtime dispatch now evaluates table-backed campaign daily and 30-day usage before queueing and returns admin-facing usage metadata.
- Updated admin campaign create/edit flows to manage `Limite invii 30 giorni` and `Limite invii giornaliero`, while client pages now avoid configured daily-limit exposure and avoid recipient-count fallbacks for send usage.
- Confirmed the active-capacity fix can stay frontend-only because the existing overview payload already exposes `status_counts.running`, `running_campaigns`, `total_campaigns`, `max_campaigns`, and `email_limit_per_campaign`.
- Confirmed the frontend already receives backend-backed per-campaign log totals through `CampaignReadModel.logs` and `ClientCampaignStatsReadModel.logs`, with available fields `sent`, `queued`, `simulated`, `opened`, `clicked`, `bounced`, `complained`, `unsubscribed`, and `providerEventsAvailable`.
- Confirmed no `attempted` field is exposed to the frontend today; the only real per-campaign send-volume fields available for honest usage display are `logs.sent` and `logs.queued`.
- Removed the incorrect eligible-recipient fallback for campaign usage so recipient counts are never presented as send usage.

Implemented:
- Rebased dashboard active-capacity semantics on `statusCounts.running` only, including the KPI card, limit rail, remaining-slot math, saturation copy, and recommendation logic.
- Kept `ready` campaigns visible as ready-to-start inventory without letting them consume active capacity.
- Reworked per-campaign usage rendering to use only backend log totals (`logs.sent + logs.queued`) against the configured campaign limit, with concise Italian copy: `Invii nel periodo`, `Invii registrati`, and `Limite campagna`.
- Simplified campaign rows by removing provider-event repetition, tightening chips, softening card styling, and adding explicit vertical separation below the status chart.
- Replaced the incomplete-status chart segment from orange to neutral gray while preserving blue for ready/running and red for blocked/error states.

Checks executed:
- `git diff --check`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config`
- touched dashboard file scan for direct listmonk calls
- touched dashboard file scan for fake delivered/open/click/open-rate/click-rate/sent claims
- changed file scan for env/secrets/config changes
- browser open attempt for `http://localhost:3000`

Checks result:
- `git diff --check`, frontend lint, frontend build, audit script, smoke test, and both Docker Compose config checks passed after the patch.
- Touched frontend file scans found no direct listmonk calls and no fake delivered/open/click/open-rate/click-rate claims.
- No env, secret, Docker, or config file changes were introduced by this milestone.
- Browser-based manual QA could not be completed here because the available Playwright browser tool failed to initialize Chrome on this machine (`Chromium distribution 'chrome' is not found at /Applications/Google Chrome.app/Contents/MacOS/Google Chrome`).

Scope confirmation:
- No backend, DB schema, API contract, auth, send/dispatch, SES, or listmonk integration changes were made.
- No fake sent, delivered, opened, clicked, open-rate, or click-rate metrics were introduced.

## Milestone 17.1B - Refine Client Dashboard Header And Campaign Analytics

Date: 2026-05-18
Branch: develop

Verified state:
- The client dashboard still consumes only the existing client overview summary plus existing recent campaign detail and stats read models; no API contract or backend logic changed.
- The header now anchors the client name higher, adds real workspace context next to it, and keeps one primary CTA to open campaigns without the previous empty left-side gap.
- The top summary is reduced to four compact cards with clearer hierarchy: ready campaigns, campaigns to complete, blocked sends in the current period, and campaign capacity versus the configured limit.
- The campaign overview now uses a compact CSS conic chart backed by real status counts, tighter spacing, and lighter campaign rows that only show real readiness, recipient, blocked-recipient, provider-event, and honest per-campaign limit progress signals.
- Side content no longer uses filler blocks: it now shows real limit saturation, current-period usage totals, actionable follow-up items, and recent readiness summaries derived from recent campaign detail snapshots only.
- Per-campaign progress uses `sent + queued` versus the real campaign limit only when those backend-backed values are present; otherwise it falls back to eligible recipients versus the exposed per-campaign limit and labels that fallback explicitly as recipient usage.

Checks executed:
- `git diff --check`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config`
- touched dashboard file scan for direct listmonk calls
- touched dashboard file scan for fake delivered/open/click/open-rate/click-rate claims
- changed file scan for env/secrets/config changes

Checks result:
- All listed local validation commands passed in this workspace.
- Direct scan of touched dashboard files found no frontend listmonk calls.
- The fake-metric scan only matched existing helper field names in shared campaign utilities; no new fake delivery, open, click, open-rate, or click-rate UI claims were added by this milestone.
- Browser-based manual QA for a valid `/c/{portalSlug}` route could not be completed here because the available Playwright browser integration failed to start without a local Chrome distribution.

Scope confirmation:
- No backend, schema, API contract, auth, send/dispatch, SES/listmonk integration, Docker/env/config, or database changes were made.
- No fake delivered/open/click/delivery-rate/open-rate/click-rate metrics or fake time-series trends were introduced.

## Milestone 18.0B - VPS Backup And Restore Safety Runbook

Date: 2026-05-16
Branch: develop

Backup and restore audit summary:
- Added a dedicated backup and restore runbook covering hourly local and remote backups for both `email_ai` and `listmonk`, retention policy, forbidden destructive commands, deploy safety, rollback flow, and the managed PostgreSQL recommendation.
- Added a staging VPS runbook that requires a backup before deploy, migrations only after pull/build, health and smoke checks after restart, code rollback steps, and restore validation before any live recovery.
- Added `scripts/backup_postgres.sh` to create timestamped `pg_dump` custom-format archives for both databases, write checksums, maintain local hourly/daily/weekly retention trees, and optionally sync the same trees to an rclone remote without hardcoded credentials or secret output.
- Added `scripts/restore_postgres_check.sh` to restore backups into temporary database names only, verify public table counts, fail safely, and print manual cleanup commands when temporary databases are retained.

Files touched:
- `docs/runbook_backup_restore.md`
- `docs/runbook_vps_staging.md`
- `scripts/backup_postgres.sh`
- `scripts/restore_postgres_check.sh`
- `docs/audit_log.md`
- `README.md`

Checks executed:
- `bash -n scripts/backup_postgres.sh`
- `bash -n scripts/restore_postgres_check.sh`
- `git diff --check`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- changed-file secret and env-value scan

Scope confirmation:
- No backend application code changed.
- No frontend code changed.
- No database schema or migration changed.
- No Docker or private env file changed.
- No destructive restore or live data mutation was performed.

## Milestone 16.9K - Clarify Review Readiness And Fix Non-Sendable Campaign State

Date: 2026-05-16
Branch: develop

Verified state:
- Audited `POST /admin/campaigns/{campaign_id}/review`, the summary/preflight path, Deliverability Guard status checks, and the admin review UI. The blocking case was real: fully configured draft campaigns stayed `status="draft"` with `content_ready=true` and `contacts_ready=true`, so Guard returned `Campaign status draft is not sendable.` and review could never become `review_ready=true`.
- Fixed the backend lifecycle loop so review stays non-dispatching but may promote a configured draft campaign to `ready` while persisting `review_ready=true` and keeping `current_step="review"` when content, recipients, and Guard checks all pass. No send, dispatch, SES enablement, or listmonk behavior changed.
- Extended the review response contract to include the current campaign status and rewired the final review panel into a checklist covering content, recipients, recipient eligibility, campaign state, and real-send availability with explicit next actions.
- Tightened known reason mapping for non-sendable status copy and updated the setup progress indicator so a review step with saved content and recipients shows as attention-needed instead of a vague not-ready state.

Checks executed:
- `git diff --check`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `pytest backend/tests/test_admin_campaigns.py -k review`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config`
- touched frontend file scan for direct listmonk calls
- touched file scan for fake delivered/open/click claims
- changed file scan for env/secrets/config changes

Scope confirmation:
- No DB schema, migration, auth, Docker/env/config, send/dispatch execution, SES live send, or direct frontend listmonk call change was made.
- No fake readiness or fake metrics were introduced. `review_ready` still means review passed; it does not mean send executed or provider events occurred.

## Milestone 16.9I - Remove Contact From Campaign UI

Date: 2026-05-15
Branch: develop

Audit summary:
- Reviewed admin campaign contact routes in `backend/app/api/admin.py`; only `GET /admin/campaigns/{campaign_id}/contacts` and `POST /admin/campaigns/{campaign_id}/contacts` existed, with no detach endpoint exposed.
- Reviewed campaign contact repository/service behavior in `backend/app/repositories/contacts.py` and `backend/app/services/campaigns.py`; attach/list/count existed, but there was no association-only remove method, and `contacts_ready` remained backend-owned through campaign contact summary recomputation.
- Reviewed frontend recipients rendering in `frontend/components/admin/AdminCampaignContactsPanel.tsx`; each row already used `contactId`, `email`, `metadata`, `status`, `isEligible`, and `blockedReasons`, but had no per-row action and already relied on `router.refresh()` after contact mutations.
- Confirmed the safest removal identifier is `contact_id`, already present in the backend response and frontend mapped contact shape; no email-based ambiguity was introduced.

Implemented:
- Added `DELETE /admin/campaigns/{campaign_id}/contacts/{contact_id}` for platform-admin users only, backed by a repository detach method that deletes from `campaign_contacts` only and never removes the saved `contacts` row or suppression data.
- Recomputed backend-owned `contacts_ready` after detach, reset review readiness, and returned a controlled JSON response without changing send, dispatch, SES, or listmonk behavior.
- Added a frontend API wrapper and a subtle per-row remove button that appears on hover/focus on desktop and remains discoverable on touch layouts.
- Replaced raw confirm behavior with an in-product confirmation modal using the requested copy, loading state, double-submit guard, controlled error handling, and `router.refresh()` on success.
- Added targeted backend tests for association-only removal and endpoint behavior, and documented the new admin contract.

Files touched:
- `backend/app/api/admin.py`
- `backend/app/repositories/contacts.py`
- `backend/app/schemas/campaigns.py`
- `backend/app/services/campaigns.py`
- `backend/tests/test_admin_campaigns.py`
- `frontend/app/globals.css`
- `frontend/components/admin/AdminCampaignContactsPanel.tsx`
- `frontend/lib/api.ts`
- `frontend/types/index.ts`
- `docs/api_contracts_v1.md`
- `docs/audit_log.md`

## Milestone 16.9H - Fix Manual Contact Attach Visibility

Date: 2026-05-15
Branch: develop

Audit summary:
- Reviewed the manual submit path in `frontend/components/admin/AdminCampaignContactsPanel.tsx`, including modal error lifecycle, `router.refresh()` usage, and the contact list render path fed by server props from `GET /admin/campaigns/{campaign_id}/contacts`.
- Reviewed backend `POST /admin/campaigns/{campaign_id}/contacts` and `GET /admin/campaigns/{campaign_id}/contacts` across `backend/app/services/campaigns.py`, `backend/app/repositories/contacts.py`, and `backend/app/schemas/campaigns.py`.
- Verified runtime backend logs for campaign `d77af2f1-8203-40de-9a53-f98e2921165b`: the manual submit reached `POST /admin/campaigns/{campaign_id}/contacts` but failed with `psycopg.ProgrammingError: cannot adapt type 'dict' using placeholder '%s'` while creating the new contact metadata payload.
- Verified runtime database state after the failed submit for `ca7rax@gmail.com`: no `contacts` row existed for that email, no new `campaign_contacts` row was created, and the campaign still only referenced the previously attached contact.
- Verified the frontend list previously rendered only `email`/status because the contacts response schema omitted metadata, so even successful manual attaches would not display `nome cognome`.

Implemented:
- Serialized contact metadata JSON for PostgreSQL create/update operations in `backend/app/repositories/contacts.py`, fixing the live manual attach failure when metadata is present.
- Extended campaign contacts GET response shaping to include normalized contact metadata, then mapped it through frontend API/types so the recipients list can display `nome cognome` with email underneath.
- Kept manual add on the recipients step after success, preserved `router.refresh()`, and cleared stale modal errors on open, close, field edit, and successful submit.
- Added targeted backend tests for PostgreSQL metadata serialization and for contact metadata visibility in the campaign contacts response.

Files touched:
- `backend/app/repositories/contacts.py`
- `backend/app/schemas/campaigns.py`
- `backend/app/services/campaigns.py`
- `backend/tests/test_admin_campaigns.py`
- `backend/tests/test_contact_repository.py`
- `frontend/components/admin/AdminCampaignContactsPanel.tsx`
- `frontend/lib/api.ts`
- `frontend/types/index.ts`
- `docs/audit_log.md`

## Milestone 16.9E - Browser API Base Resolution For Campaign Contacts

Date: 2026-05-15
Branch: develop

Audit summary:
- Reviewed `frontend/lib/api.ts` request URL construction for browser and server runtime paths, with focus on `NEXT_PUBLIC_API_BASE_URL`, `BACKEND_URL`, and the browser-only localhost rewrite branch.
- Verified the manual contact modal in `AdminCampaignContactsPanel.tsx` posts through `attachAdminCampaignContacts(...)` to `POST /admin/campaigns/{campaign_id}/contacts` and keeps the modal open when the API call rejects.
- Verified the review step in `AdminCampaignReviewPanel.tsx` uses the same API helper path through `reviewAdminCampaign(...)`.
- Reproduced the effective browser URL construction from the current helper logic: on a non-localhost public origin with `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`, the client rewrote only protocol and hostname context while preserving port `8000`, producing a browser-visible URL on the frontend host instead of the intended public API origin.

Implemented:
- Removed the browser-side localhost rewrite fallback from `frontend/lib/api.ts`.
- Added a deterministic browser configuration failure when a public frontend origin is paired with a localhost API base, while preserving existing server-side `BACKEND_URL` / `API_BASE_URL` behavior.
- Updated the campaign contacts and campaign review UI error mapping so browser configuration faults render `Configurazione API non valida per questo ambiente.` instead of the generic backend-unreachable copy.

Files touched:
- `frontend/lib/api.ts`
- `frontend/components/admin/AdminCampaignContactsPanel.tsx`
- `frontend/components/admin/AdminCampaignReviewPanel.tsx`
- `docs/audit_log.md`

## Milestone 16.9D - Campaign Workflow Final Bugfix Pass

Date: 2026-05-15
Branch: develop

Audit summary:
- Reviewed the campaign HTML editor layout in `AdminCampaignContentStep.tsx` and `frontend/app/globals.css` to trace why the editor rendered at the textarea intrinsic width instead of filling the editor shell.
- Reviewed the template apply flow in `AdminCampaignContentStep.tsx` and `AdminCampaignTemplatePicker.tsx`; the overwrite guard was still using `window.confirm(...)`, and the selected-template state was set before any explicit in-product confirmation.
- Reviewed the manual contact modal shell/input styles in `AdminCampaignContactsPanel.tsx` and `frontend/app/globals.css`; the modal still inherited shell spacing meant for icon-leading fields, which reduced usable input width in the single-column contact fields.
- Reviewed the browser API base resolution in `frontend/lib/api.ts`; when the configured browser base pointed at localhost and the app was opened from a non-local origin, the runtime only rewrote the hostname and protocol, leaving the backend port intact and causing fetch failures before any HTTP response on staging-style origins.

Implemented:
- The HTML editor now stretches to the full editor shell with explicit width and height fill rules, while the preview iframe remains a single large surface in the same container.
- Replaced the native template overwrite confirm with a Sendwise modal using local-only apply semantics and no automatic save.
- Tightened the manual contact modal field shell so email, nome, and cognome inputs use the full field width with border-box sizing and no extra left inset.
- Fixed browser API base rewriting so localhost-configured browser targets resolve to the current browser origin, including port, before admin contact saves and other campaign requests are issued.

Files touched:
- `frontend/components/admin/AdminCampaignContentStep.tsx`
- `frontend/components/admin/AdminCampaignTemplatePicker.tsx`
- `frontend/lib/api.ts`
- `frontend/app/globals.css`
- `docs/audit_log.md`

## Milestone 16.9B - Contact Modal Error Fix, Template Card Polish And Metadata Docs

Date: 2026-05-15
Branch: develop

Audit summary:
- Reviewed the manual contact modal submit path in `AdminCampaignContactsPanel`, the frontend API boundary classification in `frontend/lib/api.ts`, and the backend contact attach flow in `backend/app/services/campaigns.py`.
- Verified that only fetch failures are tagged as network errors in the API layer, while backend validation and HTTP failures keep their HTTP status and detail.
- Verified backend contact metadata normalization requires `nome`, accepts optional `cognome`, and stores both in `contacts.metadata` without changing send or merge behavior.
- Reviewed modal input shell styling and template card layout/action styling in `frontend/app/globals.css` and `AdminCampaignTemplatePicker`.
- Reviewed `db/migrations/20260515_contacts_metadata_names.sql`, `db/init.sql`, `docs/data_model_v1.md`, and `docs/api_contracts_v1.md` to align docs with the shipped `contacts.metadata` column and supported merge tags.

Implemented:
- Contact modal now reserves the `Il browser non riesce a raggiungere il backend Sendwise.` message for real network failures only and maps HTTP/API failures to concise Italian messages without exposing backend detail strings.
- Reduced manual modal input shell padding and removed the extra left inset so typed values, especially email addresses, remain fully visible while keeping the modal compact and aligned.
- Compacted template cards, softened category/selected badges, shortened copy, reduced truncation pressure, and rebalanced the action row so the preview control is icon-only while `Usa modello` takes the remaining width without the prior icon.
- Documented `contacts.metadata` in the data model as the recipient-attribute container for `nome` and optional `cognome`, including its use for `{{nome}}` and `{{cognome}}`.

Files touched:
- `frontend/components/admin/AdminCampaignContactsPanel.tsx`
- `frontend/components/admin/AdminCampaignTemplatePicker.tsx`
- `frontend/lib/campaignTemplates.ts`
- `frontend/app/globals.css`
- `docs/data_model_v1.md`
- `docs/audit_log.md`

Checks executed:
- `git diff --check`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config`
- touched-file direct listmonk scan
- touched-file fake delivered/open/click claim scan
- changed-file env/config scope scan

Checks result:
- All listed checks passed in this workspace after the patch.
- Touched frontend files contain no direct listmonk calls.
- Changed files introduce no fake delivered/open/click claims and no backend, schema, send, SES, auth, Docker, or env/config edits.

- Milestone 16.8 frontend UX pass: replaced the campaign header back pill with a subtle accessible back link, reduced the campaign header copy to a compact client/subject subtitle, and clarified review diagnostics so the final step distinguishes "Da verificare", "Campagna non pronta", and "Campagna pronta" without changing dispatch behavior, Deliverability Guard, backend APIs, or readiness honesty.

## Milestone 16.6 - Campaign Buttons And Clickable Cards Fix

Date: 2026-05-15
Branch: develop

UI audit before changes:
- `/admin/campaigns` rendered each campaign as a non-clickable `article`; only the inner `Apri` link opened the detail route.
- The `Apri` affordance was nested as a button-styled inner link instead of being part of a single card interaction target.
- `Nuova campagna` reused the campaign page action treatment with a stronger glow than the other admin CTAs.
- Campaign card header alignment depended on ad hoc inline flex styling and the badge/open affordance hierarchy was visually weak.
- Campaign wizard and detail actions already used shared button classes, but campaign-specific primary actions still carried heavier glow and some long labels wrapped awkwardly.
- No underline/link styling was intentionally applied inside the touched campaign files, but the clickable hierarchy was still unclear because cards were not first-class actions.

Implemented:
- Converted each admin campaign summary card into one keyboard-accessible `Link` that opens `/admin/campaigns/{campaignId}` from the full card surface.
- Removed the nested inner action from the card and replaced `Apri` with a non-nested secondary affordance chip aligned with the status badge.
- Kept the card summary compact to campaign name, client, readiness, recipients, and last updated. No IDs or synthetic metrics were added to the overview.
- Normalized campaign primary buttons to a flatter, standard CTA treatment with reduced glow and consistent alignment across list/detail/wizard actions.
- Shortened the detail CTA label to `Modifica` and changed the create-wizard back action to `Torna alle campagne` so labels stay compact and explicit.
- Added clearer hover and focus-visible states for clickable cards and step buttons.

Files touched:
- `frontend/app/admin/campaigns/page.tsx`
- `frontend/app/admin/campaigns/[campaignId]/page.tsx`
- `frontend/components/admin/AdminCampaignCompactCard.tsx`
- `frontend/components/admin/AdminCampaignCreateWizard.tsx`
- `frontend/components/admin/AdminCampaignDetailView.tsx`
- `frontend/app/globals.css`
- `docs/audit_log.md`

Checks executed:
- `git diff --check`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config`
- touched-file direct listmonk scan
- touched-file fake delivered/open/click claim scan
- changed-file env/config/backend scope scan

Checks result:
- All listed checks passed in this workspace after the patch.
- Touched campaign files contain no direct listmonk calls and no fake delivered/open/click claims.
- No backend, schema, auth, send/dispatch, SES, listmonk, Docker, env, or API contract files were changed in this milestone scope.

Scope confirmation:
- Frontend-only UI fix.
- No backend code, DB schema, API contract, auth flow, send behavior, direct listmonk calls, or SES behavior changed.
- No fake delivered, open, or click metrics were added.

## Milestone 12.1U + 16.5 - Unsubscribe QA And Global Button Cleanup

Date: 2026-05-15
Branch: develop

Verified state:
- Audited the existing public unsubscribe flow end to end through the backend route, unsubscribe token service, provider-event ingestion, suppression repository, campaign preparation, and Guard-backed tests.
- Kept the unsubscribe write path backend-owned and unchanged: valid public links still resolve through `GET /unsubscribe/{token}`, create or reuse a `sendwise_unsubscribe` provider event, update contact state to `unsubscribed`, and persist `suppression_list` state through the existing provider-event side effects.
- Replaced the raw-looking public unsubscribe response with a minimal branded HTML page and converted invalid-token responses from JSON detail output to a controlled HTML page with no token, internal id, or debug leakage.
- Normalized the visible admin/client CTA treatments that still used custom CSS outside the shared `Button` primitive so top-bar actions, campaign actions, account back links, account row actions, sidebar account actions, and modal CTA buttons now share the same height, radius, padding, hover weight, focus ring, and no-underline treatment.
- Kept status badges informational only. No CTA behavior, send behavior, listmonk behavior, SES behavior, schema, or auth boundary was changed.

Known limits:
- The public unsubscribe success copy remains campaign-oriented by request even though suppression is persisted at the backend-owned recipient/client suppression layer.
- The login reset action still uses underlined text styling, but login was outside the requested admin/client UI cleanup scope.
- No standalone frontend public unsubscribe page exists in this milestone; the backend route remains the public entry point.

Checks executed:
- targeted backend unsubscribe/provider-event tests
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config`
- `git diff --check`
- frontend direct-listmonk scan
- frontend direct Clerk backend API/secret scan
- touched-file fake delivered/open/click claim scan
- touched-file underline/button scan
- runtime invalid unsubscribe curl
- runtime valid unsubscribe flow with seeded local Docker backend/PostgreSQL data

Checks result:
- All listed checks passed in this workspace after the patch.
- Runtime verification confirmed controlled invalid-link handling, valid unsubscribe persistence, idempotent re-click behavior, suppression row persistence, and Guard block behavior without calling send endpoints.
- No Docker/env/config or secret file was changed during the milestone.

Scope confirmation:
- No send endpoint, dispatch logic, SES behavior, listmonk behavior, fake provider event generation, schema, Docker/env/config, or n8n integration was changed.
- No fake delivered/open/click/click-rate data was added.

## Milestone 16.4 - Client UI Color And Dashboard Polish

Date: 2026-05-15
Branch: develop

Verified state:
- Completed a frontend-only cleanup pass on the client portal and admin campaign actions after the blue theme migration.
- Replaced remaining green/olive interactive states in the touched sidebar, client heroes, client surfaces, and admin campaign action buttons with blue/azure accents.
- Reworked the client dashboard into a compact operational summary centered on workspace status, active campaigns, campaigns needing attention, blocked sends, limits, and recent backend-backed records.
- Reworked the client campaigns page into compact read-only campaign cards showing only campaign name, status, readiness, recipient counts, provider-event availability, and last update.
- Reworked the client limits page to use product labels such as `Email per campagna`, `Campagne massime`, `Campagne visibili`, and `Ultimo aggiornamento`, with read-only capacity progress and no backend field-name exposure.
- Added small visual status distributions based only on existing backend campaign counts. No trend line, fake rate, or invented provider metric was added.
- Finalized admin campaign buttons so `Nuova campagna`, `Modifica campagna`, `Torna alle campagne`, `Apri`, and wizard actions use consistent blue primary and neutral secondary button treatment without link styling.

Known limits:
- The client portal still does not expose delivered/open/click metrics unless provider-backed data exists in the current backend responses.
- No trend chart was added because the available client read models do not expose trustworthy time-series history for campaign states or provider events.
- Some older green/olive treatments remain in out-of-scope admin clients/account/login areas that were not part of this milestone.

Checks executed:
- `git diff --check`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config`
- frontend direct-listmonk scan
- frontend direct Clerk backend API / secret usage scan within app/components/lib
- touched-file fake delivered/open/click claim scan
- changed-file backend/env/config scope scan

Checks result:
- All listed checks passed in this workspace.
- Compose validation still prints existing repository environment values; no Docker, env, or secret file was modified by this milestone.
- Direct listmonk, direct Clerk backend API/secret, fake metric, backend diff, and env/config diff scans returned no matches in the changed scope.

Scope confirmation:
- No backend code, schema, frontend API contract, auth behavior, send/dispatch logic, SES enablement, listmonk behavior, Docker/env/config file, or n8n integration was changed.
- No fake delivered, open, click, click-rate, or trend data was added.

## Milestone 14.6 - Campaign Setup UX Final Pass

Date: 2026-05-14

Implemented:
- Polished `/admin/campaigns/[campaignId]` into a guided setup flow: Setup, Contenuto, Destinatari, Review.
- Added a frontend-only setup progress component driven by backend campaign fields: `current_step`, `content_ready`, `contacts_ready`, `review_ready`, and backend recipient summaries when available.
- Reworked the page hierarchy with a campaign header, status badge, back link, compact readiness/runtime/recipient summary strip, ordered wizard body, and collapsed technical details at the bottom.
- Normalized CTA copy to `Salva configurazione`, `Aggiungi destinatari`, `Esegui review`, and disabled `Import CSV non ancora disponibile`.
- Consolidated repeated runtime/provider/readiness copy into one primary summary plus panel-local hints.

Files touched:
- `frontend/app/admin/campaigns/[campaignId]/page.tsx`
- `frontend/components/admin/AdminCampaignSetupForm.tsx`
- `frontend/components/admin/AdminCampaignContactsPanel.tsx`
- `frontend/components/admin/AdminCampaignReviewPanel.tsx`
- `frontend/components/admin/AdminCampaignSetupProgress.tsx`
- `docs/audit_log.md`

Known limits:
- SES live validation remains pending.
- Import CSV, advanced selection, send, simulate-send, dispatch, AI generation, provider event creation, and SES enablement remain out of scope.

Verification:
- `git diff --check` passed.
- Native `npm run lint` and `npm run build` were attempted but PowerShell could not find `npm`; Docker builder checks were used instead.
- Docker frontend builder `npm run lint` passed with mounted frontend source directories.
- Docker frontend builder `npm run build` passed with mounted frontend source directories.
- `bash scripts/audit.sh` passed through Git Bash login shell.
- `bash scripts/smoke_test.sh` passed through Git Bash login shell.
- Direct `bash scripts/audit.sh` / `bash scripts/smoke_test.sh` through PowerShell failed because WSL has no installed Linux distribution; Git Bash reruns passed.
- `docker compose config` passed with Docker warning about unreadable `C:\Users\Jacop\.docker\config.json`.
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config` passed with the same Docker warning.
- Frontend direct-listmonk scan returned no matches.
- Touched frontend fake delivery/open/click claim scan found only existing helper field names and honest SES copy; no fake delivery claims were added.
- Env/secret config diff scan found no `.env`, `.env.example`, Docker Compose, or local config changes.

Scope confirmation:
- No backend code, dispatch logic, database schema, API contract, Docker/env config, n8n, direct frontend listmonk access, send CTA, simulate-send CTA, or fake metrics were changed.

## Milestone 14.4 - Campaign Contacts Attach UI

Contract audit:
- `GET /admin/campaigns/{campaign_id}/contacts` returns campaign-scoped contact rows and summary counts: `total`, `valid`, `invalid`, `suppressed`, `unsubscribed`, `blacklisted`, `bounced`, `eligible`, `contacts_ready`, and per-contact `is_valid`, `is_eligible`, and `blocked_reasons`.
- `POST /admin/campaigns/{campaign_id}/contacts` accepts `{ "contacts": [{ "email": string, "metadata": {} }] }` with extra fields forbidden by backend schema.
- The backend normalizes email, rejects invalid syntax, deduplicates within the payload, reuses existing contacts by `client_id + email`, creates missing client-scoped contacts, and attaches them idempotently to `campaign_contacts`.
- Contact membership reads and writes are scoped through the campaign's backend-owned `client_id`; no frontend-supplied trusted `client_id`, direct listmonk access, dispatch action, or schema change is involved.

Implemented:
- Added a backend-backed Destinatari panel on `/admin/campaigns/{campaignId}` showing existing contacts, eligible/blocked/invalid/suppressed/unsubscribed/bounced/blacklisted counts, backend `contacts_ready`, and empty/no-eligible/all-blocked states.
- Added a minimal email textarea attach form that posts only the supported contact payload through `frontend/lib/api.ts`, prevents double submit, surfaces backend-safe errors, and refreshes the route after success.
- Updated the setup checklist so the Destinatari step links to the contacts panel and reports no-contact/no-eligible reasons from backend summary state.
- Left CSV import, advanced selection, review, send, simulate-send, SES enablement, and client-side contact management unavailable.

Known limits:
- CSV import is still not supported by the backend contract and remains disabled in the UI.
- The panel does not claim send readiness; final sendability remains backend/Guard-owned and `EMAIL_SENDING_ENABLED` remains fail-closed by default.

Verification:
- `git diff --check` passed.
- Frontend lint passed through the existing local Docker builder image with changed frontend source directories mounted.
- Frontend production build passed through the existing local Docker builder image with changed frontend source directories mounted.
- `bash scripts/audit.sh` passed through Git Bash login shell.
- `bash scripts/smoke_test.sh` passed through Git Bash login shell.
- `docker compose config` passed with a Docker warning about unreadable `C:\Users\Jacop\.docker\config.json`.
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config` passed with the same Docker warning.
- Frontend direct-listmonk scan returned no matches.
- Touched frontend fake delivery/open/click claim scan found only existing type/helper field names; no fake delivery claims were added.
- Secret/env scan of non-ignored repo files returned no matches.

## Milestone 14.3 - Admin Campaign Setup Flow

Contract audit:
- Existing admin detail route was absent in the frontend; `/admin/campaigns/[campaignId]` was created.
- Existing admin campaign list already consumed `GET /admin/campaigns` and `GET /admin/campaigns/{campaign_id}/summary`.
- Existing frontend API boundary now exposes `GET /admin/campaigns/{campaign_id}`, `PATCH /admin/campaigns/{campaign_id}`, and `POST /admin/campaigns/{campaign_id}/content`.
- Backend already implements admin detail, summary, setup patch, content update, contacts read/import, and review endpoints. No backend endpoint, service, repository, or schema change was needed.

Implemented:
- Added a product-ready admin campaign detail/setup page showing campaign identity, client, subject, status, current step, readiness checklist, provider runtime/safety state, recipient summary, backend-backed log counts, blocked/attention states, and collapsed technical details.
- Added a minimal setup edit form for campaign name, subject, preview text, HTML body, and plain-text body using only existing backend contracts.
- After create success, the admin now lands on `/admin/campaigns/{campaign_id}` when the backend returns `campaign_id`.
- Campaign names in the admin campaign overview now link to the detail/setup route.

Known limits:
- Contacts import and review workflows are not implemented in this minimal setup screen; they are shown as pending UI actions rather than invented as a new wizard.
- No send, simulate-send, SES live validation, Deliverability Guard, Docker/env, n8n, listmonk, or DB schema changes were made.
- No fake delivered/open/click metrics were added; queued and sent-attempted remain distinct from delivery.

Verification:
- `git diff --check` passed.
- Frontend lint passed through the existing local Docker builder image with current changed frontend folders mounted.
- Frontend production build passed through the existing local Docker builder image with current changed frontend folders mounted.
- `docker compose config` passed with a Docker warning about unreadable `C:\Users\Jacop\.docker\config.json`.
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config` passed with the same Docker warning.
- Frontend direct-listmonk scan returned no matches.
- Touched frontend fake delivery/open/click claim scan found only existing type/helper field names and honest SES copy; no fake delivery claims were added.
- Secret/env scan of non-ignored repo files returned no matches.

Checks not run:
- Native PowerShell `npm run lint` and `npm run build` could not run because `npm` is not installed or not on PATH in the current PowerShell environment; Docker builder checks were used instead.
- `bash scripts/audit.sh` and `bash scripts/smoke_test.sh` could not run because WSL has no installed Linux distribution.
- Backend tests and migrations were not run because no backend code or schema was changed.

## Milestone 14.2 - Admin Create Campaign Flow

Date: 2026-05-14

Implemented:
- Audited the backend campaign creation contract before frontend changes: `POST /admin/campaigns` accepts `client_id`, `name`, and `subject`; `POST /admin/clients/{client_id}/campaigns` accepts `name` and `subject`; both require platform admin auth and return `AdminCampaignDetail`.
- Kept the admin `Nuova campagna` CTA enabled and routed to `/admin/campaigns/new`.
- Replaced the staged wizard UI with a minimal create form using only backend-required fields: client, campaign name, and subject.
- Added the `/admin/campaigns` API wrapper in `frontend/lib/api.ts` and kept all creation traffic behind the frontend API boundary.
- Kept the client campaign UI read-only; no client create campaign CTA was added.
- The success path redirects back to the campaign list and refreshes server data; submit is disabled while pending and backend errors are surfaced clearly.

Files touched:
- `frontend/components/admin/AdminCampaignCreateWizard.tsx`
- `frontend/lib/api.ts`
- `docs/audit_log.md`

Known limits:
- SES live validation remains pending.
- Creation only creates a draft/not-ready campaign; no send action, dispatch flow, provider claim, direct listmonk call, fake metric, backend schema change, or backend endpoint change was added.

## Milestone 15 - Admin Campaign Creation Wizard And Campaign Index Simplification

Date: 2026-05-14

Implemented:
- Added active `/admin/campaigns/new` admin campaign creation route.
- Added a compact three-step campaign wizard: client selection, campaign details, and summary.
- Wired campaign creation through the backend-backed `POST /admin/clients/{client_id}/campaigns` shortcut via `frontend/lib/api.ts`.
- Simplified `/admin/campaigns` into a scannable campaign index with campaign name, client, subject, status, readiness, recipients, backend metrics, updated date, and compact warning chips.
- Mapped known backend readiness/blocking reasons to product-friendly Italian labels and moved raw technical reason text into collapsed admin technical details.
- Removed the disabled "Nuova campagna" state and the unavailable-creation copy.
- Consolidated provider/event state so each campaign row renders one provider event label.

Files touched:
- `frontend/app/admin/campaigns/page.tsx`
- `frontend/app/admin/campaigns/new/page.tsx`
- `frontend/components/admin/AdminCampaignCreateWizard.tsx`
- `frontend/components/shared/campaignUi.ts`
- `frontend/lib/api.ts`
- `frontend/types/index.ts`
- `docs/audit_log.md`

Verified:
- `git diff --check` passed.
- `docker run --rm sendwise-frontend-builder npm run lint` passed.
- `docker compose build frontend` passed and completed Next.js production build/type check.
- Scanned touched frontend files for direct listmonk calls and fake delivered/open/click-rate claims; no new direct listmonk calls or fake delivery claims found.
- `bash scripts/audit.sh` passed via Git Bash login shell.
- `bash scripts/smoke_test.sh` passed via Git Bash login shell.
- `docker compose config` passed.

Known limits:
- SES live validation remains pending.
- Sending remains disabled and no send/dispatch behavior was changed.
- No database schema changes were made.
- No backend code changes were made.
- Admin create wizard uses only backend-supported fields: client, name, and subject.

## Milestone 14.1 - Campaign UI Repair And Create Campaign CTA

Date: 2026-05-14
Branch: develop

Implemented state:
- Repaired the admin and client campaign overview after screenshot review so campaigns render as product cards with clearer hierarchy for status, readiness, recipients, runtime safety, provider events, honest log counts, warnings, and compact blocked-recipient reasons.
- Added the admin `Nuova campagna` CTA in the campaign page header. The CTA is disabled with the visible copy `Creazione campagna non ancora disponibile` because no existing frontend creation route/page is present in the current admin app.
- Hid raw campaign/client IDs from the main admin overview and moved them into a native collapsed technical details section. The client campaign UI does not show raw IDs.
- Removed duplicate/redundant provider/readiness presentation from the campaign overview and kept queued/sent-attempted/bounced/unsubscribed/blocked counts backend-backed only.

Files touched:
- `frontend/app/admin/campaigns/page.tsx`
- `frontend/app/c/[portalSlug]/campaigns/page.tsx`
- `frontend/components/shared/campaignUi.ts`
- `docs/audit_log.md`

Known limits:
- SES live validation 12.1 remains pending; the UI does not claim SES delivery validation.
- Campaign creation backend endpoints exist in the contract/backend, but no admin frontend creation route/page was present in this repair scope.

Scope confirmation:
- No backend dispatch logic, backend services, database schema, direct frontend listmonk access, send action, fake metric, local env file, or secret was changed.

Checks run:
- `git diff --check` passed.
- Touched frontend file scan found no direct listmonk calls.
- Touched frontend file scan found no fake delivered/open-rate/click-rate claims; `opened`/`clicked` remain only as zero-value provider-event presence checks in the shared helper.
- Docker frontend builder `npm run lint` passed with the current touched frontend files and current API/type/mock boundary mounted into the builder image.
- Docker frontend builder `npm run build` passed with the current touched frontend files and current API/type/mock boundary mounted into the builder image.
- `bash scripts/audit.sh` passed through Git Bash login shell.
- `bash scripts/smoke_test.sh` passed through Git Bash login shell.
- `docker compose config` passed; Docker printed local config access warnings for `C:\Users\Jacop\.docker\config.json`.

## Initial Entry

Date: 2026-05-05
Milestone: Milestone 0
Scope: Structural contracts, repo skeleton, backend/frontend stubs, Docker base, environment example, audit and smoke scripts.
Files created: Milestone 0 skeleton under `docs/`, `backend/`, `frontend/`, `templates/`, `db/`, `listmonk/`, `mailpit/`, `scripts/`, plus root config files.
Files modified: None; workspace was empty when skeleton was created.
Tests executed:
- `bash scripts/audit.sh`
- `docker compose config`
- `bash scripts/smoke_test.sh`
Tests not executed and reason:
- `PYTHONPATH=backend python3 -m pytest backend/tests` was attempted but local Python does not have `pytest` installed.
Risks remaining:
- Real auth is not implemented.
- Real sending is not implemented.
- listmonk runtime configuration is a skeleton and must be hardened before production.
- Database schema is intentionally minimal and not production-complete.
Confirmation:
  - no real sending implemented
  - no real AI implemented
  - no full dashboard implemented
  - no Keycloak implemented
  - no Celery implemented
  - no n8n workflows implemented
  - no Postal/Rspamd implemented

## Codex Skills Documentation

Date: 2026-05-05
Milestone: Codex Skills Documentation
Scope: docs-only operational skills
Files created/modified:
- Created `docs/codex_prompt_engine_v1.md`
- Created `docs/codex_skills/README.md`
- Created `docs/codex_skills/audit-runtime-flow.md`
- Created `docs/codex_skills/check-anti-monolith.md`
- Created `docs/codex_skills/extract-root-cause.md`
- Created `docs/codex_skills/generate-minimal-fix.md`
- Created `docs/codex_skills/run-regression-guard.md`
- Created `docs/codex_skills/update-docs-after-fix.md`
- Created `docs/codex_skills/audit-installer-vps.md`
- Created `docs/codex_skills/validate-state-and-persistence.md`
- Modified `scripts/audit.sh` to require the new Codex skill docs.
- Modified `docs/audit_log.md` with this entry.
Tests executed:
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
Tests not executed and reason:
- Backend pytest and frontend lint/build were not run because this was a docs-only change with no backend or frontend behavior touched.
Risks remaining:
- These skills are operational guidance only; future prompts must explicitly apply the relevant skill.
Confirmation: no application code changed

## Milestone 0.5 - Parallel Work Boundary

Date: 2026-05-05
Milestone: Milestone 0.5 - Parallel Work Boundary
Scope: Boundary-only backend/frontend parallel-work preparation through schemas, typed endpoint stubs, frontend shared types, mock API, API transport abstraction, ownership rules, and audit checks.
Files created:
- `backend/app/schemas/common.py`
- `backend/app/schemas/clients.py`
- `backend/app/schemas/campaigns.py`
- `backend/app/schemas/contacts.py`
- `backend/app/schemas/usage.py`
- `backend/app/schemas/blocked_sends.py`
- `backend/tests/test_milestone_05_stubs.py`
Files modified:
- `backend/app/api/admin.py`
- `backend/app/api/client.py`
- `frontend/types/index.ts`
- `frontend/lib/mock-api.ts`
- `frontend/lib/api.ts`
- `frontend/app/admin/page.tsx`
- `frontend/app/client/page.tsx`
- `docs/ownership_v1.md`
- `docs/api_contracts_v1.md`
- `docs/audit_checklist_v1.md`
- `scripts/audit.sh`
- `docs/audit_log.md`
Tests executed:
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
Tests not executed and reason:
- `PYTHONPATH=backend pytest backend/tests` could not run because `pytest` is not installed in the local shell.
- `PYTHONPATH=backend python3 -m pytest backend/tests` could not run because the local Python environment does not have `pytest`.
- A direct backend import check could not run because the local Python environment does not have `fastapi`.
- `cd frontend && npm run build` was not run because `frontend/node_modules` is absent; no dependency installation was performed for this milestone.
Residual risks:
- Real auth is not implemented.
- Real database reads/writes are not implemented.
- Endpoint payloads are static stubs and must be replaced by backend-owned business logic in later approved milestones.
- Frontend backend mode has only minimal transport behavior and no production auth handling.
Confirmation:
- no real email sending implemented
- no real AI generation implemented
- no real auth implemented
- no real DB logic implemented
- no real listmonk logic implemented
- no n8n workflows implemented
- no Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase implemented

## Frontend API Boundary Review

Date: 2026-05-05
Branch: feature/frontend-v1
Scope: Minimal frontend API/mock boundary hardening for future admin and client overview summary consumption.
Files created: None.
Files modified:
- `frontend/lib/api.ts`
- `frontend/lib/mock-api.ts`
- `frontend/types/index.ts`
- `docs/audit_log.md`
Tests executed:
- `cd frontend && npm run lint` reached the known interactive Next.js ESLint setup prompt; ESLint was not configured.
- `cd frontend && npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --name-only` confirmed only allowed files changed.
- `rg "\bfetch\s*\(" frontend/app frontend/components frontend/lib` confirmed the only fetch remains in `frontend/lib/api.ts`.
- `rg -i "listmonk|postgres|postgresql|smtp|database_url|db_url" frontend/app frontend/components frontend/lib frontend/types` returned no frontend matches.
Tests not executed and reason:
- No backend pytest was run because this task did not touch backend behavior, database access, Guard logic, or API contracts.
Residual risks:
- Overview summaries are mock-only until matching backend API contracts are approved.
- Real auth, tenant enforcement, deliverability decisions, sending, AI generation, and limit enforcement remain backend-owned future work.
Confirmation:
- no frontend app or component files modified
- no backend, DB, Docker, script, Makefile, listmonk, mailpit, package/config, or contract docs modified
- no direct listmonk, PostgreSQL, SMTP, or database URL references added
- no fetch calls added outside `frontend/lib/api.ts`

## Frontend Overview Page Boundary Consumption

Date: 2026-05-05
Branch: feature/frontend-v1
Scope: Minimal page wiring for `/admin` and `/client` to consume typed overview summary accessors through `frontend/lib/api.ts`.
Files created: None.
Files modified:
- `frontend/app/admin/page.tsx`
- `frontend/app/client/page.tsx`
- `docs/audit_log.md`
Tests executed:
- `cd frontend && npm run lint` reached the known interactive Next.js ESLint setup prompt; ESLint was not configured.
- `cd frontend && npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --name-only` confirmed only allowed tracked files changed.
- `rg "\bfetch\s*\(" frontend/app frontend/components frontend/lib` confirmed the only fetch remains in `frontend/lib/api.ts`.
- `rg "mock-api" frontend/app frontend/components` returned no matches.
- `rg -i "listmonk|postgres|postgresql|smtp|database_url|db_url" frontend/app frontend/components frontend/lib frontend/types` returned no frontend matches.
Tests not executed and reason:
- No backend pytest was run because this task did not touch backend behavior, database access, Guard logic, or API contracts.
Residual risks:
- Overview summaries remain mock-backed until matching backend contracts are approved.
- Real auth, tenant enforcement, deliverability decisions, sending, AI generation, and limit enforcement remain backend-owned future work.
- `npm run build` generated untracked `frontend/next-env.d.ts`; it was not included in this task.
Confirmation:
- pages import overview data only from `frontend/lib/api.ts`
- no `frontend/lib`, `frontend/types`, or `frontend/components` files modified
- no backend, DB, Docker, script, Makefile, listmonk, mailpit, package/config, or contract docs modified
- no direct listmonk, PostgreSQL, SMTP, or database URL references added
- no fetch calls added outside `frontend/lib/api.ts`

## Frontend Mock Mode Indicator

Date: 2026-05-05
Branch: feature/frontend-v1
Scope: Minimal presentational shell update to identify mock frontend-only auth and mock-backed data mode.
Files created: None.
Files modified:
- `frontend/components/layout/AppShell.tsx`
- `docs/audit_log.md`
Tests executed:
- `cd frontend && npm run lint` reached the known interactive Next.js ESLint setup prompt; ESLint was not configured.
- `cd frontend && npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --name-only` showed this task's files plus pre-existing dirty frontend mock-login files.
- `rg "\bfetch\s*\(" frontend/app frontend/components frontend/lib` confirmed the only fetch remains in `frontend/lib/api.ts`.
- `rg "mock-api" frontend/app frontend/components` returned no matches.
- `rg -i "listmonk|postgres|postgresql|smtp|database_url|db_url" frontend/app frontend/components frontend/lib frontend/types` returned no frontend matches.
- `rg -i "localStorage|sessionStorage|document.cookie|jwt|token" frontend/app frontend/components` returned no matches.
Tests not executed and reason:
- No backend pytest was run because this task did not touch backend behavior, database access, Guard logic, or API contracts.
Residual risks:
- Real auth, tenant enforcement, backend data, deliverability decisions, sending, AI generation, and limit enforcement remain future backend-owned work.
Confirmation:
- indicator is presentational only
- no auth, route protection, credentials, tokens, cookies, localStorage, or sessionStorage introduced
- no frontend app, frontend lib, frontend types, frontend auth, or frontend UI primitive files modified by this task
- no backend, DB, Docker, scripts, Makefile, listmonk, mailpit, package/config, or contract docs modified
- no direct listmonk, PostgreSQL, SMTP, or database URL references added
- no fetch calls added outside `frontend/lib/api.ts`

## Frontend Next 16 Dependency Upgrade

Date: 2026-05-06
Branch: feature/frontend-v1
Scope: Controlled frontend dependency stack upgrade from Next.js 15 to Next.js 16.
Files created: None.
Files modified:
- `frontend/package.json`
- `frontend/tsconfig.json`
- `docs/audit_log.md`
Dependency changes:
- `next` upgraded from `15.1.3` to `^16.2.4`.
- `react` upgraded from `19.0.0` to `^19.2.5`.
- `react-dom` upgraded from `19.0.0` to `^19.2.5`.
- `typescript` remained `5.7.2`.
Tests executed:
- `cd frontend && node -v`
- `cd frontend && npm -v`

## Milestone 0.8B - Design Tokens + App Shell

Date: 2026-05-06
Branch: develop
Scope: Shared frontend visual foundation only - design tokens, brand mark, app shell, contextual sidebar, reusable top bar, mobile drawer, mock mode badge, and shell styling aligned to the Sendwise design reference zip.
Files created:
- `docs/branch_handoffs/frontend-design-shell-0.8B-handoff.md`
- `frontend/components/layout/TopBar.tsx`
- `frontend/components/shared/BrandMark.tsx`
- `frontend/components/shared/MockModeBadge.tsx`
Files modified:
- `frontend/app/globals.css`
- `frontend/app/layout.tsx`
- `frontend/components/layout/AppShell.tsx`
- `frontend/components/layout/MainNav.tsx`
- `frontend/components/layout/MobileNav.tsx`
- `frontend/components/layout/Sidebar.tsx`
- `docs/audit_log.md`
Design tokens adapted:

## Milestone 0.9E.3 - Docker Clerk Runtime Alignment

Date: 2026-05-08
Branch: develop
Scope: Docker/env alignment for the Clerk-auth frontend and backend runtime so Compose serves the current custom Clerk login instead of stale mock frontend artifacts.
Files created:
- `frontend/.dockerignore`
- `docs/branch_handoffs/docker-clerk-runtime-alignment-0.9E.3-handoff.md`
Files modified:
- `docker-compose.yml`
- `frontend/Dockerfile`
- `frontend/lib/api.ts`
- `.env.example`
- `docs/audit_log.md`
Root cause:
- The frontend container was built and started as a host-style dev runtime: `frontend/Dockerfile` ran `next dev` and copied the entire frontend context, which allowed host `.next` artifacts and `frontend/.env.local` to bleed into Docker.
- Compose also defaulted `NEXT_PUBLIC_USE_MOCK_API=true` and did not pass the Clerk/backend env contract into the containers or frontend build.
- The first verified divergence was therefore Docker/runtime configuration, not current frontend source. Current source no longer routes `/login` through `MockLoginForm`, but the copied host `.next` tree still contained the old mock login bundle.
Tests executed:
- `docker compose config`
- `git diff --check`
- `PYTHONPATH=backend python3 -m pytest backend/tests`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 BACKEND_URL=http://backend:8000 npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `grep -R "from .*mock-api" frontend/app frontend/components || true`
- `grep -R "fetch(" frontend/app frontend/components frontend/lib || true`
- `grep -R "listmonk\|postgres\|database\|smtp" frontend/app frontend/components frontend/lib || true`
- `grep -R "localStorage\|sessionStorage\|document.cookie" frontend/app frontend/components frontend/lib || true`
- `grep -R "SignUpButton\|sign-up\|signup" frontend/app frontend/components frontend/lib || true`
- `grep -R "Ruolo di sviluppo\|Accesso di sviluppo\|Modalità mock: autenticazione frontend" frontend/app frontend/components || true`
- `docker compose down`
- `docker compose build --no-cache frontend backend`
- `docker compose up -d`
- `docker compose ps`
- `docker compose exec backend printenv | grep -E "^(CLERK|AUTH_USER)"`
- `docker compose exec frontend printenv | grep -E "^(NEXT_PUBLIC_|CLERK_SECRET_KEY|BACKEND_URL)"`
- `docker compose exec frontend sh -lc 'wget -qO- http://backend:8000/health && printf "\\n---\\n" && wget -S -qO- --server-response http://backend:8000/auth/me 2>&1 | sed -n "1,12p"'`
- `curl -i http://127.0.0.1:8000/health`
- `curl -i http://127.0.0.1:8000/auth/me`
- `curl -i -H 'Authorization: Bearer invalid-token' http://127.0.0.1:8000/auth/me`
- `curl -i http://127.0.0.1:3000/login`
- `curl -I http://127.0.0.1:3000/admin`
- `curl -I http://127.0.0.1:3000/client`
- `curl -I http://127.0.0.1:3000/auth/redirect`
Verification summary:
- Frontend Docker context dropped from about `1.35GB` to about `15.82kB` on the no-cache rebuild after adding `frontend/.dockerignore` and explicit production build stages.
- Frontend logs now show `Next.js 16.2.4` with `next start`/standalone behavior and no `.env.local` loading inside the container.
- Host `/login` now renders the current custom Clerk login with `Sendwise`, `Accesso riservato`, and `Accedi`, while the old mock strings are absent from rendered HTML.
- Backend `/health` returns `200`.
- Backend `/auth/me` without auth returns `401`.
- Backend `/auth/me` with an invalid bearer token now returns `401` instead of backend-misconfigured `500`.
- Signed-out `/admin`, `/client`, and `/auth/redirect` redirect to `/login`.
Tests not executed and reason:
- Live signed-in `/auth/redirect` routing to `/admin` or `/client` was not executed because real mapped Clerk users and verified `AUTH_USER_MAPPINGS_JSON` identities were not available in tracked repo config.
- Positive-path Clerk login against backend-owned mapped users remains dependent on local secret `.env` content that stays ignored.
Residual risks:
- `MockLoginForm` and its strings still exist as dormant mock-support code in `frontend/components/auth/MockLoginForm.tsx`; it is no longer rendered by Docker, but the fallback code remains in the repo by design.
- Real admin/client post-login routing still depends on supplying valid local `AUTH_USER_MAPPINGS_JSON` values for actual Clerk user ids.
Confirmation:
- no DB migration implemented
- no `client_access` persistence implemented
- no Clerk invitation API implemented
- no admin invite flow implemented
- no onboarding endpoint implemented
- no public signup implemented
- no custom password form implemented
- no custom 2FA implemented
- no real listmonk sending implemented
- no real email sending implemented
- no AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase implemented
- Neutral `#CACFD6`
- Pale mint `#D6E5E3`
- Aqua accent `#9FD8CB`
- Primary green `#517664`
- Deep olive `#2D3319`
- Background `#FAFAF7`
- Surface `#FFFFFF`
- Surface mint `#EEF4F2`
- Border `#E3E5E0`
Implementation notes:
- Refactored the existing shell instead of creating a second app shell or duplicate navigation layer.
- Preserved `/login` without shell wrapping by making `AppShell` route-aware.
- Kept `frontend/lib/api.ts` as the only fetch boundary and did not add direct mock imports.
- Used the existing shadcn `Sheet` for mobile navigation and kept all placeholder actions disabled/presentational.
Tests executed:
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`

## Milestone 0.9C.2 - Custom Clerk Login UI

Date: 2026-05-07
Branch: develop
Milestone: Milestone 0.9C.2 - Custom Clerk Login UI
Scope: Replace the prebuilt Clerk login surface on `/login` with a Sendwise-owned custom email/password form while preserving Clerk as the auth engine, the existing `/login/[[...login]]` route, and protected account/admin/client routes.
Files created:
- `docs/branch_handoffs/clerk-custom-login-0.9C.2-handoff.md`
Files modified:
- `frontend/app/login/LoginContent.tsx`
- `frontend/app/globals.css`
- `docs/audit_log.md`
Root cause:
- `frontend/app/login/LoginContent.tsx` rendered Clerk's prebuilt `<SignIn />` component directly.
- That delegated visible auth UI to Clerk, which is incompatible with the Sendwise product requirement to keep signup, social login, Clerk branding, and default Clerk card chrome off the `/login` surface.
Implementation result:
- Replaced the prebuilt Clerk login component with a custom Sendwise form driven by Clerk `useSignIn()`.
- Kept Italian-only copy, removed Sendwise-owned signup exposure, and redirected successful sign-in to `/admin`.
- Preserved `/login/[[...login]]`, `/account` via Clerk `UserProfile`, and existing protected-route structure.
Tests executed:
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build`
- `PYTHONPATH=backend python3 -m pytest backend/tests`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`
- `grep -R -n "from .*mock-api" frontend/app frontend/components || true`
- `grep -R -n "fetch(" frontend/app frontend/components frontend/lib || true`
- `grep -R -n "listmonk\|postgres\|database\|smtp" frontend/app frontend/components frontend/lib || true`
- `grep -R -n "localStorage\|sessionStorage\|document.cookie" frontend/app frontend/components frontend/lib || true`
- `grep -R -n "SignUpButton" frontend/app frontend/components frontend/lib || true`
- `grep -R -n "sign-up" frontend/app frontend/components frontend/lib || true`
- `grep -R -n "signup" frontend/app frontend/components frontend/lib || true`
- `grep -R -n "Continue with Google\|Google" frontend/app frontend/components frontend/lib || true`
Tests not executed and reason:
- Live browser verification of `/login`, authenticated sign-in with a real Clerk user, signed-out redirect checks, and `/account` interaction were not completed in this turn.
- The local browser verification path was blocked by in-app browser security/runtime limits, and no authorized test credentials were provided for a real Clerk session.
Residual risks:
- Live Clerk password-auth behavior still depends on Clerk Dashboard configuration for password sign-in, public signup disablement, and social-login disablement.
- The custom form currently surfaces a controlled message if the Clerk project does not support password auth or requires extra factors not yet exposed in Sendwise UI.
- Existing unrelated workspace change `frontend/.gitignore` remains outside this milestone.
Confirmation:
- no backend auth logic changed
- no DB migration or `client_users` persistence implemented
- no admin-created user flow implemented
- no public signup, social login UI, custom password storage, or custom password reset/change form implemented
- no real listmonk, real sending, AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase implemented
- `docker compose config`
- `git diff --check`
- `grep -R "from .*mock-api" frontend/app frontend/components || true`
- `grep -R "fetch(" frontend/app frontend/components frontend/lib || true`
- `grep -R "listmonk\|postgres\|database\|smtp" frontend/app frontend/components frontend/lib || true`
- `grep -R "localStorage\|sessionStorage\|document.cookie" frontend/app frontend/components frontend/lib || true`
Tests not executed and reason:
- No browser-level visual verification was run in this milestone; validation stayed at build, audit, smoke, and static boundary checks.
Risks remaining:
- Admin/client dashboard internals are still the earlier milestone UI and will need a separate content restyling pass.
- Small visual tuning issues may remain until the next milestone performs browser-level validation.
Confirmation:
- no backend changes
- no DB changes
- no Docker config changes
- no real auth implemented
- no real listmonk integration implemented
- no real email sending implemented
- no AI generation implemented
- no n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase implemented
- `cd frontend && npm ls next react react-dom typescript`
- `cd frontend && npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `rg "\bfetch\s*\(" frontend/app frontend/components frontend/lib`
- `rg "mock-api" frontend/app frontend/components`
- `rg -i "listmonk|postgres|postgresql|smtp|database_url|db_url" frontend/app frontend/components frontend/lib frontend/types`
- `rg -i "localStorage|sessionStorage|document.cookie|jwt|token" frontend/app frontend/components`
- `cd frontend && rm -rf .next && npm run dev`
- Runtime HTTP checks for `/`, `/login`, `/admin`, and `/client`.
Tests not executed and reason:
- `cd frontend && npm run lint` was not run because this repo has the known Next.js ESLint setup prompt and this task must not configure ESLint.
Runtime route check:
- `/` returned `307` redirect to `/login`.
- `/login` returned `200` and rendered mock login with the mock mode indicator.
- `/admin` returned `200` and rendered the mock-backed admin overview.
- `/client` returned `200` and rendered the mock-backed client overview.
Residual risks:
- Next.js 16 requires Node.js `20.9.0+`; local preflight used Node `v25.6.1`.
- `package-lock.json` is absent in this repo, so no lockfile was created under the max-new-files constraint.
- `npm install` reported two moderate vulnerabilities; no broad audit fix was run because it would be outside the controlled upgrade scope.
- Next.js 16 regenerates `frontend/next-env.d.ts` during build/dev; generated changes were not included in this task.
Confirmation:
- no frontend app, component, lib, or types files modified
- no backend, DB, Docker, scripts, Makefile, listmonk, mailpit, or contract docs modified
- no auth, route protection, tokens, cookies, localStorage, or sessionStorage introduced
- no direct listmonk, PostgreSQL, SMTP, or database URL references added
- no fetch calls added outside `frontend/lib/api.ts`

## Admin Overview V1 Foundation

Date: 2026-05-06
Branch: feature/frontend-v1
Scope: Small mock-backed admin overview foundation with minimal Sendwise/shadcn token hygiene, typed admin overview summary extension, and `/admin` presentation update.
Files created: None.
Files modified:
- `frontend/app/globals.css`
- `frontend/types/index.ts`
- `frontend/lib/mock-api.ts`
- `frontend/app/admin/page.tsx`
- `docs/audit_log.md`
Tests executed:
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --name-only` confirmed only allowed tracked files changed.
- `rg "\bfetch\s*\(" frontend/app frontend/components frontend/lib` confirmed the only fetch remains in `frontend/lib/api.ts`.
- `rg "mock-api" frontend/app frontend/components` returned no matches.
- `rg -i "listmonk|postgres|postgresql|smtp|database_url|db_url" frontend/app frontend/components frontend/lib frontend/types` returned no matches.
- `rg -i "localStorage|sessionStorage|document.cookie|jwt|token" frontend/app frontend/components` returned no matches.
- `cd frontend && rm -rf .next && npm run dev` ran on port 3001 because port 3000 was already in use.
- Runtime HTTP checks for `/`, `/login`, `/admin`, and `/client`.
Runtime route check:
- `/` returned `307` redirect to `/login`.
- `/login` returned `200` and rendered mock login with the mock mode indicator.
- `/admin` returned `200` and rendered expanded mock-backed Admin Overview V1 fields.
- `/client` returned `200` and rendered the existing mock-backed client overview.
Tests not executed and reason:
- No backend pytest was run because this task did not touch backend behavior, database access, Guard logic, or API contracts.
Residual risks:
- Admin Overview V1 remains mock-backed until approved backend contracts exist.
- Real auth, tenant enforcement, deliverability decisions, sending, AI generation, and limit enforcement remain backend-owned future work.
Confirmation:
- `/admin` imports data only from `frontend/lib/api.ts`.
- `/`, `/login`, `/client`, `frontend/components`, and package/config files were not modified.
- no backend, DB, Docker, scripts, Makefile, listmonk, mailpit, or contract docs modified.
- no auth, route protection, tokens, cookies, localStorage, or sessionStorage introduced.
- no direct listmonk, PostgreSQL, SMTP, or database URL references added.
- no fetch calls added outside `frontend/lib/api.ts`.

## Frontend Non-Interactive Lint Setup

Date: 2026-05-06
Branch: feature/frontend-v1
Scope: Minimal frontend ESLint CLI setup for Next.js 16 so `npm run lint` runs without interactive setup or removed `next lint` behavior.
Files created:
- `frontend/eslint.config.mjs`
- `frontend/package-lock.json`
Files modified:
- `frontend/package.json`
- `docs/audit_log.md`
Dependency changes:
- Added `eslint` as a frontend dev dependency.
- Added `eslint-config-next` as a frontend dev dependency.
- No Next.js, React, or React DOM version changes.
Tests executed:
- `cd frontend && npm run lint` preflight failed non-interactively because `next lint` is removed in Next.js 16.
- `cd frontend && npm run lint` passed after setup.
- `cd frontend && npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --name-only` reported tracked changes.
- `rg "\bfetch\s*\(" frontend/app frontend/components frontend/lib` confirmed the only fetch remains in `frontend/lib/api.ts`.
- `rg "mock-api" frontend/app frontend/components` returned no matches.
- `rg -i "listmonk|postgres|postgresql|smtp|database_url|db_url" frontend/app frontend/components frontend/lib frontend/types` returned no matches.
- `rg -i "localStorage|sessionStorage|document.cookie|jwt|token" frontend/app frontend/components` returned no matches.
- `cd frontend && rm -rf .next && npm run dev` ran on port 3001 because port 3000 was already in use.
- Runtime HTTP checks for `/`, `/login`, `/admin`, and `/client`.
Tests not executed and reason:
- No backend pytest was run because this task did not touch backend behavior, database access, Guard logic, or API contracts.
Runtime route check:
- `/` returned `307` redirect to `/login`.
- `/login` returned `200` and rendered mock login with the mock mode indicator.
- `/admin` returned `200` and rendered the mock-backed admin overview.
- `/client` returned `200` and rendered the mock-backed client overview.
Residual risks:
- `npm install` reported two moderate vulnerabilities; no `npm audit fix` was run because that may make broader dependency changes outside this task.
- `frontend/next-env.d.ts` is tracked and was regenerated during build/dev; generated diff was restored and not included.
Confirmation:
- no frontend app, component, lib, or types files modified
- no backend, DB, Docker, scripts, Makefile, listmonk, mailpit, or contract docs modified
- no auth, route protection, tokens, cookies, localStorage, or sessionStorage introduced
- no direct listmonk, PostgreSQL, SMTP, or database URL references added
- no fetch calls added outside `frontend/lib/api.ts`

## Client Overview V1 Foundation

Date: 2026-05-06
Branch: feature/frontend-v1
Scope: Small mock-backed Client Overview V1 foundation through the typed frontend mock/API boundary and `/client` presentation.
Files created: None.
Files modified:
- `frontend/types/index.ts`
- `frontend/lib/mock-api.ts`
- `frontend/app/client/page.tsx`
- `docs/audit_log.md`
Tests executed:
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --name-only` confirmed only allowed tracked files changed.
- `rg "\bfetch\s*\(" frontend/app frontend/components frontend/lib` confirmed the only fetch remains in `frontend/lib/api.ts`.
- `rg "mock-api" frontend/app frontend/components` returned no matches.
- `rg -i "listmonk|postgres|postgresql|smtp|database_url|db_url" frontend/app frontend/components frontend/lib frontend/types` returned no matches.
- `rg -i "localStorage|sessionStorage|document.cookie|jwt|token" frontend/app frontend/components` returned only the required client usage metric fields for token usage, not auth/session storage.
- `cd frontend && rm -rf .next && npm run dev` ran on port 3001 because port 3000 was already in use.
- Runtime HTTP checks for `/`, `/login`, `/admin`, and `/client`.
Runtime route check:
- `/` returned `307` redirect to `/login`.
- `/login` returned `200` and rendered mock login with the mock mode indicator.
- `/admin` returned `200` and rendered the existing mock-backed admin overview.
- `/client` returned `200` and rendered expanded mock-backed Client Overview V1 sections.
Tests not executed and reason:
- No backend pytest was run because this task did not touch backend behavior, database access, Guard logic, or API contracts.
Residual risks:
- Client Overview V1 remains mock-backed until approved backend contracts exist.
- Real auth, tenant enforcement, deliverability decisions, sending, AI generation, and limit enforcement remain backend-owned future work.
- Next.js regenerated `frontend/next-env.d.ts` during build/dev; the generated diff was restored and not included.
Confirmation:
- `/client` imports data only from `frontend/lib/api.ts`.
- `/`, `/login`, `/admin`, `frontend/components`, and package/config files were not modified.
- no backend, DB, Docker, scripts, Makefile, listmonk, mailpit, or contract docs modified.
- no auth, route protection, credential tokens, cookies, localStorage, or sessionStorage introduced.
- no direct listmonk, PostgreSQL, SMTP, or database URL references added.
- no fetch calls added outside `frontend/lib/api.ts`.

## Client Overview Email Limits Copy Fix

Date: 2026-05-06
Branch: feature/frontend-v1
Scope: Minimal mock-backed Client Overview correction to display email sending usage/limits instead of client-facing AI calls/tokens, with affected `/client` copy in Italian.
Root cause: The Client Overview V1 mock/type/page model introduced AI calls/tokens as client-facing usage, but the product requirement is that the client-facing limit is email sending volume controlled by admin.
Files created: None.
Files modified:
- `frontend/types/index.ts`
- `frontend/lib/mock-api.ts`
- `frontend/app/client/page.tsx`
- `docs/audit_log.md`
Tests executed:
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --name-only` confirmed only allowed tracked files changed.
- `rg "\bfetch\s*\(" frontend/app frontend/components frontend/lib` confirmed the only fetch remains in `frontend/lib/api.ts`.
- `rg "mock-api" frontend/app frontend/components` returned no matches.
- `rg -i "listmonk|postgres|postgresql|smtp|database_url|db_url" frontend/app frontend/components frontend/lib frontend/types` returned no matches.
- `rg -i "localStorage|sessionStorage|document.cookie|jwt|token" frontend/app frontend/components` returned no matches.
- `rg -i "AI calls|Tokens|token usage|usage overview" frontend/app/client/page.tsx frontend/types/index.ts frontend/lib/mock-api.ts` returned no matches.
- `cd frontend && rm -rf .next && npm run dev` initially hit sandbox `EPERM` on port bind, then ran with approval on port 3001 because port 3000 was already in use.
- Runtime HTTP checks for `/`, `/login`, `/admin`, and `/client`.
Runtime route check:
- `/` returned `307` redirect to `/login`.
- `/login` returned `200` and rendered mock login with the mock mode indicator.
- `/admin` returned `200` and rendered the existing mock-backed Admin Overview V1.
- `/client` returned `200` and rendered Italian email-limit based Client Overview copy.
Tests not executed and reason:
- No backend pytest was run because this task did not touch backend behavior, database access, Guard logic, or API contracts.
Residual risks:
- Client Overview remains mock-backed until approved backend contracts exist.
- Admin dashboard still has its existing AI usage metric; this task intentionally changed only `/client`.
- Real auth, tenant enforcement, deliverability decisions, sending, AI generation, and limit enforcement remain backend-owned future work.
- Next.js regenerated `frontend/next-env.d.ts` during build/dev; the generated diff was restored and not included.
Confirmation:
- `/client` imports data only from `frontend/lib/api.ts`.
- `/`, `/login`, `/admin`, `frontend/components`, and package/config files were not modified.
- no backend, DB, Docker, scripts, Makefile, listmonk, mailpit, or contract docs modified.
- no auth, route protection, credentials, auth tokens, cookies, localStorage, or sessionStorage introduced.
- no direct listmonk, PostgreSQL, SMTP, or database URL references added.
- no fetch calls added outside `frontend/lib/api.ts`.
- client-facing AI call/token usage was removed from `/client`.

## Frontend Sidebar Role Nav And Client Email KPIs

Date: 2026-05-06
Branch: feature/frontend-v1
Scope: Minimal mock-backed frontend shell correction for route-contextual sidebar/mobile navigation and client email delivery KPI model.
Root cause: The shared `MainNav` rendered a static `/login`, `/admin`, and `/client` role switcher in every shell context, while the client overview type/mock/page still exposed daily email-limit fields instead of a client-facing delivery KPI grouping.
Files created: None.
Files modified:
- `frontend/components/layout/AppShell.tsx`
- `frontend/components/layout/MainNav.tsx`
- `frontend/components/layout/Sidebar.tsx`
- `frontend/components/layout/MobileNav.tsx`
- `frontend/types/index.ts`
- `frontend/lib/mock-api.ts`
- `frontend/app/client/page.tsx`
- `docs/audit_log.md`
Tests executed:
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --check` passed.
- `git diff --name-only` confirmed only allowed tracked files changed after restoring generated `frontend/next-env.d.ts`.
- `rg "\bfetch\s*\(" frontend/app frontend/components frontend/lib` confirmed the only fetch remains in `frontend/lib/api.ts`.
- `rg "mock-api" frontend/app frontend/components` returned no matches.
- `rg -i "listmonk|postgres|postgresql|smtp|database_url|db_url" frontend/app frontend/components frontend/lib frontend/types` returned no matches.
- `rg -i "localStorage|sessionStorage|document.cookie|jwt|auth token" frontend/app frontend/components` returned no matches.
- `rg -n -i "AI calls|Tokens|token usage|usageOverview|dailyEmailLimit|dailyEmailsSent" frontend/app/client/page.tsx frontend/types/index.ts frontend/lib/mock-api.ts frontend/lib/api.ts` returned no matches.
- `cd frontend && rm -rf .next && npm run dev` initially hit sandbox `EPERM` on port bind, then ran with approval on port 3001 because port 3000 was already in use.
- Runtime browser checks for `/`, `/login`, `/admin`, and `/client` on `http://localhost:3001`.
Runtime route check:
- `/` redirected to `/login`.
- `/login` rendered the mock login form and no dashboard navigation links.
- `/admin` rendered the existing mock-backed admin overview with admin menu: Panoramica, Clienti, Campagne, Limiti email, Invii bloccati, Sistema.
- `/client` rendered the corrected mock-backed client overview with client menu: Panoramica, Campagne, Limiti email, Invii bloccati.
- `/client` showed Limite email mensile, Email inviate, Aperte, Finite in spam, Rimbalzate, and Invii bloccati.
- `/client` did not show AI calls, token usage, or daily email limit terms.
Tests not executed and reason:
- No backend pytest was run because this task did not touch backend behavior, database access, Guard logic, API contracts, or schemas.
Residual risks:
- Route-contextual navigation is UI-only pathname inference, not real auth or tenant security.
- Future placeholder links do not have pages yet and may render 404 until separately implemented.
- Client KPIs remain mock-backed until approved backend contracts exist.
- Admin dashboard still has its existing AI usage metric; this task intentionally changed only client-facing KPI presentation.
Confirmation:
- sidebar menu is route-contextual and mock-only, not real auth/security.
- `/client` imports data only from `frontend/lib/api.ts`.
- `/`, `/login`, `/admin`, package/config files, and generated `frontend/next-env.d.ts` were not modified.
- no backend, DB, Docker, scripts, Makefile, listmonk, mailpit, or contract docs modified.
- no auth, route protection, credentials, auth tokens, cookies, localStorage, or sessionStorage introduced.
- no direct listmonk, PostgreSQL, SMTP, or database URL references added.
- no fetch calls added outside `frontend/lib/api.ts`.
- client-facing AI/token/daily-limit usage was removed from `/client`.

## Milestone 0.6 — Integration Audit

Date: 2026-05-06
Branch: develop
Branches merged:
- feature/backend-core
- feature/frontend-v1
Scope:
- Merge backend/frontend foundations into `develop`
- Audit state and API compatibility between backend schemas/stubs and frontend shared types/mock boundary
- Verify boundary rules, smoke/audit/build flows, and route inventory
Conflicts:
- No textual merge conflicts occurred.
- One sandbox-related Git metadata permission issue blocked the first merge attempt; rerunning with elevated repo write access resolved it without content changes.
Fixes:
- Updated `frontend/types/index.ts` so `ClientCampaignSummaryStatus` reuses documented `CampaignStatus` values.
- Updated `frontend/lib/mock-api.ts` so the client overview summary uses `running` instead of undocumented `active` for campaign state.
Tests:
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --check` passed.
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed.
- Boundary grep checks passed:
  - no frontend `listmonk` references
  - no frontend PostgreSQL/SMTP/database references
  - no `mock-api` imports from frontend pages/components
  - frontend `fetch(` remains centralized in `frontend/lib/api.ts`
- Backend pytest not executed because `pytest` is unavailable in the local Python environment (`pytest: command not found`; `python3 -m pytest`: `No module named pytest`).
Risks:
- Sidebar links target routes not yet implemented: `/admin/clients`, `/admin/campaigns`, `/admin/email-limits`, `/admin/blocked-sends`, `/admin/system`, `/client/campaigns`, `/client/email-limits`, `/client/blocked-sends`.
- `POST /campaigns/{campaign_id}/authorize` and `POST /campaigns/{campaign_id}/send` remain stub/planned rather than end-to-end typed integration contracts.
- Admin/client overview summary helpers remain frontend mock-only and are not backed by backend endpoints yet.
Confirmation:
- No real email sending, AI generation, auth/RBAC, DB persistence work, listmonk execution, n8n workflows, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase was implemented.
- Backend remains the gatekeeper.
- Business PostgreSQL remains the documented business source of truth.
- UI does not call listmonk or PostgreSQL directly.
- `EMAIL_SENDING_ENABLED` remains fail-closed by exact `"true"` evaluation.

## Prompt Shortcuts V1

Date: 2026-05-06
Branch: develop
Scope: docs-only prompt shortcut reference for compact Sendwise task prompts.
Files created:
- `docs/prompt_shortcuts_v1.md`
Files modified:
- `docs/audit_log.md`
Tests executed:
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`
Tests not executed and reason:
- No backend pytest or frontend build/lint was run because this task changed docs only and did not modify backend, frontend, DB, Docker, scripts, or runtime behavior.
Residual risks:
- Prompt shortcuts are operational guidance only; future prompts still need explicit goal, scope, and allowed-file boundaries.
- If the V1 contracts or Codex skills change later, `docs/prompt_shortcuts_v1.md` must be kept in sync.
Confirmation:
- no application code changed
- no backend, frontend, DB, Docker, script, Makefile, or env files modified

## Milestone 0.7 - Frontend Backend Connection

Date: 2026-05-06
Branch: develop
Scope:
- Harden `frontend/lib/api.ts` for dual mock/backend operation through the existing API boundary
- Keep mock mode behavior intact
- Align frontend typing with current FastAPI stub payloads
- Move `/admin` and `/client` to backend-derived overview data without adding backend routes

Files created:
- `docs/branch_handoffs/frontend-backend-connection-0.7-handoff.md`
- `frontend/components/dashboard/AdminDashboard.tsx`
- `frontend/components/dashboard/ClientDashboard.tsx`
- `frontend/components/dashboard/DashboardErrorState.tsx`

Files modified:
- `docs/audit_log.md`
- `frontend/app/admin/page.tsx`
- `frontend/app/client/page.tsx`
- `frontend/lib/api.ts`
- `frontend/types/index.ts`

Endpoints connected:
- `GET /admin/clients`
- `GET /admin/campaigns`
- `GET /client/me`
- `GET /client/campaigns`
- `GET /client/usage`
- `GET /client/blocked-sends`

Implementation notes:
- `frontend/lib/api.ts` now centralizes backend fetches, network failure handling, non-2xx handling, invalid JSON handling, and missing `NEXT_PUBLIC_API_BASE_URL` handling.
- Mock mode still returns the existing `frontend/lib/mock-api.ts` fixtures and summaries unchanged.
- Backend mode derives admin and client overview summaries from the allowed stub endpoints so the dashboards no longer stay mock-only when `NEXT_PUBLIC_USE_MOCK_API=false`.
- `/admin` and `/client` were kept thin via dashboard components plus a shared error-state component.
- Both pages are marked dynamic so backend-mode production builds do not fail by trying to pre-render unavailable local APIs.

Tests:
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed.
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --check` passed.
- Boundary grep checks passed:
  - no direct `mock-api` imports from `frontend/app` or `frontend/components`
  - `fetch(` remains only in `frontend/lib/api.ts`
  - no `listmonk`, `postgres`, `database`, or `smtp` references in allowed frontend runtime files
  - no `localStorage`, `sessionStorage`, or `document.cookie` references in allowed frontend runtime files

Tests not executed and reason:
- No live browser or HTTP runtime verification was completed with the full local stack in backend mode. Docker Desktop had to be started during the session, and `docker compose up -d` did not finish bringing the stack up before handoff.

Risks:
- Admin backend mode still renders zero/empty values for overview fields that do not have matching backend stub endpoints yet.
- Client backend mode still renders zero limits where the current backend stubs do not expose limit data.
- A live backend-mode runtime check remains outstanding.

Confirmation:
- no backend, DB, Docker, or contract files were modified
- no real auth, tokens, cookies, localStorage, sessionStorage, or session handling was introduced
- no real listmonk calls, real sending, AI generation, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work was implemented
- fetches remain centralized in `frontend/lib/api.ts`

## Milestone 0.7.1 - Frontend Backend Mode Verification

Date: 2026-05-06
Branch: develop
Scope:
- Verify the existing frontend backend-mode integration against the current stub backend endpoints
- Resolve the TypeScript `baseUrl` deprecation safely for the current toolchain
- Reconfirm frontend boundary constraints without expanding scope

Files created:
- `docs/branch_handoffs/frontend-backend-verification-0.7.1-handoff.md`

Files modified:
- `docs/audit_log.md`
- `frontend/tsconfig.json`

Implementation notes:
- `frontend/tsconfig.json` no longer uses `baseUrl`, which removes the deprecated option at the source while preserving the existing `@/*` alias mapping through `paths`.
- The exact task-requested `ignoreDeprecations: "6.0"` value was tested and rejected by the installed compiler (`typescript@5.7.2`) and by `next build` with `TS5103: Invalid value for '--ignoreDeprecations'.`
- Live HTTP verification succeeded for `GET /health`, `GET /admin/clients`, `GET /admin/campaigns`, `GET /client/me`, `GET /client/campaigns`, `GET /client/usage`, and `GET /client/blocked-sends`.
- Backend mode build succeeded with `NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`.
- No frontend API boundary regressions were found: `fetch(` remains in `frontend/lib/api.ts`, and no direct `mock-api`, storage, auth-token, cookie, database, SMTP, or listmonk usage was introduced in app/component/runtime files.

Tests:
- `cd frontend && npm run lint` passed.
- `cd frontend && npx tsc -p tsconfig.json --noEmit` passed.
- `cd frontend && npm run build` passed.
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --check` passed.
- Required boundary grep checks passed.
- Required localhost endpoint curls passed against the running backend stub.

Tests not executed and reason:
- No browser runtime verification was performed, so no browser-level backend-mode success is claimed.

Contract changes requested:
- None.

Risks:
- If the team wants the exact VS Code suppression value `ignoreDeprecations: "6.0"`, the TypeScript toolchain will need to be upgraded first because the current repo version rejects it.
- Browser rendering behavior in backend mode remains to be validated in a real session.

Confirmation:
- no backend, DB, Docker config, env, or contract files changed
- no backend logic changed
- no real auth, tokens, cookies, localStorage, or sessionStorage introduced
- no real listmonk calls, real sending, AI generation, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work implemented
## Milestone 0.7.2 - Browser Backend Mode Smoke Check

Date: 2026-05-06
Branch: develop
Scope:
- verify browser rendering for `/login`, `/admin`, and `/client` in backend mode
- confirm frontend/backend boundary behavior under a real browser session
- apply only the smallest frontend-only fix required by runtime verification

Files created:
- `docs/branch_handoffs/browser-backend-mode-smoke-0.7.2-handoff.md`

Files modified:
- `docs/audit_log.md`
- `frontend/components/layout/MobileNav.tsx`

Implementation notes:
- Verified `GET /health`, `GET /admin/clients`, `GET /admin/campaigns`, `GET /client/me`, `GET /client/campaigns`, `GET /client/usage`, and `GET /client/blocked-sends` against the running local backend stub.
- Verified `/login`, `/admin`, and `/client` in a real browser with `NEXT_PUBLIC_USE_MOCK_API=false` and `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`.
- Confirmed backend mode on `/admin` and `/client` through rendered values and the `Backend stub` badge while keeping `fetch(` centralized in `frontend/lib/api.ts`.
- Added a `SheetDescription` to `frontend/components/layout/MobileNav.tsx` to remove the runtime warning emitted by the Radix sheet dialog when the mobile navigation opens.

Tests:
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed.
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --check` passed.
- Required boundary grep checks passed.
- Required localhost endpoint curls passed.
- Real browser route verification passed for `/login`, `/admin`, and `/client`.

Tests not executed and reason:
- None.

Risks:
- `/login` remains intentionally mock-only until a separate auth milestone is approved.
- Some `/admin` and `/client` summary fields remain zero/empty because the current backend stub does not expose fuller aggregate data yet.

Confirmation:
- no backend, DB, Docker config, env, or contract files changed
- no real auth, tokens, cookies, localStorage, or sessionStorage introduced
- no real listmonk calls, real sending, AI generation, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work implemented
- fetches remain centralized in `frontend/lib/api.ts`
## Milestone 0.8B.1 - Frontend Shell Bugfix & Runtime Hardening

Date: 2026-05-06
Branch: develop
Scope:
- audit and reproduce current frontend shell/runtime issues before fixing
- remove the shell brand icon
- restore correct mock-mode startup behavior
- stop existing sidebar-linked routes from failing
- verify frontend behavior in both mock and backend modes without touching backend contracts

Files created:
- `docs/branch_handoffs/frontend-shell-bugfix-0.8B.1-handoff.md`
- `frontend/app/section-placeholder.tsx`
- `frontend/app/admin/clients/page.tsx`
- `frontend/app/admin/campaigns/page.tsx`
- `frontend/app/admin/email-limits/page.tsx`
- `frontend/app/admin/blocked-sends/page.tsx`
- `frontend/app/admin/system/page.tsx`
- `frontend/app/client/campaigns/page.tsx`
- `frontend/app/client/email-limits/page.tsx`
- `frontend/app/client/blocked-sends/page.tsx`

Files modified:
- `docs/audit_log.md`
- `frontend/components/shared/BrandMark.tsx`
- `frontend/components/layout/AppShell.tsx`
- `frontend/components/layout/Sidebar.tsx`
- `frontend/components/layout/MobileNav.tsx`
- `frontend/components/layout/TopBar.tsx`
- `frontend/lib/api.ts`

Issues reproduced:
- The shell brand rendered an icon next to `Sendwise`.
- Plain `npm run dev` did not stay in mock mode when `NEXT_PUBLIC_USE_MOCK_API` was unset.
- `/admin` and `/client` rendered the dashboard error state with `NEXT_PUBLIC_API_BASE_URL is required when NEXT_PUBLIC_USE_MOCK_API=false.` under that startup condition.
- Sidebar-linked routes returned `404`: `/admin/clients`, `/admin/campaigns`, `/admin/email-limits`, `/admin/blocked-sends`, `/admin/system`, `/client/campaigns`, `/client/email-limits`, `/client/blocked-sends`.
- No real `400` frontend route or backend API response was reproduced. The audited backend endpoints all returned `200 OK`.

Implementation notes:
- `frontend/lib/api.ts` now defaults to mock mode unless the env explicitly sets `NEXT_PUBLIC_USE_MOCK_API=false`.
- `frontend/components/shared/BrandMark.tsx` now renders only the `Sendwise` wordmark.
- Added minimal static app routes only for the already-linked shell URLs so navigation no longer points at missing pages.
- `AppShell`, `Sidebar`, `MobileNav`, and `TopBar` now hide the mock badge when backend mode is active.
- Verified mock-mode browser behavior on `http://localhost:3000` and backend-mode browser behavior on `http://localhost:3101`.
- Verified `GET /health`, `GET /admin/clients`, `GET /admin/campaigns`, `GET /client/me`, `GET /client/campaigns`, `GET /client/usage`, and `GET /client/blocked-sends` against the running backend stub; each returned `200 OK`.

Tests:
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed.
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose up -d backend` passed.
- `docker compose config` passed.
- `git diff --check` passed.
- Boundary grep checks passed:
  - no direct `mock-api` imports from `frontend/app` or `frontend/components`
  - `fetch(` remains only in `frontend/lib/api.ts`
  - no `listmonk`, `postgres`, `database`, or `smtp` references in allowed frontend runtime files
  - no `localStorage`, `sessionStorage`, or `document.cookie` references in allowed frontend runtime files
- Browser verification passed for the listed mock-mode routes on `http://localhost:3000`.
- Browser verification passed for the listed backend-mode routes on `http://localhost:3101`.

Tests not executed and reason:
- A second concurrent backend-mode `npm run dev` session was not run because the workspace already had an active `next dev` process on `localhost:3000`, and Next 16 refused a second dev server in the same directory.
- Backend-mode runtime verification was completed instead from a separate built frontend server on `http://localhost:3101`.

Contract changes requested:
- None.

Risks:
- The newly added sidebar route pages are static placeholders that prevent broken navigation but intentionally do not add new feature behavior.
- `/login` remains intentionally mock-only until an approved auth milestone changes that boundary.
- `/admin` and `/client` still reflect the current backend stub coverage and can show zero/empty aggregates where the backend does not yet expose richer data.

Confirmation:
- no backend, DB, Docker config, env, or contract files changed
- no backend logic changed
- no real auth, tokens, cookies, localStorage, or sessionStorage introduced
- no real listmonk calls, real sending, AI generation, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work implemented
- fetches remain centralized in `frontend/lib/api.ts`

## Milestone 0.8C - Login Visual

Date: 2026-05-06
Branch: develop
Scope:
- restyle only `frontend/app/login/page.tsx`
- keep `/login` outside the dashboard shell
- preserve mock-only routing behavior without adding auth persistence or backend calls

Files created:
- `docs/branch_handoffs/frontend-login-visual-0.8C-handoff.md`

Files modified:
- `docs/audit_log.md`
- `frontend/app/globals.css`
- `frontend/app/login/page.tsx`

Implementation notes:
- Replaced the basic login panel with a premium split layout built directly from existing shared primitives and dedicated login CSS.
- Kept the Sendwise wordmark visible without reintroducing a shell icon.
- Preserved the Sendwise palette and 0.8B visual tone while keeping all visible copy in Italian.
- Preserved the existing demo role switch and local route redirects to `/admin` and `/client`.
- Moved the route styling foundation into semantic login classes in `frontend/app/globals.css` so the page does not depend on page-local arbitrary utility generation.
- No changes were made to `frontend/components/auth/MockLoginForm.tsx` because that file is outside the allowed edit scope; the login page now owns its presentational mock form directly.

Tests:
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed.
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --check` passed.
- `grep -R "from .*mock-api" frontend/app frontend/components || true` returned no matches.
- `grep -R "fetch(" frontend/app frontend/components frontend/lib || true` confirmed the only fetch remains in `frontend/lib/api.ts`.
- `grep -R "listmonk\|postgres\|database\|smtp" frontend/app frontend/components frontend/lib || true` returned no matches.
- `grep -R "localStorage\|sessionStorage\|document.cookie" frontend/app frontend/components frontend/lib || true` returned no matches.
- `curl -I http://localhost:3000/login` returned `HTTP/1.1 200 OK`.

Tests not executed and reason:
- Browser-based visual verification could not be completed because the available Playwright browser tooling requires a Chrome runtime that is not installed in this environment.

Residual risks:
- Final visual parity against the attached design artifact may need a manual browser pass because the reference zip was not present in the workspace for direct inspection during implementation.
- The premium serif headline effect depends on locally available fallback fonts.

Confirmation:
- no backend, DB, Docker config, env, or contract files changed
- no real auth, tokens, cookies, localStorage, or sessionStorage introduced
- no real listmonk calls, real sending, AI generation, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work implemented
- no fetch calls added outside `frontend/lib/api.ts`

## Milestone 0.8D - Admin Visual Dashboard + Login Official Cleanup

Date: 2026-05-07
Branch: develop
Scope:
- restyle `/admin` as the primary Sendwise operational dashboard
- clean `/login` so it no longer presents as demo/mock
- preserve the current frontend architecture and temporary local-only access behavior

Files created:
- `docs/branch_handoffs/frontend-admin-visual-0.8D-handoff.md`
- `frontend/components/admin/AdminBlockedSendsCard.tsx`
- `frontend/components/admin/AdminDashboardHeader.tsx`
- `frontend/components/admin/AdminKpiGrid.tsx`
- `frontend/components/admin/AdminOperationsRail.tsx`
- `frontend/components/admin/AdminRecentCampaignsCard.tsx`
- `frontend/components/admin/AdminSurface.tsx`

Files modified:
- `docs/audit_log.md`
- `frontend/app/globals.css`
- `frontend/app/login/page.tsx`
- `frontend/components/dashboard/AdminDashboard.tsx`
- `frontend/lib/api.ts`
- `frontend/lib/mock-api.ts`
- `frontend/types/index.ts`

Implementation notes:
- Replaced the previous admin stub card layout with a structured dashboard made of a control header, KPI cards, recent campaigns, recent blocked sends, and a compact operational rail.
- Kept the page boundary intact by expanding only the typed admin summary fields needed for presentation: client status counts and recent campaigns.
- Preserved the existing `page -> component -> api.ts -> mock/backend -> types` flow and kept `frontend/components/dashboard/AdminDashboard.tsx` as a thin composition layer.
- Removed visible demo/mock wording and the role selector from `/login`.
- Preserved a single temporary local access route to `/admin` for controlled internal verification without introducing auth persistence or backend calls.

Tests:
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed.
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --check` passed.
- `grep -R "from .*mock-api" frontend/app frontend/components || true` returned no matches.
- `grep -R "fetch(" frontend/app frontend/components frontend/lib || true` confirmed the only `fetch(` remains in `frontend/lib/api.ts`.
- `grep -R "listmonk\|postgres\|database\|smtp" frontend/app frontend/components frontend/lib || true` returned no matches.
- `grep -R "localStorage\|sessionStorage\|document.cookie" frontend/app frontend/components frontend/lib || true` returned no matches.

Tests not executed and reason:
- Browser-based visual verification of `/login` and `/admin` could not be completed because the available Playwright browser tooling requires a Chrome runtime that is not installed in this environment.

Contract changes requested:
- None.

Risks:
- Backend mode still returns zero or empty admin aggregates for fields that do not yet have richer backend endpoints.
- Final manual browser QA is still recommended because automated screenshot verification was blocked by the missing local Chrome runtime.

Confirmation:
- no backend, DB, Docker config, env, or contract files changed
- no `/client` redesign was performed
- no Clerk integration, real auth, signup, password reset, token, cookie, localStorage, or sessionStorage was introduced
- no real listmonk calls, real sending, AI generation, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work implemented
- fetches remain centralized in `frontend/lib/api.ts`

## Milestone 0.8E - Client Visual Dashboard + Admin/Login Polish

Date: 2026-05-07
Branch: develop
Scope:
- refine `/client` into the official client-facing dashboard
- tighten `/admin` header, KPI density, and top summary surface
- simplify `/login` into the official reserved-access page
- increase the visual weight of the Sendwise wordmark across touched surfaces

Files created:
- `docs/branch_handoffs/frontend-client-visual-0.8E-handoff.md`
- `frontend/components/admin/AdminTopBarActions.tsx`
- `frontend/components/client/ClientDashboardHeader.tsx`
- `frontend/components/client/ClientDeliveryCard.tsx`
- `frontend/components/client/ClientKpiGrid.tsx`
- `frontend/components/client/ClientRecentBlockedSendsCard.tsx`
- `frontend/components/client/ClientRecentCampaignsCard.tsx`
- `frontend/components/client/ClientSurface.tsx`
- `frontend/components/client/clientStatus.ts`

Files modified:
- `docs/audit_log.md`
- `frontend/app/client/page.tsx`
- `frontend/app/globals.css`
- `frontend/app/login/page.tsx`
- `frontend/components/admin/AdminDashboardHeader.tsx`
- `frontend/components/dashboard/AdminDashboard.tsx`
- `frontend/components/dashboard/ClientDashboard.tsx`
- `frontend/components/layout/AppShell.tsx`
- `frontend/components/layout/TopBar.tsx`
- `frontend/components/shared/BrandMark.tsx`

Implementation notes:
- Replaced the admin breadcrumb-style header with a title-only top bar and safe placeholder actions.
- Reduced the admin hero surface to a compact summary and tightened KPI density to a two-column layout.
- Rebuilt `/client` using dedicated presentational components under `frontend/components/client/` while preserving the current frontend API boundary.
- Removed redundant and temporary explanatory UI from `/login` while preserving the existing local-only temporary route behavior.
- Increased the weight and size of the `Sendwise` wordmark without changing the logo system.

Tests:
- `cd frontend && npm run lint` passed
- `cd frontend && npm run build` passed
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build` passed
- `bash scripts/audit.sh` passed
- `bash scripts/smoke_test.sh` passed
- `docker compose config` passed
- `git diff --check` passed
- `grep -R "from .*mock-api" frontend/app frontend/components || true` returned no matches
- `grep -R "fetch(" frontend/app frontend/components frontend/lib || true` confirmed the only `fetch(` remains in `frontend/lib/api.ts`
- `grep -R "listmonk\|postgres\|database\|smtp" frontend/app frontend/components frontend/lib || true` returned no matches
- `grep -R "localStorage\|sessionStorage\|document.cookie" frontend/app frontend/components frontend/lib || true` returned no matches

Tests not executed and reason:
- Browser-based visual verification of `/admin`, `/client`, and `/login` was attempted against a local dev server, but Playwright could not attach because this environment does not have a Chrome runtime installed.

Contract changes requested:
- None.

Risks:
- Client limit values remain presentation-safe but can still display as unavailable until richer backend summary data exists.
- Final human QA is recommended to confirm hierarchy and spacing on `/admin`, `/client`, and `/login`.

Confirmation:
- no backend, DB, Docker config, env, or contract files changed
- no Clerk integration, real auth, signup, password reset, token, cookie, `localStorage`, or `sessionStorage` was introduced
- no real listmonk calls, real sending, AI generation, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work implemented
- fetches remain centralized in `frontend/lib/api.ts`

## Milestone 0.8F - Visual QA Polish for Admin / Client / Login

Date: 2026-05-07
Branch: develop
Scope:
- refine spacing, hierarchy, and compactness on `/admin`, `/client`, and `/login`
- preserve the current Sendwise UI system and frontend API boundary
- keep the milestone strictly frontend-only with no auth or backend work

Files created:
- `docs/branch_handoffs/frontend-visual-qa-0.8F-handoff.md`

Files modified:
- `docs/audit_log.md`
- `frontend/app/globals.css`
- `frontend/app/login/page.tsx`
- `frontend/components/admin/AdminTopBarActions.tsx`
- `frontend/components/dashboard/AdminDashboard.tsx`
- `frontend/components/dashboard/ClientDashboard.tsx`

Implementation notes:
- Tightened admin and client card density by moving both dashboards to a clearer two-column content rhythm with wider follow-up metric blocks.
- Reduced KPI stretch and improved card separation while preserving the existing palette, rounded surfaces, and Sendwise tone.
- Refined the admin topbar action buttons with lightweight line icons and more intentional disabled styling.
- Simplified the login card header copy and replaced the weak lower info row with a single reserved-access support block.
- Deliberately skipped extra illustration or animation work because the existing glow treatment was sufficient and cleaner.

Tests:
- `cd frontend && npm run lint` passed
- `cd frontend && npm run build` passed
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build` passed
- `bash scripts/audit.sh` passed
- `bash scripts/smoke_test.sh` passed
- `docker compose config` passed
- `git diff --check` passed
- `grep -R "from .*mock-api" frontend/app frontend/components || true` returned no matches
- `grep -R "fetch(" frontend/app frontend/components frontend/lib || true` confirmed the only `fetch(` remains in `frontend/lib/api.ts`
- `grep -R "listmonk\|postgres\|database\|smtp" frontend/app frontend/components frontend/lib || true` returned no matches
- `grep -R "localStorage\|sessionStorage\|document.cookie" frontend/app frontend/components frontend/lib || true` returned no matches
- Browser verification completed on `/admin`, `/client`, and `/login` against the existing local dev server at `http://localhost:3000` using the in-app browser viewport

Tests not executed and reason:
- Dedicated Playwright-browser verification on a separate Chrome runtime was not available because the local Playwright backend does not have Chrome installed in this environment.

Contract changes requested:
- None.

Risks:
- Final human visual QA on a wide desktop viewport is still recommended to confirm spacing and card rhythm at the exact acceptance resolution.

Confirmation:
- no backend, DB, Docker config, env, or contract files changed
- no Clerk integration, real auth, signup, password reset, token, cookie, `localStorage`, or `sessionStorage` was introduced
- no real listmonk calls, real sending, AI generation, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work implemented
- fetches remain centralized in `frontend/lib/api.ts`

## Milestone 0.8F.1 - Dashboard KPI Card Grid Fix

Date: 2026-05-07
Branch: develop
Scope:
- fix the remaining KPI/stat card layout issue on `/admin` and `/client`
- preserve the existing dashboard visual style and frontend-only architecture
- keep the change limited to the smallest layout root cause

Files created:
- `docs/branch_handoffs/dashboard-kpi-grid-fix-0.8F.1-handoff.md`

Files modified:
- `frontend/app/globals.css`
- `docs/audit_log.md`

Implementation notes:
- Identified the actual layout bug in the shared KPI wrapper CSS: both KPI wrappers declared column tracks but were missing `display: grid`.
- Added grid display to the admin and client KPI wrappers so the existing two-column rules now apply as intended on desktop and tablet widths.
- Reduced KPI card minimum height and padding slightly to remove excess vertical bulk while preserving the current palette, rounded corners, borders, and typography.
- Left page logic, data boundaries, dashboard sections, and backend behavior untouched.

Admin result:
- KPI cards now render two per row on desktop-width layout instead of stacking one per row.

Client result:
- KPI cards now render two per row on desktop-width layout instead of stacking one per row.

Verification:
- `cd frontend && npm run lint` passed
- `cd frontend && npm run build` passed
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build` passed
- `bash scripts/audit.sh` passed
- `bash scripts/smoke_test.sh` passed
- `docker compose config` passed
- `git diff --check` passed
- `grep -R "from .*mock-api" frontend/app frontend/components || true` returned no matches
- `grep -R "fetch(" frontend/app frontend/components frontend/lib || true` confirmed the only `fetch(` remains in `frontend/lib/api.ts`
- `grep -R "listmonk\|postgres\|database\|smtp" frontend/app frontend/components frontend/lib || true` returned no matches
- `grep -R "localStorage\|sessionStorage\|document.cookie" frontend/app frontend/components frontend/lib || true` returned no matches
- Visual verification completed in the in-app browser on `/admin` and `/client` against the existing local dev server at `http://localhost:3000`

Tests not executed and reason:
- No separate live narrow-viewport browser pass was run; mobile behavior remains covered by the unchanged single-column media query.

Contract changes requested:
- None.

Risks:
- Final human QA on the intended acceptance viewport is still recommended to validate the preferred compactness and spacing feel.

Confirmation:
- no backend, DB, Docker config, env, or contract files changed
- no Clerk integration, real auth, signup, password reset, token, cookie, `localStorage`, or `sessionStorage` was introduced
- no real listmonk calls, real sending, AI generation, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work implemented
- fetches remain centralized in `frontend/lib/api.ts`

## Milestone 0.9A - Clerk Auth Contract + Backend Integration Plan

Date: 2026-05-07
Branch: develop
Scope:
- docs-only auth contract and implementation planning for Clerk with the existing Next.js frontend and FastAPI backend
- define the future identity, route protection, backend verification, user mapping, secret-storage, and rollout phases without changing runtime code
- keep the current Sendwise architecture and boundary rules intact

Files created:
- `docs/auth_contract_v1.md`
- `docs/branch_handoffs/auth-contract-0.9A-handoff.md`

Files modified:
- `docs/architecture_v1.md`
- `docs/data_model_v1.md`
- `docs/audit_checklist_v1.md`
- `docs/audit_log.md`

Planning notes:
- Clerk is defined as the identity and session provider, while FastAPI remains the authorization gatekeeper and Business PostgreSQL remains the business source of truth.
- Public signup stays disabled; admin-created or invited users only.
- Passwords, password hashes, reset tokens, and session secrets remain forbidden in Sendwise Business PostgreSQL.
- `client_users` is now documented as the planned Clerk-to-business mapping table, and `client_secrets` is documented as a future encrypted table only if per-client provider credentials are needed later.
- The rollout is staged into 0.9B through 0.9F so the frontend can connect earlier without prematurely changing backend, DB, Docker, or secret handling.

Tests executed:
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`

Tests not executed and reason:
- No frontend build or lint was run because this milestone changed docs only and did not modify frontend runtime code.
- No backend pytest was run because this milestone changed docs only and did not modify backend runtime code or tests.

Risks remaining:
- Clerk role names, `client_users` persistence, and backend token verification remain planned only and are not yet implemented in the runtime.
- Current stub frontend and backend auth behavior still uses pre-contract placeholder flows and will need explicit alignment in Milestones 0.9B through 0.9E.
- Platform-admin scoping, Clerk Organizations usage, and final invitation flow remain implementation decisions with recommended defaults but not final code.

Confirmation:
- no frontend runtime code changed
- no backend runtime code changed
- no DB migration or schema implementation changed
- no Docker config changed
- no Clerk install or real auth implementation added
- no signup, password implementation, token or cookie storage, listmonk execution, real sending, AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work implemented

## Milestone 0.9B - Clerk Auth Vertical Slice

Date: 2026-05-07
Branch: develop
Scope:
- implement the first Clerk authentication vertical slice across the Next.js frontend and FastAPI backend
- protect `/admin`, `/client`, and `/account`
- attach Clerk session tokens to frontend backend-mode API requests
- verify Clerk JWTs in FastAPI and derive a backend-owned authenticated user context
- keep public signup disabled in the Sendwise UI

Files created:
- `backend/app/core/auth.py`
- `backend/app/repositories/auth_users.py`
- `backend/tests/test_clerk_auth.py`
- `frontend/app/account/[[...account]]/page.tsx`
- `frontend/components/shared/AccountUserButton.tsx`
- `frontend/proxy.ts`
- `docs/branch_handoffs/clerk-auth-vertical-slice-0.9B-handoff.md`

Files removed:
- `backend/tests/test_milestone_05_stubs.py`

Files modified:
- `backend/app/api/admin.py`
- `backend/app/api/campaigns.py`
- `backend/app/api/client.py`
- `backend/app/core/config.py`
- `backend/app/core/security.py`
- `backend/app/schemas/blocked_sends.py`
- `backend/app/schemas/campaigns.py`
- `backend/requirements.txt`
- `.env.example`
- `frontend/app/layout.tsx`
- `frontend/app/login/page.tsx`
- `frontend/components/layout/AppShell.tsx`
- `frontend/components/layout/Sidebar.tsx`
- `frontend/lib/api.ts`
- `frontend/package.json`
- `frontend/package-lock.json`
- `docs/audit_log.md`

Implementation notes:
- Added `@clerk/nextjs` to the frontend and wrapped the root layout with `ClerkProvider`.
- Replaced the local fake login submit flow with Clerk `SignIn` and disabled sign-up UI on the Sendwise login page.
- Added Clerk `clerkMiddleware()` in `frontend/proxy.ts` and explicitly protected `/admin`, `/client`, and `/account`.
- Added `/account` with Clerk `UserProfile` and integrated a Clerk `UserButton` into the topbar while removing the fake local user identity card.
- Kept `fetch(` centralized in `frontend/lib/api.ts` and attached Clerk session tokens with server-side `auth().getToken()` in backend mode.
- Replaced the placeholder API-key gate on admin and client dashboard endpoints with Clerk JWT verification plus backend-owned role and status enforcement.
- Used a temporary backend-only `AUTH_USER_MAPPINGS_JSON` repository for Clerk user to Sendwise role and `client_id` mapping. This is fail-closed and explicitly temporary until `client_users` persistence lands in `0.9D`.

Verification:
- `cd frontend && npm run lint` passed
- `cd frontend && npm run build` passed
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build` passed
- `bash scripts/audit.sh` passed
- `bash scripts/smoke_test.sh` passed
- `docker compose config` passed
- `git diff --check` passed
- `PYTHONPATH=backend python3 -m pytest backend/tests` passed
- `grep -R "from .*mock-api" frontend/app frontend/components || true` returned no matches
- `grep -R "fetch(" frontend/app frontend/components frontend/lib || true` confirmed the only `fetch(` remains in `frontend/lib/api.ts`
- `grep -R "listmonk\\|postgres\\|database\\|smtp" frontend/app frontend/components frontend/lib || true` returned no matches
- `grep -R "localStorage\\|sessionStorage\\|document.cookie" frontend/app frontend/components frontend/lib || true` returned no matches
- `grep -R "SignUpButton\\|sign-up\\|signup" frontend/app frontend/components frontend/lib || true` returned no matches

Tests not executed and reason:
- No live Clerk browser sign-in was executed because real Clerk instance credentials and manual restricted-signup configuration were not provided in this turn.
- No authenticated browser or curl verification was executed against a real backend because no live Clerk user ids were mapped for local runtime use.

Contract changes requested:
- None.

Risks:
- The backend mapping is temporary env-backed state rather than `client_users` persistence.
- Frontend middleware enforces authentication but not role-specific route UX yet; backend role enforcement remains authoritative.
- `frontend/app/login/page.tsx` does not use a catch-all Clerk sign-in route, so more complex nested Clerk path flows should be validated live with real credentials.

Confirmation:
- no DB secrets, passwords, password hashes, reset tokens, or session secrets were committed or stored
- no public signup UI or route was added
- no frontend-trusted role or `client_id` was introduced
- no real listmonk calls, real sending, AI generation, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work was implemented

## Milestone 0.9B.1 - Clerk Login Catch-All Route Fix

Date: 2026-05-07
Branch: develop
Scope:
- fix the known Clerk login route limitation by replacing the single `/login` page route with an optional catch-all App Router route
- preserve the existing Sendwise login visual design
- keep login and nested Clerk login paths public without changing the auth architecture

Files created:
- `frontend/app/login/LoginContent.tsx`
- `frontend/app/login/[[...login]]/page.tsx`
- `docs/branch_handoffs/clerk-login-catchall-0.9B.1-handoff.md`

Files modified:
- `frontend/proxy.ts`
- `docs/audit_log.md`

Files removed:
- `frontend/app/login/page.tsx`

Verified behavior:
- Confirmed the root cause at the frontend route layer: the repo previously rendered Clerk `SignIn` only from `frontend/app/login/page.tsx`, so nested Clerk path flows under `/login/*` had no matching optional catch-all route.
- Preserved the existing login UI by moving the current Sendwise login JSX and Clerk appearance config into `frontend/app/login/LoginContent.tsx`.
- Mounted login through `frontend/app/login/[[...login]]/page.tsx` and preserved the existing signed-in redirect to `/admin`.
- Kept `withSignUp={false}` in the Clerk `SignIn` component.
- Made `frontend/proxy.ts` explicitly treat `/login` and `/login(.*)` as public while preserving existing protected matchers for `/admin(.*)`, `/client(.*)`, and `/account(.*)`.
- Verified through both frontend builds that Next now emits the route `ƒ /login/[[...login]]`.
- Verified boundary checks still pass:
- no direct `mock-api` imports from app or components
- the only frontend `fetch(` remains in `frontend/lib/api.ts`
- no `listmonk`, `postgres`, `database`, or `smtp` references in frontend app/components/lib
- no `localStorage`, `sessionStorage`, or `document.cookie`
- no `SignUpButton`, `/sign-up`, or `signup` exposure in frontend app/components/lib

Tests executed:
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`
- `PYTHONPATH=backend python3 -m pytest backend/tests`
- `grep -R "from .*mock-api" frontend/app frontend/components || true`
- `grep -R "fetch(" frontend/app frontend/components frontend/lib || true`
- `grep -R "listmonk\|postgres\|database\|smtp" frontend/app frontend/components frontend/lib || true`
- `grep -R "localStorage\|sessionStorage\|document.cookie" frontend/app frontend/components frontend/lib || true`
- `grep -R "SignUpButton\|sign-up\|signup" frontend/app frontend/components frontend/lib || true`

Tests not executed and reason:
- No live Clerk sign-in flow was executed because real Clerk environment values and authorized test credentials were not provided.
- No live browser or HTTP verification was run against a started local Next server for `/login/*`; route compatibility was verified at build level through the emitted App Router route tree.

Risks remaining:
- Live Clerk nested route behavior still depends on valid runtime Clerk configuration and credentials.
- Public signup must still remain disabled or restricted in the Clerk Dashboard; this fix does not override Clerk instance policy.
- The workspace still contains unrelated pre-existing dirty changes outside this milestone.

Confirmation:
- no backend, DB, Docker config, signup, custom password form, user CRUD, real listmonk, real sending, AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work was implemented

## Milestone 0.9C - Clerk Auth Runtime Verification

Date: 2026-05-07
Branch: develop
Scope:
- verify the existing Clerk auth vertical slice from `0.9B` against the current local runtime
- confirm env and secret handling
- run required regression and boundary checks
- apply no code changes unless a confirmed minimal runtime bug fits the allowed scope

Verified state:
- `git status --short` was clean.
- `git diff --cached --name-only || true` returned no staged files.
- `git diff -- .env .env.local frontend/.env.local backend/.env.local || true` returned no tracked secret diff.
- No local `.env` or `.env.local` files were present in the repo during verification.
- Required Clerk env vars were not present in the current shell environment.
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed.
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build` passed.
- `PYTHONPATH=backend python3 -m pytest backend/tests` passed with `11` tests.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --check` passed.
- Boundary checks passed:
- the only frontend `fetch(` remains in `frontend/lib/api.ts`
- no direct frontend `mock-api` imports from `frontend/app` or `frontend/components`
- no frontend references to `listmonk`, `postgres`, `database`, or `smtp`
- no frontend `localStorage`, `sessionStorage`, or `document.cookie`
- no Sendwise `SignUpButton`, `/sign-up`, or `signup` exposure
- Build output still includes `ƒ /login/[[...login]]`, confirming nested Clerk login paths do not fail at the Next route level.
- Live backend negative-path checks:
- `GET /health` returned `200`
- `GET /admin/clients` without auth returned `401`
- `GET /admin/clients` with invalid bearer token and missing Clerk backend config returned `500` with `Clerk auth is not fully configured on the backend.`

First divergence found:
- Live frontend requests to `/login`, `/admin`, and `/account` returned generic `500 Internal Server Error` responses when Clerk frontend env was absent.

Root cause:
- Category: frontend rendering
- Primary cause: `ClerkProvider` throws before page render when `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is missing.
- Evidence: Next server log reported `@clerk/nextjs: Missing publishableKey.`
- Minimal fix boundary: `frontend/app/layout.tsx`

Fix status:
- No app fix applied.
- Reason: the confirmed minimal fix boundary is outside the allowed modification scope for this milestone.

Known limits:
- Real Clerk runtime verification was blocked because no real local Clerk env values were present.
- Real Clerk Dashboard policy could not be confirmed from the workspace.
- Real mapped Clerk test users were not available for live admin/client authorization checks.
- Playwright browser verification was unavailable because the required local browser engine was not installed.

Contract changes requested:
- None.

Risks:
- Frontend missing-env behavior is not user-facing clear yet; the browser only receives a generic `500`.
- End-to-end frontend-to-backend token transport with a real Clerk session remains unverified.
- `AUTH_USER_MAPPINGS_JSON` remains temporary runtime mapping rather than `client_users` persistence.

Confirmation:
- no DB migration, `client_users` persistence, admin-created user flow, public signup, custom password form, real listmonk, real sending, AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase work was implemented

## Milestone 0.9D-Prep - One Admin + One Client Account Contract

Date: 2026-05-07
Branch: develop
Scope:
- docs-only contract update for the V1 auth, data-model, API, architecture pointer, audit checklist, audit log, and branch handoff files
- simplify V1 from multi-user client roles to one backend-controlled platform admin plus one Clerk-backed client account per client
- define onboarding contract for Clerk password setup, required `personal_name`, and optional `company_name`

Verified state:
- `docs/auth_contract_v1.md` now defines one platform admin account, one client account per client, backend-resolved `client_id`, no role selection, no team or sub-user model, and Clerk-owned password management.
- `docs/data_model_v1.md` now replaces planned `client_users` with planned `client_access` and documents the `clients` plus `client_access` split.
- `docs/api_contracts_v1.md` now defines admin client-access endpoints, a client onboarding completion endpoint, and removes role or user-type contract language from V1 access flows.
- `docs/audit_checklist_v1.md` now includes explicit checks for no role selector, no admin/client selector, no multi-user client UI, backend-controlled platform admin, backend-derived `client_id`, one active access per client, no public signup route, and no `SignUpButton`.
- `docs/architecture_v1.md` now points to `client_access` mappings and clarifies that the platform admin is backend-controlled rather than a client account.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --check` passed.

Known limits:
- This milestone updates contracts only; no runtime auth behavior, Clerk API calls, database schema, invitation flow, or onboarding flow was implemented.
- The workspace contains a pre-existing untracked file: `docs/branch_handoffs/clerk-custom-login-0.9C.2-handoff.md`. It was not modified by this task.

Contract changes requested:
- define V1 as one platform admin plus one Clerk-backed client account per client
- remove V1 `client_users`, role selection, user-type selection, and team or sub-user assumptions
- define client onboarding profile fields as required `personal_name` plus optional `company_name`
- define future invite-access and onboarding-complete API contracts with backend-owned client scope

Residual risks:
- Existing runtime code and placeholder auth behavior still predate this simplified contract and will need a later implementation milestone to align code with docs.
- The exact future persistence constraints for `email` uniqueness among active or invited access rows will need implementation-level enforcement details when schema work is approved.

Confirmation:
- no frontend runtime code implemented
- no backend runtime code implemented
- no DB migration implemented
- no Clerk API call implemented
- no client access implementation implemented
- no onboarding implementation implemented
- no public signup implemented
- no custom password form implemented
- no custom 2FA implemented
- no real listmonk implemented
- no real sending implemented
- no AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase implemented

## Milestone 0.9E — Runtime Auth Model Alignment

Date: 2026-05-07
Branch: develop
Scope:
- align backend runtime auth from legacy role hierarchy to the V1 one-admin plus one-client access model
- replace temporary auth mapping expectations with object-shaped Clerk-user keyed access mappings
- keep protected admin, client, and campaign endpoints fail-closed without adding DB persistence, Clerk invitations, or UI redesign

Verified state:
- `backend/app/core/auth.py` now trusts `platform_admin` and `client` access kinds only, with `require_active_user`, `require_platform_admin`, and `require_client_scope` enforcing the simplified runtime contract.
- `backend/app/repositories/auth_users.py` now validates object-shaped `AUTH_USER_MAPPINGS_JSON`, rejects non-empty legacy list mappings, rejects unknown access types, rejects client access without `client_id`, and rejects platform admin access with a trusted `client_id`.
- `backend/app/api/admin.py` now depends on `require_platform_admin`.
- `backend/app/api/campaigns.py` now depends on `require_active_user`.
- `backend/tests/test_clerk_auth.py` now verifies public health, missing token `401`, invalid token `401`, active platform admin access, active client access, client-to-admin `403`, admin-to-client `403`, non-active status `403`, invalid mapping `500`, unknown access type `500`, and legacy role mapping `500`.
- `.env.example` now documents the temporary object-shaped auth mapping placeholder with `access_type` values `platform_admin` and `client`.
- `PYTHONPATH=backend python3 -m pytest backend/tests` passed.
- `cd frontend && npm run lint` passed.
- `cd frontend && npm run build` passed.
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build` passed.
- `bash scripts/audit.sh` passed.
- `bash scripts/smoke_test.sh` passed.
- `docker compose config` passed.
- `git diff --check` passed.

Known limits:
- Clerk frontend login redirects still contain hard `/admin` assumptions in `frontend/app/layout.tsx` and `frontend/app/login/[[...login]]/page.tsx`, but those files were outside the allowed edit scope for this milestone.
- `frontend/components/auth/MockLoginForm.tsx` still contains a dev-only admin/client selector outside this milestone scope and appears unused by the current Clerk login route.
- Runtime auth mapping remains backend env configuration rather than persisted `client_access` state.
- The worktree contains an unrelated `frontend/app/globals.css` modification outside this milestone scope.

Contract changes requested:
- None.

Confirmation:
- no DB migration implemented
- no `client_access` persistence implemented
- no Clerk invitation API implemented
- no admin invite flow implemented
- no onboarding endpoint implemented
- no public signup implemented
- no custom password form implemented
- no custom 2FA implemented
- no real listmonk implemented
- no real sending implemented
- no AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase implemented

## Milestone 0.9C.3 — Custom Clerk Login Verification Steps

Date: 2026-05-07
Branch: develop
Scope:
- extend the Sendwise custom Clerk login UI to continue through Clerk intermediate verification states
- keep the custom `/login` surface Italian-only and Sendwise-owned
- preserve no-signup, no-social, and no-backend-change boundaries

Flow audited:
- Expected contract:
- `/login` remains custom Next.js UI
- Clerk identifies users and drives sign-in state transitions
- intermediate first-factor and second-factor states should continue inside the custom UI instead of dropping to Clerk prebuilt UI or blocking generically
- backend auth logic stays unchanged
- Observed behavior before fix:
- the old custom form only completed on `signIn.status === "complete"`
- `needs_first_factor` and `needs_second_factor` were mapped to generic blocking errors
- First divergence point:
- frontend login flow control in `frontend/app/login/LoginContent.tsx`
- Evidence:
- the old code returned a terminal generic message for `needs_second_factor`
- the old code returned a terminal generic message for `needs_first_factor`
- the installed Clerk SDK proxy in this repo exposes supported factor metadata and custom-flow methods that can continue the sign-in inside Sendwise UI

Root cause:
- Symptom:
- users with Clerk accounts that require additional verification could not complete sign-in from the custom Sendwise page
- Primary root cause:
- frontend rendering and flow handling treated Clerk intermediate states as final errors
- Category:
- frontend rendering
- Minimal fix boundary:
- `frontend/app/login/LoginContent.tsx`

Verified state:
- `frontend/app/login/LoginContent.tsx` now uses a Sendwise-owned multi-step flow built on Clerk custom-flow methods.
- Password-first sign-in continues through `signIn.create(...)` plus `signIn.password(...)` when password is a supported first factor.
- First-factor continuation now supports `email_code` and `phone_code`.
- Second-factor continuation now supports `totp`, `phone_code`, `email_code`, and `backup_code`.
- Code-based factors support controlled resend flows through the available Clerk send-code APIs.
- Successful completion activates the Clerk session through `clerk.setActive({ session: createdSessionId })`.
- Controlled Italian error messages now cover invalid credentials, invalid codes, expired codes, unsupported factor shapes, throttling, and temporary auth unavailability.
- Live browser verification on `http://localhost:3000/login` confirmed:
- the page loads
- the custom Sendwise UI renders
- invalid credentials show `Email o password non validi.`
- no signup or social UI is visible
- no hydration warning was observed in browser logs; only the expected Clerk development-keys warning appeared

Checks executed:
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build`
- `PYTHONPATH=backend python3 -m pytest backend/tests`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`
- boundary grep checks for mock API imports, direct fetches, listmonk/DB/SMTP references, storage/cookie writes, signup strings, and Google/social strings
- in-app browser verification of `/login`

Known limits:
- A live additional-verification success path was not completed in this turn because no authorized QA credentials or TOTP or backup codes were available in the workspace.
- The frontend redirect target after successful auth remains hard-coded to `/admin` in existing route behavior outside this milestone's allowed redirect follow-up.
- Unsupported future Clerk factor combinations still fail closed with support guidance instead of prebuilt Clerk UI.
- The worktree contains an unrelated pre-existing modification in `frontend/app/globals.css` outside this milestone scope.

Contract changes requested:
- None.

Confirmation:
- no backend auth logic changed
- no DB migration implemented
- no `client_access` persistence implemented
- no admin-created invitation flow implemented
- no public signup implemented
- no social login implemented
- no custom password storage implemented
- no custom password reset or change implemented
- no real listmonk or real sending implemented
- no AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase implemented

## Milestone 0.9E.1 — Clerk Redirect Alignment

Date: 2026-05-07
Branch: develop
Scope:
- align post-login Clerk routing to backend-resolved access type
- keep `AUTH_USER_MAPPINGS_JSON` as the temporary backend mapping source
- avoid DB persistence, invitations, onboarding, and UI redesign

Flow audited:
- Expected contract:
- Clerk identifies the user
- FastAPI resolves trusted access type and trusted `client_id`
- the frontend redirects to `/admin` for `platform_admin` and `/client` for `client` only after backend resolution
- Observed behavior before fix:
- `frontend/app/login/LoginContent.tsx` hard-coded the success redirect target to `/admin`
- `frontend/app/login/[[...login]]/page.tsx` redirected every authenticated user to `/admin`
- `frontend/app/layout.tsx` still contains `signInFallbackRedirectUrl="/admin"` and `signInForceRedirectUrl="/admin"`
- backend runtime auth had no minimal `/auth/me` endpoint for frontend redirect resolution
- First divergence point:
- frontend post-login routing in `frontend/app/login/LoginContent.tsx` and `frontend/app/login/[[...login]]/page.tsx`
- Evidence:
- the custom Clerk login flow completed by calling `router.replace("/admin")`
- authenticated visits to `/login` were immediately redirected to `/admin`
- no backend-owned auth-context endpoint existed for the frontend to ask which dashboard route to use

Root cause:
- Symptom:
- active client logins could be sent to `/admin` after successful Clerk authentication
- Primary root cause:
- frontend redirect handling was hard-coded to an admin route before any backend-owned access resolution step
- Category:
- frontend API client
- Minimal fix boundary:
- `frontend/app/login/LoginContent.tsx`
- `frontend/app/login/[[...login]]/page.tsx`
- `frontend/app/auth/redirect/page.tsx`
- `frontend/lib/api.ts`
- `backend/app/api/`
- `backend/app/schemas/`
- `backend/tests/test_clerk_auth.py`

Verified state:
- `backend/app/api/auth.py` now exposes `GET /auth/me` for active authenticated users and returns `access_type`, backend-owned `client_id`, `email`, and `status`.
- `backend/app/schemas/auth.py` defines the minimal `GET /auth/me` response shape.
- `frontend/lib/api.ts` now exposes a backend-only post-login redirect helper that calls `/auth/me` and maps `platform_admin` to `/admin` and `client` to `/client`.
- `frontend/app/auth/redirect/page.tsx` now resolves the redirect server-side through the backend and fails closed with a small error state if auth resolution is unavailable.
- `frontend/app/login/LoginContent.tsx` now routes successful Clerk session activation to `/auth/redirect` instead of `/admin`.
- `frontend/app/login/[[...login]]/page.tsx` now routes already-authenticated users to `/auth/redirect` instead of `/admin`.
- `frontend/proxy.ts` required no change; it still protects `/admin`, `/client`, and `/account` by authentication only.
- `backend/tests/test_clerk_auth.py` now verifies `GET /auth/me` for both active `platform_admin` and active `client` mappings.

Checks executed:
- `PYTHONPATH=backend python3 -m pytest backend/tests`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`

Known limits:
- `frontend/app/layout.tsx` still contains hard-coded Clerk fallback and force redirect props pointing to `/admin`. The current custom login flow no longer depends on them, but any future Clerk-managed redirect path would still need follow-up.
- post-login routing now fails closed if `NEXT_PUBLIC_USE_MOCK_API=true`, because backend resolution is required for this flow.
- backend auth mapping remains the temporary `AUTH_USER_MAPPINGS_JSON` env configuration rather than persisted `client_access` state.

Confirmation:
- no DB migration implemented
- no `client_access` persistence implemented
- no Clerk invitation API implemented
- no admin invite flow implemented
- no onboarding completion endpoint implemented
- no public signup implemented
- no custom password form implemented
- no custom 2FA implemented
- no real listmonk integration implemented
- no real sending implemented
- no AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase implemented

## Milestone 0.9E.1b — Remove Residual Clerk Admin Redirects

Date: 2026-05-07
Branch: develop
Scope:
- remove the remaining Clerk provider post-login `/admin` fallback from the shared frontend layout
- preserve `/auth/redirect` as the only post-login route chooser
- avoid backend, DB, invitation, onboarding, and UI changes

Flow audited:
- Expected contract:
- Clerk identifies the user
- `/auth/redirect` owns the post-login destination decision
- the frontend never decides trusted `access_type` or `client_id`
- Observed behavior before fix:
- `frontend/app/layout.tsx` still configured `signInFallbackRedirectUrl="/admin"` and `signInForceRedirectUrl="/admin"`
- that configuration could bypass `/auth/redirect` on Clerk-managed redirect paths
- First divergence point:
- shared Clerk provider configuration in `frontend/app/layout.tsx`
- Evidence:
- the live layout file still pointed both Clerk sign-in redirect props at `/admin`

Root cause:
- Symptom:
- future Clerk-managed sign-in redirects could still send client users to `/admin`
- Primary root cause:
- stale Clerk provider redirect configuration remained after the earlier `/auth/redirect` rollout
- Category:
- frontend rendering
- Minimal fix boundary:
- `frontend/app/layout.tsx`

Verified state:
- `frontend/app/layout.tsx` now points `signInFallbackRedirectUrl` and `signInForceRedirectUrl` to `/auth/redirect`.
- `afterSignOutUrl="/login"` remains unchanged.
- `frontend/proxy.ts` required no change and still protects `/admin`, `/client`, and `/account` by authentication only.
- Redirect grep returned no remaining forbidden post-login `/admin` fallback matches.
- Broad `/admin` grep still returns only:
- `frontend/components/layout/AppShell.tsx` and `frontend/components/layout/MainNav.tsx` admin navigation references
- `frontend/lib/api.ts` backend-owned `ADMIN_ROUTE` target used only after `/auth/me`
- `frontend/components/auth/MockLoginForm.tsx` dev-only mock role redirect logic outside the live Clerk flow and outside this task's allowed scope

Checks executed:
- `PYTHONPATH=backend python3 -m pytest backend/tests`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`
- `grep -R "from .*mock-api" frontend/app frontend/components || true`
- `grep -R "fetch(" frontend/app frontend/components frontend/lib || true`
- `grep -R "listmonk\|postgres\|database\|smtp" frontend/app frontend/components frontend/lib || true`
- `grep -R "localStorage\|sessionStorage\|document.cookie" frontend/app frontend/components frontend/lib || true`
- `grep -R "SignUpButton\|sign-up\|signup" frontend/app frontend/components frontend/lib || true`
- `grep -R "afterSignInUrl.*admin\|forceRedirectUrl.*admin\|fallbackRedirectUrl.*admin\|router.push('/admin')\|router.replace('/admin')" frontend/app frontend/components frontend/lib || true`
- `grep -R '"/admin"' frontend/app frontend/components frontend/lib || true`

Known limits:
- Live Clerk runtime verification was not executed because no real mapped Clerk credentials were available in the workspace.
- `frontend/components/auth/MockLoginForm.tsx` still contains a dev-only admin or client mock redirect outside the live Clerk flow and outside this task's allowed scope.
- The worktree still contains the earlier uncommitted 0.9E.1 backend and frontend auth-alignment changes.

Contract changes requested:
- None.

Confirmation:
- no backend implemented or modified for this milestone
- no DB migration implemented
- no `client_access` persistence implemented
- no Clerk invitation API implemented
- no admin invite flow implemented
- no onboarding endpoint implemented
- no public signup implemented
- no custom password form implemented
- no custom 2FA implemented
- no real listmonk implemented
- no real sending implemented
- no AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase implemented

## Milestone 0.9E.2 — Clerk Runtime QA with Real Mapped Users

Date: 2026-05-07
Branch: develop

Verified state:
- Secret-safety checks passed:
- `git status --short` was clean before task output
- no tracked or staged diff was present for `.env`, `.env.local`, `frontend/.env.local`, or `backend/.env.local`
- `frontend/.env.local` exists with frontend Clerk variables
- `backend/.env.local` does not exist in this workspace
- the current shell environment does not contain `CLERK_JWKS_URL`, `CLERK_ISSUER`, or `AUTH_USER_MAPPINGS_JSON`
- Automated regression checks passed:
- `PYTHONPATH=backend python3 -m pytest backend/tests`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`
- Boundary grep checks passed:
- `fetch(` remains isolated to `frontend/lib/api.ts`
- no direct frontend `listmonk`, `postgres`, `database`, `smtp`, `localStorage`, `sessionStorage`, `document.cookie`, or signup exposure was found
- no forbidden generic post-login `/admin` redirect match was found in the checked frontend paths
- Live runtime checks executed outside the sandbox:
- backend `GET /health` returned `200`
- backend `GET /auth/me`, `GET /admin/clients`, and `GET /client/me` returned `401` without auth
- frontend signed-out `/admin`, `/client`, and `/account` are protected and redirect or rewrite to `/login`
- frontend `/login` renders the custom Sendwise login HTML and no signup or social button was visible in the rendered HTML
- Code-path verification passed:
- `frontend/app/auth/redirect/page.tsx` routes through backend-owned `getPostLoginRedirectPath()`
- `frontend/lib/api.ts` attaches `Authorization: Bearer <token>` in backend mode using Clerk `auth().getToken()`
- `getPostLoginRedirectPath()` decides `/admin` versus `/client` only from backend `GET /auth/me`

Known limits:
- Real backend Clerk runtime verification is blocked because local backend Clerk env is missing:
- `CLERK_JWKS_URL`
- `CLERK_ISSUER`
- `AUTH_USER_MAPPINGS_JSON`
- Real mapped admin and client Clerk users were not available in the workspace for live sign-in.
- Clerk Dashboard settings for public signup, social login, local redirect URLs, and mapped test users were not confirmable from this workspace.
- Interactive browser checks are limited because Playwright could not start Chrome on this machine.

Observed blocker:
- `GET /auth/me` with `Authorization: Bearer invalid-token` returned `500` with `Clerk auth is not fully configured on the backend.`
- This does not count as an application bug for this milestone because the required Clerk backend verification env was not present locally.

Scope confirmation:
- No DB migration was implemented.
- No `client_access` persistence was implemented.
- No Clerk invitation API, admin invite flow, onboarding endpoint, public signup, custom password form, custom 2FA, real listmonk, real sending, AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase was implemented.

## Milestone 11.2 - DB Migration Runner Hardening

Date: 2026-05-13
Branch: develop

Verified state:
- Added `scripts/apply_migrations.sh` as the explicit dev/staging SQL migration runner.
- Existing PostgreSQL volumes can be aligned with `db/migrations` without dropping data or resetting volumes.
- The runner creates `schema_migrations` if missing, applies pending migration files once in lexicographic order, and skips filenames already recorded.
- `--dry-run` lists pending/applied status without creating the tracking table or mutating schema.
- `scripts/smoke_test.sh` now verifies the runner exists and is executable without mutating the database.

Known limits:
- Existing migrations are not rewritten to be independently rerunnable; idempotency is enforced by tracking table filename registration.
- `20260508_client_access_v1.sql` still contains the historical `DROP TABLE IF EXISTS client_users`; the runner prevents accidental second application after tracking.

Out of scope:
- No SES controlled send, frontend UI, provider event expansion, send flow, Guard logic, auth, AI, or worker changes were implemented.

Milestone 11 audit note:
- Added backend-owned `GET /unsubscribe/{token}` with signed opaque tokens, idempotent suppression, and minimal safe HTML response.
- Added `POST /events/provider` ingestion for normalized provider payloads and minimal SES/SNS-like payloads, persisting idempotent `provider_events` rows before correlated side effects.
- Campaign read models now expose provider-event-backed `opened`, `clicked`, `bounced`, `complained`, and `unsubscribed` counts when processed events exist, while keeping zero/unavailable behavior honest when they do not.

## 2026-05-13 - Milestone 10.9 admin review summary and client campaign stats

Summary:
- Implemented `GET /admin/campaigns/{campaign_id}/summary` as a Business-DB-backed read model for admin review.
- Consolidated `POST /admin/campaigns/{campaign_id}/review` to return stable readiness/sendability fields including `allowed_to_send`, `can_send_when_enabled`, `sending_enabled`, and `current_step`.
- Implemented `GET /client/campaigns/{campaign_id}` and `GET /client/campaigns/{campaign_id}/stats` as client-scoped read-only endpoints backed by `campaigns`, `campaign_contacts`, `email_logs`, `blocked_sends`, and suppression data.
- Kept provider-event-derived metrics honest: `opened`, `clicked`, `complained/spam`, and similar metrics remain `0` with unavailable source metadata when no DB-backed event data exists.

Checks:
- `docker run --rm -v "$PWD/backend:/app" -v "$PWD/templates/dist:/templates/dist:ro" -w /app sendwise-backend python -m pytest tests`
- `cd templates && npm run build`
- `cd frontend && npm run build`
- `cd frontend && npm run lint`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config`
- `git diff --check`

Scope confirmation:
- No frontend implementation was added.
- No AI, SES, provider-event ingestion, or real send-path behavior was added.
- No broad refactor or listmonk bypass was introduced.

## Milestone 10.8 Completion — Admin Campaign Recipients API

Date: 2026-05-13
Branch: develop

Verified state:
- Added `GET /admin/campaigns/{campaign_id}/contacts` for platform-admin recipient reads scoped by `campaign.client_id`.
- Added `POST /admin/campaigns/{campaign_id}/contacts` for platform-admin JSON batch import/association.
- Contact import now normalizes email with trim/lowercase, rejects invalid email syntax, deduplicates within payload, reuses existing contacts by `client_id + email`, and attaches contacts idempotently to `campaign_contacts`.
- Recipient summary now reports `total`, `valid`, `invalid`, `suppressed`, `unsubscribed`, `blacklisted`, `bounced`, `eligible`, and per-contact blocked reasons.
- `contacts_ready` is refreshed from recipient eligibility for the admin recipients flow and `review_ready` is invalidated when recipient associations change.
- Client campaign routes remain read-only; no client contacts write surface was added.
- Recipients import does not call listmonk, does not create `email_logs`, does not create `blocked_sends`, and does not trigger send or simulation side effects.

Known limits:
- CSV file upload/import was not implemented in this milestone.
- No DB unique constraint was added to `campaign_contacts`; idempotency remains enforced application-side.
- Contact classification uses current `contacts.status` plus `suppression_list`; separate boolean fields for unsubscribe/blacklist/bounce do not exist in the current schema.

Checks referenced:
- `docker run --rm -v "$PWD/backend:/app" -v "$PWD/templates/dist:/templates/dist:ro" -w /app sendwise-backend python -m pytest tests/test_admin_campaigns.py -q`

Scope confirmation:
- No frontend code was changed.
- No auth flow, onboarding, provider events, SES, AI, Mailpit dispatch path, or Docker production behavior was changed.
- No broad refactor or legacy route removal was performed.

## Milestone 10.6.5 - Campaign Contract Realignment

Date: 2026-05-13
Branch: develop
Scope: Docs-only correction of campaign ownership contracts from the Milestone 10.5 self-service direction to the binding admin-managed direction.

Files modified:
- `docs/structural_contracts_v1.md`
- `docs/api_contracts_v1.md`
- `docs/data_model_v1.md`
- `docs/states_v1.md`
- `docs/ownership_v1.md`
- `docs/audit_checklist_v1.md`
- `docs/architecture_v1.md`
- `docs/audit_log.md`

Audit summary:
- Verified runtime campaign write routes still exist under the generic backend-owned `/campaigns/*` surface.
- Verified client runtime routes remain read-only today: `GET /client/campaigns`, `GET /client/usage`, `GET /client/blocked-sends`, plus stub detail/stats.
- Verified admin runtime surfaces exist for campaign listing and client administration, while the admin campaign wizard remains contractual only.
- Verified persisted `campaign_slots`, `campaign_slot_id`, `preview_text`, `body_html`, `body_text`, `content_ready`, `contacts_ready`, `review_ready`, and `current_step` remain valid for the admin-managed model.
- Verified Deliverability Guard, Mailpit dispatch, `email_logs`, `blocked_sends`, template rendering, and listmonk mapping/sync remain unchanged and in scope.

Contract updates:
- Admin is now documented as the only V1 actor allowed to create, configure, review, simulate, and send campaigns.
- Client portal is now documented as read-only for campaign visibility, usage, blocked sends, and delivery metrics.
- Client-side write campaign endpoints were removed from the V1 contract and replaced by planned admin campaign endpoints.
- AI editorial endpoints were moved under future admin-owned routes.
- Historical self-service wording in older audit entries is superseded by this milestone.

Tests executed:
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`

Tests not executed and reason:
- `PYTHONPATH=backend pytest backend/tests` was not run because only docs were modified.
- Frontend lint/build checks were not run because no frontend files changed.

Residual risks:
- Current runtime still exposes generic `/campaigns/*` write routes, so the final admin namespaced API contract is not implemented yet.
- Historical branch handoff and audit log entries still describe the old self-service direction as past context.
- Client detail, stats, and events routes remain stub/future and do not yet deliver the full read-only contract.

Scope confirmation:
- No frontend UI was modified.
- No backend runtime route, service, repository, Guard, listmonk adapter, or auth flow was modified.
- No DB schema or migration was modified.
- No Mailpit, SMTP, SES, worker, or provider behavior was modified.

## Milestone 10.5 — Contract Alignment For Self-Service Campaigns

Date: 2026-05-13
Branch: develop

Verified state:
- Audited current campaign persistence and runtime behavior from:
- `db/init.sql`
- `backend/app/api/campaigns.py`
- `backend/app/api/client.py`
- `backend/app/services/campaigns.py`
- `backend/app/services/campaign_preparation.py`
- `backend/app/services/send_simulation.py`
- `backend/app/guard/deliverability_guard.py`
- `backend/app/repositories/clients.py`
- `backend/app/repositories/contacts.py`
- `backend/app/repositories/email_logs.py`
- `frontend/app/c/[portalSlug]/campaigns/page.tsx`
- `frontend/lib/api.ts`
- Verified current runtime contract:
- campaigns are currently persisted with `id`, `client_id`, `name`, `status`, `subject`, timestamps only
- client campaign reads are currently available through backend-owned `GET /client/campaigns`
- client campaign detail and stats routes still return stub responses
- `POST /campaigns/{campaign_id}/simulate-send` is implemented and creates `email_logs.status="simulated"`
- `POST /campaigns/{campaign_id}/send` is implemented for controlled dev dispatch and creates `email_logs.status="queued"`
- Deliverability Guard currently enforces `clients.email_limit_per_campaign` and `clients.max_campaigns`
- no persisted `campaign_slots`, `email_templates`, wizard-step flags, or final-review records exist today
- Updated contracts only:
- `docs/structural_contracts_v1.md`
- `docs/api_contracts_v1.md`
- `docs/data_model_v1.md`
- `docs/states_v1.md`
- `docs/ownership_v1.md`
- `docs/audit_checklist_v1.md`
- `docs/architecture_v1.md`
- Contract updates now document:
- client self-service campaign ownership in the portal
- backend-derived `client_id` and backend-owned Guard/review decisions
- recommended wizard steps and readiness flags
- recommended `campaign_slots` model with legacy compatibility for `email_limit_per_campaign` and `max_campaigns`
- recommended `email_templates` product model
- future AI assistant boundaries as editorial-only
- proposed future client/admin/AI endpoints clearly marked `planned` or `future`

Known limits:
- No runtime schema, API, service, frontend, or Guard implementation was changed for the new self-service flow.
- `campaign_slots` and `email_templates` remain contractual only.
- Current runtime still uses legacy campaign states including `running`, `completed`, and `failed`.
- Current runtime still stores only `subject` on campaigns and builds HTML from the technical template renderer during preparation/simulation/send.

Checks referenced:
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`

Scope confirmation:
- No DB migration was implemented.
- No backend runtime feature was implemented.
- No frontend UI flow was implemented.
- No real AI, CSV import, slot persistence, SES rollout, worker, or new integration was implemented.

## Milestone 10.7 Completion — Backend API admin campaign wizard

Date: 2026-05-13
Branch: develop

Verified state:
- Implemented admin-managed campaign write endpoints under `/admin/campaigns` for create, detail, patch, content save, slot selection, review, simulate-send, and send.
- Implemented shortcut `POST /admin/clients/{client_id}/campaigns`.
- Admin create now requires explicit `client_id`, validates Business DB client existence, and rejects non-writable client statuses `blocked`, `archived`, and `suspended`.
- Admin content updates persist `subject`, `preview_text`, `body_html`, and `body_text`, and recompute `content_ready` in Business PostgreSQL.
- Admin review now runs backend preflight without treating `EMAIL_SENDING_ENABLED=false` as a review failure; readiness and real dispatch remain distinct.
- Admin simulate/send wrappers now reuse the existing simulation and dispatch services from the namespaced admin contract.
- Client campaign routes remain read-only; no client write endpoint was added.
- Generic `/campaigns/*` runtime routes remain available as legacy/internal technical surfaces.

Known limits:
- No frontend wizard was implemented.
- No contacts import endpoint was added in this milestone.
- No AI, provider events, SES, or worker flow was implemented.

Checks referenced:
- `docker run --rm -v "$PWD/backend:/app" -v "$PWD/templates/dist:/templates/dist:ro" -w /app sendwise-backend python -m pytest tests`
- `cd templates && npm run build`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config`
- `git diff --check`

Scope confirmation:
- No frontend code was changed.
- No auth flow, onboarding, provider event, SES, AI, or Docker production behavior was changed.
- No broad refactor or legacy route removal was performed.

## Milestone 0.9E.2 Completion — Real Clerk Mapped Users Verification

Date: 2026-05-08
Branch: develop

Verified state:
- Secret-safety checks passed and no tracked or staged env-file changes were present.
- `docker compose down`, `docker compose up -d --build`, and `docker compose ps` completed successfully.
- Backend container runtime included Clerk issuer, JWKS, and auth-mapping env keys.
- Frontend container runtime included Clerk publishable-key and backend URL env keys with `NEXT_PUBLIC_USE_MOCK_API=false`.
- Signed-out runtime matched contract:
- `GET /health` returned `200`
- `GET /auth/me`, `GET /admin/clients`, and `GET /client/me` returned `401` without auth
- signed-out `/admin`, `/client`, and `/account` redirected to `/login`
- signed-out `/auth/redirect` returned safe unauthenticated behavior and routed back to `/login`
- `/login` rendered the custom Sendwise login form with no rendered signup or social login surface.
- Backend positive-path verification succeeded with real Clerk-created sessions for the mapped users:
- admin session resolved `/auth/me` to `platform_admin`, `client_id: null`, `status: active`
- admin session reached `/admin/clients` with `200`
- admin session hit `/client/me` with `403`
- client session resolved `/auth/me` to `client`, `client_id: client_demo`, `status: active`
- client session reached `/client/me` with `200`
- client session hit `/admin/clients` with `403`
- Automated checks passed:
- `PYTHONPATH=backend python3 -m pytest backend/tests`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `cd frontend && NEXT_PUBLIC_USE_MOCK_API=false NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 BACKEND_URL=http://backend:8000 npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `git diff --check`
- required boundary greps

First divergence still blocking full browser completion:
- Real Clerk bearer-auth runtime is working in FastAPI, but direct frontend page verification with a raw Clerk session cookie still resolves as signed out on the Clerk dev-instance frontend flow.
- Protected frontend pages served the signed-out login shell even when tested with:
- a real active Clerk session JWT created through the official Clerk backend SDK
- a Clerk testing token

Root cause summary:
- Symptom: positive backend auth passes, but positive frontend protected-page verification remains signed out in the non-interactive verification path.
- Expected contract: real mapped Clerk users should complete `/login` and then route through `/auth/redirect` to `/admin` or `/client`.
- First divergence: the frontend Clerk browser session was not established from the available raw HTTP injection path, so `/admin`, `/client`, `/account`, and `/auth/redirect` still rendered as signed out.
- Primary root cause: the remaining blocker is the Clerk dev-instance browser-session handshake, not the Sendwise backend auth mapping.
- Category: Docker/VPS config
- Minimal fix boundary: no verified Sendwise code fix identified in this run; completion requires a real browser-authenticated Clerk session or a Clerk-supported frontend testing helper.

Known limits:
- Real browser login through the visible `/login` form was not completed because no password or interactive verification channel was available in this environment.
- Authenticated `/account` browser UI and sign-out return flow remain unverified for the same reason.
- `frontend/components/auth/MockLoginForm.tsx` still contains dormant mock-label text outside the live route path and outside scope.

Scope confirmation:
- No DB migration was implemented.
- No `client_access` persistence was implemented.
- No Clerk invitation API, admin invite flow, onboarding endpoint, public signup, custom password form, custom 2FA, real listmonk, real sending, AI, n8n, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase was implemented.

## Milestone 12 Safety Implementation - SES Controlled Send

Date: 2026-05-13
Branch: develop

Verified state:
- Added SES controlled-send safety configuration while keeping repository defaults fail-closed: `EMAIL_SENDING_ENABLED=false` and `EMAIL_PROVIDER=mailpit`.
- Added backend SES safety gate before listmonk dispatch for runtime environment, SES SMTP completeness, public unsubscribe URL, review readiness, allowed recipients, recipient max, and prepared unsubscribe link.
- Added admin send response diagnostics for provider, safety checks, recipient counts, listmonk dispatch, real-send attempt, email log creation, unsubscribe readiness, and provider event readiness.
- Added `scripts/validate_ses_readiness.sh` and `docs/runbook_ses_controlled_send.md` for dev/staging live-test preparation without printing or committing secrets.

Known limits:
- SES live send was not validated in this implementation pass because local SES credentials and an authorized live recipient were not provided.
- SES SNS signature verification remains a follow-up.
- No frontend, AI, worker, production mass-send, or provider-event expansion was implemented.

Checks referenced:
- Backend SES safety tests are in `backend/tests/test_campaign_dispatch.py`.
- Full command results are reported in the Milestone 12 completion response for this task.

Scope confirmation:
- No secrets, local env files, frontend files, auth flow, n8n, AI, worker, or dashboard UI were changed.

## Milestone 13.1 - Runtime Provider Mode Read Model

Date: 2026-05-13
Branch: develop

Verified state:
- Added a safe runtime provider read model to admin system status and campaign read-model responses: `email_sending_enabled`, normalized `email_provider`, `provider_mode_label`, `real_send_available=false`, `ses_live_validation_status`, `provider_events_available`, and `mailpit_dev_mode`.
- Updated admin campaign/system UI labels to use backend runtime labels for Mailpit/dev, SES pending validation, sending disabled, and unavailable provider modes.
- Response tests assert the runtime shape and verify fake SMTP/AWS/Clerk secret values are not present in responses.

Known limits:
- SES live validation remains `pending`; this milestone does not validate SES live delivery.
- `real_send_available` remains false because no new live-send validation was performed.

Checks referenced:
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config`
- `bash scripts/apply_migrations.sh`
- backend tests
- frontend lint/build
- `git diff --check`

Scope confirmation:
- No send/dispatch behavior, database schema, SES enablement, secret response fields, fake metrics, direct frontend listmonk access, or broad refactor was added.

## Milestone 14 - Campaign Detail Polish And Client Stats UX

Date: 2026-05-14
Branch: develop

Implemented state:
- Polished the admin campaign list/detail-style row UI with clearer campaign status, readiness, send safety, provider runtime, recipient summary, blocked reasons, and DB/provider-backed stat wording.
- Polished the client campaign list/detail-style row UI with plain-language status, recipient stats, provider-events state, blocked-send state, and empty/unavailable states without exposing internal provider IDs or listmonk IDs.
- Added a small frontend-only campaign UI helper for shared status labels, readiness copy, recipient summaries, provider event labels, runtime safety copy, and honest log stat labels.

Files touched:
- `frontend/app/admin/campaigns/page.tsx`
- `frontend/app/c/[portalSlug]/campaigns/page.tsx`
- `frontend/components/shared/campaignUi.ts`
- `docs/audit_log.md`

Known limits:
- SES live validation 12.1 remains pending; the UI does not claim SES delivery validation.
- Full regression tests are intentionally pending for the later validation pass.

Scope confirmation:
- No backend send/dispatch logic, backend services, DB schema, n8n files, direct frontend listmonk access, local env files, secrets, fake metrics, or optimistic provider stats were added.

Checks referenced:
- Full regression intentionally not run in this task per instruction.

## Milestone 12.1 - Live SES Validation Preflight

Date: 2026-05-13
Branch: develop

Verified state:
- Live SES dispatch was not attempted because the local runtime remained fail-closed: `EMAIL_SENDING_ENABLED=false`, `EMAIL_PROVIDER=mailpit`, no SES SMTP credentials, no `AWS_SES_REGION`, no single-recipient allowlist, and `BACKEND_PUBLIC_URL=http://localhost:8000`.
- listmonk was running with dev SMTP pointed at Mailpit, not SES.
- Business PostgreSQL had no clients, campaigns, contacts, campaign-contact rows, or email logs available for a one-recipient controlled send target.
- `scripts/validate_ses_readiness.sh` was tightened to fail when `AWS_SES_REGION` is missing, runtime environment is not allowed, allowed-recipient enforcement is disabled, `REAL_SEND_MAX_RECIPIENTS` is not `1`, or the allowlist does not contain exactly one recipient.

Checks executed:
- `bash -n scripts/validate_ses_readiness.sh`
- `scripts/validate_ses_readiness.sh` against current local env, which failed safely.
- `scripts/validate_ses_readiness.sh` against dummy non-secret SES-shaped env, which passed without printing secrets.
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config`
- `bash scripts/apply_migrations.sh`
- `docker run --rm ... sendwise-backend python -m pytest tests`
- Docker Node temp-copy `npm run lint`
- Docker Node temp-copy `npm run build`
- `git diff --check`

Result:
- Milestone 12.1 is blocked by external/local runtime configuration and missing target data, not by the send service.
- No fake delivery, open, click, or provider metrics were added.
- No secrets or local env files were committed.

## Milestone 12.0R - SES Runtime Readiness Seed

Date: 2026-05-13
Branch: develop

Verified state:
- Expanded `docs/runbook_ses_controlled_send.md` with an uncommitted SES override flow using placeholders only, one-recipient allowlist requirements, public HTTPS unsubscribe requirements, listmonk API `403` diagnostics, and an exact manual validation sequence.
- Added `scripts/prepare_ses_validation_target.sh` as a validation-only Business DB target checker. It rejects missing or multiple recipients, does not create data, does not send email, does not call listmonk, and prints target IDs only when an existing client/campaign/contact relation is safe for one-recipient SES validation.
- Kept committed defaults safe: `EMAIL_SENDING_ENABLED=false`, `EMAIL_PROVIDER=mailpit`, Mailpit remains the dev default, and no local env or credential files were changed.

Known limits:
- The new target script does not create test data because review state, Guard eligibility, and prepared listmonk content must remain backend/admin-flow owned.
- Live SES validation still requires local/staging secrets, one allowlisted recipient, a verified SES from identity, public HTTPS `BACKEND_PUBLIC_URL`, working listmonk API auth, and an existing reviewed campaign target.

Checks referenced:
- `bash -n scripts/validate_ses_readiness.sh`
- `bash -n scripts/prepare_ses_validation_target.sh`
- `git diff --check`

Scope confirmation:
- No frontend, schema, campaign send logic, Deliverability Guard, credential, fake metric, provider event, or real send behavior was changed.
- No email was sent and no listmonk campaign send was triggered.

## Milestone 13 - Campaign Wizard And Stats UI Alignment

Date: 2026-05-13
Branch: develop

Verified state:
- Admin campaign list now reads the existing backend campaign summary read model for readiness flags, recipient eligibility/blocked counts, blocked-send reasons, sendability warnings, DB-backed log counts, and provider-events availability.
- Client campaign list now reads existing client-scoped campaign detail and stats endpoints for readiness, recipient counts, blocked sends, and DB/provider-backed log counts.
- Empty and neutral states were added for unavailable read models, no contacts, no eligible recipients, all recipients blocked, no provider events, and pending SES live validation.

Known limits:
- SES live validation remains pending; the UI does not claim real SES delivery validation.
- Provider mode is not exposed in the campaign read model, so the UI shows a neutral unavailable state instead of inventing it.

Checks referenced:
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config`
- `bash scripts/apply_migrations.sh`
- Docker backend pytest with `/templates/dist` mounted
- Docker frontend builder `npm run lint`
- Fresh Docker frontend image build
- `git diff --check`

Scope confirmation:
- No backend send/dispatch logic, DB schema, listmonk integration, n8n files, local env files, secrets, fake metrics, or direct frontend listmonk access were added.

## Milestone 14.7 - Campaign Setup Buttons And Horizontal Stepper Polish

Date: 2026-05-14
Branch: develop

Verified state:
- Admin campaign setup now uses a horizontal four-step setup stepper for Setup, Contenuto, Destinatari, and Review instead of the previous sticky vertical guided setup card.
- The stepper displays backend-owned readiness and current-step state only: `content_ready`, `contacts_ready`, `review_ready`, `current_step`, and the existing recipient summary when present.
- The campaign back action is a compact secondary navigation control near the header breadcrumb/title instead of a large hero action.
- Setup, contacts, review, and disabled CSV controls use consistent button sizing and page-level visual roles.

Known limits:
- SES live validation remains pending.
- Import CSV remains disabled and no send, simulate-send, dispatch, or SES enablement control was added.

Checks executed:
- `git diff --check`
- Docker frontend builder `npm run lint`
- Docker frontend builder `npm run build`
- `bash scripts/audit.sh` failed under WSL because no WSL distro is installed.
- Git Bash `scripts/audit.sh`
- `bash scripts/smoke_test.sh` failed under WSL because no WSL distro is installed.
- Git Bash `scripts/smoke_test.sh`
- `docker compose config`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config`
- Frontend direct-listmonk scan
- Touched-file fake delivered/open/click metric and send/dispatch wording scan
- Changed-file env/secret/config scope scan

Scope confirmation:
- No backend, schema, API contract, send/dispatch, Deliverability Guard, listmonk integration, local env, or secret files were changed.
- No fake delivered, open, click, click-rate, queued, sent-attempted, or provider-event metric claims were added.

## Milestone 16.2 - UI System Polish And Campaign Template Selection

Date: 2026-05-15
Branch: develop

Verified state:
- The admin campaign create flow and wizard steps now use a localized blue/azure campaign UI layer for cards, action rows, buttons, callouts, inputs, selects, and non-resizable textareas without changing backend behavior.
- The campaign content step now exposes a frontend-only template picker with five Italian presets: primo contatto commerciale, follow-up leggero, newsletter breve, annuncio prodotto, and invito consulenza/demo.
- Applying a template pre-fills `previewText`, `bodyHtml`, and `bodyText` locally only, warns before overwriting current step content, and still requires the existing save endpoint to persist changes.
- New campaign creation still creates only the draft with client, campaign name, and subject, then redirects into the edit wizard content step where template selection is available.
- The edit wizard keeps backend-owned readiness semantics intact: templates do not imply `content_ready`, review remains backend-run, and no send, simulate-send, or SES activation control was added.

UI polish summary:
- Normalized campaign-area primary/secondary button styling and heights around the existing button primitive.
- Replaced touched campaign-area olive/green emphasis with blue/azure surfaces, borders, and focus states while leaving global product theme and non-campaign auth/account flows unchanged.
- Tightened content-step labels and helper copy to `Anteprima email`, `HTML email`, and `Versione testo semplice`, with more balanced spacing and less raw-looking fields.
- Kept contacts and review panels visually aligned with the same action row and card treatment.

Known limits:
- Template presets are frontend-only convenience content and are not backend/provider/listmonk templates.
- Existing MJML files under `templates/` remain backend-owned compiled send templates and were not wired into the admin content form.
- Global shared success status badges still use semantic success coloring; this milestone only removed olive/green emphasis from the touched campaign surfaces and controls.

Checks executed:
- `git diff --check`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config`
- frontend direct-listmonk scan
- frontend direct Clerk backend API/secret usage scan
- touched-file fake delivered/open/click claim scan
- changed-file env/secret/config scope scan

Checks result:
- All listed checks passed in this workspace.
- The direct Clerk scan only returned existing Dockerfile env wiring outside the touched scope; no new direct Clerk backend API calls or secret usage were introduced by this milestone.

Scope confirmation:
- No backend code, DB schema, API contract, send/dispatch logic, Deliverability Guard, SES enablement, listmonk integration, Docker/env/config file, Clerk/auth flow, or onboarding/account runtime behavior was changed.
- No fake delivery, open, click, click-rate, queued, sent-attempted, or provider-event metric claims were added.

## Milestone 16.3 - Global Blue Theme And UI Cleanup Pass

Date: 2026-05-15
Branch: develop

Verified state:
- The shared frontend palette now uses blue/azure accent tokens across admin, client, campaign, and account surfaces instead of the previous olive/green primary accent, while keeping destructive and warning semantics intact.
- Campaign list, detail, and edit flows now use one compact header direction, smaller secondary back actions, normalized primary/secondary buttons, and reduced badge/pill noise.
- The campaign edit wizard now removes the extra guided hero copy, uses a compact blue stepper, trims tutorial text, removes the disabled advanced-import action, and keeps backend-owned readiness semantics visible with product labels only.
- Template cards are now shorter, expose one `Anteprima` action plus one `Usa modello` action, and the preview opens in a frontend modal without saving anything automatically.
- The admin dashboard now prioritizes operational data already exposed by the existing admin overview read model: active clients, campaigns needing attention, blocked sends, runtime/provider state, and clients near limits. No new endpoint or fake KPI was added.
- The Sendwise-owned account workspace is simplified into compact summary and action rows; Clerk remains contained to the existing security sheet and no auth behavior changed.

Known limits:
- SES live validation remains pending.
- Campaign send/dispatch controls remain unavailable and `EMAIL_SENDING_ENABLED` default behavior was not changed.
- Review and readiness continue to reflect backend state only; selecting a template still does not imply `content_ready`.

Checks executed:
- `git diff --check`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config`
- frontend direct-listmonk scan
- frontend direct Clerk backend API / secret usage scan
- touched-file fake delivered/open/click claim scan
- changed-file backend/env/config/send-scope scan

Checks result:
- All listed checks passed in this workspace.
- Compose validation output still exposes existing repository secrets in environment values; no Docker or env file was changed by this milestone.

Scope confirmation:
- No backend, schema, API contract, auth model, send/dispatch flow, SES enablement, listmonk integration, Docker/env/config, or frontend API boundary behavior was changed.
- No fake delivered, open, click, click-rate, queued, sent-attempted, or provider-event metric claims were added.

## Milestone 17.2B - Align UI With Campaign Sending Limits

Date: 2026-05-18
Branch: develop

Verified state:
- Client dashboard header now shows only `Bentornato, {firstName}` plus the campaigns CTA, with workspace labels, badges, descriptive copy, and header metric pills removed.
- Client dashboard KPI row now exposes exactly four cards: active campaigns, sent mail last 7 days, opened mail last 7 days, and ready campaigns. The two 7-day cards stay on `Non disponibili` unless real backend-backed windows exist, and no configured daily limit is shown to the client.
- Client dashboard main area keeps the status distribution donut, uses the neutral gray incomplete segment, removes the recent campaign list, and adds a bottom CTA to the campaigns page.
- Client side rail now keeps `Azioni richieste` and a single `Invii periodo` block that renders only real period usage from backend campaign detail models; otherwise it shows `Avvia la prima campagna per ricevere dati.`.
- Client campaigns page now keeps readiness and recipient health but uses only `periodUsage.hasRealUsage` plus `periodUsage.periodUsed` for send usage, never recipient counts, and never exposes the configured daily limit.
- Admin creation and setup continue to expose both `Limite invii 30 giorni` and `Limite invii giornaliero`, while admin detail and review keep `Invii oggi`, `Invii periodo`, remaining values, and `Periodo non ancora avviato` when no period start exists.

Checks executed:
- `git diff --check`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config`
- touched frontend file scan for direct listmonk calls
- touched frontend file scan for fake delivered/open/click/open-rate/click-rate/sent claims
- touched client file scan for `daily_email_limit` or `Limite invii giornaliero`
- changed file scan for env/secrets/config changes

Scope confirmation:
- No backend, schema, API contract, auth model, send/dispatch flow, SES enablement, listmonk integration, Docker/env/config, or secrets were changed.
- No fake sent, delivered, opened, clicked, open-rate, or click-rate metrics were added.

## Milestone 17.1 - Client Dashboard Product Polish

Date: 2026-05-16
Branch: develop

Verified state:
- The client dashboard route now composes the portal view directly from `GET /client/overview` plus existing per-campaign read models for recent campaigns only, so the page stays tied to backend-backed campaign state, recipient readiness, blocked sends, usage totals, and provider-event availability without inventing trends or delivery claims.
- The hero was reduced to workspace identity, one concise operational status, and a single primary action to open campaigns.
- The top summary now uses four compact cards only: campaigns ready, campaigns to complete, campaigns needing attention, and campaign capacity versus configured limit.
- The main dashboard card now renders a real status distribution bar from backend campaign counts and a recent campaign list enriched with readiness, eligible recipients, blocked recipients, and provider-event availability when exposed.
- The side rail now focuses on readiness signals from recent campaign read models, configured limits, current-period usage labels, blocked sends, and one recommended next action.
- Raw usage keys are translated into product labels and blocked-send reasons reuse the shared readable-reason mapping when available.

Checks executed:
- `git diff --check`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config`
- touched dashboard file scan for direct listmonk calls
- touched dashboard file scan for fake delivered/open/click claims

Checks result:
- All listed checks passed in this workspace.
- `docker compose up -d` confirmed the frontend, backend, postgres, listmonk, and mailpit containers were already running.
- Browser-based positive-path QA for a valid authenticated client route was not completed here because the local Playwright browser dependency is unavailable and no reusable client login session or credentials are present in this workspace.

Scope confirmation:
- No backend, schema, API contract, auth model, send/dispatch flow, SES enablement, listmonk integration, Docker/env/config, or frontend API boundary behavior was changed.
- No fake delivered, open, click, click-rate, queued, sent-attempted, or time-series trend claims were added.

## Milestone 18.6J - Public Unsubscribe Screen And Issue #2 Fix

Date: 2026-05-20
Branch: develop

Verified state:
- Addresses issue #2.
- Audited campaign unsubscribe link generation and confirmed the previous path was backend-owned: campaign preparation built unsubscribe URLs from `BACKEND_PUBLIC_URL`, so recipients were sent to the raw backend endpoint instead of a public frontend screen.
- Added a frontend public unsubscribe page at `/unsubscribe/[token]` with confirmation, loading, success, already-unsubscribed, invalid-link, and temporary-unavailable states using controlled copy only.
- Added `POST /unsubscribe/{token}` as a backend JSON endpoint for the frontend page while keeping `GET /unsubscribe/{token}` as the safe HTML fallback/backward-compatible endpoint.
- Kept unsubscribe write-side ownership in the backend: valid tokens still record `sendwise_unsubscribe`, update contact state to `unsubscribed`, and persist suppression state idempotently.
- Campaign-generated unsubscribe links now use `FRONTEND_URL` and no longer generate raw backend unsubscribe links for new emails.
- No schema change or migration was required.
- No hardcoded `api.mailerpro.it` path was introduced in changed code.

Checks executed:
- `git diff --check`
- targeted backend unsubscribe/provider-event/campaign preparation/dispatch tests
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `SENDWISE_ENV_FILE=.env.example docker compose --env-file .env.example config`
- `SENDWISE_ENV_FILE=.env.example docker compose --env-file .env.example -f docker-compose.yml -f docker-compose.dev.yml config`
- changed-file scan for `api.mailerpro.it`
- changed-file scan for fake delivered/open/click claims
- changed-file scan for direct Listmonk/SES shortcut paths
- changed-file scan for env/secrets edits

Scope confirmation:
- No DB reset, schema migration, Docker volume deletion, destructive DB command, direct Listmonk send, direct SES send, fake metric path, suppression bypass, or unsubscribe bypass was introduced.

## Milestone 16.9C - Contact Attach, Email Preview UX And Review Diagnostics

Date: 2026-05-15
Branch: develop

Verified state:
- The browser campaign API bundle was audited against the built frontend artifact and the contact/review actions were pointing to `http://localhost:8000` in client-side runtime code. This is a true fetch/network failure whenever the frontend is opened from a non-localhost hostname, so the contact modal and review step were surfacing real network copy rather than an HTTP backend response.
- Browser API base resolution now rewrites localhost-only frontend runtime targets to the current browser hostname before issuing client-side admin campaign requests, while server-side calls continue using `BACKEND_URL`.
- Manual contact save and review keep the browser/network copy only for real fetch failures; HTTP 4xx/5xx responses now stay inside controlled backend error copy instead of collapsing into network messaging.
- The manual contact modal keeps the compact layout but removes the extra left inset so full email addresses stay visible across the field width.
- Step 2 now uses one large editor surface with `HTML` and `Preview` modes, keeps `Anteprima email` above the editor, renders preview content inside a sandboxed iframe, and safely derives `body_text` from HTML when saving if the HTML changed.
- Template preview keeps the preview text block, renders the HTML preview in a sandboxed iframe, and uses a styled close icon button aligned with the rest of the Sendwise modal system.

Scope confirmation:
- No backend, schema, API contract, auth model, send/dispatch flow, SES enablement, listmonk integration, Docker/env/config, or deliverability guard policy was changed.
- The only frontend API-layer change is browser-side base URL resolution for admin campaign requests when a localhost-only build target would otherwise cause a fetch failure.
- No fake readiness, personalization, delivered, open, click, click-rate, queued, sent-attempted, or provider-event metric claims were added.

## Milestone 16.9 - Contact Names And Compact Templates

Date: 2026-05-15
Branch: develop

Verified state:
- `POST /admin/campaigns/{campaign_id}/contacts` uses `{ "contacts": [{ "email": string, "metadata": { "nome": string, "cognome"?: string } }] }` and rejects rows missing `metadata.nome`.
- Contact name metadata is now persisted in `contacts.metadata`, refreshed when an existing client contact is reused with newer `nome` / `cognome`, and sent to listmonk subscriber attributes as `attribs.nome` / `attribs.cognome`.
- Campaign preparation converts only `{{nome}}` and `{{cognome}}` into listmonk subscriber attribute syntax and leaves unsubscribe token handling unchanged.
- Unsupported unresolved `{{...}}` placeholders are blocked at save time with `Completa o rimuovi le variabili del template prima di salvare.`
- Admin contacts UI now uses a manual contact modal plus CSV import, and template cards were compacted with corrected category badge styling.

## Milestone 16.8B - Restore Campaign Header Blue Card

Date: 2026-05-15
Branch: develop

Verified state:
- The shared campaign page header for both detail and edit modes no longer uses the plain white override introduced during the review diagnostics cleanup; it now uses the existing light blue/azure campaign surface treatment with a subtle blue border and restrained shadow.
- The `Torna alle campagne` action was moved outside and above the header card so the header can keep the blue treatment without reintroducing a pill-style control inside the card.
- The read-only detail summary card was restored from `campaign-panel--subtle` to the existing `campaign-panel` treatment so the primary campaign summary surface is visually consistent with the campaign header direction.

Checks executed:
- `git diff --check`
- `cd frontend && npm run lint`
- `cd frontend && npm run build`
- `bash scripts/audit.sh`
- `bash scripts/smoke_test.sh`
- `docker compose config`
- `docker compose -f docker-compose.yml -f docker-compose.dev.yml config`
- touched frontend file scan for direct listmonk calls
- touched frontend file scan for fake delivered/open/click claims
- changed file scan for env/secrets/config changes

Scope confirmation:
- No backend, schema, API contract, auth model, send/dispatch flow, SES enablement, listmonk integration, Docker/env/config, or frontend API boundary behavior was changed.
- No fake delivered, open, click, click-rate, queued, sent-attempted, or provider-event metric claims were added.

## Milestone 18.1B - Align README With Current Repository State

Date: 2026-05-19
Branch: develop

Verified state:
- README was updated as public/reference documentation instead of agent startup context.
- Stale skeleton/simulation-only wording was replaced with current local runtime status for campaign-level limits, Deliverability Guard enforcement, backend-backed client dashboard analytics, contact metadata, unsubscribe handling, and staging assets.
- Sending-limit wording now states that limits are per campaign through `campaign_sending_limits`, with `period_email_limit` as the 30-day campaign limit and `daily_email_limit` as admin/internal pacing that must stay hidden from client dashboard responses.
- Dashboard wording now states that business metrics are backend-owned through `client_dashboard`, with windows `24h`, `7d`, `14d`, `30d`, and `allTime`, and no frontend-synthesized sent/open/block metrics.
- VPS staging and backup/restore sections now link to `docs/runbook_vps_staging.md` and `docs/runbook_backup_restore.md` instead of duplicating full runbooks.
- Safety wording now preserves a no-send first staging posture with `EMAIL_SENDING_ENABLED=false`, no direct listmonk/SES shortcut, and no committed env or secret files.

Checks executed:
- `git diff --check`
- README referenced-file existence check for staging runbook, backup/restore runbook, API contracts, data model, staging compose, backup script, and restore-check script
- README diff scan for secret-like values and forbidden claims
- README markdown/link sanity check by inspection

Scope confirmation:
- Only `README.md` and `docs/audit_log.md` were modified.
- No backend, frontend, schema, migration, Docker, env, secret, config, send, SES, or listmonk action was performed.
