# Ownership V1

Source of truth: `project_handoff_v1.md`.

## Operational Boundary

Current architecture rules:

```txt
backend is gatekeeper
listmonk is engine only
n8n is not core V1
```

Contracts cannot be changed during feature branch work unless both developers approve.

## Parallel Branches

```txt
Person A -> feature/backend-core
Person B -> feature/frontend-v1
```

## Person A - Backend Core

Owned folders:
- `backend/`
- `db/`

Allowed files:
- `backend/app/api/`
- `backend/app/schemas/`
- `backend/app/services/`
- `backend/app/repositories/`
- `backend/app/guard/`
- `backend/app/integrations/listmonk/`
- `backend/tests/`
- `db/`

Forbidden files without explicit review:
- `frontend/`
- `templates/`
- `mailpit/`
- `listmonk/`
- `docker-compose.yml`
- `docker-compose.dev.yml`
- `.env.example`
- `Makefile`

Audit rule:
- Backend work must prove FastAPI remains the gatekeeper.
- Backend work must preserve `client_id` isolation.
- Backend work must not make listmonk the business source of truth.

## Person B - Frontend V1

Owned folders:
- `frontend/`
- `templates/`
- `mailpit/`

Allowed files:
- `frontend/app/`
- `frontend/components/`
- `frontend/lib/`
- `frontend/types/`
- `templates/`
- `mailpit/`

Forbidden files without explicit review:
- `backend/app/services/`
- `backend/app/repositories/`
- `backend/app/guard/`
- `backend/app/integrations/listmonk/`
- `db/`
- `listmonk/`
- `docker-compose.yml`
- `docker-compose.dev.yml`
- `.env.example`
- `Makefile`

Audit rule:
- Frontend work must call FastAPI only.
- Frontend work must not call PostgreSQL or listmonk directly.
- Frontend work must not duplicate backend business, auth, or send authorization logic.

## Shared Files Requiring Review

- `docs/`
- `scripts/`
- `README.md`
- `docker-compose.yml`
- `docker-compose.dev.yml`
- `.env.example`
- `Makefile`
- API contracts and shared frontend/backend schema concepts

## Merge Rule

Merge every 1-2 days only if:

```txt
bash scripts/audit.sh
bash scripts/smoke_test.sh
docker compose config
backend and frontend checks relevant to the branch
pass.
```

Contract, schema, API, or ownership changes require review from both Person A and Person B before merge.
