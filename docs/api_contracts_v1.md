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
| `GET /admin/campaigns/{campaign_id}` | Read campaign detail. | Admin dashboard. | Platform admin. | `campaign_id`. | Campaign detail. | `401`, `403`, `404`. | `stub` |
| `POST /admin/campaigns/{campaign_id}/pause` | Pause campaign. | Admin dashboard. | Platform admin. | `campaign_id`, reason. | Updated campaign state. | `401`, `403`, `404`, `409`. | `stub` |
| `POST /admin/campaigns/{campaign_id}/resume` | Resume campaign. | Admin dashboard. | Platform admin. | `campaign_id`, reason. | Updated campaign state. | `401`, `403`, `404`, `409`. | `stub` |

## Client Portal Current Endpoints

| Endpoint | Purpose | Allowed caller | Required access | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `GET /client/me` | Read current client context. | Client portal. | Active client account. | Auth context. | Client profile and access summary. | `401`, `403`. | `implemented` |
| `GET /client/overview` | Read client overview summary. | Client portal. | Active client account. | Auth context. | Client dashboard summary. | `401`, `403`. | `implemented` |
| `GET /client/campaigns` | List campaigns owned by the authenticated client. | Client portal. | Active client account. | Filters, pagination. | Client-scoped campaign summaries. | `401`, `403`. | `implemented` |
| `GET /client/campaigns/{campaign_id}` | Read own campaign detail. | Client portal. | Active client account. | `campaign_id`. | Campaign detail if owned by caller's client. | `401`, `403`, `404`. | `stub` |
| `GET /client/campaigns/{campaign_id}/stats` | Read own campaign stats. | Client portal. | Active client account. | `campaign_id`. | Campaign stats if owned by caller's client. | `401`, `403`, `404`. | `stub` |
| `GET /client/usage` | Read own usage. | Client portal. | Active client account. | Date range. | Client-scoped usage records. | `401`, `403`. | `implemented` |
| `GET /client/blocked-sends` | Read own blocked sends. | Client portal. | Active client account. | Filters. | Client-scoped blocked-send records. | `401`, `403`. | `implemented` |

Current contract note:

- today the client can read campaigns and dashboard data
- today the client cannot create or edit campaigns through dedicated client endpoints
- client scoping comes from auth + backend mapping, not from frontend input

## Campaign Runtime Endpoints Current

These are backend-owned campaign operations not yet shaped as the final self-service client API.

| Endpoint | Purpose | Allowed caller | Required access | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `POST /campaigns` | Create campaign draft. | Admin or active client caller. | Active user. | Campaign draft fields. | Placeholder result. | `400`, `401`, `403`, `409`. | `stub` |
| `POST /campaigns/{campaign_id}/authorize` | Run send authorization. | Admin or active client caller. | Active user. | `campaign_id`. | Placeholder result. | `400`, `401`, `403`, `404`, `409`, `423`. | `stub` |
| `POST /campaigns/{campaign_id}/sync-listmonk` | Prepare listmonk technical entities for a campaign. | Admin or active client caller. | Active user with backend-owned scope. | `campaign_id`. | Preparation result, list mappings, content readiness. | `400`, `401`, `403`, `404`, integration failures. | `implemented` |
| `POST /campaigns/{campaign_id}/simulate-send` | Run backend preflight plus simulation log creation without real dispatch. | Admin or active client caller. | Active user with backend-owned scope. | `campaign_id`. | Simulation result, Guard payload, content snapshot, email-log summary. | `400`, `401`, `403`, `404`, `409`, `423`. | `implemented` |
| `POST /campaigns/{campaign_id}/send` | Trigger controlled dev dispatch after backend checks. | Admin or active client caller. | Active user with backend-owned scope. | `campaign_id`. | Blocked, failed, or queued controlled-dispatch result. | `400`, `401`, `403`, `404`, `409`, `423`. | `implemented` |

Current runtime notes:

- real dispatch still depends on `EMAIL_SENDING_ENABLED=true`
- send remains fail-closed outside controlled runtime/provider conditions
- current send flow still uses legacy campaign and limit modeling

## Self-Service Campaign API Proposed

These are proposed product contracts for the guided client wizard. They are not implemented by this milestone unless explicitly marked otherwise.

| Endpoint | Purpose | Allowed caller | Required access | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `GET /client/campaigns` | List own campaigns. | Client portal. | Active client account. | Filters. | Campaign summaries. | `401`, `403`. | `implemented` |
| `POST /client/campaigns` | Create a new client-scoped campaign. | Client portal. | Active client account. | Setup fields only. | Created draft campaign. | `400`, `401`, `403`, `409`. | `planned` |
| `GET /client/campaigns/{campaign_id}` | Read own campaign detail. | Client portal. | Active client account. | `campaign_id`. | Full client-owned campaign detail. | `401`, `403`, `404`. | `planned` |
| `PATCH /client/campaigns/{campaign_id}` | Update allowed draft/review fields on own campaign. | Client portal. | Active client account. | Partial setup fields. | Updated campaign draft. | `400`, `401`, `403`, `404`, `409`. | `planned` |
| `POST /client/campaigns/{campaign_id}/select-slot` | Assign an available slot to a campaign. | Client portal. | Active client account. | `slot_id`. | Slot assignment summary. | `400`, `401`, `403`, `404`, `409`. | `future` |
| `POST /client/campaigns/{campaign_id}/content` | Save working content for a campaign. | Client portal. | Active client account. | `subject`, `preview_text`, `body_html`, `body_text`, content metadata. | Updated campaign content state. | `400`, `401`, `403`, `404`, `409`, `422`. | `planned` |
| `POST /client/campaigns/{campaign_id}/contacts/import` | Import contacts into the campaign workflow. | Client portal. | Active client account. | CSV or structured contact payload. | Import summary and validation preview. | `400`, `401`, `403`, `404`, `409`, `413`, `422`. | `future` |
| `GET /client/campaigns/{campaign_id}/contacts` | Read contacts associated with the campaign. | Client portal. | Active client account. | `campaign_id`. | Campaign contact list and summary. | `401`, `403`, `404`. | `future` |
| `POST /client/campaigns/{campaign_id}/review` | Build final review payload without dispatching. | Client portal. | Active client account. | `campaign_id`. | Warnings, blocking errors, counts, readiness, slot limit. | `400`, `401`, `403`, `404`, `409`, `422`. | `planned` |
| `POST /client/campaigns/{campaign_id}/simulate-send` | Request backend simulation from the client flow. | Client portal. | Active client account. | `campaign_id`. | Simulation result. | `400`, `401`, `403`, `404`, `409`, `423`. | `planned` |
| `POST /client/campaigns/{campaign_id}/send` | Request controlled send from the client flow. | Client portal. | Active client account. | `campaign_id`. | Blocked, failed, or queued send result. | `400`, `401`, `403`, `404`, `409`, `423`. | `planned` |

Self-service contract notes:

- backend derives `client_id` from auth and `client_access`
- backend validates step progression and cross-client access
- send requires content readiness, contact readiness, review validity, Guard allow, valid slot/limit, and `EMAIL_SENDING_ENABLED=true` for real dispatch

## Template API Proposed

| Endpoint | Purpose | Allowed caller | Required access | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `GET /client/templates` | List visible templates. | Client portal. | Active client account. | Filters. | System and owned client templates. | `401`, `403`. | `future` |
| `POST /client/templates` | Create client-owned template. | Client portal. | Active client account. | Template fields. | Created template. | `400`, `401`, `403`, `409`, `422`. | `future` |
| `GET /client/templates/{template_id}` | Read template detail. | Client portal. | Active client account. | `template_id`. | Template detail if visible. | `401`, `403`, `404`. | `future` |
| `PATCH /client/templates/{template_id}` | Update owned template. | Client portal. | Active client account. | Partial template fields. | Updated template. | `400`, `401`, `403`, `404`, `409`, `422`. | `future` |
| `POST /client/campaigns/{campaign_id}/apply-template` | Copy a template into campaign content. | Client portal. | Active client account. | `template_id`. | Updated campaign content snapshot. | `400`, `401`, `403`, `404`, `409`. | `future` |

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
| `POST /client/campaigns/{campaign_id}/ai/generate` | Generate draft email content from brief. | Client portal. | Active client account. | Brief and content options. | Structured proposed content. | `400`, `401`, `403`, `404`, `409`, `422`. | `future` |
| `POST /client/campaigns/{campaign_id}/ai/improve` | Improve existing content. | Client portal. | Active client account. | Current content and intent. | Structured suggested revision. | `400`, `401`, `403`, `404`, `409`, `422`. | `future` |
| `POST /client/campaigns/{campaign_id}/ai/subject-variants` | Propose subject variants. | Client portal. | Active client account. | Current campaign content. | Subject option list. | `400`, `401`, `403`, `404`, `409`, `422`. | `future` |
| `POST /client/campaigns/{campaign_id}/ai/review-content` | Analyze content risk without sending. | Client portal. | Active client account. | Current campaign content. | Risk notes and improvements. | `400`, `401`, `403`, `404`, `409`, `422`. | `future` |

AI contract notes:

- AI output is advisory and must be user-applied
- AI cannot authorize send, assign limits, or publish automatically
- future calls should be tracked in `api_usage`

## Contacts Current And Proposed

| Endpoint | Purpose | Allowed caller | Required access | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `POST /contacts/import` | Import contacts. | Admin or active client caller. | Active user. | File or batch metadata. | Placeholder result. | `400`, `401`, `403`, `409`, `413`. | `stub` |
| `GET /contacts` | List contacts visible to caller. | Admin or active client caller. | Active user. | Filters. | Placeholder result. | `401`, `403`. | `stub` |
| `POST /contacts/{contact_id}/sync` | Sync a contact to listmonk. | Admin or active client caller. | Active user. | `contact_id`, optional `campaign_id`. | Sync result. | `400`, `401`, `403`, `404`. | `implemented` |
| `POST /contacts/{contact_id}/suppress` | Suppress contact. | Admin or active client caller. | Active user. | `contact_id`, reason. | Placeholder result. | `401`, `403`, `404`, `409`. | `stub` |

## Events

| Endpoint | Purpose | Allowed caller | Required access | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `POST /events/listmonk` | Receive listmonk webhook events. | listmonk. | Webhook secret or API key. | Event payload. | Accepted placeholder result. | `400`, `401`, `403`, `409`. | `stub` |
| `POST /events/provider` | Receive provider events if configured later. | SMTP/provider webhook. | Webhook secret or API key. | Event payload. | Accepted placeholder result. | `400`, `401`, `403`, `409`. | `future` |
