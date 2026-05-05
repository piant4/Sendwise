# Validate State And Persistence

## Purpose

Validate consistency between runtime state, Business PostgreSQL, listmonk mappings, provider events, suppression, and dashboard/API output.

## When To Use

Use when Sendwise data or state appears inconsistent, including:

- dashboard data does not match API or database state
- campaign status is wrong
- contact status or sendability is wrong
- suppression is ignored
- provider events are missing or mapped incorrectly
- blocked sends do not explain Guard decisions
- API usage is not recorded or is recorded under the wrong client
- listmonk mappings do not resolve correctly

## Scope To Cover

- Business PostgreSQL
- `client_id` isolation
- campaign status
- contact status
- `suppression_list`
- `provider_events`
- `blocked_sends`
- `api_usage`
- `listmonk_mappings`
- frontend dashboard output

## Hard Rules

- Repository remains persistence boundary.
- Do not put domain logic into persistence.
- Distinguish write issue, read issue, query issue, mapping issue, and state transition issue.
- Do not assume record exists means lookup is correct.
- Verify `client_id` scope.
- Business PostgreSQL remains the source of truth.
- listmonk mappings do not transfer ownership or business truth to listmonk.
- UI displays backend output and must not enforce source-of-truth policy.

## Procedure

1. State the expected business state from the V1 contracts.
2. Identify the entity and `client_id` scope being validated.
3. Verify the write path that should create or update the row.
4. Verify the read path that should return the row.
5. Verify repository queries include the correct `client_id` filter or relationship.
6. Verify state transition rules from `docs/states_v1.md`.
7. Verify listmonk mappings are client-scoped and point to the expected technical entity.
8. Verify provider events, blocked sends, suppression, and usage records map to the same business entity.
9. Compare backend API output with frontend dashboard output.
10. Identify the first persistence or state divergence.

## Classification

Classify the issue as exactly one primary type:

- write issue
- read issue
- query issue
- mapping issue
- state transition issue
- dashboard rendering issue
- API response shaping issue

## Output Format

```txt
Entity and client_id scope:
Expected state:
Write path checked:
Read path checked:
Repository/query evidence:
Mapping evidence:
API/dashboard comparison:
First divergence:
Issue classification:
Fix status: not attempted
Next required skill: extract-root-cause
```

## Stop Conditions

Stop when:

- the first state or persistence divergence is found
- the necessary database, API, or dashboard evidence is unavailable
- `client_id` scope cannot be verified
- continuing would require modifying repository, service, schema, or frontend code
