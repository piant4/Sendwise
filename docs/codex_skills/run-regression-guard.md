# Run Regression Guard

## Purpose

Verify that a code change did not introduce behavioral or architectural regressions.

## When To Use

Use after any code, config, schema, Docker, script, or behavior change. For docs-only changes, run the repository audit and any smoke checks that are feasible.

## Default Checks

Run when possible:

```bash
bash scripts/audit.sh
bash scripts/smoke_test.sh
docker compose config
```

Backend checks when relevant:

```bash
PYTHONPATH=backend pytest backend/tests
```

Frontend checks when relevant:

```bash
cd frontend && npm run lint
cd frontend && npm run build
```

## Invariants

- backend remains gatekeeper
- UI does not call listmonk
- PostgreSQL not publicly exposed
- Mailpit dev/staging only
- `EMAIL_SENDING_ENABLED` fail-closed
- `client_id` isolation preserved
- n8n not restored as core
- contracts not changed silently
- listmonk remains engine-only
- Business PostgreSQL remains source of truth
- no component bypasses the Deliverability Guard

## Procedure

1. List changed files and classify them as docs, backend, frontend, db, Docker, scripts, or config.
2. Run the default checks.
3. Run backend checks if backend behavior, database access, Guard logic, or API contracts changed.
4. Run frontend checks if frontend pages, components, API clients, styles, or build config changed.
5. Inspect failures and map each failure to the changed files or known environment limits.
6. Do not claim success for checks that were skipped or unavailable.

## Output Format

```txt
Checks executed:
Checks passed:
Checks failed:
Checks not executed and reason:
Invariant review:
Residual risk:
```

## Stop Conditions

Stop and report failure when:

- audit detects a forbidden boundary
- Compose config is invalid
- backend or frontend checks fail due to the change
- Docker or required tools are unavailable and the check cannot run
