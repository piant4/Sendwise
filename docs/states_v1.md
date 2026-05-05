# States V1

Source of truth: `project_handoff_v1.md`.

State checks are owned by the backend and Deliverability Guard. UI displays states; it does not decide sendability.

## Client Lifecycle

States:

```txt
trial -> active -> paused -> active
active -> blocked
paused -> blocked
trial -> archived
active -> archived
paused -> archived
blocked -> archived
```

Rules:
- `trial` may send only if future limits and guard checks allow it.
- `active` may send only if campaign/contact/send checks pass.
- `paused`, `blocked`, and `archived` cannot send.
- `archived` is terminal for V1 unless explicitly changed later.

## Campaign Lifecycle

States:

```txt
draft -> ready -> running -> completed
ready -> paused -> ready
running -> paused -> running
draft -> blocked
ready -> blocked
running -> blocked
running -> failed
paused -> blocked
```

Rules:
- `draft` cannot send until ready/authorized.
- `ready` can be evaluated for authorization.
- `running` can continue only while guard checks pass.
- `paused`, `blocked`, `completed`, and `failed` cannot send.

## Contact Sendability

States:

```txt
pending -> sendable
pending -> error
sendable -> suppressed
sendable -> bounced
sendable -> unsubscribed
sendable -> blacklisted
error -> pending
```

Rules:
- `sendable` is the only normal sendable state.
- `unsubscribed`, `blacklisted`, `bounced`, and `suppressed` cannot send.
- `pending` cannot send until validated.
- `error` cannot send until resolved.

## Send Authorization

```txt
SendDecision:
authorized
blocked
dry_run
```

Rules:

```txt
If client is paused, blocked, or archived -> no sending.
If campaign is paused, blocked, completed, or failed -> no sending.
If contact is unsubscribed, blacklisted, bounced, or suppressed -> no sending.
If EMAIL_SENDING_ENABLED is not exactly "true" -> dry_run or blocked depending on context.
```

Milestone 0 default is fail-closed. The skeleton does not send email.
