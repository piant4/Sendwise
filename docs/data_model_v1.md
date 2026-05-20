# Data Model V1

Source of truth: `project_handoff_v1.md`.

This file now distinguishes between:

- verified current persistence
- recommended contract additions for admin-managed V1
- legacy compatibility that remains during migration

Mandatory rule:

```txt
Every business entity that belongs to a customer must include client_id or be reachable through a client_id relationship.
```

## Current Verified Persistence

Current audited tables in `db/init.sql`:

- `clients`
- `client_access`
- `campaigns`
- `campaign_slots`
- `contacts`
- `campaign_contacts`
- `email_logs`
- `api_usage`
- `suppression_list`
- `provider_events`
- `blocked_sends`
- `listmonk_mappings`

Current audited gaps:

- no `email_templates` table
- no persisted review snapshot or preflight result table

## States

Current implemented campaign statuses used by backend/frontend:

```txt
draft
ready
running
paused
blocked
completed
failed
```

Recommended product campaign statuses for V1:

```txt
draft
ready
queued
sending
sent
paused
blocked
archived
```

Compatibility note:

- `running` remains the current implementation state.
- `completed` and `failed` remain legacy-compatible until runtime migration.
- future runtime may map `running -> sending` and `completed -> sent`.

## Entities

### clients

Purpose: Root customer business profile.

Current verified fields:
- `id`
- `email`
- `personal_name`
- `status`
- `email_limit_per_campaign`
- `max_campaigns`
- `monthly_email_limit`
- `daily_email_limit`
- `created_at`
- `updated_at`

Legacy compatibility:
- `email_limit_per_campaign` is deprecated as a Guard source for send volume.
- `max_campaigns` remains the Guard-enforced active-campaign-count limit.
- frontend account/admin client pages should not present `email_limit_per_campaign` as an account-level control
- user-facing period/day windows derived from these compatibility fields should be rendered with `Europe/Rome`

Recommended direction:
- keep these fields during migration
- treat `email_limit_per_campaign` as deprecated compatibility data only
- treat `max_campaigns` as legacy compatibility until slot-count policy is formalized

### client_access

Purpose: Backend-owned auth/access mapping for one client login in V1.

Current verified fields:
- `id`
- `client_id`
- `email`
- `clerk_user_id`
- `clerk_invitation_id`
- `portal_slug`
- `status`
- `invitation_status`
- `invited_at`
- `accepted_at`
- `created_at`
- `updated_at`

Contract rule:
- backend derives trusted `client_id` from this mapping
- frontend never supplies trusted `client_id`
- `portal_slug` stays persistence-owned and may be reserved before the first successful Clerk login, but frontend/admin API summaries must expose it only after `status=active` and `invitation_status=accepted`
- `clerk_invitation_id` may hold either the latest Clerk invitation id for unclaimed access or the previous invite reference kept for audit purposes after activation
- Sendwise never stores plaintext passwords in this table or any other Business DB table

### campaigns

Purpose: Product campaign record and lifecycle anchor.

Current verified fields:
- `id`
- `client_id`
- `name`
- `status`
- `subject`
- `campaign_slot_id`
- `preview_text`
- `body_html`
- `body_text`
- `content_ready`
- `contacts_ready`
- `review_ready`
- `current_step`
- `created_at`
- `updated_at`

Lifecycle notes:
- `running` remains the active dispatch state in the current runtime.
- there is no dedicated `started_at` column on `campaigns`.

### campaign_sending_limits

Purpose: Campaign-scoped send limits and campaign period anchor.

Current verified fields:
- `campaign_id`
- `period_email_limit`
- `daily_email_limit`
- `period_started_at`
- `created_at`
- `updated_at`

Contract rules:
- limits are per campaign, not per client
- `period_email_limit` is the 30-day campaign limit
- `daily_email_limit` is internal pacing only and must stay hidden from client UI
- `period_started_at` begins when a campaign first enters `running`; existing real dispatch logs may backfill it when reliable

Current audited limitations:
- no per-campaign review snapshot table
- no dedicated product template entity yet
- technical template rendering remains a legacy fallback and does not make campaign content product-ready by itself

Recommended additions for admin-managed V1 contract:
- optional `review_snapshot` or separate review persistence later

Current verified admin-managed compatibility:
- `campaign_slot_id` links a campaign to `campaign_slots` when assigned
- `campaign_slot_id` is assigned by admin workflow and validated by backend
- `clients.email_limit_per_campaign` remains the legacy fallback when no slot is linked
- `max_campaigns` remains the legacy active-campaign-count compatibility check

Contract rules:

- admin creates and updates campaign content/state on behalf of a validated client
- client portal reads campaign state and metrics scoped to its own `client_id`
- `current_step`, `content_ready`, `contacts_ready`, and `review_ready` describe the admin flow state, not a client-owned write flow
- client dashboard business metrics are API read-model fields, not frontend-derived calculations
- client dashboard send analytics use real non-simulated `email_logs` rows, real `blocked_sends` rows, and real processed provider events
- provider-event-backed dashboard metrics must stay unavailable when the source is missing; they must not be synthesized from recipient counts, status totals, or configured daily limits
- `clients.daily_email_limit` remains backend/internal pacing data and must stay hidden from client-facing dashboard responses

### contacts

Purpose: Client-owned contact records.

Current verified fields:
- `id`
- `client_id`
- `email`
- `status`
- `metadata`
- `created_at`
- `updated_at`

Contract rules:
- deduplication must remain scoped by `client_id + email`
- cross-client contact reuse is forbidden unless explicitly modeled later
- `metadata` stores recipient attributes used by the admin campaign contact collection flow, including `nome` and optional `cognome`
- per-recipient merge tags `{{nome}}` and `{{cognome}}` are powered by `contacts.metadata`
- admin campaign contact collection currently requires `metadata.nome`
- `metadata.cognome` remains optional

### campaign_contacts

Purpose: Relationship between campaigns and contacts.

Current verified fields:
- `id`
- `client_id`
- `campaign_id`
- `contact_id`
- `status`
- `created_at`

Contract rules:
- `campaign_id`, `contact_id`, and `client_id` must remain consistent
- future admin import/selection flows must populate this relationship in Business PostgreSQL first

### email_logs

Purpose: Backend audit log for simulations and controlled dispatch.

Current verified fields:
- `id`
- `client_id`
- `campaign_id`
- `contact_id`
- `status`
- `provider_message_id`
- `body`
- `created_at`

Current audited behavior:
- simulation writes `status="simulated"`
- controlled dev dispatch writes `status="queued"`
- provider and unsubscribe events may update `status` for correlated logs without adding a separate delivery-state table yet
- the frontend public unsubscribe page is presentation-only; token validation, suppression writes, contact state changes, and provider-event persistence remain backend-owned
- limit usage counts rely on real `email_logs.created_at` rows and exclude `simulated`
- `sent`/accepted states mean the sending system accepted the message; they do not prove inbox delivery without provider events

### api_usage

Purpose: Client-scoped usage ledger.

Current verified fields:
- `id`
- `client_id`
- `usage_type`
- `quantity`
- `metadata`
- `created_at`

Future contract:
- AI assistant calls, token counts, and costs should be recorded here or in a compatible future extension

### suppression_list and provider_events

Purpose: Deliverability side effects and event truth.

Current contract notes:
- `suppression_list` is the backend-owned suppression source used by unsubscribe and provider-event side effects.
- `provider_events` stores normalized provider outcomes such as delivery, open, click, bounce, complaint, and Sendwise unsubscribe when correlated data is available.
- Bounce and complaint suppression behavior depends on provider-event ingestion and correlation, not on accepted send rows alone.
- SES SNS signature verification and `SubscriptionConfirmation` handling are still pending, so official trials must treat provider event coverage as partial until those follow-ups land.

### suppression_list

Purpose: Client-scoped suppression enforcement.

Current verified fields:
- `id`
- `client_id`
- `email`
- `reason`
- `created_at`

Contract rule:
- suppression remains enforced by backend and Guard, not by listmonk alone
- unsubscribe, complaint, and bounce may all write suppression rows idempotently for the same client-scoped e-mail with different reasons

### provider_events

Purpose: Append-only normalized provider/listmonk event store.

Current verified fields:
- `id`
- `client_id`
- `campaign_id`
- `contact_id`
- `email_log_id`
- `provider`
- `source`
- `provider_event_id`
- `event_key`
- `event_type`
- `payload`
- `occurred_at`
- `processed_at`
- `created_at`

Current audited behavior:
- events are persisted idempotently by `event_key`
- correlated delivery, bounce, complaint, open, click, and unsubscribe events may update `email_logs`, `contacts`, `suppression_list`, and campaign read-model metrics

### blocked_sends

Purpose: Audit log of denied simulations or sends.

Current verified fields:
- `id`
- `client_id`
- `campaign_id`
- `contact_id`
- `reason`
- `decision`
- `created_at`

### listmonk_mappings

Purpose: Mapping layer between business entities and listmonk technical ids.

Current verified fields:
- `id`
- `client_id`
- `entity_type`
- `entity_id`
- `listmonk_type`
- `listmonk_id`
- `created_at`
- `updated_at`

Contract rule:
- mappings do not move business ownership into listmonk

### campaign_slots

Status: implemented persistence.

Purpose: Admin-owned capacity slots assigned one-to-one to campaigns for per-campaign custom limits.

Current verified fields:
- `id`
- `client_id`
- `label`
- `max_emails`
- `status`
- `assigned_campaign_id` nullable
- `created_at`
- `updated_at`

Current verified statuses:
- `available`
- `assigned`
- `used`
- `archived`

Current verified rules:
- only admin creates, edits, or archives slots
- only admin assigns a slot to a campaign
- client portal may read slot or limit usage if exposed later, but cannot mutate slots
- one slot can be assigned to at most one campaign
- Guard applies `campaign_slots.max_emails`
- `clients.email_limit_per_campaign` remains fallback/legacy until migration completes

Current V1 choice:
- `campaign_slots` is the implemented source for per-campaign custom limit when linked
- `campaigns.email_limit` was not introduced

### email_templates

Status: recommended contract, not implemented.

Purpose: Product template catalog for system, client-scoped, campaign-derived, and AI-generated email content managed by admin in V1.

Recommended fields:
- `id`
- `client_id` nullable
- `name`
- `description`
- `category`
- `subject`
- `preview_text`
- `body_html`
- `body_text`
- `source_type`
- `status`
- `created_at`
- `updated_at`

Recommended `source_type` values:
- `system`
- `client`
- `campaign`
- `ai_generated`

Recommended rules:
- only admin creates, edits, selects, or applies templates in V1
- system templates are readable by admin for all eligible clients
- client-scoped templates are visible to admin when operating for the owning client
- client portal template management is not part of V1
- applying a template copies content into the campaign record; the campaign becomes the active working copy
- Business PostgreSQL remains the source of truth
- listmonk receives only final rendered HTML after backend approval
