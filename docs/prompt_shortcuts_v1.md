# Prompt Shortcuts V1

Use `SW_MODE` in every Sendwise prompt, then add one or more task aliases such as `SW_FEATURE`, `SW_BUG`, or `SW_DOCS`. These shortcuts compress repeated prompt boilerplate; they do not override the V1 contracts, ownership rules, or allowed file scope for a task.

## Aliases

### `SW_MODE`

- Docs to read: `docs/codex_prompt_engine_v1.md`, `docs/structural_contracts_v1.md`, `docs/api_contracts_v1.md`, `docs/data_model_v1.md`, `docs/states_v1.md`, `docs/ownership_v1.md`, `docs/audit_checklist_v1.md`, `docs/architecture_v1.md`
- Skills to apply: select the relevant workflow from `docs/codex_skills/README.md` before work starts; do not skip mandatory pipeline skills
- Default forbidden actions: changing contracts without explicit instruction; implementing future milestones; bypassing the backend gatekeeper; making listmonk the business source of truth; enabling real sending, real AI, or real auth outside approved scope
- Default tests: `bash scripts/audit.sh`, `bash scripts/smoke_test.sh`, `docker compose config`, `git diff --check`
- Output format: `Scope | Skills selected | Files changed | Tests | Risks`

### `SW_FEATURE`

- Docs to read: `docs/codex_prompt_engine_v1.md`, `docs/structural_contracts_v1.md`, `docs/api_contracts_v1.md`, `docs/data_model_v1.md`, `docs/states_v1.md`, `docs/ownership_v1.md`, `docs/audit_checklist_v1.md`, `docs/architecture_v1.md`
- Skills to apply: `docs/codex_skills/check-anti-monolith.md`, `docs/codex_skills/run-regression-guard.md`, `docs/codex_skills/update-docs-after-fix.md` when verified behavior or docs change
- Default forbidden actions: future-milestone implementation; mixed-responsibility files; cross-layer shortcuts; silent contract changes; unrequested refactors outside the scoped feature
- Default tests: core `SW_MODE` tests plus branch-relevant backend or frontend checks
- Output format: `Feature scope | Anti-monolith result | Files changed | Tests | Risks`

### `SW_BUG`

- Docs to read: `docs/codex_prompt_engine_v1.md`, `docs/structural_contracts_v1.md`, `docs/api_contracts_v1.md`, `docs/data_model_v1.md`, `docs/states_v1.md`, `docs/ownership_v1.md`, `docs/audit_checklist_v1.md`, `docs/architecture_v1.md`
- Skills to apply: `docs/codex_skills/audit-runtime-flow.md`, `docs/codex_skills/extract-root-cause.md`, `docs/codex_skills/generate-minimal-fix.md`, `docs/codex_skills/run-regression-guard.md`, `docs/codex_skills/update-docs-after-fix.md` when behavior or docs change
- Default forbidden actions: jumping from symptom to patch; changing multiple layers without proving first divergence; silent contract edits; speculative fixes without evidence
- Default tests: core `SW_MODE` tests plus the smallest relevant backend/frontend/runtime checks that prove the fix
- Output format: `Expected contract | First divergence | Root cause | Fix | Tests | Risks`

### `SW_BACKEND`

- Docs to read: `docs/codex_prompt_engine_v1.md`, `docs/structural_contracts_v1.md`, `docs/api_contracts_v1.md`, `docs/data_model_v1.md`, `docs/states_v1.md`, `docs/ownership_v1.md`, `docs/audit_checklist_v1.md`, `docs/architecture_v1.md`
- Skills to apply: `docs/codex_skills/check-anti-monolith.md` for backend features, `docs/codex_skills/audit-runtime-flow.md` and `docs/codex_skills/extract-root-cause.md` for backend bugs, `docs/codex_skills/generate-minimal-fix.md`, `docs/codex_skills/run-regression-guard.md`, `docs/codex_skills/update-docs-after-fix.md` when needed
- Default forbidden actions: frontend edits without explicit approval; direct SMTP/provider sending as default path; bypassing Deliverability Guard; weakening `client_id` isolation; treating listmonk as business truth
- Default tests: `PYTHONPATH=backend python3 -m pytest backend/tests` when available, plus core `SW_MODE` tests
- Output format: `Backend scope | Gatekeeper check | API/state impact | Tests | Risks`

### `SW_FRONTEND`

- Docs to read: `docs/codex_prompt_engine_v1.md`, `docs/structural_contracts_v1.md`, `docs/api_contracts_v1.md`, `docs/data_model_v1.md`, `docs/states_v1.md`, `docs/ownership_v1.md`, `docs/audit_checklist_v1.md`, `docs/architecture_v1.md`, `docs/frontend_design_reference_v1.md`
- Skills to apply: `docs/codex_skills/check-anti-monolith.md` for features, `docs/codex_skills/audit-runtime-flow.md` and `docs/codex_skills/extract-root-cause.md` for bugs, `docs/codex_skills/run-regression-guard.md`, `docs/codex_skills/update-docs-after-fix.md` when needed
- Default forbidden actions: backend or DB edits without explicit approval; direct calls to listmonk, PostgreSQL, SMTP, or env-backed database URLs; duplicating backend business/auth/send logic; adding `fetch(` outside `frontend/lib/api.ts`
- Default tests: `cd frontend && npm run build`, `cd frontend && npm run lint` when configured, plus core `SW_MODE` tests
- Output format: `Frontend scope | UI/API boundary check | Files changed | Tests | Risks`

### `SW_INTEGRATION`

- Docs to read: `docs/codex_prompt_engine_v1.md`, `docs/structural_contracts_v1.md`, `docs/api_contracts_v1.md`, `docs/data_model_v1.md`, `docs/states_v1.md`, `docs/ownership_v1.md`, `docs/audit_checklist_v1.md`, `docs/architecture_v1.md`, `docs/frontend_design_reference_v1.md`
- Skills to apply: `docs/codex_skills/audit-runtime-flow.md`, `docs/codex_skills/validate-state-and-persistence.md` when data/state is involved, `docs/codex_skills/extract-root-cause.md`, `docs/codex_skills/generate-minimal-fix.md`, `docs/codex_skills/run-regression-guard.md`, `docs/codex_skills/update-docs-after-fix.md` when needed
- Default forbidden actions: UI to listmonk/DB shortcuts; backend-to-provider shortcuts that bypass the documented flow; trusting mock/frontend state over backend contracts; skipping `client_id`, state, or ownership checks
- Default tests: core `SW_MODE` tests, `cd frontend && npm run build`, `PYTHONPATH=backend python3 -m pytest backend/tests` when available, and boundary grep checks for `fetch(` plus forbidden direct integration references
- Output format: `Flow audited | Boundary mismatch | Fix or doc update | Tests | Risks`

### `SW_VPS`

- Docs to read: `docs/codex_prompt_engine_v1.md`, `docs/structural_contracts_v1.md`, `docs/ownership_v1.md`, `docs/audit_checklist_v1.md`, `docs/architecture_v1.md`, `README.md`
- Skills to apply: `docs/codex_skills/audit-installer-vps.md`, `docs/codex_skills/extract-root-cause.md`, `docs/codex_skills/generate-minimal-fix.md`, `docs/codex_skills/run-regression-guard.md`
- Default forbidden actions: changing Compose, mounts, env, or reverse proxy settings before proving the failing boundary; exposing PostgreSQL publicly; using Mailpit in production; enabling real sends as a shortcut to “fix” delivery
- Default tests: `docker compose config`, `bash scripts/smoke_test.sh`, `bash scripts/audit.sh`, relevant health/install checks, `git diff --check`
- Output format: `Host/container boundary | First failing hop | Change made | Tests | Risks`

### `SW_DOCS`

- Docs to read: `docs/codex_prompt_engine_v1.md`, `docs/codex_skills/update-docs-after-fix.md`, `docs/audit_log.md`, plus the affected V1 contract or reference docs
- Skills to apply: `docs/codex_skills/update-docs-after-fix.md`; if the docs are derived from a bug, feature, integration, or VPS task, follow the upstream skill evidence first
- Default forbidden actions: modifying application code; documenting unverified behavior as implemented; silent contract changes; using docs edits to expand scope
- Default tests: `bash scripts/audit.sh`, `bash scripts/smoke_test.sh`, `docker compose config`, `git diff --check`
- Output format: `Docs updated | Verified state | Known limits | Tests referenced | Risks`

### `SW_RELEASE`

- Docs to read: `docs/codex_prompt_engine_v1.md`, `docs/structural_contracts_v1.md`, `docs/api_contracts_v1.md`, `docs/data_model_v1.md`, `docs/states_v1.md`, `docs/ownership_v1.md`, `docs/audit_checklist_v1.md`, `docs/architecture_v1.md`, `docs/audit_log.md`, `README.md`
- Skills to apply: `docs/codex_skills/run-regression-guard.md`, `docs/codex_skills/update-docs-after-fix.md`; add `docs/codex_skills/audit-installer-vps.md` for deployment-path checks and `docs/codex_skills/validate-state-and-persistence.md` for state-sensitive release changes
- Default forbidden actions: claiming release-ready status without running required checks; shipping unresolved contract regressions; enabling future features or infra shortcuts to force a pass; skipping docs/audit log updates
- Default tests: core `SW_MODE` tests plus all relevant backend/frontend/build/runtime checks for the release scope
- Output format: `Release scope | Checks passed | Blockers | Merge/push recommendation | Risks`

## Compact Prompt Examples

### Frontend task

```txt
SW_MODE SW_FRONTEND SW_FEATURE
Goal: update /client overview copy and layout only.
Allowed scope: frontend/app/client/page.tsx, docs/audit_log.md if needed.
Forbidden: backend/, db/, docker-compose*.yml, fetch outside frontend/lib/api.ts.
```

### Backend task

```txt
SW_MODE SW_BACKEND SW_FEATURE
Goal: add a typed stub field to a backend response without changing frontend code.
Allowed scope: backend/app/api/, backend/app/schemas/, backend/tests/, docs/audit_log.md if needed.
Forbidden: frontend/, docker-compose*.yml, .env.example, Makefile.
```

### Bug audit

```txt
SW_MODE SW_BUG SW_INTEGRATION
Goal: audit why client campaign status differs between backend contract and frontend display.
Do not patch before the first contract divergence and root cause are proven.
```

### Integration audit

```txt
SW_MODE SW_INTEGRATION SW_RELEASE
Goal: verify backend/frontend boundary after merge and report any contract, type, or route mismatch.
No feature expansion; document only verified findings and required follow-ups.
```

### Docs update

```txt
SW_MODE SW_DOCS
Goal: update docs only for verified behavior already present in the repo.
Allowed scope: docs/.
Forbidden: backend/, frontend/, db/, docker-compose*.yml, scripts/, Makefile, .env.example.
```
