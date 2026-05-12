# Data Model V1

Source of truth: `project_handoff_v1.md`.

This file now distinguishes between:

- verified current persistence
- recommended contract additions for self-service V1
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
- `contacts`
- `campaign_contacts`
- `email_logs`
- `api_usage`
- `suppression_list`
- `provider_events`
- `blocked_sends`
- `listmonk_mappings`

Current audited gaps:

- no `campaign_slots` table
- no `email_templates` table
- no persisted campaign wizard flags
- no persisted `preview_text`, `body_html`, or `body_text` on `campaigns`
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

Recommended self-service campaign statuses for product V1:

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
- `email_limit_per_campaign` is the current Guard-enforced per-campaign limit.
- `max_campaigns` is the current Guard-enforced active-campaign-count limit.

Recommended direction:
- keep these fields during migration
- treat `email_limit_per_campaign` as legacy fallback once `campaign_slots` exists
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

### campaigns

Purpose: Product campaign record and lifecycle anchor.

Current verified fields:
- `id`
- `client_id`
- `name`
- `status`
- `subject`
- `created_at`
- `updated_at`

Current audited limitations:
- no persisted wizard step
- no `content_ready`
- no `contacts_ready`
- no `review_ready`
- no `preview_text`
- no `body_html`
- no `body_text`
- no `slot_id`
- no per-campaign limit field

Recommended additions for self-service V1 contract:
- `current_step`
- `content_ready`
- `contacts_ready`
- `review_ready`
- `preview_text`
- `body_html`
- `body_text`
- `assigned_slot_id`
- optional `review_snapshot` or separate review persistence later

Fallback option:
- `campaigns.email_limit` is acceptable only as a temporary fallback if `campaign_slots` cannot land yet
- recommended choice remains `campaign_slots`

### contacts

Purpose: Client-owned contact records.

Current verified fields:
- `id`
- `client_id`
- `email`
- `status`
- `created_at`
- `updated_at`

Contract rules:
- deduplication must remain scoped by `client_id + email`
- cross-client contact reuse is forbidden unless explicitly modeled later

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
- future import/selection flows must populate this relationship in Business PostgreSQL first

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

### provider_events

Purpose: Future normalized provider/listmonk event store.

Current verified fields:
- `id`
- `client_id`
- `campaign_id`
- `contact_id`
- `event_type`
- `payload`
- `created_at`

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

Status: recommended contract, not implemented.

Purpose: Admin-owned capacity slots assigned one-to-one to campaigns for per-campaign custom limits.

Recommended fields:
- `id`
- `client_id`
- `label`
- `max_emails`
- `status`
- `assigned_campaign_id` nullable
- `created_at`
- `updated_at`

Recommended statuses:
- `available`
- `assigned`
- `used`
- `archived`

Recommended rules:
- only admin creates, edits, or archives slots
- client may view assignable slots but not mutate slot policy
- one campaign uses one slot
- Guard applies `campaign_slots.max_emails`
- `clients.email_limit_per_campaign` remains fallback/legacy until migration completes

Recommended V1 choice:
- preferred: `campaign_slots`
- acceptable fallback if delivery pressure is high: temporary `campaigns.email_limit`

### email_templates

Status: recommended contract, not implemented.

Purpose: Product template catalog for system, client, campaign-derived, and AI-generated email content.

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
- system templates are readable by all eligible clients
- client templates are visible only to the owning client
- applying a template copies content into the campaign record; the campaign becomes the active working copy
- Business PostgreSQL remains the source of truth
- listmonk receives only final rendered HTML after backend approval
