# Update Docs After Fix

## Purpose

Update Sendwise documentation after verified behavior changes, bug fixes, boundary changes, or milestone closure.

## When To Use

Use after a fix or milestone when verified behavior affects contracts, architecture notes, audit checklists, README guidance, operational instructions, or known limits.

## Hard Rules

- Docs reflect verified behavior only.
- Do not document planned features as implemented.
- Distinguish verified state, known limits, out of scope, and residual risk.
- Update `docs/audit_log.md` when appropriate.
- Avoid marketing wording.
- Do not silently change V1 contracts.
- Do not use docs updates to justify application changes outside scope.

## Procedure

1. Identify what behavior changed and how it was verified.
2. Identify which docs are allowed to change for the task.
3. Update only the docs that must reflect verified behavior or milestone state.
4. Preserve clear labels for `stub`, `planned`, and `future` behavior.
5. Add an audit log entry when a milestone, fix, or operational boundary changed.
6. Record tests executed, tests not executed, residual risk, and scope confirmation.

## Documentation Categories

Use these labels explicitly when helpful:

- Verified state: behavior observed through tests, audits, logs, or runtime checks.
- Known limits: current limits that remain true.
- Out of scope: requested or related features not implemented.
- Residual risk: remaining risk after verification.

## Output Format

```txt
Docs updated:
Verified behavior documented:
Known limits:
Out of scope:
Audit log updated: yes | no
Tests referenced:
```

## Stop Conditions

Stop before editing docs when:

- behavior was not verified
- the docs change would modify a contract without explicit instruction
- the docs change would claim future functionality is already implemented
- the allowed scope does not include the required file
