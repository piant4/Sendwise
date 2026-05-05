# Generate Minimal Fix

## Purpose

Generate a minimal, conservative patch only after the root cause is confirmed.

## When To Use

Use only after `extract-root-cause.md` has produced one verified primary root cause with a clear fix boundary.

## Hard Sendwise Rules

- No refactor.
- No opportunistic cleanup.
- No broad service creation.
- Do not move logic across layers unless required to fix the root cause.
- Backend remains gatekeeper.
- UI must not call listmonk.
- `EMAIL_SENDING_ENABLED` remains fail-closed.
- Preserve `client_id` isolation.
- Add or update targeted tests where relevant.
- No real email sending unless explicitly approved by contract change.
- No real AI generation unless explicitly approved by contract change.
- Do not restore n8n as core.
- Do not silently change V1 contracts.

## Procedure

1. Confirm the root cause, category, and minimal fix boundary.
2. Identify the smallest file set needed to correct only that cause.
3. Check anti-monolith boundaries before editing if code structure changes.
4. Write the smallest patch that corrects the cause.
5. Add or update targeted tests when behavior is executable and relevant.
6. Do not include adjacent improvements, cleanup, formatting churn, or future milestone work.
7. Hand off immediately to `run-regression-guard.md`.

## Minimality Checklist

- The patch changes only files needed for the confirmed cause.
- The patch preserves current layer ownership.
- The patch does not create a new utility dumping ground.
- The patch does not broaden API behavior beyond the reported issue.
- The patch keeps listmonk as engine-only.
- The patch keeps Business PostgreSQL as source of truth.
- The patch keeps frontend as display and backend API caller only.

## Output Format

```txt
Confirmed root cause:
Files changed:
Why each file was necessary:
Tests added or updated:
Out of scope:
Next required skill: run-regression-guard
```

## Stop Conditions

Stop before editing when:

- root cause is not confirmed
- the requested fix requires a contract change not explicitly approved
- the minimal fix would require changing forbidden layers
- the patch would implement future milestones or unrelated features
