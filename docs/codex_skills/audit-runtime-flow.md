# Audit Runtime Flow

## Purpose

Audit a Sendwise runtime flow and locate the first exact break point without fixing prematurely.

Typical flow:

```txt
UI -> FastAPI -> service -> guard/repository/integration -> Business PostgreSQL/listmonk -> output
```

## When To Use

Use this skill when behavior is wrong, unclear, or crossing more than one layer, including:

- dashboard data is incorrect
- an API endpoint returns unexpected output
- a campaign state changes incorrectly
- a send is authorized, blocked, or dry-run unexpectedly
- provider/listmonk events do not appear in business state
- frontend output does not match backend or database state

## Required Inputs

- User-reported behavior and expected behavior.
- Exact UI route, API endpoint, command, or container involved when known.
- Relevant contract files from `docs/*_v1.md`.
- Logs, request/response payloads, database rows, or test output when available.

## Hard Rules

- Do not write fixes in this phase.
- Do not refactor.
- Do not assume root cause without evidence.
- Respect Sendwise contracts as source of truth.
- Identify the first divergence point, not every possible issue.
- Backend remains the gatekeeper.
- UI must not call listmonk or Business PostgreSQL.
- listmonk remains engine-only and not the business source of truth.
- No component may bypass the Deliverability Guard.

## Procedure

1. State the intended contract for the flow using the V1 docs.
2. List each hop in order, starting with the trigger and ending with observed output.
3. For each hop, verify actual input, actual output, and owner layer.
4. Stop at the first hop where actual behavior diverges from the contract or prior hop.
5. Record the evidence for that divergence.
6. Do not continue into speculative fixes.

Sendwise flow examples:

```txt
UI page -> frontend API client -> FastAPI router -> service -> repository -> Business PostgreSQL -> response -> dashboard
```

```txt
FastAPI router -> CampaignService -> DeliverabilityGuard -> listmonk adapter -> listmonk -> Mailpit/dev SMTP or production SMTP provider
```

```txt
listmonk/provider event -> events endpoint -> service -> repository -> provider_events/email_logs/blocked_sends -> dashboard/API output
```

## Output Format

```txt
Flow audited:
Expected contract:
Observed behavior:
Verified hops:
First divergence point:
Evidence:
Likely impacted files or layers:
Fix status: not attempted
Next required skill: extract-root-cause
```

## Stop Conditions

Stop when one of these is true:

- the first contract divergence is identified with evidence
- the issue cannot be reproduced with available inputs
- required logs, payloads, env, or runtime access are missing
- continuing would require modifying application code
