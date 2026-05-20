# API Contracts V1

Source of truth: `project_handoff_v1.md`.

Status values:

- `implemented`: route exists and has verified backend behavior
- `stub`: route exists but returns placeholder/non-final behavior
- `planned`: contract exists; implementation comes later
- `future`: outside near-term implementation

All product APIs must be called through FastAPI. Frontend and external callers must not call listmonk directly.

## Global Trust Rules

- backend resolves trusted `client_id` from authenticated identity mapping
- only admin campaign-write endpoints may accept a user-selected `client_id`, and backend must validate it
- frontend never sends a trusted `client_id` for client-scoped operations
- frontend never sends a trusted Guard result, slot limit, or provider choice
- review endpoints are advisory/preflight only
- send endpoints remain backend-authorized operations

## Auth

| Endpoint | Purpose | Allowed caller | Required access | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `GET /auth/me` | Resolve authenticated Sendwise access context for post-login routing and portal gating. | Authenticated frontend. | Active platform admin or active client account. | Clerk bearer token. | `access_type`, backend-owned `client_id`, `email`, `status`, `portal_slug`, onboarding flags. | `401`, `403`. | `implemented` |

## Health

| Endpoint | Purpose | Allowed caller | Required access | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `GET /health` | Service health check. | Ops and developers. | None. | None. | Status and service metadata. | `500`. | `implemented` |

## Admin Clients

| Endpoint | Purpose | Allowed caller | Required access | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `GET /admin/clients` | List clients. | Admin dashboard. | Platform admin. | Filters, pagination. | Client summaries. | `401`, `403`. | `implemented` |
| `POST /admin/clients` | Create/invite a client profile. | Admin dashboard. | Platform admin. | `email`, optional profile fields. | Client profile plus access summary. | `400`, `401`, `403`, `409`, `422`. | `implemented` |
| `GET /admin/clients/{client_id}` | Read client detail. | Admin dashboard. | Platform admin. | `client_id`. | Client detail and access summary. | `401`, `403`, `404`. | `implemented` |
| `PATCH /admin/clients/{client_id}` | Update client profile and current legacy limits. | Admin dashboard. | Platform admin. | `client_id`, partial profile and limit fields. | Updated client profile. | `400`, `401`, `403`, `404`, `409`. | `implemented` |
| `POST /admin/clients/{client_id}/invite-access` | Re-issue access invite. | Admin dashboard. | Platform admin. | `client_id`. | Refreshed access state. | `400`, `401`, `403`, `404`, `409`, `422`. | `implemented` |
| `POST /admin/clients/{client_id}/revoke-access` | Revoke pending access. | Admin dashboard. | Platform admin. | `client_id`. | Updated access state. | `401`, `403`, `404`, `409`. | `implemented` |
| `POST /admin/clients/{client_id}/archive` | Archive client and access. | Admin dashboard. | Platform admin. | `client_id`. | Archived client state. | `401`, `403`, `404`, `409`. | `implemented` |
| `GET /admin/clients/{client_id}/campaigns` | List campaigns for a client. | Admin dashboard. | Platform admin. | `client_id`, filters. | Campaign summaries. | `401`, `403`, `404`. | `stub` |
| `GET /admin/clients/{client_id}/usage` | View usage for a client. | Admin dashboard. | Platform admin. | `client_id`, date range. | Usage records. | `401`, `403`, `404`. | `stub` |
| `GET /admin/clients/{client_id}/blocked-sends` | View blocked sends for a client. | Admin dashboard. | Platform admin. | `client_id`, filters. | Blocked send records. | `401`, `403`, `404`. | `stub` |

Admin request notes:

- admin endpoints remain platform-admin only
- client-scoped limits edited here are still legacy fields today
- slot-management endpoints below are proposed and not yet implemented

## Admin Campaigns

| Endpoint | Purpose | Allowed caller | Required access | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `GET /admin/overview` | Read admin operational summary. | Admin dashboard. | Platform admin. | None. | Client, campaign, send, system summaries. | `401`, `403`. | `implemented` |
| `GET /admin/campaigns` | List all campaigns. | Admin dashboard. | Platform admin. | Filters, pagination. | Campaign summaries. | `401`, `403`. | `implemented` |
| `GET /admin/email-limits` | Read current limit overview based on legacy fields and usage summaries. | Admin dashboard. | Platform admin. | None. | Limit dashboard summary. | `401`, `403`. | `implemented` |
| `GET /admin/blocked-sends` | View blocked sends across clients. | Admin dashboard. | Platform admin. | Filters. | Blocked send records. | `401`, `403`. | `implemented` |
| `GET /admin/campaigns/{campaign_id}` | Read campaign detail. | Admin dashboard. | Platform admin. | `campaign_id`. | Campaign detail. | `401`, `403`, `404`. | `implemented` |
| `POST /admin/campaigns/{campaign_id}/pause` | Pause campaign. | Admin dashboard. | Platform admin. | `campaign_id`, reason. | Updated campaign state. | `401`, `403`, `404`, `409`. | `stub` |
| `POST /admin/campaigns/{campaign_id}/resume` | Resume campaign. | Admin dashboard. | Platform admin. | `campaign_id`, reason. | Updated campaign state. | `401`, `403`, `404`, `409`. | `stub` |

## Client Portal Current Endpoints

| Endpoint | Purpose | Allowed caller | Required access | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `GET /client/me` | Read current client context. | Client portal. | Active client account. | Auth context. | Client profile and access summary. | `401`, `403`. | `implemented` |
| `GET /client/overview` | Read client overview summary. | Client portal. | Active client account. | Auth context. | Client dashboard summary plus backend-owned `client_dashboard` analytics windows and KPI state. | `401`, `403`. | `implemented` |
| `GET /client/campaigns` | List campaigns owned by the authenticated client. | Client portal. | Active client account. | Filters, pagination. | Client-scoped campaign summaries. | `401`, `403`. | `implemented` |
| `GET /client/campaigns/{campaign_id}` | Read own campaign detail. | Client portal. | Active client account. | `campaign_id`. | Client-scoped campaign read model with readiness, recipient counts, log counts, and blocked sends. | `401`, `403`, `404`. | `implemented` |
| `GET /client/campaigns/{campaign_id}/stats` | Read own campaign stats. | Client portal. | Active client account. | `campaign_id`. | DB-backed campaign metrics only; unsupported provider metrics stay `0` with unavailable source metadata. | `401`, `403`, `404`. | `implemented` |
| `GET /client/usage` | Read own usage. | Client portal. | Active client account. | Date range. | Client-scoped usage records. | `401`, `403`. | `implemented` |
| `GET /client/blocked-sends` | Read own blocked sends. | Client portal. | Active client account. | Filters. | Client-scoped blocked-send records. | `401`, `403`. | `implemented` |

Current contract note:

- today the client can read campaigns and dashboard data
- today the client cannot create or edit campaigns through dedicated client endpoints
- client scoping comes from auth + backend mapping, not from frontend input
- business metrics shown on the client dashboard are backend-owned through `client_dashboard`; the frontend may format and switch windows but must not derive send/open/block metrics from unrelated fields
- `client_dashboard.kpis.active_campaigns.value` uses `running` campaigns only; `ready` campaigns never consume active capacity
- `client_dashboard.performance_analytics.windows` exposes `24h`, `7d`, `14d`, `30d`, and `allTime` with backend counts for `sent`, `queued`, `blocked`, and provider-event-backed `opened`
- `client_dashboard.period_usage` mirrors the backend default dashboard window and is intended for compact send-activity UI only
- unavailable metric sources must remain `null` with `available=false`; real zero-row send/block windows may remain `0` with `available=true`, while provider-event-backed windows stay unavailable until processed events exist
- `delivered`, `opened`, `clicked`, `bounced`, `complained`, and `unsubscribed` campaign metrics are provider-event-backed only, `blocked` metrics are `blocked_sends` rows only, and client daily pacing limits stay hidden from client responses

## Campaign Runtime Endpoints Current

These are backend-owned technical routes currently present in the runtime as legacy/internal compatibility surfaces beside the product-facing admin namespace.

| Endpoint | Purpose | Allowed caller | Required access | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `POST /campaigns` | Create campaign draft through the current generic runtime surface. | Backend-owned runtime caller. | Active user. | Campaign draft fields. | Placeholder result. | `400`, `401`, `403`, `409`. | `stub` |
| `POST /campaigns/{campaign_id}/authorize` | Run send authorization through the current generic runtime surface. | Backend-owned runtime caller. | Active user. | `campaign_id`. | Placeholder result. | `400`, `401`, `403`, `404`, `409`, `423`. | `stub` |
| `POST /campaigns/{campaign_id}/sync-listmonk` | Prepare listmonk technical entities for a campaign. | Backend-owned runtime caller. | Active user with backend-owned scope. | `campaign_id`. | Preparation result, list mappings, content readiness. | `400`, `401`, `403`, `404`, integration failures. | `implemented` |
| `POST /campaigns/{campaign_id}/simulate-send` | Run backend preflight plus simulation log creation without real dispatch. | Backend-owned runtime caller. | Active user with backend-owned scope. | `campaign_id`. | Simulation result, Guard payload, content snapshot, email-log summary. | `400`, `401`, `403`, `404`, `409`, `423`. | `implemented` |
| `POST /campaigns/{campaign_id}/send` | Trigger controlled dev dispatch after backend checks. | Backend-owned runtime caller. | Active user with backend-owned scope. | `campaign_id`. | Blocked, failed, or accepted controlled-dispatch result. | `400`, `401`, `403`, `404`, `409`, `423`. | `implemented` |

Current runtime notes:

- real dispatch still depends on `EMAIL_SENDING_ENABLED=true`
- send remains fail-closed outside controlled runtime/provider conditions
- current generic routes do not define the final product ownership model and are not the recommended frontend path
- final V1 product contract remains admin-managed for campaign write actions

## Admin-Managed Campaign API Proposed

These are the V1 product endpoints for the only operational campaign flow. Entries still marked `planned` remain out of scope for this milestone.

| Endpoint | Purpose | Allowed caller | Required access | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `GET /admin/campaigns` | List campaigns across clients. | Admin dashboard. | Platform admin. | Filters, pagination. | Campaign summaries. | `401`, `403`. | `implemented` |
| `POST /admin/campaigns` | Create a new admin-managed campaign draft. | Admin dashboard. | Platform admin. | Selected `client_id`, setup fields. | Created draft campaign. | `400`, `401`, `403`, `404`, `409`, `422`. | `implemented` |
| `POST /admin/clients/{client_id}/campaigns` | Shortcut to create a campaign from a client context. | Admin dashboard. | Platform admin. | Setup fields. | Created draft campaign already scoped to the client. | `400`, `401`, `403`, `404`, `409`, `422`. | `implemented` |
| `GET /admin/campaigns/{campaign_id}` | Read admin campaign detail. | Admin dashboard. | Platform admin. | `campaign_id`. | Campaign detail. | `401`, `403`, `404`. | `implemented` |
| `GET /admin/campaigns/{campaign_id}/summary` | Read final admin campaign summary without dispatching. | Admin dashboard. | Platform admin. | `campaign_id`. | Campaign, client, slot, recipient, log, blocked-send, and sendability summary. | `401`, `403`, `404`. | `implemented` |
| `PATCH /admin/campaigns/{campaign_id}` | Update allowed campaign setup fields. | Admin dashboard. | Platform admin. | Partial setup fields. | Updated campaign. | `400`, `401`, `403`, `404`, `409`, `422`. | `implemented` |
| `POST /admin/campaigns/{campaign_id}/select-slot` | Assign a slot to a campaign. | Admin dashboard. | Platform admin. | `slot_id`. | Slot assignment summary. | `400`, `401`, `403`, `404`, `409`, `422`. | `implemented` |
| `POST /admin/campaigns/{campaign_id}/content` | Save content or apply a template into campaign content fields. | Admin dashboard. | Platform admin. | `subject`, `preview_text`, `body_html`, `body_text`, optional template reference. | Updated campaign content state. | `400`, `401`, `403`, `404`, `409`, `422`. | `implemented` |
| `POST /admin/campaigns/{campaign_id}/contacts` | Import or associate contacts for the campaign. | Admin dashboard. | Platform admin. | Structured contact payload. | Import summary and validation preview. | `400`, `401`, `403`, `404`, `409`, `422`. | `implemented` |
| `GET /admin/campaigns/{campaign_id}/contacts` | Read contacts associated with the campaign. | Admin dashboard. | Platform admin. | `campaign_id`. | Campaign contact list and summary. | `401`, `403`, `404`. | `implemented` |
| `DELETE /admin/campaigns/{campaign_id}/contacts/{contact_id}` | Remove a contact association from the campaign without deleting the saved contact. | Admin dashboard. | Platform admin. | `campaign_id`, backend-owned `contact_id`. | Controlled detach result with backend-owned readiness. | `401`, `403`, `404`, `409`. | `implemented` |
| `POST /admin/campaigns/{campaign_id}/review` | Build final review payload without dispatching. When preflight passes for a configured draft, the backend marks the campaign `ready` and `review_ready=true` without sending. | Admin dashboard. | Platform admin. | `campaign_id`. | Stable readiness/sendability payload including current status, kill-switch state, warnings, blocking errors, counts, current step, and slot limit. | `400`, `401`, `403`, `404`, `409`, `422`. | `implemented` |
| `POST /admin/campaigns/{campaign_id}/simulate-send` | Request backend simulation from the admin flow. | Admin dashboard. | Platform admin. | `campaign_id`. | Simulation result. | `400`, `401`, `403`, `404`, `409`, `423`. | `implemented` |
| `POST /admin/campaigns/{campaign_id}/send` | Request controlled send from the admin flow. | Admin dashboard. | Platform admin. | `campaign_id`. | Blocked, failed, or accepted send result. | `400`, `401`, `403`, `404`, `409`, `423`. | `implemented` |

Admin-managed contract notes:

- only admin selects `client_id`
- backend validates selected `client_id` and client status on every write action
- admin may assign `campaign_slot_id`, save content, associate/import contacts, request review, simulate, and send
- `POST /admin/campaigns` and `PATCH /admin/campaigns/{campaign_id}` accept campaign-scoped `period_email_limit` and `daily_email_limit`
- `GET /admin/campaigns/{campaign_id}/summary` returns backend-owned `can_send`, `can_send_when_enabled`, and `sending_enabled` so the admin UI can distinguish review readiness from runtime send gating
- admin summary, review, and send responses expose campaign usage metadata: `daily_limit`, `daily_used`, `daily_remaining`, `period_limit`, `period_used`, `period_remaining`, `period_started_at`, and `period_ends_at`
- admin review remains non-dispatching, but it may promote a draft campaign to `ready` only after content, recipients, and Deliverability Guard checks all pass
- `POST /admin/campaigns/{campaign_id}/contacts` accepts `{ "contacts": [{ "email": string, "metadata": { "nome": string, "cognome"?: string } }] }`
- `DELETE /admin/campaigns/{campaign_id}/contacts/{contact_id}` removes only the `campaign_contacts` association, keeps the underlying `contacts` row and suppression data untouched, and returns backend-owned `contacts_ready`
- Guard remains mandatory for simulation and real dispatch
- `EMAIL_SENDING_ENABLED` remains the real-dispatch kill switch
- `EMAIL_PROVIDER=ses` adds a backend safety gate requiring explicit dev/staging runtime, complete SES SMTP env, public unsubscribe URL, review readiness, optional allowlist enforcement, and an optional positive recipient max before listmonk dispatch
- SES trial readiness outside the API also requires verified identity/domain, DKIM, SPF, DMARC, SES production access for non-verified recipients, and correct SES SMTP credentials in Listmonk
- controlled send responses include provider and safety diagnostics such as `provider_status`, `queued_count`, `sent_or_accepted_count`, `failed_count`, `safety_checked`, `safety_passed`, `allowed_recipients_checked`, `eligible_contact_count`, `max_real_send_recipients`, `listmonk_dispatched`, `real_send_attempted`, `email_logs_created`, `unsubscribe_ready`, and `provider_events_ready`
- Deliverability Guard blocks campaign dispatch with `campaign_daily_limit_reached` and `campaign_period_limit_reached` when campaign usage would exceed the configured table-backed limits
- First SES validation may keep `REAL_SEND_MAX_RECIPIENTS=1` and `REAL_SEND_REQUIRE_ALLOWED_RECIPIENTS=true`; official product trials should use `REAL_SEND_MAX_RECIPIENTS=0` and `REAL_SEND_REQUIRE_ALLOWED_RECIPIENTS=false`
- Campaign limits configured by admins are the real product limits; `EMAIL_SENDING_ENABLED=false` remains the emergency global off switch
- listmonk remains a technical engine only
- campaign preparation sets `from_email` from `SMTP_FROM_EMAIL`; no separate Reply-To contract is surfaced today

## Client Read-Only Campaign API Contract

These are the V1 client-facing campaign routes. They are read-only and scoped by backend-derived `client_id`.

| Endpoint | Purpose | Allowed caller | Required access | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `GET /client/campaigns` | List own campaigns. | Client portal. | Active client account. | Filters. | Campaign summaries. | `401`, `403`. | `implemented` |
| `GET /client/campaigns/{campaign_id}` | Read own campaign detail. | Client portal. | Active client account. | `campaign_id`. | Full client-scoped campaign read model with available DB-backed metrics. | `401`, `403`, `404`. | `implemented` |
| `GET /client/campaigns/{campaign_id}/stats` | Read own campaign stats. | Client portal. | Active client account. | `campaign_id`. | Send counts and delivery metrics only when backed by Business DB data. | `401`, `403`, `404`. | `implemented` |
| `GET /client/campaigns/{campaign_id}/events` | Read own campaign timeline and delivery events when available. | Client portal. | Active client account. | `campaign_id`, filters. | Client-scoped event list. | `401`, `403`, `404`. | `future` |
| `GET /client/blocked-sends` | Read own blocked sends. | Client portal. | Active client account. | Filters. | Client-scoped blocked-send records. | `401`, `403`. | `implemented` |
| `GET /client/usage` | Read own usage. | Client portal. | Active client account. | Date range. | Client-scoped usage records. | `401`, `403`. | `implemented` |

Client read-only notes:

- V1 client routes do not create, edit, delete, import, simulate, send, assign slots, or mutate templates
- backend derives `client_id` from auth and `client_access`
- backend denies cross-client access even for read-only campaign data
- client-visible metrics may include queued, sent, delivered, opens, clicks, bounce, complaint/spam, unsubscribe, blocked sends, and period usage only when backed by real logs or provider events
- client responses must not expose configured `daily_email_limit`

## Admin Template API Future

Client-side template CRUD is not part of V1. If template catalog management is introduced later, it belongs under admin-owned routes.

| Endpoint | Purpose | Allowed caller | Required access | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `GET /admin/templates` | List templates available to admins. | Admin dashboard. | Platform admin. | Filters. | System and client-scoped template summaries. | `401`, `403`. | `future` |
| `POST /admin/templates` | Create a template for later campaign use. | Admin dashboard. | Platform admin. | Template fields. | Created template. | `400`, `401`, `403`, `409`, `422`. | `future` |
| `PATCH /admin/templates/{template_id}` | Update a template. | Admin dashboard. | Platform admin. | Partial template fields. | Updated template. | `400`, `401`, `403`, `404`, `409`, `422`. | `future` |

## Campaign Slot Admin API Proposed

| Endpoint | Purpose | Allowed caller | Required access | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `GET /admin/clients/{client_id}/campaign-slots` | List campaign slots for a client. | Admin dashboard. | Platform admin. | `client_id`. | Slot summaries. | `401`, `403`, `404`. | `future` |
| `POST /admin/clients/{client_id}/campaign-slots` | Create a slot for a client. | Admin dashboard. | Platform admin. | `label`, `max_emails`, status fields. | Created slot. | `400`, `401`, `403`, `404`, `409`, `422`. | `future` |
| `PATCH /admin/clients/{client_id}/campaign-slots/{slot_id}` | Update slot policy. | Admin dashboard. | Platform admin. | Partial slot fields. | Updated slot. | `400`, `401`, `403`, `404`, `409`, `422`. | `future` |
| `POST /admin/clients/{client_id}/campaign-slots/{slot_id}/archive` | Archive a slot. | Admin dashboard. | Platform admin. | `slot_id`. | Archived slot state. | `401`, `403`, `404`, `409`. | `future` |

## AI Editorial Assist API Proposed

| Endpoint | Purpose | Allowed caller | Required access | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `POST /admin/campaigns/{campaign_id}/ai/generate` | Generate draft email content from brief. | Admin dashboard. | Platform admin. | Brief and content options. | Structured proposed content. | `400`, `401`, `403`, `404`, `409`, `422`. | `future` |
| `POST /admin/campaigns/{campaign_id}/ai/improve` | Improve existing content. | Admin dashboard. | Platform admin. | Current content and intent. | Structured suggested revision. | `400`, `401`, `403`, `404`, `409`, `422`. | `future` |
| `POST /admin/campaigns/{campaign_id}/ai/subject-variants` | Propose subject variants. | Admin dashboard. | Platform admin. | Current campaign content. | Subject option list. | `400`, `401`, `403`, `404`, `409`, `422`. | `future` |
| `POST /admin/campaigns/{campaign_id}/ai/review-content` | Analyze content risk without sending. | Admin dashboard. | Platform admin. | Current campaign content. | Risk notes and improvements. | `400`, `401`, `403`, `404`, `409`, `422`. | `future` |

AI contract notes:

- AI output is advisory and must be user-applied
- AI cannot authorize send, assign limits, or publish automatically
- future calls should be tracked in `api_usage`

## Contacts Current And Proposed

| Endpoint | Purpose | Allowed caller | Required access | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `POST /contacts/import` | Import contacts through the current generic runtime surface. | Backend-owned runtime caller. | Active user. | File or batch metadata. | Placeholder result. | `400`, `401`, `403`, `409`, `413`. | `stub` |
| `GET /contacts` | List contacts visible to caller. | Admin or active client caller. | Active user. | Filters. | Placeholder result. | `401`, `403`. | `stub` |
| `POST /contacts/{contact_id}/sync` | Sync a contact to listmonk. | Admin or active client caller. | Active user. | `contact_id`, optional `campaign_id`. | Sync result. | `400`, `401`, `403`, `404`. | `implemented` |
| `POST /contacts/{contact_id}/suppress` | Suppress contact. | Admin or active client caller. | Active user. | `contact_id`, reason. | Placeholder result. | `401`, `403`, `404`, `409`. | `stub` |

Contacts notes:

- V1 campaign contact import/association belongs to admin-managed campaign endpoints, not client write routes
- client portal may read campaign outcomes and metrics, but not mutate contact membership for campaigns

## Events

| Endpoint | Purpose | Allowed caller | Required access | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `GET /unsubscribe/{token}` | Public Sendwise-managed unsubscribe endpoint for direct/backward-compatible access. | Email recipient. | None. | Signed opaque token and optional `campaign_id`. | Minimal safe HTML confirmation and backend-owned suppression side effects. | `400`, `503`. | `implemented` |
| `POST /unsubscribe/{token}` | Backend JSON endpoint used by the frontend public unsubscribe page. | Frontend public page. | None. | Signed opaque token. | Controlled JSON state for success, already-unsubscribed, invalid-token, or temporary-unavailable flows. | `400`, `503`. | `implemented` |
| `POST /events/listmonk` | Receive supported listmonk event payloads. | listmonk. | Webhook secret or API key. | Event payload. | Accepted unsubscribe ingestion for supported normalized payloads; unsupported payloads are ignored. | `400`, `401`, `403`, `409`. | `implemented` |
| `POST /events/provider` | Receive normalized provider events and minimal SES/SNS-like payloads. | SMTP/provider webhook. | Webhook secret or API key. | Event payload. | Accepted idempotent event persistence plus correlated email-log, suppression, and campaign-metric side effects when resolvable. | `400`, `401`, `403`, `409`. | `implemented` |

Event limitations:

- SES SNS signature verification is not implemented yet.
- SES SNS `SubscriptionConfirmation` handling is not implemented yet.
- Provider-event-backed metrics and suppression side effects depend on normalized events that can be correlated to existing logs/contacts.
