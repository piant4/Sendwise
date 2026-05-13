# States V1

Source of truth: `project_handoff_v1.md`.

State checks are owned by the backend and Deliverability Guard. UI displays state; it does not decide sendability.

## Client Lifecycle

Current and planned usable states:

```txt
trial
active
paused
blocked
archived
```

Rules:
- `trial` and `active` may proceed only if backend checks pass.
- `paused`, `blocked`, and `archived` are not sendable.
- `archived` is terminal unless an explicit future migration says otherwise.

## Campaign Lifecycle

### Current verified runtime-compatible states

```txt
draft
ready
running
paused
blocked
completed
failed
```

Current runtime rules:
- `draft` cannot simulate or send.
- `ready` is the current sendable state.
- `running` is currently treated as sendable by the Guard.
- `paused`, `blocked`, `completed`, and `failed` are not sendable.

### Recommended self-service contract states

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

Recommended rules:
- `draft` is editable and not sendable.
- `ready` is editable with care and eligible for review/send checks.
- `queued` is not editable except for operational controls.
- `sending` is operational and not normally editable.
- `sent` is terminal for dispatch and read-only for business content.
- `paused` blocks dispatch until resumed.
- `blocked` blocks dispatch until the blocking condition is cleared.
- `archived` is terminal and not sendable.

Compatibility mapping plan:
- current `running` can map to future `sending`
- current `completed` can map to future `sent`
- current `failed` remains a legacy operational failure state until a richer retry contract exists

## Campaign Wizard Step Contract

Recommended `current_step` values:

```txt
setup
content
recipients
review
send
```

Recommended readiness flags:

```txt
content_ready
contacts_ready
review_ready
```

Rules:
- `setup` captures name and baseline campaign metadata.
- `content` owns template selection, content draft, and future AI assist application.
- `recipients` owns recipient import/selection and deduped association.
- `review` owns preflight analysis and warnings.
- `send` is an action step, not a trust boundary; backend still rechecks.
- `current_step`, `content_ready`, `contacts_ready`, and `review_ready` are now persisted on `campaigns`.
- `content_ready=true` requires persisted `body_html` in Business PostgreSQL for real dispatch.
- `contacts_ready` may be refreshed from persisted `campaign_contacts`, but Guard still performs the final eligibility check.

## Contact Sendability

Current and planned states:

```txt
pending
sendable
suppressed
bounced
unsubscribed
blacklisted
error
```

Rules:
- `sendable` is the only normal sendable contact state.
- `pending`, `suppressed`, `bounced`, `unsubscribed`, `blacklisted`, and `error` are not sendable.
- suppression and invalid recipient handling must remain backend-owned.

## Final Review Contract

Recommended review output fields:

- `allowed_to_send`
- `warnings`
- `blocking_errors`
- `eligible_contact_count`
- `blocked_contact_count`
- `slot_limit`
- `content_ready`
- `contacts_ready`
- `review_ready`

Rules:
- review does not send
- review does not replace the Guard
- send must re-run or revalidate backend authorization before dispatch

## Send Authorization

Current Guard decisions:

```txt
authorized
blocked
dry_run
```

Rules:
- if client is paused, blocked, suspended, or archived -> no send
- if campaign is not in a sendable state -> no send
- if contact eligibility is invalid -> no send
- if slot or limit is invalid -> no send
- if `EMAIL_SENDING_ENABLED` is not exactly `true` -> no real dispatch
- simulation and real dispatch remain distinct outcomes

## Editability Matrix

- editable: `draft`, recommended `ready`
- limited operational editability only: `paused`
- not editable for content changes: `queued`, `sending`, `sent`, `blocked`, `archived`
- terminal: `sent`, `archived`

This matrix is the recommended product contract. Current runtime still uses `running`, `completed`, and `failed` compatibility states.
