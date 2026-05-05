# Extract Root Cause

## Purpose

Reduce an audit into one clear, verifiable root cause before any fix is generated.

## When To Use

Use after `audit-runtime-flow.md`, `audit-installer-vps.md`, or `validate-state-and-persistence.md` has produced evidence. Do not use this as a substitute for auditing.

## Root Cause Categories

Classify the primary cause into exactly one category:

- frontend rendering
- frontend API client
- backend router
- backend service
- repository/query
- Deliverability Guard
- listmonk adapter
- Business DB schema/state
- Docker/VPS config
- Mailpit/dev SMTP

## Hard Rules

- One primary root cause only.
- Distinguish symptom, secondary effect, and root cause.
- No redesign proposals.
- No vague alternatives.
- No fix until evidence supports the cause.
- Do not blame a downstream layer when the first divergence is upstream.
- If evidence is insufficient, say so and request the missing verification.

## Procedure

1. Restate the expected contract.
2. Restate the first observed divergence from the audit.
3. Separate symptom from secondary effects.
4. Name the single primary root cause.
5. Cite the evidence that makes the cause verifiable.
6. Identify the smallest likely fix boundary without designing the fix.

## Output Format

```txt
Symptom:
Expected contract:
First divergence:
Secondary effects:
Primary root cause:
Category:
Evidence:
Minimal fix boundary:
Confidence:
Next required skill: generate-minimal-fix
```

## Stop Conditions

Stop without naming a root cause when:

- no first divergence was identified
- evidence is only speculative
- multiple causes remain equally plausible
- the required runtime, logs, database rows, or config are unavailable
