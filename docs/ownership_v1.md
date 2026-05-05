# Ownership V1

Source of truth: `project_handoff_v1.md`.

## Gate 0 - No Split Yet

Before parallel work, these must exist:

```txt
structural contracts
API contracts
data model
states
repo skeleton
audit script
frontend mock API
backend endpoint stubs
```

No one should start divergent backend/frontend implementation before Gate 0 is complete.

## Gate 1 - Safe Split

After Milestone 0/0.5:

```txt
Person A -> Backend / DB / Guard / listmonk adapter
Person B -> Frontend / UI / MJML / Mailpit / components
```

Person A owns:
- `backend/`
- `db/`
- backend-owned listmonk adapter code
- Deliverability Guard implementation
- backend tests

Person B owns:
- `frontend/`
- `templates/`
- `mailpit/`
- UI components and mock API evolution

Shared files requiring coordination:
- `docs/`
- `docker-compose.yml`
- `docker-compose.dev.yml`
- `.env.example`
- `Makefile`
- `README.md`
- `scripts/`

## Branch Strategy

```txt
main = stable
develop = integration
feature/backend-core
feature/frontend-v1
feature/listmonk-adapter
feature/templates-mailpit
feature/audit-tests
```

At the beginning, only these are required:

```txt
feature/backend-core
feature/frontend-v1
```

## Merge Rule

```txt
Merge every 1-2 days only if:
make audit
make smoke
docker compose config
pass.
```

Codex must not change contracts during merge unless explicitly instructed.
