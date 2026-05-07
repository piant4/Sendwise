# Data Model V1

Source of truth: `project_handoff_v1.md`.

This is a high-level planned model. Milestone 0 creates only understandable schema stubs.

Mandatory rule:

```txt
Every business entity that belongs to a customer must include client_id or be reachable through a client_id relationship.
```

## States

Client states:

```txt
trial
active
paused
blocked
archived
```

Campaign states:

```txt
draft
ready
running
paused
blocked
completed
failed
```

Contact states:

```txt
pending
sendable
suppressed
bounced
unsubscribed
blacklisted
error
```

## Entities

### clients

Purpose: Customer account/root tenant.

Minimum fields: `id`, `name`, `status`, `created_at`, `updated_at`.

Relation to `client_id`: Root entity; other customer business data references `clients.id`.

V1 notes: Stores lifecycle state and future account limits.

Anti-regression rules: Client status must be checked before sending; archived/blocked/paused clients cannot send.

### client_users

Purpose: Users associated with a client dashboard or admin ownership.

Minimum fields: `id`, `client_id`, `clerk_user_id`, `clerk_org_id`, `email`, `role`, `status`, `created_at`, `updated_at`.

Relation to `client_id`: Direct `client_id` for client users. Platform admins may use nullable `client_id` or a dedicated platform scope in a later auth milestone.

V1 notes: Real auth is not implemented in Milestone 0. The planned auth contract uses Clerk as identity provider while Business PostgreSQL stores Sendwise role, status, and client mapping only. No password, password hash, password reset token, or session secret belongs in this table.

Planned statuses: `invited`, `active`, `suspended`, `archived`.

Anti-regression rules: `clerk_user_id` must be unique; client users must not access other clients' data; backend resolves `client_id` from this mapping rather than trusting frontend input; suspended or archived users cannot access protected data.

### client_secrets

Purpose: Future encrypted storage for per-client provider credentials when Sendwise supports client-specific SMTP, SES, or API secrets.

Minimum fields: `id`, `client_id`, `provider`, `secret_type`, `encrypted_value`, `key_version`, `status`, `last_verified_at`, `created_at`, `updated_at`.

Relation to `client_id`: Direct `client_id`.

V1 notes: Not implemented in Milestone 0 and not required for the initial Clerk integration milestone. Global provider credentials should remain in deployment secret storage unless per-client secrets are explicitly needed.

Anti-regression rules: Secret values must never be stored in cleartext, returned to the frontend, or logged. Encryption keys must come from deployment secret storage rather than the database.

### campaigns

Purpose: Product campaign record and state.

Minimum fields: `id`, `client_id`, `name`, `status`, `subject`, `created_at`, `updated_at`.

Relation to `client_id`: Direct `client_id`.

V1 notes: listmonk campaign ids are stored separately in `listmonk_mappings`.

Anti-regression rules: listmonk must not become the source of campaign state; blocked/paused/completed/failed campaigns cannot send.

### contacts

Purpose: Customer contact records and sendability state.

Minimum fields: `id`, `client_id`, `email`, `status`, `created_at`, `updated_at`.

Relation to `client_id`: Direct `client_id`.

V1 notes: Import validation and deduplication come later.

Anti-regression rules: Suppressed, bounced, unsubscribed, and blacklisted contacts cannot send.

### campaign_contacts

Purpose: Relationship between campaigns and contacts.

Minimum fields: `id`, `client_id`, `campaign_id`, `contact_id`, `status`, `created_at`.

Relation to `client_id`: Direct `client_id`; also reachable through campaign and contact.

V1 notes: Supports future per-campaign inclusion/exclusion and send state.

Anti-regression rules: `campaign_id`, `contact_id`, and `client_id` must remain consistent.

### email_logs

Purpose: Audit log of send attempts and outcomes.

Minimum fields: `id`, `client_id`, `campaign_id`, `contact_id`, `status`, `provider_message_id`, `created_at`.

Relation to `client_id`: Direct `client_id`.

V1 notes: Created by backend-controlled sending and event processing.

Anti-regression rules: No log should imply a send was authorized unless backend authorization existed.

### api_usage

Purpose: Track AI/API/token/send usage.

Minimum fields: `id`, `client_id`, `usage_type`, `quantity`, `metadata`, `created_at`.

Relation to `client_id`: Direct `client_id`.

V1 notes: AI integration is not implemented in Milestone 0.

Anti-regression rules: Usage must remain client-scoped.

### suppression_list

Purpose: Client-scoped and global suppression records.

Minimum fields: `id`, `client_id`, `email`, `reason`, `created_at`.

Relation to `client_id`: Nullable `client_id` for future global suppression; client-scoped rows include `client_id`.

V1 notes: Suppression enforcement belongs to backend/Guard.

Anti-regression rules: Suppressed addresses cannot send.

### provider_events

Purpose: Store normalized listmonk/provider events.

Minimum fields: `id`, `client_id`, `campaign_id`, `contact_id`, `event_type`, `payload`, `created_at`.

Relation to `client_id`: Direct `client_id` when mapped; otherwise must be resolved before business use.

V1 notes: Provider event ingestion is planned/future.

Anti-regression rules: Events must not overwrite business truth without backend validation.

### blocked_sends

Purpose: Record blocked authorization/send attempts and reasons.

Minimum fields: `id`, `client_id`, `campaign_id`, `contact_id`, `reason`, `decision`, `created_at`.

Relation to `client_id`: Direct `client_id`.

V1 notes: Supports auditability and dashboard explanations.

Anti-regression rules: Every blocked send must include a readable reason.

### listmonk_mappings

Purpose: Map business entities to listmonk technical ids.

Minimum fields: `id`, `client_id`, `entity_type`, `entity_id`, `listmonk_type`, `listmonk_id`, `created_at`, `updated_at`.

Relation to `client_id`: Direct `client_id`.

V1 notes: Keeps listmonk operational data separate from business truth.

Anti-regression rules: Mapping does not transfer business ownership to listmonk.
