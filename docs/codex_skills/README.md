# Codex Skills

These files define reusable operating skills for future Codex work on Sendwise. They are not product specifications and they do not implement application behavior. They tell Codex how to audit, isolate, patch, verify, and document work without drifting from the V1 contracts.

The current contracts remain the source of truth:

- `docs/structural_contracts_v1.md`
- `docs/api_contracts_v1.md`
- `docs/data_model_v1.md`
- `docs/states_v1.md`
- `docs/ownership_v1.md`
- `docs/audit_checklist_v1.md`
- `docs/architecture_v1.md`
- `project_handoff_v1.md`, if present

If older notes conflict with the current V1 contracts, follow the V1 contracts. These docs-only skills must not change backend, frontend, database, Docker, listmonk, Mailpit, or product behavior.

## Mandatory Use

Future prompts must select the relevant skill when the task matches its scope. More than one skill may apply. Bug work must not skip audit and root-cause isolation. Feature work must check anti-monolith boundaries before implementation. Any code change must run the regression guard.

## Decision Table

| Task signal | Use skill |
|---|---|
| Bug or unclear behavior | `audit-runtime-flow` |
| Possible monolith/hotspot | `check-anti-monolith` |
| Audit completed, need exact cause | `extract-root-cause` |
| Confirmed root cause | `generate-minimal-fix` |
| After any code change | `run-regression-guard` |
| After behavior or milestone changes | `update-docs-after-fix` |
| VPS/Docker/install issue | `audit-installer-vps` |
| DB/state/persistence mismatch | `validate-state-and-persistence` |

## How To Choose

Start from the user request and the first affected boundary:

- Runtime behavior crossing UI, backend, repository, Guard, listmonk, or database: use `audit-runtime-flow.md`.
- A proposed change adds responsibilities to a file or layer: use `check-anti-monolith.md`.
- Evidence has been gathered and the exact cause must be named: use `extract-root-cause.md`.
- A fix is allowed only after the root cause is confirmed: use `generate-minimal-fix.md`.
- Verification is needed after any code, config, schema, or behavior change: use `run-regression-guard.md`.
- Documentation must reflect a verified change or milestone: use `update-docs-after-fix.md`.
- Host, container, Compose, env, ports, mounts, or reverse proxy behavior is involved: use `audit-installer-vps.md`.
- Business PostgreSQL, `client_id`, state transitions, listmonk mappings, provider events, or dashboard/API output diverge: use `validate-state-and-persistence.md`.

## Non-Goals

These skills do not authorize application code changes by themselves. They do not change contracts, add features, implement real email sending, implement real AI generation, add real auth, restore n8n as core, or move business logic into UI or listmonk.
