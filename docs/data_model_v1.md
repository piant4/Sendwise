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

Purpose: Actual customer profile, person, or account for the client dashboard.

Minimum fields: `id`, `email`, `personal_name`, `company_name`, `status`, `monthly_email_limit`, `daily_email_limit`, `created_at`, `updated_at`.

Relation to `client_id`: Root entity; other customer business data references `clients.id`.

V1 notes:

- `personal_name` is required for a fully onboarded client profile.
- `company_name` is nullable and may represent a company, studio, or brand label.
- Existing business fields may expand this entity later, but V1 keeps one client profile per logged-in customer account.

Anti-regression rules:

- Client status must be checked before sending; archived, blocked, and paused clients cannot send.
- The business profile must not store password values, password hashes, reset tokens, or session secrets.

### client_access

Purpose: Clerk-backed auth, invitation, and access mapping for a single client.

Minimum fields: `id`, `client_id`, `email`, `clerk_user_id`, `clerk_invitation_id`, `status`, `invitation_status`, `invited_at`, `accepted_at`, `created_at`, `updated_at`.

Relation to `client_id`: Direct `client_id`. In V1, one client has one access mapping.

V1 notes:

- `clerk_user_id` is nullable while the client is invited but has not accepted access yet.
- `clerk_invitation_id` is nullable when no active invitation exists.
- Real auth is not implemented in Milestone 0. The planned auth contract uses Clerk as the identity provider while Business PostgreSQL stores client access state and client mapping only.
- V1 has no `role` field and no `client_users` table.
- The platform admin is backend-controlled and is not modeled as a client access row.

Allowed access statuses: `invited`, `active`, `suspended`, `archived`.

Allowed invitation statuses: `pending`, `accepted`, `revoked`, `expired`.

Anti-regression rules:

- `client_id` must be unique in `client_access` for V1.
- One client has one active Clerk-backed access in V1.
- `clerk_user_id` must be unique when present.
- `email` must be unique among active or invited client accesses.
- Invited clients cannot access protected client data until access becomes `active`.
- Suspended or archived client access cannot access protected client data.
- Backend resolves `client_id` from this mapping rather than trusting frontend input.
- No password, password hash, password reset token, or session secret belongs in this table.
- Keeping `client_access` separate from `clients` preserves business profile data in `clients` while keeping Clerk-specific invitation and identity mapping out of the core customer profile.

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
