# API Contracts V1

Source of truth: `project_handoff_v1.md`.

Status values:
- `stub`: route may exist as a non-functional placeholder.
- `planned`: contract exists; implementation comes later.
- `future`: outside near-term V1 implementation.

All product APIs must be called through FastAPI. UI, n8n, and external callers must not call listmonk directly.

## Health

| Endpoint | Purpose | Allowed caller | Required scope/role | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `GET /health` | Service health check. | Ops, compose health checks, developers. | None for skeleton. | None. | Status, service name, version. | `500` service unavailable. | `stub` |

## Admin Clients

Milestone 0.5: `GET /admin/clients` is stubbed with typed mock data.

| Endpoint | Purpose | Allowed caller | Required scope/role | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `GET /admin/clients` | List clients. | Admin dashboard. | Admin. | Filters, pagination. | Client summaries. | `401`, `403`. | `stub` |
| `POST /admin/clients` | Create client. | Admin dashboard. | Admin. | Client profile fields. | Created client. | `400`, `401`, `403`, `409`. | `planned` |
| `GET /admin/clients/{client_id}` | Read client detail. | Admin dashboard. | Admin. | `client_id`. | Client detail. | `401`, `403`, `404`. | `planned` |
| `PATCH /admin/clients/{client_id}` | Update client. | Admin dashboard. | Admin. | `client_id`, partial client fields. | Updated client. | `400`, `401`, `403`, `404`, `409`. | `planned` |
| `POST /admin/clients/{client_id}/pause` | Pause client sending. | Admin dashboard. | Admin. | `client_id`, reason. | Updated client state. | `401`, `403`, `404`, `409`. | `planned` |
| `POST /admin/clients/{client_id}/resume` | Resume eligible client. | Admin dashboard. | Admin. | `client_id`, reason. | Updated client state. | `401`, `403`, `404`, `409`. | `planned` |
| `POST /admin/clients/{client_id}/block` | Block client sending. | Admin dashboard. | Admin. | `client_id`, reason. | Updated client state. | `401`, `403`, `404`, `409`. | `planned` |
| `POST /admin/clients/{client_id}/archive` | Archive client. | Admin dashboard. | Admin. | `client_id`, reason. | Updated client state. | `401`, `403`, `404`, `409`. | `planned` |
| `GET /admin/clients/{client_id}/campaigns` | List campaigns for a client. | Admin dashboard. | Admin. | `client_id`, filters. | Campaign summaries. | `401`, `403`, `404`. | `planned` |
| `GET /admin/clients/{client_id}/usage` | View usage for a client. | Admin dashboard. | Admin. | `client_id`, date range. | API/token/send usage. | `401`, `403`, `404`. | `planned` |
| `GET /admin/clients/{client_id}/blocked-sends` | View blocked sends for a client. | Admin dashboard. | Admin. | `client_id`, filters. | Blocked send records. | `401`, `403`, `404`. | `planned` |

## Admin Campaigns

Milestone 0.5: `GET /admin/campaigns` is stubbed with typed mock data.

| Endpoint | Purpose | Allowed caller | Required scope/role | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `GET /admin/campaigns` | List all campaigns. | Admin dashboard. | Admin. | Filters, pagination. | Campaign summaries. | `401`, `403`. | `stub` |
| `GET /admin/campaigns/{campaign_id}` | Read campaign detail. | Admin dashboard. | Admin. | `campaign_id`. | Campaign detail. | `401`, `403`, `404`. | `planned` |
| `POST /admin/campaigns/{campaign_id}/pause` | Pause campaign. | Admin dashboard. | Admin. | `campaign_id`, reason. | Updated campaign state. | `401`, `403`, `404`, `409`. | `planned` |
| `POST /admin/campaigns/{campaign_id}/resume` | Resume eligible campaign. | Admin dashboard. | Admin. | `campaign_id`, reason. | Updated campaign state. | `401`, `403`, `404`, `409`. | `planned` |
| `GET /admin/blocked-sends` | View blocked sends across clients. | Admin dashboard. | Admin. | Filters, pagination. | Blocked send records. | `401`, `403`. | `planned` |
| `GET /admin/api-usage` | View API/token usage across clients. | Admin dashboard. | Admin. | Filters, date range. | Usage records. | `401`, `403`. | `planned` |

## Client Dashboard

Milestone 0.5: `GET /client/me`, `GET /client/campaigns`, `GET /client/usage`, and `GET /client/blocked-sends` are stubbed with typed mock data scoped to one mock client.

| Endpoint | Purpose | Allowed caller | Required scope/role | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `GET /client/me` | Read current client/user context. | Client dashboard. | Client user. | Auth context. | Client profile and permissions. | `401`, `403`. | `stub` |
| `GET /client/campaigns` | List own campaigns. | Client dashboard. | Client user. | Filters, pagination. | Campaign summaries for caller's client only. | `401`, `403`. | `stub` |
| `GET /client/campaigns/{campaign_id}` | Read own campaign detail. | Client dashboard. | Client user. | `campaign_id`. | Campaign detail if owned by caller's client. | `401`, `403`, `404`. | `planned` |
| `GET /client/campaigns/{campaign_id}/stats` | Read campaign stats. | Client dashboard. | Client user. | `campaign_id`, date range. | Stats for caller's client only. | `401`, `403`, `404`. | `planned` |
| `GET /client/usage` | Read own usage. | Client dashboard. | Client user. | Date range. | Usage records for caller's client. | `401`, `403`. | `stub` |
| `GET /client/blocked-sends` | Read own blocked sends. | Client dashboard. | Client user. | Filters, pagination. | Blocked send records for caller's client. | `401`, `403`. | `stub` |

## Campaigns

| Endpoint | Purpose | Allowed caller | Required scope/role | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `POST /campaigns` | Create campaign draft. | Admin dashboard, allowed client dashboard user. | Admin or client campaign manager. | Campaign draft fields. | Created campaign draft. | `400`, `401`, `403`, `409`. | `planned` |
| `POST /campaigns/{campaign_id}/authorize` | Run send authorization through backend and Deliverability Guard. | Backend-triggered UI action, future integration caller. | Admin or allowed campaign manager. | `campaign_id`, target segment/batch metadata. | `SendDecision` and reasons. | `400`, `401`, `403`, `404`, `409`, `423`. | `planned` |
| `POST /campaigns/{campaign_id}/send` | Trigger controlled send after authorization. | Admin dashboard, allowed client dashboard user, future integration caller. | Admin or allowed campaign manager. | `campaign_id`, send request id. | Accepted dry-run/queued result. | `400`, `401`, `403`, `404`, `409`, `423`. | `planned` |

## Contacts

| Endpoint | Purpose | Allowed caller | Required scope/role | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `POST /contacts/import` | Import contacts for a client. | Admin dashboard, allowed client dashboard user. | Admin or client contact manager. | Contact file/batch metadata. | Import summary. | `400`, `401`, `403`, `409`, `413`. | `planned` |
| `GET /contacts` | List contacts visible to caller. | Admin dashboard, client dashboard. | Admin or client user. | Filters, pagination. | Contact summaries scoped by role/client. | `401`, `403`. | `planned` |
| `POST /contacts/{contact_id}/suppress` | Suppress contact. | Admin dashboard, allowed client dashboard user. | Admin or client contact manager. | `contact_id`, reason. | Updated contact state. | `401`, `403`, `404`, `409`. | `planned` |

## Events

| Endpoint | Purpose | Allowed caller | Required scope/role | High-level input | High-level output | Main errors | Status |
|---|---|---|---|---|---|---|---|
| `POST /events/listmonk` | Receive listmonk webhook events. | listmonk. | Webhook secret/API key. | Event payload. | Accepted/ignored result. | `400`, `401`, `403`, `409`. | `planned` |
| `POST /events/provider` | Receive provider events if configured later. | SMTP/SES provider webhook. | Webhook secret/API key. | Provider event payload. | Accepted/ignored result. | `400`, `401`, `403`, `409`. | `future` |
