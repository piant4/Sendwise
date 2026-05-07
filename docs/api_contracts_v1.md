# API Contracts V1

Source of truth: `project_handoff_v1.md`.

Status values:
- `stub`: route may exist as a non-functional placeholder.
- `planned`: contract exists; implementation comes later.
- `future`: outside near-term V1 implementation.

All product APIs must be called through FastAPI. UI, n8n, and external callers must not call listmonk directly.

V1 auth and access contract:

- There is one platform admin account.
- A client is the actual customer profile or person that logs into `/client`.
- Each client has exactly one Clerk-backed access in V1.
- There is no role selector, no user-type selector, and no multi-user client-team model in V1.
- Backend resolves trusted `client_id` from authenticated identity mapping.

## Auth

Milestone 0.9E.1: `GET /auth/me` is implemented as a minimal backend-owned auth-context endpoint for post-login redirect routing while `AUTH_USER_MAPPINGS_JSON` remains the temporary mapping source.

| Endpoint | Purpose | Allowed caller | Required access | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `GET /auth/me` | Resolve the authenticated Sendwise access context for post-login routing. | Authenticated Next.js login redirect flow and authenticated UI. | Active platform admin or active client account. | Clerk bearer token. | `access_type`, backend-owned `client_id`, `email`, `status`. | `401`, `403`. | `stub` |

## Health

| Endpoint | Purpose | Allowed caller | Required access | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `GET /health` | Service health check. | Ops, compose health checks, developers. | None for skeleton. | None. | Status, service name, version. | `500` service unavailable. | `stub` |

## Admin Clients

Milestone 0.5: `GET /admin/clients` is stubbed with typed mock data.

| Endpoint | Purpose | Allowed caller | Required access | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `GET /admin/clients` | List clients. | Admin dashboard. | Platform admin. | Filters, pagination. | Client summaries. | `401`, `403`. | `stub` |
| `POST /admin/clients` | Create client profile. | Admin dashboard. | Platform admin. | Client profile fields. | Created client profile. | `400`, `401`, `403`, `409`. | `planned` |
| `GET /admin/clients/{client_id}` | Read client detail. | Admin dashboard. | Platform admin. | `client_id`. | Client detail and access summary. | `401`, `403`, `404`. | `planned` |
| `PATCH /admin/clients/{client_id}` | Update client profile. | Admin dashboard. | Platform admin. | `client_id`, partial client profile fields. | Updated client profile. | `400`, `401`, `403`, `404`, `409`. | `planned` |
| `POST /admin/clients/{client_id}/invite-access` | Invite the single V1 client login for that client. | Admin dashboard. | Platform admin. | `client_id`, `email`. | Pending invitation and access status. | `400`, `401`, `403`, `404`, `409`, `422`. | `planned` |
| `POST /admin/clients/{client_id}/revoke-access` | Revoke pending client access invitation. | Admin dashboard. | Platform admin. | `client_id`. | Updated access state. | `401`, `403`, `404`, `409`. | `planned` |
| `POST /admin/clients/{client_id}/suspend-access` | Suspend active client access. | Admin dashboard. | Platform admin. | `client_id`, reason. | Updated access state. | `401`, `403`, `404`, `409`. | `planned` |
| `POST /admin/clients/{client_id}/reactivate-access` | Reactivate eligible suspended client access. | Admin dashboard. | Platform admin. | `client_id`. | Updated access state. | `401`, `403`, `404`, `409`. | `planned` |
| `POST /admin/clients/{client_id}/pause` | Pause client sending. | Admin dashboard. | Platform admin. | `client_id`, reason. | Updated client state. | `401`, `403`, `404`, `409`. | `planned` |
| `POST /admin/clients/{client_id}/resume` | Resume eligible client. | Admin dashboard. | Platform admin. | `client_id`, reason. | Updated client state. | `401`, `403`, `404`, `409`. | `planned` |
| `POST /admin/clients/{client_id}/block` | Block client sending. | Admin dashboard. | Platform admin. | `client_id`, reason. | Updated client state. | `401`, `403`, `404`, `409`. | `planned` |
| `POST /admin/clients/{client_id}/archive` | Archive client. | Admin dashboard. | Platform admin. | `client_id`, reason. | Updated client state. | `401`, `403`, `404`, `409`. | `planned` |
| `GET /admin/clients/{client_id}/campaigns` | List campaigns for a client. | Admin dashboard. | Platform admin. | `client_id`, filters. | Campaign summaries. | `401`, `403`, `404`. | `planned` |
| `GET /admin/clients/{client_id}/usage` | View usage for a client. | Admin dashboard. | Platform admin. | `client_id`, date range. | API or send usage. | `401`, `403`, `404`. | `planned` |
| `GET /admin/clients/{client_id}/blocked-sends` | View blocked sends for a client. | Admin dashboard. | Platform admin. | `client_id`, filters. | Blocked send records. | `401`, `403`, `404`. | `planned` |

### Admin client-access request notes

- `POST /admin/clients/{client_id}/invite-access` accepts `email` only.
- `POST /admin/clients/{client_id}/invite-access` does not accept `role`.
- `POST /admin/clients/{client_id}/invite-access` does not accept `user_type`.
- `client_id` comes from the path and must be validated by the backend.
- Only the platform admin may call admin endpoints.
- V1 supports one active client access per client.

### Future admin UI note

The future `/admin/clients` create or edit form should include:

- client email
- optional initial `personal_name` if known
- optional initial `company_name` if known

It should not include:

- role selector
- admin or client selector
- permission selector
- team member management
- multiple users list in V1

## Admin Campaigns

Milestone 0.5: `GET /admin/campaigns` is stubbed with typed mock data.

| Endpoint | Purpose | Allowed caller | Required access | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `GET /admin/campaigns` | List all campaigns. | Admin dashboard. | Platform admin. | Filters, pagination. | Campaign summaries. | `401`, `403`. | `stub` |
| `GET /admin/campaigns/{campaign_id}` | Read campaign detail. | Admin dashboard. | Platform admin. | `campaign_id`. | Campaign detail. | `401`, `403`, `404`. | `planned` |
| `POST /admin/campaigns/{campaign_id}/pause` | Pause campaign. | Admin dashboard. | Platform admin. | `campaign_id`, reason. | Updated campaign state. | `401`, `403`, `404`, `409`. | `planned` |
| `POST /admin/campaigns/{campaign_id}/resume` | Resume eligible campaign. | Admin dashboard. | Platform admin. | `campaign_id`, reason. | Updated campaign state. | `401`, `403`, `404`, `409`. | `planned` |
| `GET /admin/blocked-sends` | View blocked sends across clients. | Admin dashboard. | Platform admin. | Filters, pagination. | Blocked send records. | `401`, `403`. | `planned` |
| `GET /admin/api-usage` | View API or token usage across clients. | Admin dashboard. | Platform admin. | Filters, date range. | Usage records. | `401`, `403`. | `planned` |

## Client Dashboard

Milestone 0.5: `GET /client/me`, `GET /client/campaigns`, `GET /client/usage`, and `GET /client/blocked-sends` are stubbed with typed mock data scoped to one mock client.

| Endpoint | Purpose | Allowed caller | Required access | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `GET /client/me` | Read current client account context. | Client dashboard. | Active client account. | Auth context. | Client profile and access status. | `401`, `403`. | `stub` |
| `GET /client/campaigns` | List own campaigns. | Client dashboard. | Active client account. | Filters, pagination. | Campaign summaries for the caller's client only. | `401`, `403`. | `stub` |
| `GET /client/campaigns/{campaign_id}` | Read own campaign detail. | Client dashboard. | Active client account. | `campaign_id`. | Campaign detail if owned by the caller's client. | `401`, `403`, `404`. | `planned` |
| `GET /client/campaigns/{campaign_id}/stats` | Read campaign stats. | Client dashboard. | Active client account. | `campaign_id`, date range. | Stats for the caller's client only. | `401`, `403`, `404`. | `planned` |
| `GET /client/usage` | Read own usage. | Client dashboard. | Active client account. | Date range. | Usage records for the caller's client. | `401`, `403`. | `stub` |
| `GET /client/blocked-sends` | Read own blocked sends. | Client dashboard. | Active client account. | Filters, pagination. | Blocked send records for the caller's client. | `401`, `403`. | `stub` |
| `POST /client/onboarding/complete` | Complete invited client onboarding profile. | Client onboarding flow. | Invited authenticated client access that is completing onboarding. | `personal_name`, optional `company_name`. | Activated client profile and access status. | `400`, `401`, `403`, `404`, `409`, `422`. | `planned` |

### Client onboarding request notes

- `POST /client/onboarding/complete` accepts `personal_name` and optional `company_name` only.
- `POST /client/onboarding/complete` does not accept trusted `client_id`.
- `POST /client/onboarding/complete` does not accept `role`.
- `personal_name` is required to complete onboarding.
- `company_name` is optional.
- Backend activates access only after successful onboarding completion.

### Future client UI note

The future `/client` onboarding flow should collect:

- `personal_name`
- optional `company_name`

The logged-in client account then manages only its own campaigns and data.

## Campaigns

| Endpoint | Purpose | Allowed caller | Required access | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `POST /campaigns` | Create campaign draft. | Admin dashboard, client dashboard. | Platform admin or active client account. | Campaign draft fields. | Created campaign draft. | `400`, `401`, `403`, `409`. | `planned` |
| `POST /campaigns/{campaign_id}/authorize` | Run send authorization through backend and Deliverability Guard. | Backend-triggered UI action, future integration caller. | Platform admin or active client account with backend-owned client scope. | `campaign_id`, target segment or batch metadata. | `SendDecision` and reasons. | `400`, `401`, `403`, `404`, `409`, `423`. | `planned` |
| `POST /campaigns/{campaign_id}/send` | Trigger controlled send after authorization. | Admin dashboard, client dashboard, future integration caller. | Platform admin or active client account with backend-owned client scope. | `campaign_id`, send request id. | Accepted dry-run or queued result. | `400`, `401`, `403`, `404`, `409`, `423`. | `planned` |

## Contacts

| Endpoint | Purpose | Allowed caller | Required access | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `POST /contacts/import` | Import contacts for a client. | Admin dashboard, client dashboard. | Platform admin or active client account. | Contact file or batch metadata. | Import summary. | `400`, `401`, `403`, `409`, `413`. | `planned` |
| `GET /contacts` | List contacts visible to caller. | Admin dashboard, client dashboard. | Platform admin or active client account. | Filters, pagination. | Contact summaries scoped by backend-owned client access rules. | `401`, `403`. | `planned` |
| `POST /contacts/{contact_id}/suppress` | Suppress contact. | Admin dashboard, client dashboard. | Platform admin or active client account. | `contact_id`, reason. | Updated contact state. | `401`, `403`, `404`, `409`. | `planned` |

## Events

| Endpoint | Purpose | Allowed caller | Required access | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `POST /events/listmonk` | Receive listmonk webhook events. | listmonk. | Webhook secret or API key. | Event payload. | Accepted or ignored result. | `400`, `401`, `403`, `409`. | `planned` |
| `POST /events/provider` | Receive provider events if configured later. | SMTP or SES provider webhook. | Webhook secret or API key. | Provider event payload. | Accepted or ignored result. | `400`, `401`, `403`, `409`. | `future` |
