# Codex Prompt Engine V1

This prompt engine defines how future Codex prompts must select and apply Sendwise operational skills.

Before work begins, every future Codex prompt must select the relevant skill or skills from:

```txt
docs/codex_skills/
```

The current V1 contracts remain the source of truth:

- `docs/structural_contracts_v1.md`
- `docs/api_contracts_v1.md`
- `docs/data_model_v1.md`
- `docs/states_v1.md`
- `docs/ownership_v1.md`
- `docs/audit_checklist_v1.md`
- `docs/architecture_v1.md`
- `project_handoff_v1.md`, if present

Do not change contracts unless explicitly requested. Do not implement future milestones unless explicitly requested. If older notes conflict with current V1 contracts, follow the current V1 contracts.

## Reusable Prompt Header

```txt
Before starting, select the relevant Codex skill from docs/codex_skills/.
Follow that skill's procedure.
Do not skip audit/root-cause steps for bugs.
Do not create monoliths.
Do not implement future milestones.
Do not change contracts unless explicitly requested.
```

## Bug Task Pipeline

Bug tasks must use:

1. `docs/codex_skills/audit-runtime-flow.md`
2. `docs/codex_skills/extract-root-cause.md`
3. `docs/codex_skills/generate-minimal-fix.md`
4. `docs/codex_skills/run-regression-guard.md`
5. `docs/codex_skills/update-docs-after-fix.md` if behavior or docs changed

Codex must not jump directly from a symptom to a patch.

## Feature Task Pipeline

Feature tasks must use:

1. `docs/codex_skills/check-anti-monolith.md`
2. implementation prompt
3. `docs/codex_skills/run-regression-guard.md`
4. `docs/codex_skills/update-docs-after-fix.md` if behavior or docs changed

Feature prompts must stay inside the requested milestone and must preserve layer ownership.

## VPS And Install Task Pipeline

VPS/install tasks must use:

1. `docs/codex_skills/audit-installer-vps.md`
2. `docs/codex_skills/extract-root-cause.md`
3. `docs/codex_skills/generate-minimal-fix.md`
4. `docs/codex_skills/run-regression-guard.md`

Host/container boundaries must be proven before any install, Compose, mount, env, or reverse proxy change.

## DB, State, And Dashboard Mismatch Pipeline

DB/state/dashboard mismatch tasks must use:

1. `docs/codex_skills/validate-state-and-persistence.md`
2. `docs/codex_skills/extract-root-cause.md`
3. `docs/codex_skills/generate-minimal-fix.md`
4. `docs/codex_skills/run-regression-guard.md`

If the mismatch crosses UI, API, service, repository, Guard, or listmonk, also use `docs/codex_skills/audit-runtime-flow.md`.

## Global Guardrails

- Backend remains the gatekeeper.
- UI calls FastAPI only.
- UI does not call listmonk or Business PostgreSQL.
- listmonk remains engine-only.
- Business PostgreSQL remains business source of truth.
- No component bypasses the Deliverability Guard.
- `EMAIL_SENDING_ENABLED` remains fail-closed.
- `client_id` isolation is preserved.
- Mailpit remains dev/staging only.
- PostgreSQL is not publicly exposed.
- n8n remains optional future integration only.
- No real email sending, real AI generation, real auth, dashboard expansion, Celery, Keycloak, Metabase, Postal, Rspamd, or Budibase unless explicitly requested by an approved milestone.
